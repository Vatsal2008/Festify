from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user, get_current_user_optional
from app.schemas import EventCreate, TicketTierCreate
from app.serializers import serialize_event, serialize_tier

router = APIRouter(prefix="/events", tags=["events"])

BUCKET = "event-banners"


def _enrich_events(supabase, events: list[dict], viewer: dict | None) -> list[dict]:
    """Attach organizer, tiers, hype and wishlist state to raw event rows.

    Batched deliberately: one query per related table for the whole page
    of events rather than per-event lookups, so a 20-event list stays at
    a handful of round trips instead of ~100.
    """
    if not events:
        return []

    event_ids = [e["id"] for e in events]
    org_ids = list({e["org_group_id"] for e in events if e.get("org_group_id")})

    orgs_by_id = {}
    if org_ids:
        orgs = supabase.table("org_groups").select("*").in_("id", org_ids).execute()
        orgs_by_id = {o["id"]: o for o in orgs.data}

    tiers = supabase.table("ticket_tiers").select("*").in_("event_id", event_ids).execute()
    tiers_by_event: dict[str, list[dict]] = {}
    for t in tiers.data:
        tiers_by_event.setdefault(t["event_id"], []).append(t)

    # Sold counts, so the UI can show "N left" and a capacity bar.
    tier_ids = [t["id"] for t in tiers.data]
    sold_by_tier: dict[str, int] = {}
    if tier_ids:
        sold = (
            supabase.table("tickets")
            .select("ticket_tier_id")
            .in_("ticket_tier_id", tier_ids)
            .in_("status", ["issued", "scanned"])
            .execute()
        )
        for row in sold.data:
            sold_by_tier[row["ticket_tier_id"]] = sold_by_tier.get(row["ticket_tier_id"], 0) + 1

    hypes = supabase.table("event_hypes").select("event_id, user_id").in_("event_id", event_ids).execute()
    hype_count_by_event: dict[str, int] = {}
    hyped_by_viewer: set[str] = set()
    for h in hypes.data:
        hype_count_by_event[h["event_id"]] = hype_count_by_event.get(h["event_id"], 0) + 1
        if viewer and h["user_id"] == viewer["id"]:
            hyped_by_viewer.add(h["event_id"])

    wishlisted: set[str] = set()
    if viewer:
        wl = (
            supabase.table("event_wishlist")
            .select("event_id")
            .eq("user_id", viewer["id"])
            .in_("event_id", event_ids)
            .execute()
        )
        wishlisted = {w["event_id"] for w in wl.data}

    banners = (
        supabase.table("event_banners")
        .select("event_id, storage_path, banner_type")
        .in_("event_id", event_ids)
        .eq("status", "active")
        .execute()
    )
    cover_by_event: dict[str, str] = {}
    for b in banners.data:
        if b["banner_type"] in ("main", "event_page") and b["event_id"] not in cover_by_event:
            cover_by_event[b["event_id"]] = supabase.storage.from_(BUCKET).get_public_url(b["storage_path"])

    reviews = supabase.table("event_reviews").select("event_id, rating").in_("event_id", event_ids).execute()
    review_stats: dict[str, dict] = {}
    for r in reviews.data:
        s = review_stats.setdefault(r["event_id"], {"total": 0, "count": 0})
        s["total"] += r["rating"] or 0
        s["count"] += 1

    out = []
    for e in events:
        stats = review_stats.get(e["id"])
        out.append(
            serialize_event(
                e,
                org=orgs_by_id.get(e.get("org_group_id")),
                tiers=tiers_by_event.get(e["id"], []),
                sold_by_tier=sold_by_tier,
                hype_count=hype_count_by_event.get(e["id"], 0),
                is_hyped=e["id"] in hyped_by_viewer,
                is_wishlisted=e["id"] in wishlisted,
                cover_image=cover_by_event.get(e["id"]),
                review_stats={
                    "avg_rating": round(stats["total"] / stats["count"], 1) if stats and stats["count"] else None,
                    "review_count": stats["count"] if stats else 0,
                },
            )
        )
    return out


@router.post("")
def create_event(body: EventCreate, current_user: dict = Depends(get_current_user)):
    require_org_manager(current_user["id"], body.org_group_id)

    supabase = get_supabase()

    # events.college_id is derived from the organizing org's own college
    # affiliation at creation time -- it's what §9.5's routing rule
    # ("college_id present on the event -> routes to college admin;
    # otherwise -> super admin") actually reads, so it must be set here
    # rather than left to the caller.
    org_result = supabase.table("org_groups").select("college_id").eq("id", body.org_group_id).execute()
    college_id = org_result.data[0]["college_id"] if org_result.data else None

    inserted = (
        supabase.table("events")
        .insert(
            {
                "org_group_id": body.org_group_id,
                "college_id": college_id,
                "title": body.title,
                "description": body.description,
                "category": body.category,
                "venue": body.venue,
                "starts_at": body.starts_at,
                "ends_at": body.ends_at,
                "capacity": body.capacity,
                "visibility": body.visibility,
            }
        )
        .execute()
    )
    return _enrich_events(supabase, inserted.data, current_user)[0]


@router.get("")
def list_events(
    q: str | None = None,
    category: str | None = None,
    sort: str = "trending",
    limit: int = Query(60, le=200),
    viewer: dict | None = Depends(get_current_user_optional),
):
    supabase = get_supabase()
    query = supabase.table("events").select("*").eq("visibility", "public")

    if category and category != "All":
        query = query.eq("category", category)
    if q:
        # Match title or venue, mirroring the client-side search this replaces.
        query = query.or_(f"title.ilike.%{q}%,venue.ilike.%{q}%")

    result = query.order("starts_at").limit(limit).execute()
    events = _enrich_events(supabase, result.data, viewer)

    if sort == "trending":
        events.sort(key=lambda e: e["hype_count"], reverse=True)
    elif sort == "price-asc":
        events.sort(key=lambda e: min([t["price"] for t in e["tiers"]], default=0))
    elif sort == "price-desc":
        events.sort(key=lambda e: max([t["price"] for t in e["tiers"]], default=0), reverse=True)

    return events


@router.get("/{event_id}")
def get_event(event_id: str, viewer: dict | None = Depends(get_current_user_optional)):
    supabase = get_supabase()
    result = supabase.table("events").select("*").eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return _enrich_events(supabase, result.data, viewer)[0]


@router.post("/{event_id}/tiers")
def create_ticket_tier(
    event_id: str, body: TicketTierCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("ticket_tiers")
        .insert(
            {
                "event_id": event_id,
                "name": body.name,
                "price": body.price,
                "pool_capacity": body.pool_capacity,
                "is_college_only": body.is_college_only,
            }
        )
        .execute()
    )
    return serialize_tier(inserted.data[0], 0)


@router.get("/{event_id}/tiers")
def list_ticket_tiers(event_id: str):
    supabase = get_supabase()
    result = supabase.table("ticket_tiers").select("*").eq("event_id", event_id).execute()
    tier_ids = [t["id"] for t in result.data]

    sold_by_tier: dict[str, int] = {}
    if tier_ids:
        sold = (
            supabase.table("tickets")
            .select("ticket_tier_id")
            .in_("ticket_tier_id", tier_ids)
            .in_("status", ["issued", "scanned"])
            .execute()
        )
        for row in sold.data:
            sold_by_tier[row["ticket_tier_id"]] = sold_by_tier.get(row["ticket_tier_id"], 0) + 1

    return [serialize_tier(t, sold_by_tier.get(t["id"], 0)) for t in result.data]
