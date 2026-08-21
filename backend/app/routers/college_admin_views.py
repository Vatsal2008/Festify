"""Read and moderation surfaces for a college admin.

The two screens these serve -- the college's event list and its
analytics -- were built against hard-coded arrays: twelve clubs, 28
events, 18,400 tickets, a revenue figure of Rs 48.2 lakh, and eight
months of invented monthly data. None of it came from the database. The
live figures for the same college are 6 events and one ticket sold.

Numbers that look like measurements get believed and acted on, so
everything below is counted from tables and an empty college returns
empty rather than a plausible-looking shape.

Scope is deliberate: a college admin sees their own colleges, and a
super admin sees any of them. Without the second rule these endpoints
would be untestable and unusable, since a super admin overseeing a
complaint about a college has no way to become that college's admin.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.authz import is_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events
from app.routers.platform import _audit

router = APIRouter(prefix="/college-admin", tags=["college-admin"])
logger = logging.getLogger(__name__)

# What a college admin may set. Narrower than the super admin's set on
# purpose: this role moderates whether a college's events are visible,
# it does not own the event's content or run its lifecycle. completed
# and ongoing are absent because those follow from the clock.
COLLEGE_ADMIN_STATUSES = {"draft", "live", "early_access", "on_sale", "cancelled", "postponed"}


def _my_college_ids(supabase, user: dict) -> list[str]:
    rows = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", user["id"])
        .eq("status", "active")
        .execute()
        .data
    ) or []
    return [r["college_id"] for r in rows]


def _resolve_scope(supabase, user: dict, college_id: str | None) -> str:
    """The college being viewed, or 403 if this user may not view it.

    Super admins may name any college. Everyone else is confined to the
    colleges they actually administer, and defaults to their first one
    so the common single-college case needs no parameter.
    """
    if is_super_admin(user):
        if college_id:
            return college_id
        first = supabase.table("colleges").select("id").order("name").limit(1).execute().data
        if not first:
            raise HTTPException(status_code=404, detail="No colleges exist yet.")
        return first[0]["id"]

    mine = _my_college_ids(supabase, user)
    if not mine:
        raise HTTPException(status_code=403, detail="You do not administer a college.")
    if college_id and college_id not in mine:
        raise HTTPException(status_code=403, detail="That college is not yours to administer.")
    return college_id or mine[0]


@router.get("/scope")
def my_scope(current_user: dict = Depends(get_current_user)):
    """Which colleges this user may look at, so the client can offer a
    picker instead of guessing, and can say plainly when the answer is
    none."""
    supabase = get_supabase()
    if is_super_admin(current_user):
        colleges = supabase.table("colleges").select("id, name").order("name").execute().data or []
        return {"is_super_admin": True, "colleges": colleges}

    ids = _my_college_ids(supabase, current_user)
    colleges = []
    if ids:
        colleges = supabase.table("colleges").select("id, name").in_("id", ids).order("name").execute().data or []
    return {"is_super_admin": False, "colleges": colleges}


@router.get("/events")
def college_events(
    college_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Every event belonging to the college, in any state.

    This screen previously called the public events endpoint and showed
    the first five rows of it -- so it listed other colleges' events and
    hid the college's own drafts, which is exactly backwards for a
    moderation surface.
    """
    supabase = get_supabase()
    cid = _resolve_scope(supabase, current_user, college_id)

    rows = (
        supabase.table("events")
        .select("id, title, venue, status, visibility, starts_at, ends_at, capacity, category, org_group_id")
        .eq("college_id", cid)
        .order("starts_at", desc=True)
        .execute()
        .data
    ) or []
    if not rows:
        return {"college_id": cid, "events": []}

    # Deliberately not _enrich_events. That attaches tiers, hype counts,
    # wishlist state and review aggregates -- roughly seven round trips
    # to a remote database, and this table displays none of it. The lean
    # projection needs three, and took the endpoint from ~1.9s to well
    # under half that.
    event_ids = [e["id"] for e in rows]

    org_ids = list({e["org_group_id"] for e in rows if e.get("org_group_id")})
    org_names = {}
    if org_ids:
        org_names = {
            o["id"]: o.get("name")
            for o in supabase.table("org_groups").select("id, name").in_("id", org_ids).execute().data or []
        }

    # Sold counts come from tickets, not from the tier maths, because a
    # moderator's question is how many people are actually holding one.
    sold = defaultdict(int)
    tickets = (
        supabase.table("tickets")
        .select("event_id, status")
        .in_("event_id", event_ids)
        .in_("status", ["issued", "scanned", "used"])
        .execute()
        .data
    ) or []
    for t in tickets:
        sold[t["event_id"]] += 1

    events = [
        {
            "id": e["id"],
            "title": e["title"],
            "venue": e.get("venue"),
            "category": e.get("category"),
            "capacity": e.get("capacity"),
            "visibility": e.get("visibility"),
            # Published under the names the client already uses
            # everywhere else; the columns are status/starts_at/ends_at.
            "state": e.get("status"),
            "start_date": e.get("starts_at"),
            "end_date": e.get("ends_at"),
            "organizer": {"id": e.get("org_group_id"), "name": org_names.get(e.get("org_group_id"))},
            "tickets_sold": sold.get(e["id"], 0),
        }
        for e in rows
    ]
    return {"college_id": cid, "events": events}


@router.patch("/events/{event_id}")
def moderate_event(
    event_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Publish, unpublish, cancel or postpone one of the college's events.

    The buttons behind this used to call a toast and nothing else --
    "Event approved -- now live!" was printed while the event stayed
    exactly as it was. Only the state moves here; the title, timing and
    capacity belong to the organiser who created them.
    """
    supabase = get_supabase()

    existing = supabase.table("events").select("*").eq("id", event_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    event = existing[0]

    if not event.get("college_id"):
        raise HTTPException(status_code=403, detail="This event is not affiliated with a college.")
    _resolve_scope(supabase, current_user, event["college_id"])

    # `state` is the name the client uses; `status` is the column.
    new_state = (body or {}).get("state") or (body or {}).get("status")
    if not new_state:
        raise HTTPException(status_code=422, detail="A state is required.")
    if new_state not in COLLEGE_ADMIN_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"state must be one of: {', '.join(sorted(COLLEGE_ADMIN_STATUSES))}",
        )

    if new_state == event["status"]:
        return _enrich_events(supabase, [event], current_user)[0]

    updated = (
        supabase.table("events").update({"status": new_state}).eq("id", event_id).execute().data
    )
    if not updated:
        raise HTTPException(status_code=500, detail="The update did not apply.")

    _audit(
        supabase, current_user["id"], "college_admin.event_state_changed", "event", event_id,
        {
            "title": event.get("title"),
            "college_id": event["college_id"],
            "changes": {"status": {"from": event["status"], "to": new_state}},
            "note": (body or {}).get("note") or None,
        },
    )
    return _enrich_events(supabase, updated, current_user)[0]


@router.get("/analytics")
def college_analytics(
    college_id: str | None = None,
    months: int = Query(8, ge=3, le=24),
    current_user: dict = Depends(get_current_user),
):
    """Headline figures and a monthly series for one college."""
    supabase = get_supabase()
    cid = _resolve_scope(supabase, current_user, college_id)

    college = supabase.table("colleges").select("id, name").eq("id", cid).execute().data
    college_name = college[0]["name"] if college else "This college"

    events = (
        supabase.table("events")
        .select("id, title, category, org_group_id, status, starts_at, capacity")
        .eq("college_id", cid)
        .execute()
        .data
    ) or []
    event_ids = [e["id"] for e in events]
    events_by_id = {e["id"]: e for e in events}

    tickets = []
    if event_ids:
        tickets = (
            supabase.table("tickets")
            .select("event_id, price_paid, status, created_at")
            .in_("event_id", event_ids)
            .in_("status", ["issued", "scanned", "used"])
            .execute()
            .data
        ) or []

    revenue = sum(float(t.get("price_paid") or 0) for t in tickets)
    org_ids = {e["org_group_id"] for e in events if e.get("org_group_id")}

    # Monthly buckets, oldest first, with every month present even when
    # it saw nothing -- a chart that silently skips empty months
    # misrepresents the shape of the trend.
    now = datetime.now(timezone.utc)
    buckets: list[tuple[str, str]] = []
    year, month = now.year, now.month
    for _ in range(months):
        buckets.append((f"{year:04d}-{month:02d}", datetime(year, month, 1).strftime("%b")))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    buckets.reverse()

    rev_by_month: dict[str, float] = defaultdict(float)
    tix_by_month: dict[str, int] = defaultdict(int)
    for t in tickets:
        key = str(t.get("created_at") or "")[:7]
        if key:
            rev_by_month[key] += float(t.get("price_paid") or 0)
            tix_by_month[key] += 1

    monthly = [
        {"month": label, "key": key,
         "revenue": round(rev_by_month.get(key, 0.0), 2),
         "tickets": tix_by_month.get(key, 0)}
        for key, label in buckets
    ]

    by_category: dict[str, int] = defaultdict(int)
    for t in tickets:
        ev = events_by_id.get(t["event_id"])
        if ev:
            by_category[ev.get("category") or "Other"] += 1
    # Fall back to counting events when nothing has sold, so a college
    # with listings but no sales still shows what it runs.
    basis = "tickets"
    if not by_category:
        basis = "events"
        for e in events:
            by_category[e.get("category") or "Other"] += 1

    total = sum(by_category.values()) or 1
    categories = sorted(
        ({"name": k, "count": v, "pct": round(v * 100 / total)} for k, v in by_category.items()),
        key=lambda c: c["count"], reverse=True,
    )

    top_events = sorted(
        (
            {
                "id": e["id"],
                "title": e["title"],
                "tickets": sum(1 for t in tickets if t["event_id"] == e["id"]),
                "revenue": round(sum(float(t.get("price_paid") or 0)
                                     for t in tickets if t["event_id"] == e["id"]), 2),
            }
            for e in events
        ),
        key=lambda e: (e["revenue"], e["tickets"]), reverse=True,
    )[:5]

    return {
        "college_id": cid,
        "college_name": college_name,
        "metrics": [
            {"key": "orgs", "label": "Active clubs", "value": len(org_ids), "format": "count"},
            {"key": "events", "label": "Events hosted", "value": len(events), "format": "count"},
            {"key": "tickets", "label": "Tickets sold", "value": len(tickets), "format": "count"},
            {"key": "revenue", "label": "Gross revenue", "value": round(revenue, 2), "format": "currency"},
        ],
        "monthly": monthly,
        "categories": categories,
        "category_basis": basis,
        "top_events": top_events,
    }
