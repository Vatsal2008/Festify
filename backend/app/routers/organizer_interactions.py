from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import FeedbackRequestCreate

router = APIRouter(tags=["organizer-interactions"])

MAX_FEEDBACK_REQUESTS_PER_EVENT = 2


@router.post("/events/{event_id}/feedback-requests")
def send_feedback_request(
    event_id: str, body: FeedbackRequestCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    org_group_id = event_result.data[0]["org_group_id"]

    require_org_manager(current_user["id"], org_group_id)

    prime_result = (
        supabase.table("users").select("customer_level").eq("id", body.prime_user_id).execute()
    )
    if not prime_result.data or prime_result.data[0]["customer_level"] != "prime":
        raise HTTPException(status_code=422, detail="Target user is not a Prime user")

    block_result = (
        supabase.table("org_contact_blocks")
        .select("user_id")
        .eq("user_id", body.prime_user_id)
        .eq("org_group_id", org_group_id)
        .execute()
    )
    if block_result.data:
        raise HTTPException(status_code=403, detail="This user has blocked contact from this organizer")

    existing_count = (
        supabase.table("org_feedback_requests")
        .select("id", count="exact")
        .eq("event_id", event_id)
        .eq("prime_user_id", body.prime_user_id)
        .execute()
    )
    if (existing_count.count or 0) >= MAX_FEEDBACK_REQUESTS_PER_EVENT:
        raise HTTPException(
            status_code=409,
            detail=f"Max {MAX_FEEDBACK_REQUESTS_PER_EVENT} feedback requests per Prime user per event reached",
        )

    inserted = (
        supabase.table("org_feedback_requests")
        .insert(
            {
                "event_id": event_id,
                "org_group_id": org_group_id,
                "prime_user_id": body.prime_user_id,
                "message": body.message,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/events/{event_id}/feedback-requests")
def list_feedback_requests(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = supabase.table("org_feedback_requests").select("*").eq("event_id", event_id).execute()
    return result.data


@router.post("/org-groups/{org_group_id}/contact-block")
def toggle_contact_block(org_group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("org_contact_blocks")
        .select("user_id")
        .eq("user_id", current_user["id"])
        .eq("org_group_id", org_group_id)
        .execute()
    )
    if existing.data:
        supabase.table("org_contact_blocks").delete().eq("user_id", current_user["id"]).eq(
            "org_group_id", org_group_id
        ).execute()
        return {"blocked": False}

    supabase.table("org_contact_blocks").insert(
        {"user_id": current_user["id"], "org_group_id": org_group_id}
    ).execute()
    return {"blocked": True}
