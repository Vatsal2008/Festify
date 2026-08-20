"""Super admin login -- email and a one-time code, independent of Google.

Super admins used to be ordinary Google accounts carrying a flag, which
meant the panel could only be reached by first signing in as a normal
user. This is a login of its own: enter an approved email, receive a
code, and get a session. No Google, no password, no shared secret to
leak.

Only addresses in super_admins (or the SUPER_ADMIN_EMAILS bootstrap) can
receive a code, so an unapproved address can never obtain a session no
matter what it sends.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Body, Depends, HTTPException, Request

from app.authz import require_super_admin
from app.core import redis_client
from app.core.config import settings
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/auth/super", tags=["super-auth"])
logger = logging.getLogger(__name__)

OTP_TTL = 600           # 10 minutes
SESSION_HOURS = 8
MAX_ATTEMPTS = 5        # per code, before it is burned
REQUEST_WINDOW = 600    # 10 minutes
# Generous enough to survive a few genuine failures -- a slow cold start
# or a relay hiccup makes people retry, and locking them out for that is
# punishing the wrong thing. Still far too low to be useful for probing.
MAX_REQUESTS = 10       # per email per window


def _bootstrap_emails() -> set[str]:
    return {e.strip().lower() for e in (settings.super_admin_emails or "").split(",") if e.strip()}


def is_approved_email(supabase, email: str) -> bool:
    """Whether this address may hold a super admin session."""
    email = (email or "").strip().lower()
    if not email:
        return False
    if email in _bootstrap_emails():
        return True
    rows = (
        supabase.table("super_admins")
        .select("id, is_active")
        .ilike("email", email)
        .execute()
    )
    return any(r.get("is_active", True) for r in rows.data)


def _find_or_create_user(supabase, email: str) -> dict:
    """The session still needs a users row to hang on.

    A super admin approved by email may never have signed in with Google,
    so there may be no account yet. One is created on first successful
    login rather than blocking it.
    """
    existing = supabase.table("users").select("*").ilike("email", email).execute()
    if existing.data:
        return existing.data[0]

    created = (
        supabase.table("users")
        .insert({"email": email.lower(), "full_name": email.split("@")[0]})
        .execute()
    )
    return created.data[0]


@router.post("/request-code")
def request_code(body: dict = Body(...), request: Request = None):
    email = (body.get("email") or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    # Rate limit per address, so this endpoint cannot be used to hammer
    # an approved admin's inbox or to probe addresses in bulk.
    rate_key = f"sa_login_rate:{email}"
    attempts = int(redis_client.get(rate_key) or 0)
    if attempts >= MAX_REQUESTS:
        # Say how long. A bare "try again later" after a failure the
        # person did not cause reads as the login being broken, and they
        # retry -- which is exactly what got them limited.
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many code requests for this address. "
                f"Try again in about {REQUEST_WINDOW // 60} minutes."
            ),
        )
    redis_client.set_with_ttl(rate_key, str(attempts + 1), REQUEST_WINDOW)

    supabase = get_supabase()
    approved = is_approved_email(supabase, email)

    if approved:
        code = f"{secrets.randbelow(1_000_000):06d}"
        try:
            send_email(
                to=email,
                subject="Festify admin sign-in code",
                body=(
                    f"Your Festify admin sign-in code is {code}.\n\n"
                    f"It expires in {OTP_TTL // 60} minutes.\n\n"
                    "If you did not try to sign in, ignore this email — "
                    "the code is useless without access to this inbox."
                ),
            )
        except Exception as e:
            logger.exception("Could not send super admin login code to %s", email)
            raise HTTPException(status_code=502, detail=str(e))

        # Stored only after the send succeeds: a code that never arrived
        # must not sit here waiting to be accepted.
        redis_client.set_with_ttl(f"sa_login:{email}", f"{code}:0", OTP_TTL)
    else:
        # Deliberately indistinguishable from success. Saying "not an
        # admin" would turn this form into a way to discover exactly
        # which addresses hold the highest privilege on the platform.
        logger.warning("Super admin code requested for unapproved address %s", email)

    return {
        "message": "If that address is approved, a sign-in code is on its way.",
        "expires_in_seconds": OTP_TTL,
    }


@router.post("/verify-code")
def verify_code(body: dict = Body(...)):
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    if not email or not code:
        raise HTTPException(status_code=422, detail="Email and code are both required.")

    stored = redis_client.get(f"sa_login:{email}")
    if not stored:
        raise HTTPException(status_code=400, detail="No code pending, or it has expired. Request a new one.")

    expected, attempts = stored.rsplit(":", 1)
    attempts = int(attempts)

    if attempts >= MAX_ATTEMPTS:
        redis_client.delete(f"sa_login:{email}")
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Request a new code.")

    if not secrets.compare_digest(code, expected):
        redis_client.set_with_ttl(f"sa_login:{email}", f"{expected}:{attempts + 1}", OTP_TTL)
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {MAX_ATTEMPTS - attempts - 1} attempts left.",
        )

    supabase = get_supabase()
    # Re-check approval at verification. A grant could have been revoked
    # in the ten minutes since the code was issued.
    if not is_approved_email(supabase, email):
        redis_client.delete(f"sa_login:{email}")
        raise HTTPException(status_code=403, detail="This address is no longer approved.")

    redis_client.delete(f"sa_login:{email}")
    user = _find_or_create_user(supabase, email)

    # Link the grant to the account now that one exists, and record the
    # login so a dormant or unexpected admin is visible in the list.
    supabase.table("super_admins").update(
        {"user_id": user["id"], "last_login_at": datetime.now(timezone.utc).isoformat()}
    ).ilike("email", email).execute()

    # Without this the failure is "InvalidKeyError: HMAC key must not be
    # empty" raised from deep inside the JWT library, surfaced as a bare
    # 500 -- which reads as the login being broken rather than as one
    # unset environment variable.
    if not (settings.jwt_secret or "").strip():
        logger.error("JWT_SECRET is not set; cannot issue a session token")
        raise HTTPException(
            status_code=500,
            detail="The server is missing JWT_SECRET, so it cannot issue a session. Set it in the backend environment.",
        )

    token = jwt.encode(
        {"sub": user["id"], "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    # Marks this session as having passed the emailed-code check, which
    # is what the panel's gate looks for.
    redis_client.set_with_ttl(f"sa_session:{user['id']}", secrets.token_urlsafe(32), SESSION_HOURS * 3600)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {**user, "is_super_admin": True},
        "expires_in_seconds": SESSION_HOURS * 3600,
    }


# ── managing who is approved ──────────────────────────────────────

@router.get("/admins")
def list_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("super_admins").select("*").order("created_at").execute().data
    return {
        "admins": rows,
        "bootstrap_emails": sorted(_bootstrap_emails()),
    }


@router.post("/admins")
def add_admin(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    email = (body.get("email") or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    supabase = get_supabase()
    if supabase.table("super_admins").select("id").ilike("email", email).execute().data:
        raise HTTPException(status_code=409, detail="That address is already an admin.")

    # No user account required: the point is to approve someone before
    # they have ever signed in.
    existing_user = supabase.table("users").select("id").ilike("email", email).execute()
    inserted = (
        supabase.table("super_admins")
        .insert({
            "email": email,
            "user_id": existing_user.data[0]["id"] if existing_user.data else None,
            "granted_by": current_user["id"],
            "is_active": True,
        })
        .execute()
    )
    return inserted.data[0]


@router.delete("/admins/{admin_id}")
def remove_admin(admin_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()

    row = supabase.table("super_admins").select("*").eq("id", admin_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="No such admin")

    target = row.data[0]
    if (target.get("email") or "").lower() == (current_user.get("email") or "").lower():
        # Removing your own access mid-session could leave the platform
        # with no reachable admin at all.
        raise HTTPException(status_code=409, detail="You cannot remove your own admin access.")

    remaining = supabase.table("super_admins").select("id").eq("is_active", True).execute()
    if len(remaining.data) <= 1 and not _bootstrap_emails():
        raise HTTPException(
            status_code=409,
            detail="This is the last super admin. Add another before removing this one.",
        )

    supabase.table("super_admins").delete().eq("id", admin_id).execute()
    if target.get("user_id"):
        redis_client.delete(f"sa_session:{target['user_id']}")
    return {"removed": admin_id}


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    redis_client.delete(f"sa_session:{current_user['id']}")
    return {"logged_out": True}
