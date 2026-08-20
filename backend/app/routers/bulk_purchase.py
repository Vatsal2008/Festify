from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import BulkPurchaseRequestCreate, BulkPurchaseReviewRequest

router = APIRouter(prefix="/bulk-purchase-requests", tags=["bulk-purchase"])


@router.post("")
def create_bulk_request(
    body: BulkPurchaseRequestCreate, current_user: dict = Depends(get_current_user)
):
    if body.requested_qty < 1:
        raise HTTPException(status_code=422, detail="requested_qty must be at least 1")

    supabase = get_supabase()
    try:
        inserted = (
            supabase.table("bulk_purchase_requests")
            .insert(
                {
                    "event_id": body.event_id,
                    "buyer_id": current_user["id"],
                    "requested_qty": body.requested_qty,
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(
                status_code=409, detail="You already have a pending bulk request for this event"
            )
        raise
    return inserted.data[0]


@router.get("/mine")
def my_bulk_requests(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("bulk_purchase_requests")
        .select("*")
        .eq("buyer_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("")
def list_bulk_requests_for_event(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = (
        supabase.table("bulk_purchase_requests")
        .select("*")
        .eq("event_id", event_id)
        .eq("status", "pending")
        .execute()
    )
    return result.data


@router.post("/{request_id}/review")
def review_bulk_request(
    request_id: str, body: BulkPurchaseReviewRequest, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    req_result = supabase.table("bulk_purchase_requests").select("*").eq("id", request_id).execute()
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Bulk request not found")
    bulk_request = req_result.data[0]

    event_result = (
        supabase.table("events").select("org_group_id").eq("id", bulk_request["event_id"]).execute()
    )
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    if bulk_request["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already decided")

    # NOTE: approval here only flips status. Converting an approved request
    # into real tickets still requires the buyer (or organizer) to pick a
    # ticket_tier and go through POST /orders -- this table is tier-agnostic
    # by design (per festify_full.md schema), so no ticket_tier_id exists
    # here to issue against automatically.
    new_status = "approved" if body.approve else "rejected"
    updated = (
        supabase.table("bulk_purchase_requests").update({"status": new_status}).eq("id", request_id).execute()
    )
    return updated.data[0]
