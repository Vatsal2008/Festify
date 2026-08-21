"""Ticket theft reports -- filing, routing, and reissue.

Previously a report inserted a row and stopped. Nothing computed who
should decide it, nothing enforced the spec's limits, no admin could
see it, and a valid report never produced a replacement ticket -- which
is the entire point of the feature.

Rules implemented here, from §6 (Ticket Theft & QR Security) and §8
(Support Ticket Routing):

  - a report must be raised at least 1 hour before the event starts
  - at most 2 reports per ticket per customer
  - a college student's report goes to their College Admin, everyone
    else's to a Super Admin
  - on approval the old verify code is dead and a new ticket is issued
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.authz import is_college_admin, is_super_admin, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.services.notifications import notify

router = APIRouter(prefix="/theft-reports", tags=["theft"])
logger = logging.getLogger(__name__)

REPORT_CUTOFF = timedelta(hours=1)
MAX_REPORTS_PER_CUSTOMER = 2


def _parse(ts: str | None):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


@router.post("")
def file_report(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    ticket_id = (body or {}).get("ticket_id")
    if not ticket_id:
        raise HTTPException(status_code=422, detail="ticket_id is required")

    supabase = get_supabase()
    tickets = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not tickets.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = tickets.data[0]

    if ticket["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="That is not your ticket.")

    if ticket["status"] in ("scanned", "used"):
        # §6: if the thief scans first, nothing can be done. Saying so
        # plainly beats opening a case that cannot be resolved.
        raise HTTPException(
            status_code=409,
            detail="This ticket has already been scanned. Once used, a ticket cannot be recovered.",
        )
    if ticket["status"] == "theft_reported":
        raise HTTPException(status_code=409, detail="A report on this ticket is already open.")
    if ticket["status"] in ("cancelled", "revoked", "expired"):
        raise HTTPException(status_code=409, detail=f"This ticket is {ticket['status']}.")

    events = supabase.table("events").select("*").eq("id", ticket["event_id"]).execute()
    event = events.data[0] if events.data else {}
    starts_at = _parse(event.get("starts_at"))
    if starts_at and datetime.now(timezone.utc) > starts_at - REPORT_CUTOFF:
        raise HTTPException(
            status_code=409,
            detail="Theft reports must be raised at least 1 hour before the event starts.",
        )

    # The limit is per customer per ticket, not per ticket. Counting all
    # reports on the ticket would let one person's two reports block a
    # different owner after a transfer.
    mine = (
        supabase.table("ticket_theft_reports")
        .select("id", count="exact")
        .eq("ticket_id", ticket_id)
        .eq("reported_by", current_user["id"])
        .execute()
    )
    if (mine.count or 0) >= MAX_REPORTS_PER_CUSTOMER:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You have already filed {MAX_REPORTS_PER_CUSTOMER} reports for this ticket. "
                "Raise a support ticket instead."
            ),
        )

    # Routing is decided now and frozen. A student verifying their
    # college email mid-review should not silently move the case to a
    # different desk.
    college_id = current_user.get("college_id")
    is_verified_student = bool(current_user.get("college_verified_at")) and bool(college_id)
    routed_to = "college_admin" if is_verified_student else "super_admin"

    total = (
        supabase.table("ticket_theft_reports")
        .select("id", count="exact")
        .eq("ticket_id", ticket_id)
        .execute()
    )

    inserted = (
        supabase.table("ticket_theft_reports")
        .insert({
            "ticket_id": ticket_id,
            "reported_by": current_user["id"],
            "report_number": (total.count or 0) + 1,
            "status": "pending",
            "routed_to": routed_to,
            "college_id": college_id if is_verified_student else None,
            "reason": (body.get("reason") or "").strip()[:500] or None,
        })
        .execute()
        .data[0]
    )

    # Freeze the ticket while the case is open, so it cannot be sold,
    # gifted or scanned in the meantime.
    supabase.table("tickets").update({"status": "theft_reported"}).eq("id", ticket_id).execute()

    return {
        **inserted,
        "routed_to_label": "your college admin" if routed_to == "college_admin" else "the Festify team",
    }


def _decorate(supabase, rows: list) -> list:
    """Inline reporter, ticket and event -- a reviewer needs all three."""
    if not rows:
        return []

    user_ids = list({r["reported_by"] for r in rows if r.get("reported_by")})
    ticket_ids = list({r["ticket_id"] for r in rows if r.get("ticket_id")})

    users = {}
    if user_ids:
        res = supabase.table("users").select("id, full_name, email").in_("id", user_ids).execute()
        users = {u["id"]: u for u in res.data}

    tickets, events = {}, {}
    if ticket_ids:
        res = supabase.table("tickets").select("*").in_("id", ticket_ids).execute()
        tickets = {t["id"]: t for t in res.data}
        event_ids = list({t["event_id"] for t in res.data if t.get("event_id")})
        if event_ids:
            ev = supabase.table("events").select("id, title, starts_at, venue").in_("id", event_ids).execute()
            events = {e["id"]: e for e in ev.data}

    out = []
    for r in rows:
        t = tickets.get(r.get("ticket_id")) or {}
        out.append({
            **r,
            "reporter": users.get(r.get("reported_by")),
            "ticket": {
                "id": t.get("id"),
                "status": t.get("status"),
                "booking_code": (t.get("verify_code") or "")[:8].upper(),
                "price_paid": t.get("price_paid"),
            },
            "event": events.get(t.get("event_id")),
        })
    return out


@router.get("")
def list_reports(
    status: str = Query("pending"),
    current_user: dict = Depends(get_current_user),
):
    """Reports this admin is responsible for.

    A super admin sees everything, including college-routed cases, so
    nothing can sit unowned if a college has no active admin. A college
    admin sees only their own college's.
    """
    supabase = get_supabase()

    query = supabase.table("ticket_theft_reports").select("*")
    if status and status != "all":
        query = query.eq("status", status)

    if is_super_admin(current_user):
        rows = query.order("created_at", desc=True).execute().data
        return _decorate(supabase, rows)

    admin_of = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .execute()
    )
    college_ids = [r["college_id"] for r in admin_of.data]
    if not college_ids:
        raise HTTPException(status_code=403, detail="You do not review theft reports.")

    rows = (
        query.eq("routed_to", "college_admin")
        .in_("college_id", college_ids)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return _decorate(supabase, rows)


def _may_decide(current_user: dict, report: dict) -> bool:
    if is_super_admin(current_user):
        return True
    if report.get("routed_to") != "college_admin":
        return False
    return is_college_admin(current_user["id"], report.get("college_id"))


@router.post("/{report_id}/approve")
def approve_report(
    report_id: str, body: dict = Body(default={}), current_user: dict = Depends(get_current_user)
):
    """Kill the compromised ticket and issue its replacement."""
    supabase = get_supabase()
    res = supabase.table("ticket_theft_reports").select("*").eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = res.data[0]

    if not _may_decide(current_user, report):
        raise HTTPException(status_code=403, detail="Not authorized to decide this report")
    if report["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"This report is already {report['status']}.")

    tickets = supabase.table("tickets").select("*").eq("id", report["ticket_id"]).execute()
    if not tickets.data:
        raise HTTPException(status_code=404, detail="Ticket no longer exists")
    old = tickets.data[0]

    # Revoke before issuing. If the insert failed after the old code was
    # still live, both codes would work at the gate.
    supabase.table("tickets").update({"status": "revoked"}).eq("id", old["id"]).execute()

    replacement = (
        supabase.table("tickets")
        .insert({
            "event_id": old["event_id"],
            "ticket_tier_id": old["ticket_tier_id"],
            "order_id": old.get("order_id"),
            "owner_id": old["owner_id"],
            # A fresh secret: the point of the reissue is that whoever
            # holds the old QR cannot use it.
            "verify_code": secrets.token_hex(16),
            "price_paid": old.get("price_paid"),
            "status": "issued",
        })
        .execute()
        .data[0]
    )

    updated = (
        supabase.table("ticket_theft_reports")
        .update({
            "status": "approved",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_note": (body or {}).get("note"),
            "replacement_ticket_id": replacement["id"],
        })
        .eq("id", report_id)
        .execute()
        .data[0]
    )

    logger.info("Theft report %s approved; ticket %s revoked, %s issued",
                report_id, old["id"], replacement["id"])

    new_code = replacement["verify_code"][:8].upper()
    notify(
        user_id=old["owner_id"],
        type_key="ticket_reissued",
        title="Your ticket has been replaced",
        body=f"New booking code: {new_code}. The old code no longer works.",
        link="/me/tickets",
        email_subject="Your Festify ticket has been reissued",
        email_body="\n".join([
            "Your theft report was approved and your ticket has been replaced.",
            "",
            f"New booking code: {new_code}",
            "",
            "The previous code and QR are now dead and will be refused at the",
            "gate. Open the app to see your new ticket.",
        ]),
    )
    return {
        **updated,
        "replacement": {
            "id": replacement["id"],
            "booking_code": replacement["verify_code"][:8].upper(),
        },
    }


@router.post("/{report_id}/reject")
def reject_report(
    report_id: str, body: dict = Body(default={}), current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("ticket_theft_reports").select("*").eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = res.data[0]

    if not _may_decide(current_user, report):
        raise HTTPException(status_code=403, detail="Not authorized to decide this report")
    if report["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"This report is already {report['status']}.")

    # Release the freeze: a rejected report means the ticket was never
    # compromised, so it goes back to being usable.
    supabase.table("tickets").update({"status": "issued"}).eq("id", report["ticket_id"]).execute()

    note = (body or {}).get("note")
    lines = [
        "Your theft report was reviewed and not approved.",
        "",
        "Your original ticket is active again and will work at the gate.",
    ]
    if note:
        lines += ["", f"Note from the reviewer: {note}"]

    notify(
        user_id=report["reported_by"],
        type_key="theft_report_decision",
        title="Theft report not approved",
        body="Your original ticket is active again and can be used at the gate.",
        link="/me/tickets",
        email_subject="About your Festify theft report",
        email_body="\n".join(lines),
    )

    return (
        supabase.table("ticket_theft_reports")
        .update({
            "status": "rejected",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_note": (body or {}).get("note"),
        })
        .eq("id", report_id)
        .execute()
        .data[0]
    )


@router.get("/mine")
def my_reports(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    rows = (
        supabase.table("ticket_theft_reports")
        .select("*")
        .eq("reported_by", current_user["id"])
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return _decorate(supabase, rows)
