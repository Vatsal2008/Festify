from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase

MANAGE_ROLES = ("leader", "manager")
SCAN_ROLES = ("leader", "manager", "ticket_checker")


def _org_roles(user_id: str, org_group_id: str) -> set[str]:
    supabase = get_supabase()
    result = (
        supabase.table("org_member_roles")
        .select("role")
        .eq("org_group_id", org_group_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {row["role"] for row in result.data}


def require_org_manager(user_id: str, org_group_id: str) -> None:
    if not _org_roles(user_id, org_group_id).intersection(MANAGE_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to manage this org group")


def require_org_scanner(user_id: str, org_group_id: str) -> None:
    if not _org_roles(user_id, org_group_id).intersection(SCAN_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to scan tickets for this org group")


def is_college_admin(user_id: str, college_id: str) -> bool:
    if not college_id:
        return False
    supabase = get_supabase()
    result = (
        supabase.table("college_admins")
        .select("id")
        .eq("user_id", user_id)
        .eq("college_id", college_id)
        .eq("status", "active")
        .execute()
    )
    return bool(result.data)


def require_college_admin(user_id: str, college_id: str) -> None:
    if not is_college_admin(user_id, college_id):
        raise HTTPException(status_code=403, detail="Not authorized as an admin for this college")


def is_super_admin(user: dict | None) -> bool:
    """True if the user is a super admin, by either route.

    Two sources, deliberately: the SUPER_ADMIN_EMAILS env allowlist is the
    bootstrap (it has to work when the table is empty, or a fresh deploy
    locks everyone out), and the super_admins table holds grants made
    from the admin panel afterwards.
    """
    if not user:
        return False

    email = user.get("email")
    allowlist = {e.strip().lower() for e in settings.super_admin_emails.split(",") if e.strip()}
    if email and email.lower() in allowlist:
        return True

    if not user.get("id"):
        return False
    result = (
        get_supabase().table("super_admins").select("id").eq("user_id", user["id"]).execute()
    )
    return bool(result.data)


def require_super_admin(current_user: dict) -> None:
    if not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Super admin access required")
