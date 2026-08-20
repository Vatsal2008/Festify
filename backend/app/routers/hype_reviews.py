from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import ReviewCreate

router = APIRouter(prefix="/events", tags=["hype-reviews"])


@router.post("/{event_id}/hype")
def toggle_hype(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = (
        supabase.table("event_hypes")
        .select("*")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("event_hypes").delete().eq("event_id", event_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"hyped": False}

    supabase.table("event_hypes").insert(
        {"event_id": event_id, "user_id": current_user["id"]}
    ).execute()
    return {"hyped": True}


@router.get("/{event_id}/hype")
def get_hype_count(event_id: str):
    supabase = get_supabase()
    result = supabase.table("event_hypes").select("user_id", count="exact").eq("event_id", event_id).execute()
    return {"count": result.count or 0}


@router.post("/{event_id}/reviews")
def create_review(event_id: str, body: ReviewCreate, current_user: dict = Depends(get_current_user)):
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")

    supabase = get_supabase()

    ticket_result = (
        supabase.table("tickets")
        .select("id")
        .eq("event_id", event_id)
        .eq("owner_id", current_user["id"])
        .execute()
    )
    if not ticket_result.data:
        raise HTTPException(status_code=403, detail="Only attendees with a ticket can review this event")

    existing = (
        supabase.table("event_reviews")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="You have already reviewed this event")

    inserted = (
        supabase.table("event_reviews")
        .insert(
            {
                "event_id": event_id,
                "user_id": current_user["id"],
                "ticket_id": ticket_result.data[0]["id"],
                "rating": body.rating,
                "comment": body.comment,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/{event_id}/reviews")
def list_reviews(event_id: str):
    """Reviews with their author inlined.

    This returned raw rows carrying only user_id, so the client had no
    name or avatar to show and crashed reading review.user.name. A
    review without its author is not renderable, so the join belongs
    here rather than as a lookup per row on the client.
    """
    supabase = get_supabase()
    result = (
        supabase.table("event_reviews")
        .select("*")
        .eq("event_id", event_id)
        .order("created_at", desc=True)
        .execute()
    )
    if not result.data:
        return []

    user_ids = list({r["user_id"] for r in result.data if r.get("user_id")})
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, avatar_url, customer_level")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    out = []
    for r in result.data:
        u = users_by_id.get(r.get("user_id")) or {}
        out.append({
            **r,
            "user": {
                # The client reads `name`; the column is full_name. A
                # deleted account still leaves its review, so fall back
                # rather than emitting a user without one.
                "id": u.get("id"),
                "name": u.get("full_name") or "Festify user",
                "avatar_url": u.get("avatar_url"),
                "customer_level": u.get("customer_level"),
            },
            "is_prime_review": u.get("customer_level") == "prime",
        })
    return out
