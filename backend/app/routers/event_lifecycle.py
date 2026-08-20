from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import ChangeRequestCreate, EventPollCreate, PollVoteRequest

router = APIRouter(tags=["event-lifecycle"])


@router.post("/events/{event_id}/polls")
def create_poll(event_id: str, body: EventPollCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("event_polls")
        .insert({"event_id": event_id, "question": body.question, "closes_at": body.closes_at})
        .execute()
    )
    return inserted.data[0]


@router.post("/polls/{poll_id}/vote")
def vote_on_poll(poll_id: str, body: PollVoteRequest, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        supabase.table("event_poll_votes").upsert(
            {"poll_id": poll_id, "user_id": current_user["id"], "vote": body.vote}
        ).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"poll_id": poll_id, "vote": body.vote}


@router.get("/polls/{poll_id}/results")
def poll_results(poll_id: str):
    supabase = get_supabase()
    votes = supabase.table("event_poll_votes").select("vote").eq("poll_id", poll_id).execute()
    yes_count = sum(1 for v in votes.data if v["vote"])
    no_count = sum(1 for v in votes.data if not v["vote"])
    return {"yes": yes_count, "no": no_count, "total": len(votes.data)}


@router.post("/events/{event_id}/change-requests")
def create_change_request(
    event_id: str, body: ChangeRequestCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("event_change_requests")
        .insert({"event_id": event_id, "poll_id": body.poll_id, "change_details": body.change_details})
        .execute()
    )
    return inserted.data[0]


@router.post("/change-requests/{request_id}/decide")
def decide_change_request(
    request_id: str, approve: bool, current_user: dict = Depends(get_current_user)
):
    require_super_admin(current_user)
    supabase = get_supabase()

    req_result = supabase.table("event_change_requests").select("status").eq("id", request_id).execute()
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Change request not found")
    if req_result.data[0]["status"] != "pending_super_admin":
        raise HTTPException(status_code=409, detail="Change request already decided")

    updated = (
        supabase.table("event_change_requests")
        .update({"status": "approved" if approve else "rejected"})
        .eq("id", request_id)
        .execute()
    )
    return updated.data[0]
