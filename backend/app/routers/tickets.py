from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_scanner
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import TicketAssignCreate, TicketAssignmentRespond, TicketScanRequest

router = APIRouter(prefix="/tickets", tags=["tickets"])

# Separate router so the wallet can live at /users/me/tickets rather than
# under the /tickets prefix.
wallet_router = APIRouter(tags=["tickets"])


@wallet_router.get("/users/me/tickets")
def my_tickets(current_user: dict = Depends(get_current_user)):
    """Every ticket the user currently holds, with the event and tier
    inlined so the wallet renders in a single request."""
    supabase = get_supabase()
    tickets = (
        supabase.table("tickets")
        .select("*")
        .eq("owner_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    if not tickets.data:
        return []

    event_ids = list({t["event_id"] for t in tickets.data if t.get("event_id")})
    tier_ids = list({t["ticket_tier_id"] for t in tickets.data if t.get("ticket_tier_id")})

    events_by_id = {}
    if event_ids:
        evs = supabase.table("events").select("*").in_("id", event_ids).execute()
        events_by_id = {e["id"]: e for e in evs.data}

    tiers_by_id = {}
    if tier_ids:
        ts = supabase.table("ticket_tiers").select("*").in_("id", tier_ids).execute()
        tiers_by_id = {t["id"]: t for t in ts.data}

    # Which days have already been scanned, so the wallet can show a
    # ticket as used without a second round trip per ticket.
    scans = (
        supabase.table("ticket_scans")
        .select("ticket_id")
        .in_("ticket_id", [t["id"] for t in tickets.data])
        .execute()
    )
    scanned = {s["ticket_id"] for s in scans.data}

    # Ticket background art, per event, chosen by the organiser. Fetched
    # for the whole wallet in one query rather than per ticket.
    from app.routers.media import BUCKET as MEDIA_BUCKET
    ticket_bg_by_event: dict[str, str] = {}
    if event_ids:
        bgs = (
            supabase.table("event_media")
            .select("event_id, storage_path, placement")
            .in_("event_id", event_ids)
            .eq("status", "active")
            .in_("placement", ["ticket_bg", "cover"])
            .execute()
        )
        for m in bgs.data:
            # An explicit ticket_bg wins; the cover stands in otherwise,
            # so a ticket is never a blank rectangle.
            if m["placement"] == "ticket_bg" or m["event_id"] not in ticket_bg_by_event:
                url = supabase.storage.from_(MEDIA_BUCKET).get_public_url(m["storage_path"])
                if m["placement"] == "ticket_bg":
                    ticket_bg_by_event[m["event_id"]] = url
                else:
                    ticket_bg_by_event.setdefault(m["event_id"], url)

    out = []
    for t in tickets.data:
        ev = events_by_id.get(t.get("event_id")) or {}
        tier = tiers_by_id.get(t.get("ticket_tier_id")) or {}
        # The organizer decides when codes go live. Withholding the scan
        # secret until then is the whole point: released at purchase, a
        # ticket can be screenshotted and forwarded for days; released at
        # the door, that window is the length of the queue. The booking
        # code stays visible throughout so people can still identify
        # their own ticket.
        revealed = bool(ev.get("qr_revealed_at"))
        out.append({
            "id": t["id"],
            "verify_code": t.get("verify_code") if revealed else None,
            "qr_revealed": revealed,
            "booking_code": (t.get("verify_code") or "")[:8].upper(),
            "status": "used" if t["id"] in scanned else t.get("status"),
            "price_paid": float(t.get("price_paid") or 0),
            "created_at": t.get("created_at"),
            "order_id": t.get("order_id"),
            "event": {
                "id": ev.get("id"),
                "title": ev.get("title"),
                "category": ev.get("category"),
                "venue": ev.get("venue"),
                "start_date": ev.get("starts_at"),
                "state": ev.get("status"),
                "cover_image": None,
                "qr_revealed_at": ev.get("qr_revealed_at"),
                "gate_opened_at": ev.get("gate_opened_at"),
                "ticket_bg": ticket_bg_by_event.get(ev.get("id")),
            },
            "tier": {
                "id": tier.get("id"),
                "name": tier.get("name"),
                "price": float(tier.get("price") or 0),
            },
        })
    return out


def _get_ticket_or_404(supabase, ticket_id: str) -> dict:
    result = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result.data[0]


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    ticket = _get_ticket_or_404(supabase, ticket_id)

    if ticket["owner_id"] != current_user["id"]:
        event = supabase.table("events").select("org_group_id").eq("id", ticket["event_id"]).execute()
        org_group_id = event.data[0]["org_group_id"] if event.data else None
        if not org_group_id:
            raise HTTPException(status_code=403, detail="Not your ticket")
        require_org_scanner(current_user["id"], org_group_id)

    return ticket


@router.post("/scan")
def scan_ticket(body: TicketScanRequest, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    code = (body.verify_code or "").strip()
    if not code:
        raise HTTPException(status_code=422, detail="No ticket code supplied")

    # A QR carries the full 32-character verify_code, but the wallet
    # *shows* the holder a booking code -- its first 8 characters,
    # uppercased. Gate staff read that off the screen and type it, so an
    # exact match alone made manual entry impossible while scanning
    # worked perfectly.
    ticket_result = supabase.table("tickets").select("*").eq("verify_code", code).execute()

    if not ticket_result.data and len(code) >= 6:
        prefix = code.lower()
        ticket_result = (
            supabase.table("tickets").select("*").ilike("verify_code", f"{prefix}%").execute()
        )
        # A prefix is not guaranteed unique. Admitting the first of
        # several matches would be admitting an arbitrary person, so
        # ambiguity is an error rather than a guess.
        if len(ticket_result.data) > 1:
            raise HTTPException(
                status_code=409,
                detail="That code matches more than one ticket. Scan the QR code instead.",
            )

    if not ticket_result.data:
        raise HTTPException(status_code=404, detail="Invalid ticket code")
    ticket = ticket_result.data[0]

    event_result = (
        supabase.table("events")
        .select("org_group_id, gate_opened_at, title")
        .eq("id", ticket["event_id"])
        .execute()
    )
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    event = event_result.data[0]
    org_group_id = event["org_group_id"]

    require_org_scanner(current_user["id"], org_group_id)

    # Refuse scans before the organizer opens the gate. Without this the
    # gate switch is decorative: a scanner left running would admit
    # people hours early and burn their single-use ticket.
    if not event.get("gate_opened_at"):
        raise HTTPException(
            status_code=409,
            detail="The gate is closed. Open it from the event's gate controls before scanning.",
        )

    # Every state that must not open the gate, with the reason the
    # person at the door needs. Checking only "expired" meant a ticket
    # revoked after a theft report still admitted whoever held the old
    # QR -- which defeats the entire point of reissuing it.
    BLOCKED = {
        "expired": "This ticket has expired.",
        "cancelled": "This ticket was cancelled.",
        "revoked": "This ticket was revoked and replaced after a theft report. Ask for the current ticket.",
        "theft_reported": "This ticket is frozen while a theft report is reviewed.",
    }
    if ticket["status"] in BLOCKED:
        raise HTTPException(status_code=409, detail=BLOCKED[ticket["status"]])

    already_scanned_today = (
        supabase.table("ticket_scans")
        .select("id")
        .eq("ticket_id", ticket["id"])
        .eq("day_number", body.day_number)
        .execute()
    )
    if already_scanned_today.data:
        raise HTTPException(status_code=409, detail="Ticket already scanned for this day")

    tier_result = (
        supabase.table("ticket_tiers")
        .select("valid_days")
        .eq("id", ticket["ticket_tier_id"])
        .execute()
    )
    valid_days = tier_result.data[0]["valid_days"] if tier_result.data else 1

    if body.day_number < 1 or body.day_number > valid_days:
        raise HTTPException(status_code=400, detail=f"This ticket is not valid on day {body.day_number}")

    scan_inserted = (
        supabase.table("ticket_scans")
        .insert(
            {
                "ticket_id": ticket["id"],
                "day_number": body.day_number,
                "scanned_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )

    if body.day_number >= valid_days:
        update_result = (
            supabase.table("tickets")
            .update({"status": "scanned"})
            .eq("id", ticket["id"])
            .execute()
        )
        ticket = update_result.data[0]

    return {"ticket": ticket, "scan": scan_inserted.data[0]}


@router.post("/{ticket_id}/assign")
def assign_ticket(ticket_id: str, body: TicketAssignCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    ticket = _get_ticket_or_404(supabase, ticket_id)

    if ticket["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the ticket owner can gift/assign it")
    if ticket["status"] != "issued":
        raise HTTPException(status_code=409, detail="Only an unscanned, unexpired ticket can be assigned")

    recipient_membership = (
        supabase.table("user_group_members")
        .select("status")
        .eq("group_id", body.group_id)
        .eq("user_id", body.recipient_id)
        .execute()
    )
    if not recipient_membership.data or recipient_membership.data[0]["status"] != "accepted":
        raise HTTPException(status_code=422, detail="Recipient is not an accepted member of that group")

    inserted = (
        supabase.table("ticket_assignments")
        .insert(
            {
                "ticket_id": ticket_id,
                "group_id": body.group_id,
                "recipient_id": body.recipient_id,
                "status": "pending",
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.post("/assignments/{assignment_id}/respond")
def respond_to_assignment(
    assignment_id: str, body: TicketAssignmentRespond, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    assignment_result = (
        supabase.table("ticket_assignments").select("*").eq("id", assignment_id).execute()
    )
    if not assignment_result.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment = assignment_result.data[0]

    if assignment["recipient_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can respond to this assignment")
    if assignment["status"] != "pending":
        raise HTTPException(status_code=409, detail="Assignment already responded to")

    now = datetime.now(timezone.utc).isoformat()

    if body.accept:
        supabase.table("tickets").update({"owner_id": current_user["id"]}).eq(
            "id", assignment["ticket_id"]
        ).execute()
        new_status = "accepted"
    else:
        # The DB's status CHECK constraint (§9/§31) has no literal "declined"
        # value -- 'skipped_ineligible' is the closest fit for "recipient did
        # not take this ticket".
        new_status = "skipped_ineligible"

    updated = (
        supabase.table("ticket_assignments")
        .update({"status": new_status, "responded_at": now})
        .eq("id", assignment_id)
        .execute()
    )
    return updated.data[0]
