from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import UserGroupCreate, UserGroupInvite, UserGroupRespond

router = APIRouter(prefix="/user-groups", tags=["user-groups"])


@router.post("")
def create_user_group(body: UserGroupCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    inserted = (
        supabase.table("user_groups").insert({"name": body.name, "owner_id": current_user["id"]}).execute()
    )
    group = inserted.data[0]

    supabase.table("user_group_members").insert(
        {
            "group_id": group["id"],
            "user_id": current_user["id"],
            "status": "accepted",
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()

    return group


def _require_member(supabase, group_id: str, user_id: str) -> None:
    result = (
        supabase.table("user_group_members")
        .select("status")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data or result.data[0]["status"] != "accepted":
        raise HTTPException(status_code=403, detail="Not a member of this group")


@router.get("/{group_id}")
def get_user_group(group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    group_result = supabase.table("user_groups").select("*").eq("id", group_id).execute()
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")

    _require_member(supabase, group_id, current_user["id"])

    members = supabase.table("user_group_members").select("*").eq("group_id", group_id).execute()
    return {"group": group_result.data[0], "members": members.data}


@router.post("/{group_id}/invite")
def invite_to_group(group_id: str, body: UserGroupInvite, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    group_result = supabase.table("user_groups").select("owner_id").eq("id", group_id).execute()
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    if group_result.data[0]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the group owner can invite members")

    existing = (
        supabase.table("user_group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", body.user_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="User already invited or a member")

    inserted = (
        supabase.table("user_group_members")
        .insert({"group_id": group_id, "user_id": body.user_id, "status": "invited"})
        .execute()
    )
    return inserted.data[0]


@router.post("/{group_id}/respond")
def respond_to_invite(
    group_id: str, body: UserGroupRespond, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    existing = (
        supabase.table("user_group_members")
        .select("*")
        .eq("group_id", group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="No invite found for this group")
    if existing.data[0]["status"] != "invited":
        raise HTTPException(status_code=409, detail="Invite already responded to")

    new_status = "accepted" if body.accept else "left"
    updated = (
        supabase.table("user_group_members")
        .update({"status": new_status, "responded_at": datetime.now(timezone.utc).isoformat()})
        .eq("group_id", group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return updated.data[0]
