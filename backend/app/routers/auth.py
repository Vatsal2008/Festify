import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwt
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import JWT_ALGORITHM
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

JWT_EXPIRY = timedelta(days=7)


class GoogleLoginRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    user: dict


@router.post("/google", response_model=TokenResponse)
def login_with_google(body: GoogleLoginRequest):
    if not settings.google_client_id:
        # Without this the audience check below is meaningless, and the
        # failure would surface as a confusing token error instead.
        raise HTTPException(
            status_code=500,
            detail="Server is missing GOOGLE_CLIENT_ID. Set it in the backend environment.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as e:
        # Wrong audience lands here too, which is the likeliest cause when
        # the frontend and backend are configured with different clients.
        logger.warning("Google token rejected: %s", e)
        raise HTTPException(status_code=401, detail=f"Invalid Google ID token: {e}")
    except GoogleAuthError as e:
        # Fetching Google's signing certs is a network call; if it fails
        # this is our problem, not a bad token.
        logger.exception("Could not verify Google token")
        raise HTTPException(status_code=502, detail=f"Could not reach Google to verify sign-in: {e}")

    google_id = claims["sub"]
    email = claims.get("email")
    full_name = claims.get("name")
    avatar_url = claims.get("picture")

    supabase = get_supabase()
    existing = (
        supabase.table("users").select("*").eq("google_id", google_id).execute()
    )

    if existing.data:
        user = existing.data[0]
    else:
        # An account may already exist under this email from a different
        # sign-in path (a seeded row, or an earlier Google client). email
        # is UNIQUE, so inserting again would blow up with a constraint
        # violation; adopt the existing row instead.
        by_email = (
            supabase.table("users").select("*").eq("email", email).execute()
            if email else None
        )
        if by_email and by_email.data:
            user = (
                supabase.table("users")
                .update({
                    "google_id": google_id,
                    "full_name": full_name or by_email.data[0].get("full_name"),
                    "avatar_url": avatar_url or by_email.data[0].get("avatar_url"),
                })
                .eq("id", by_email.data[0]["id"])
                .execute()
                .data[0]
            )
        else:
            try:
                inserted = (
                    supabase.table("users")
                    .insert(
                        {
                            "google_id": google_id,
                            "email": email,
                            "full_name": full_name,
                            "avatar_url": avatar_url,
                        }
                    )
                    .execute()
                )
            except APIError as e:
                logger.exception("Failed to create user for %s", email)
                raise HTTPException(status_code=500, detail=f"Could not create your account: {e.message}")
            user = inserted.data[0]

    payload = {
        "sub": user["id"],
        "exp": datetime.now(timezone.utc) + JWT_EXPIRY,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)

    return TokenResponse(access_token=token, user=_with_profile(user))


def _with_profile(user: dict) -> dict:
    """Attach the derived fields the client needs to route and gate UI.

    org_memberships drives the organizer dashboard nav, and is_prime /
    is_college_verified save the client from re-deriving them from
    customer_level and college_verified_at in several places.
    """
    supabase = get_supabase()
    roles = (
        supabase.table("org_member_roles")
        .select("org_group_id, role")
        .eq("user_id", user["id"])
        .execute()
    )

    org_ids = [r["org_group_id"] for r in roles.data]
    names_by_id: dict[str, str] = {}
    if org_ids:
        orgs = supabase.table("org_groups").select("id, name").in_("id", org_ids).execute()
        names_by_id = {o["id"]: o["name"] for o in orgs.data}

    # has_prime_pass was read by the profile and Prime pages from the
    # very start but never returned here, so it was permanently
    # undefined and every pass-gated benefit rendered as absent.
    from app.routers.prime_pass import get_active_pass

    active_pass = get_active_pass(supabase, user["id"])

    return {
        **user,
        "is_prime": user.get("customer_level") == "prime",
        "has_prime_pass": bool(active_pass),
        "prime_pass_expires_at": (active_pass or {}).get("expires_at"),
        "is_college_verified": bool(user.get("college_verified_at")),
        "org_memberships": [
            {
                "org_id": r["org_group_id"],
                "org_name": names_by_id.get(r["org_group_id"]),
                # The UI's ownership check looks for 'owner'; the DB's
                # equivalent top role is 'leader'.
                "role": "owner" if r["role"] == "leader" else r["role"],
            }
            for r in roles.data
        ],
    }


@router.get("/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    return _with_profile(current_user)
