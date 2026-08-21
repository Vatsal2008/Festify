from fastapi import APIRouter, Depends

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events

router = APIRouter(tags=["wishlist-follow"])


@router.post("/events/{event_id}/wishlist")
def toggle_wishlist(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("event_wishlist")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("event_wishlist").delete().eq("event_id", event_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"wishlisted": False}

    supabase.table("event_wishlist").insert(
        {"event_id": event_id, "user_id": current_user["id"]}
    ).execute()
    return {"wishlisted": True}


@router.get("/users/me/wishlist")
def my_wishlist(current_user: dict = Depends(get_current_user)):
    """Full event objects, not just ids — the wishlist page renders event
    cards, and returning bare ids would force it into an N+1 fetch."""
    supabase = get_supabase()
    rows = (
        supabase.table("event_wishlist")
        .select("event_id")
        .eq("user_id", current_user["id"])
        .execute()
    )
    event_ids = [r["event_id"] for r in rows.data]
    if not event_ids:
        return []

    events = supabase.table("events").select("*").in_("id", event_ids).execute()
    return _enrich_events(supabase, events.data, current_user)


@router.post("/org-groups/{org_group_id}/follow")
def toggle_follow(org_group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("org_follows")
        .select("id")
        .eq("org_group_id", org_group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("org_follows").delete().eq("org_group_id", org_group_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"following": False}

    supabase.table("org_follows").insert(
        {"org_group_id": org_group_id, "user_id": current_user["id"]}
    ).execute()
    return {"following": True}


@router.get("/users/me/following")
def my_follows(current_user: dict = Depends(get_current_user)):
    """Organizers this user follows, with enough detail to render them.

    This returned nothing but org_group_id and a timestamp, so anything
    listing follows could only show a row of UUIDs. The organiser is
    inlined here, in one query for the whole list.
    """
    supabase = get_supabase()
    follows = (
        supabase.table("org_follows")
        .select("org_group_id, created_at")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
        .data
    ) or []
    if not follows:
        return []

    org_ids = [f["org_group_id"] for f in follows if f.get("org_group_id")]
    orgs_by_id = {}
    if org_ids:
        orgs = (
            supabase.table("org_groups")
            .select("id, name, college_id, score, successful_event_count")
            .in_("id", org_ids)
            .execute()
            .data
        ) or []
        orgs_by_id = {o["id"]: o for o in orgs}

    college_ids = list({o.get("college_id") for o in orgs_by_id.values() if o.get("college_id")})
    colleges = {}
    if college_ids:
        colleges = {
            c["id"]: c["name"]
            for c in supabase.table("colleges").select("id, name").in_("id", college_ids).execute().data or []
        }

    out = []
    for f in follows:
        org = orgs_by_id.get(f["org_group_id"])
        # A follow can outlive the organiser it points at; skipping it
        # is better than emitting a row with nothing in it.
        if not org:
            continue
        out.append({
            "org_id": org["id"],
            "name": org.get("name"),
            "college_name": colleges.get(org.get("college_id")),
            "score": org.get("score") or 0,
            "successful_events": org.get("successful_event_count") or 0,
            "followed_at": f.get("created_at"),
        })
    return out
