from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import CollegeAdminCreate, CollegeAdminFlagCreate

router = APIRouter(prefix="/college-admins", tags=["college-admins"])


@router.post("")
def add_college_admin(body: CollegeAdminCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    inserted = (
        supabase.table("college_admins")
        .insert(
            {
                "user_id": body.user_id,
                "college_id": body.college_id,
                "added_by": current_user["id"],
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("")
def list_college_admins(college_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    result = supabase.table("college_admins").select("*").eq("college_id", college_id).execute()
    return result.data


def _get_own_college_admin_row(supabase, user_id: str) -> dict:
    result = (
        supabase.table("college_admins")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="You are not an active college admin")
    return result.data[0]


@router.post("/escalate")
def escalate_to_super_admin(
    subject: str, details: str | None = None, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    own_row = _get_own_college_admin_row(supabase, current_user["id"])

    inserted = (
        supabase.table("admin_escalations")
        .insert({"college_admin_id": own_row["id"], "subject": subject, "details": details})
        .execute()
    )
    return inserted.data[0]


@router.post("/{college_admin_id}/flags")
def flag_college_admin(
    college_admin_id: str, body: CollegeAdminFlagCreate, current_user: dict = Depends(get_current_user)
):
    require_super_admin(current_user)
    supabase = get_supabase()

    target = supabase.table("college_admins").select("id").eq("id", college_admin_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="College admin not found")

    inserted = (
        supabase.table("college_admin_flags")
        .insert(
            {
                "college_admin_id": college_admin_id,
                "flagged_by": current_user["id"],
                "reason": body.reason,
            }
        )
        .execute()
    )
    return inserted.data[0]
