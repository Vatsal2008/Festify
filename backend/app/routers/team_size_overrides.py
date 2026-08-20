from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_college_admin, require_org_manager, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import TeamSizeOverrideCreate, TeamSizeOverrideReview

router = APIRouter(tags=["team-size-overrides"])


@router.post("/ticket-tiers/{tier_id}/team-size-override")
def request_team_size_override(
    tier_id: str, body: TeamSizeOverrideCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("event_id").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    event_result = (
        supabase.table("events")
        .select("org_group_id, college_id")
        .eq("id", tier_result.data[0]["event_id"])
        .execute()
    )
    event = event_result.data[0]
    require_org_manager(current_user["id"], event["org_group_id"])

    routed_to = "college_admin" if event["college_id"] else "super_admin"

    inserted = (
        supabase.table("team_size_override_requests")
        .insert(
            {
                "ticket_tier_id": tier_id,
                "organizer_id": current_user["id"],
                "requested_max": body.requested_max,
                "routed_to": routed_to,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.post("/team-size-override-requests/{request_id}/review")
def review_team_size_override(
    request_id: str, body: TeamSizeOverrideReview, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    req_result = (
        supabase.table("team_size_override_requests").select("*").eq("id", request_id).execute()
    )
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    request_row = req_result.data[0]

    if request_row["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already decided")

    tier_result = (
        supabase.table("ticket_tiers")
        .select("event_id")
        .eq("id", request_row["ticket_tier_id"])
        .execute()
    )
    event_result = (
        supabase.table("events").select("college_id").eq("id", tier_result.data[0]["event_id"]).execute()
    )
    college_id = event_result.data[0]["college_id"]

    if request_row["routed_to"] == "college_admin":
        require_college_admin(current_user["id"], college_id)
    else:
        require_super_admin(current_user)

    granted_max = body.granted_max if body.approve else None
    updated = (
        supabase.table("team_size_override_requests")
        .update(
            {
                "status": "approved" if body.approve else "rejected",
                "granted_max": granted_max,
                "reviewed_by": current_user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", request_id)
        .execute()
    )

    if body.approve and granted_max is not None:
        supabase.table("ticket_tiers").update({"max_team_size_override": granted_max}).eq(
            "id", request_row["ticket_tier_id"]
        ).execute()

    return updated.data[0]
