"""Platform-wide listing endpoints used by the admin surfaces and by the
signup/apply flows (colleges). Kept separate from the per-resource
routers because these are cross-cutting reads rather than operations on
one entity.
"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import is_super_admin, require_super_admin
from app.core import redis_client
from app.core.config import settings
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import SuperAdminCreate, SuperAdminOtpVerify

router = APIRouter(tags=["platform"])
logger = logging.getLogger(__name__)


@router.get("/colleges")
def list_colleges():
    """Public: needed by onboarding and the organizer application form."""
    supabase = get_supabase()
    return supabase.table("colleges").select("*").order("name").execute().data


@router.get("/org-groups")
def list_org_groups(limit: int = Query(100, le=500)):
    """Directory of organizers, ordered by score, with current ban state.

    Ban state is joined in here because the admin organizer table needs
    it per row, and querying it per organizer would be an N+1.
    """
    supabase = get_supabase()
    orgs = (
        supabase.table("org_groups")
        .select("*")
        .order("score", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    if not orgs:
        return []

    bans = (
        supabase.table("org_bans")
        .select("org_group_id, stage, is_active, created_at")
        .in_("org_group_id", [o["id"] for o in orgs])
        .eq("is_active", True)
        .execute()
        .data
    )
    ban_by_org = {}
    for b in bans:
        ban_by_org.setdefault(b["org_group_id"], b)

    return [
        {
            **o,
            # Name these the way the client reads them, so the admin table
            # does not have to know the column names.
            "score_points": o.get("score") or 0,
            "successful_events_count": o.get("successful_event_count") or 0,
            "banned": o["id"] in ban_by_org,
            "ban_stage": ban_by_org.get(o["id"], {}).get("stage"),
        }
        for o in orgs
    ]


@router.get("/support-tickets")
def list_all_support_tickets(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    tickets = (
        supabase.table("support_tickets")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )

    user_ids = list({t["raised_by"] for t in tickets if t.get("raised_by")})
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, email")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    return [{**t, "raised_by_user": users_by_id.get(t.get("raised_by"))} for t in tickets]


@router.get("/audit-log")
def list_audit_log(
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user),
):
    require_super_admin(current_user)
    supabase = get_supabase()
    return (
        supabase.table("audit_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


@router.get("/scoring-config")
def list_scoring_config(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    return supabase.table("scoring_config").select("*").order("key").execute().data


# ── user lookup + admin management ────────────────────────────────

@router.get("/users/search")
def search_users(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_user)):
    """Find a user by email or name so an admin can be granted a role.
    Super-admin only: this exposes other people's email addresses."""
    require_super_admin(current_user)
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("id, email, full_name, avatar_url, customer_level, college_id")
        .or_(f"email.ilike.%{q}%,full_name.ilike.%{q}%")
        .limit(20)
        .execute()
    )
    return result.data


@router.get("/super-admins")
def list_super_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("super_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    granted = [{**r, "user": users_by_id.get(r["user_id"])} for r in rows]

    # Surface the env-var bootstrap admins too, so the list reflects who
    # actually has access rather than only the DB-granted subset.
    bootstrap = [e.strip() for e in settings.super_admin_emails.split(",") if e.strip()]
    return {"granted": granted, "bootstrap_emails": bootstrap}


@router.post("/super-admins")
def add_super_admin(body: SuperAdminCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()

    target = supabase.table("users").select("id, email").eq("id", body.user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    existing = supabase.table("super_admins").select("id").eq("user_id", body.user_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="That user is already a super admin")

    inserted = (
        supabase.table("super_admins")
        .insert({"user_id": body.user_id, "granted_by": current_user["id"]})
        .execute()
    )
    return {**inserted.data[0], "user": target.data[0]}


@router.delete("/super-admins/{user_id}")
def remove_super_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    if user_id == current_user["id"]:
        # Losing your own access mid-session is never the intent, and
        # could leave the platform with no reachable admin.
        raise HTTPException(status_code=409, detail="You cannot remove your own super admin access")

    supabase = get_supabase()
    supabase.table("super_admins").delete().eq("user_id", user_id).execute()
    return {"removed": user_id}


@router.get("/college-admins/all")
def list_all_college_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("college_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    college_ids = [r["college_id"] for r in rows if r.get("college_id")]

    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    colleges_by_id = {}
    if college_ids:
        cols = supabase.table("colleges").select("id, name").in_("id", college_ids).execute()
        colleges_by_id = {c["id"]: c for c in cols.data}

    return [
        {**r, "user": users_by_id.get(r["user_id"]), "college": colleges_by_id.get(r.get("college_id"))}
        for r in rows
    ]


# ── super admin step-up verification ──────────────────────────────
#
# Being a super admin is decided by account (env allowlist or the
# super_admins table). This adds a second factor on top: a code emailed
# to the admin, required before the panel opens. It is a step-up check on
# an already-authenticated session, not a second login -- so it cannot be
# used to gain access, only to confirm the person holding the session
# also controls the mailbox.
SUPER_ADMIN_OTP_TTL = 600


@router.post("/auth/super-admin/request-code")
def request_super_admin_code(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email address.")

    code = f"{secrets.randbelow(1_000_000):06d}"

    # Send first, store second. Storing before sending leaves a valid code
    # sitting in Redis after a failed send -- accepted by the verify
    # endpoint but never delivered to anyone, which looks to the admin
    # like the code simply "doesn't work".
    try:
        send_email(
            to=email,
            subject="Festify admin access code",
            body=(
                f"Your Festify super admin access code is {code}.\n\n"
                f"It expires in {SUPER_ADMIN_OTP_TTL // 60} minutes.\n\n"
                "If you did not request this, someone may have access to your "
                "Festify session. Sign out on all devices."
            ),
        )
    except Exception as e:
        logger.exception("Could not send super admin code to %s", email)
        raise HTTPException(status_code=502, detail=str(e))

    redis_client.set_with_ttl(f"sa_otp:{current_user['id']}", code, SUPER_ADMIN_OTP_TTL)

    # Never return the code itself; only where it went.
    masked = email[0] + "***" + email[email.index("@"):] if "@" in email else "your email"
    return {"sent_to": masked, "expires_in_seconds": SUPER_ADMIN_OTP_TTL}


@router.post("/auth/super-admin/verify-code")
def verify_super_admin_code(body: SuperAdminOtpVerify, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    stored = redis_client.get(f"sa_otp:{current_user['id']}")
    if not stored:
        raise HTTPException(status_code=400, detail="No code pending, or it has expired. Request a new one.")
    if body.code != stored:
        raise HTTPException(status_code=400, detail="Incorrect code.")

    redis_client.delete(f"sa_otp:{current_user['id']}")
    # Short-lived grant: the panel re-verifies rather than trusting a
    # long-lived flag, so a stolen session is not permanently elevated.
    ticket = secrets.token_urlsafe(32)
    redis_client.set_with_ttl(f"sa_session:{current_user['id']}", ticket, 60 * 60)
    return {"verified": True, "expires_in_seconds": 3600}


@router.get("/auth/super-admin/status")
def super_admin_status(current_user: dict = Depends(get_current_user)):
    """Whether this session has passed the emailed-code check."""
    if not is_super_admin(current_user):
        return {"is_super_admin": False, "verified": False}
    return {
        "is_super_admin": True,
        "verified": bool(redis_client.get(f"sa_session:{current_user['id']}")),
    }


@router.get("/auth/my-roles")
def my_roles(current_user: dict = Depends(get_current_user)):
    """What admin surfaces the signed-in user may see. The client uses
    this to decide which nav entries to render."""
    supabase = get_supabase()
    college_rows = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .execute()
    )
    return {
        "is_super_admin": is_super_admin(current_user),
        "college_admin_of": [r["college_id"] for r in college_rows.data],
    }
