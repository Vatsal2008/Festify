"""Gate control -- when QR codes go live and when scanning starts.

Two separate switches on purpose. Revealing codes lets attendees load
their QR while queuing; opening the gate lets scanners accept them.
Organizers usually want the first a few minutes before the second, so
the queue is ready before anyone reaches the door.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_scanner
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/events/{event_id}/gate", tags=["gate"])


def _event_or_404(supabase, event_id: str) -> dict:
    result = supabase.table("events").select("*").eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return result.data[0]


def _counts(supabase, event_id: str) -> dict:
    issued = (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("event_id", event_id)
        .in_("status", ["issued", "scanned"])
        .execute()
    )
    total = issued.count or 0

    ticket_ids = [t["id"] for t in (
        supabase.table("tickets").select("id").eq("event_id", event_id).execute().data or []
    )]
    scanned = 0
    if ticket_ids:
        scans = (
            supabase.table("ticket_scans")
            .select("ticket_id", count="exact")
            .in_("ticket_id", ticket_ids)
            .execute()
        )
        scanned = scans.count or 0

    return {"tickets_issued": total, "checked_in": scanned, "remaining": max(0, total - scanned)}


@router.get("")
def gate_status(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(current_user["id"], event["org_group_id"])
    return {
        "event_id": event_id,
        "title": event.get("title"),
        "qr_revealed": bool(event.get("qr_revealed_at")),
        "qr_revealed_at": event.get("qr_revealed_at"),
        "gate_open": bool(event.get("gate_opened_at")),
        "gate_opened_at": event.get("gate_opened_at"),
        **_counts(supabase, event_id),
    }


def _set_flag(event_id: str, user_id: str, column: str, on: bool) -> dict:
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(user_id, event["org_group_id"])

    value = datetime.now(timezone.utc).isoformat() if on else None
    supabase.table("events").update({column: value}).eq("id", event_id).execute()
    return gate_status_internal(supabase, event_id)


def gate_status_internal(supabase, event_id: str) -> dict:
    event = _event_or_404(supabase, event_id)
    return {
        "event_id": event_id,
        "qr_revealed": bool(event.get("qr_revealed_at")),
        "qr_revealed_at": event.get("qr_revealed_at"),
        "gate_open": bool(event.get("gate_opened_at")),
        "gate_opened_at": event.get("gate_opened_at"),
        **_counts(supabase, event_id),
    }


@router.post("/reveal-qr")
def reveal_qr(event_id: str, current_user: dict = Depends(get_current_user)):
    """Release QR codes to everyone holding a ticket for this event."""
    return _set_flag(event_id, current_user["id"], "qr_revealed_at", True)


@router.post("/hide-qr")
def hide_qr(event_id: str, current_user: dict = Depends(get_current_user)):
    return _set_flag(event_id, current_user["id"], "qr_revealed_at", False)


@router.post("/open")
def open_gate(event_id: str, current_user: dict = Depends(get_current_user)):
    """Start accepting scans. Codes are revealed at the same time if they
    are not already -- a gate that admits people whose tickets they
    cannot display is not a working gate."""
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(current_user["id"], event["org_group_id"])

    now = datetime.now(timezone.utc).isoformat()
    patch = {"gate_opened_at": now}
    if not event.get("qr_revealed_at"):
        patch["qr_revealed_at"] = now
    supabase.table("events").update(patch).eq("id", event_id).execute()
    return gate_status_internal(supabase, event_id)


@router.post("/close")
def close_gate(event_id: str, current_user: dict = Depends(get_current_user)):
    return _set_flag(event_id, current_user["id"], "gate_opened_at", False)
