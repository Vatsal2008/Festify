from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import WaitlistJoin

router = APIRouter(prefix="/ticket-tiers", tags=["waitlist"])


@router.post("/{tier_id}/waitlist")
def join_waitlist(tier_id: str, body: WaitlistJoin, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("*").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")
    tier = tier_result.data[0]

    sold_result = (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("ticket_tier_id", tier_id)
        .in_("status", ["issued", "scanned"])
        .execute()
    )
    if (sold_result.count or 0) < tier["pool_capacity"]:
        raise HTTPException(status_code=409, detail="This tier still has tickets available -- buy directly")

    try:
        inserted = (
            supabase.table("event_waitlist")
            .insert(
                {
                    "event_id": tier["event_id"],
                    "ticket_tier_id": tier_id,
                    "user_id": current_user["id"],
                    "quantity_requested": body.quantity_requested,
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(status_code=409, detail="You are already on the waitlist for this tier")
        raise
    return inserted.data[0]


@router.get("/{tier_id}/waitlist")
def list_waitlist(tier_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("event_id").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    event_result = (
        supabase.table("events").select("org_group_id").eq("id", tier_result.data[0]["event_id"]).execute()
    )
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = (
        supabase.table("event_waitlist")
        .select("*")
        .eq("ticket_tier_id", tier_id)
        .eq("status", "waiting")
        .order("created_at")
        .execute()
    )
    return result.data
