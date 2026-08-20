"""Shape raw DB rows into the objects the frontend actually consumes.

The UI reads nested, enriched events (`event.organizer.name`,
`event.tiers[]`, `hype_count`, `is_hyped`) rather than flat table rows,
and uses its own field names in places (`state`, `start_date`). Rather
than scatter that translation across every React component, the API
serves its client's shape here, in one place.
"""


def serialize_tier(tier: dict, sold_count: int = 0) -> dict:
    return {
        "id": tier["id"],
        "name": tier["name"],
        # The UI branches on tier.type for the college-only lock; derive it
        # rather than storing a redundant column.
        "type": "college_only" if tier.get("is_college_only") else "general",
        "price": float(tier.get("price") or 0),
        "quantity": tier.get("pool_capacity") or 0,
        "sold_count": sold_count,
        "college_only": bool(tier.get("is_college_only")),
        "valid_days": tier.get("valid_days") or 1,
        "min_team_size": tier.get("min_team_size") or 1,
        "max_team_size_override": tier.get("max_team_size_override"),
    }


def serialize_org(org: dict | None) -> dict | None:
    if not org:
        return None
    return {
        "id": org["id"],
        "name": org.get("name"),
        "trust_tier": org.get("trust_tier") or "new",
        "successful_events_count": org.get("successful_event_count") or 0,
        "score_points": org.get("score") or 0,
        "college": None,
        "avatar": None,
        "description": None,
    }


def serialize_event(
    event: dict,
    *,
    org: dict | None = None,
    tiers: list[dict] | None = None,
    sold_by_tier: dict[str, int] | None = None,
    hype_count: int = 0,
    is_hyped: bool = False,
    is_wishlisted: bool = False,
    cover_image: str | None = None,
    review_stats: dict | None = None,
) -> dict:
    sold_by_tier = sold_by_tier or {}
    review_stats = review_stats or {}
    return {
        "id": event["id"],
        "title": event.get("title"),
        "description": event.get("description"),
        "category": event.get("category"),
        "visibility": event.get("visibility"),
        # The UI calls this `state`; the column is `status`.
        "state": event.get("status"),
        "venue": event.get("venue"),
        "start_date": event.get("starts_at"),
        "end_date": event.get("ends_at"),
        "capacity": event.get("capacity"),
        "waitlist_enabled": event.get("waitlist_enabled", True),
        "cover_image": cover_image,
        "organizer": serialize_org(org),
        "org_group_id": event.get("org_group_id"),
        "college_id": event.get("college_id"),
        "tiers": [serialize_tier(t, sold_by_tier.get(t["id"], 0)) for t in (tiers or [])],
        "hype_count": hype_count,
        "is_hyped": is_hyped,
        "is_wishlisted": is_wishlisted,
        "avg_rating": review_stats.get("avg_rating"),
        "review_count": review_stats.get("review_count", 0),
        "sales_close_at": event.get("sales_close_at"),
        "edit_lock_at": event.get("edit_lock_at"),
        "youtube_video_id": event.get("youtube_video_id"),
    }
