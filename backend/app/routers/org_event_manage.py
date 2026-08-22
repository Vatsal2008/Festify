"""Organizer-side event management.

The organizer dashboard had a Manage button that navigated to the
event's PUBLIC page, where an organizer can do nothing but look at their
own listing. Nothing in the API let them change an event after creating
it either: the only update paths were the super admin's and the college
admin's, so the person who ran the event was the one person who could
not edit it.

Two rules shape what is editable here, and both are about money already
taken:

  Price is fixed once a tier exists. Somebody has paid it. Changing it
  retroactively makes every sold ticket either a discount the organizer
  did not offer or an overcharge, and Festify has no refund path to
  settle the difference.

  A ticket pool may only grow. Shrinking it below what has sold would
  invalidate tickets people are holding, and shrinking it at all is a
  promise to a queue that has already formed.
"""
import logging

from fastapi import APIRouter, Body, Depends, HTTPException

from app.authz import is_super_admin, require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events

router = APIRouter(prefix="/org-events", tags=["org-events"])
logger = logging.getLogger(__name__)

# What an organizer may set. Narrower than the super admin's set: no
# college_id, no org_group_id -- an event cannot change hands from here.
EDITABLE = {
    "title", "description", "venue", "category",
    "starts_at", "ends_at", "capacity", "visibility", "status",
}

# The states an organizer may move between. cancelled is included --
# calling off your own event is a legitimate thing to do -- while
# completed, ongoing and sold_out follow from the clock and the ticket
# counts rather than from a dropdown.
ORG_STATUSES = {"draft", "live", "early_access", "on_sale", "cancelled", "postponed"}

CLIENT_ALIASES = {"state": "status", "start_date": "starts_at", "end_date": "ends_at"}


def _event_for_manager(supabase, event_id: str, user: dict) -> dict:
    rows = supabase.table("events").select("*").eq("id", event_id).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Event not found")
    event = rows[0]
    if not is_super_admin(user):
        require_org_manager(user["id"], event["org_group_id"])
    return event


def _sold_for_tier(supabase, tier_id: str) -> int:
    return (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("ticket_tier_id", tier_id)
        .in_("status", ["issued", "scanned", "used", "theft_reported"])
        .execute()
        .count
    ) or 0


@router.get("/{event_id}")
def get_manageable_event(event_id: str, current_user: dict = Depends(get_current_user)):
    """The event plus its tiers with live sold counts, for the editor."""
    supabase = get_supabase()
    event = _event_for_manager(supabase, event_id, current_user)

    tiers = (
        supabase.table("ticket_tiers")
        .select("*")
        .eq("event_id", event_id)
        .order("price")
        .execute()
        .data
    ) or []

    return {
        **_enrich_events(supabase, [event], current_user)[0],
        "tiers_managed": [
            {
                **t,
                "sold": _sold_for_tier(supabase, t["id"]),
                # Stated rather than left for the client to infer, so the
                # editor and the server cannot disagree about the floor.
                "min_pool_capacity": _sold_for_tier(supabase, t["id"]),
                "price_locked": True,
            }
            for t in tiers
        ],
    }


@router.patch("/{event_id}")
def update_own_event(
    event_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    before = _event_for_manager(supabase, event_id, current_user)

    body = dict(body or {})
    for alias, column in CLIENT_ALIASES.items():
        if alias in body and column not in body:
            body[column] = body.pop(alias)

    rejected = [k for k in body if k in ("price", "tiers") or k.endswith("_price")]
    if rejected:
        raise HTTPException(
            status_code=422,
            detail="Ticket prices cannot be changed after a tier exists — people have already paid them.",
        )

    patch = {k: v for k, v in body.items() if k in EDITABLE}
    if not patch:
        raise HTTPException(status_code=422, detail="No editable fields supplied.")

    if "status" in patch and patch["status"] not in ORG_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"state must be one of: {', '.join(sorted(ORG_STATUSES))}",
        )
    if "title" in patch:
        patch["title"] = (patch["title"] or "").strip()
        if not patch["title"]:
            raise HTTPException(status_code=422, detail="Title cannot be empty.")

    # Event capacity may grow but never shrink below what is already out
    # in people's wallets.
    if "capacity" in patch and patch["capacity"] is not None:
        try:
            patch["capacity"] = int(patch["capacity"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Capacity must be a whole number.")
        issued = (
            supabase.table("tickets")
            .select("id", count="exact")
            .eq("event_id", event_id)
            .in_("status", ["issued", "scanned", "used", "theft_reported"])
            .execute()
            .count
        ) or 0
        if patch["capacity"] < issued:
            raise HTTPException(
                status_code=422,
                detail=f"{issued} tickets are already issued, so capacity cannot go below {issued}.",
            )

    starts = patch.get("starts_at", before.get("starts_at"))
    ends = patch.get("ends_at", before.get("ends_at"))
    if starts and ends:
        from datetime import datetime
        try:
            if datetime.fromisoformat(str(ends).replace("Z", "+00:00")) <= datetime.fromisoformat(
                str(starts).replace("Z", "+00:00")
            ):
                raise HTTPException(status_code=422, detail="The event must end after it starts.")
        except ValueError:
            raise HTTPException(status_code=422, detail="Dates must be valid timestamps.")

    updated = supabase.table("events").update(patch).eq("id", event_id).execute().data
    if not updated:
        raise HTTPException(status_code=500, detail="The update did not apply.")
    return _enrich_events(supabase, updated, current_user)[0]


@router.patch("/{event_id}/tiers/{tier_id}")
def update_own_tier(
    event_id: str,
    tier_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Grow a tier's pool, or rename it. Price is not touchable."""
    supabase = get_supabase()
    _event_for_manager(supabase, event_id, current_user)

    rows = (
        supabase.table("ticket_tiers")
        .select("*")
        .eq("id", tier_id)
        .eq("event_id", event_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Ticket tier not found on this event")
    tier = rows[0]

    if "price" in (body or {}):
        raise HTTPException(
            status_code=422,
            detail="Price is fixed once a tier exists — people have already paid it.",
        )

    patch = {}
    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Tier name cannot be empty.")
        patch["name"] = name

    if "pool_capacity" in body:
        try:
            pool = int(body["pool_capacity"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Pool size must be a whole number.")

        sold = _sold_for_tier(supabase, tier_id)
        current = int(tier.get("pool_capacity") or 0)
        if pool < current:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"A ticket pool can only grow. This tier is set to {current}; "
                    "reducing it would break a promise to people already in the queue."
                ),
            )
        if pool < sold:
            raise HTTPException(
                status_code=422,
                detail=f"{sold} tickets have sold from this tier, so the pool cannot go below {sold}.",
            )
        patch["pool_capacity"] = pool

    if not patch:
        raise HTTPException(status_code=422, detail="Nothing to update.")

    updated = (
        supabase.table("ticket_tiers").update(patch).eq("id", tier_id).execute().data
    )
    if not updated:
        raise HTTPException(status_code=500, detail="The update did not apply.")
    return {**updated[0], "sold": _sold_for_tier(supabase, tier_id)}
