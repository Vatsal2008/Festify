"""Platform-wide listing endpoints used by the admin surfaces and by the
signup/apply flows (colleges). Kept separate from the per-resource
routers because these are cross-cutting reads rather than operations on
one entity.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.authz import is_super_admin, require_super_admin
from app.core import redis_client
from app.core.config import settings
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events
from app.schemas import SuperAdminCreate, SuperAdminOtpVerify

router = APIRouter(tags=["platform"])
logger = logging.getLogger(__name__)


@router.get("/colleges")
def list_colleges():
    """Public: needed by onboarding and the organizer application form."""
    supabase = get_supabase()
    return supabase.table("colleges").select("*").order("name").execute().data


@router.get("/org-groups")
def list_org_groups(limit: int = Query(100, le=500)):
    """Directory of organizers, ordered by score, with current ban state.

    Ban state is joined in here because the admin organizer table needs
    it per row, and querying it per organizer would be an N+1.
    """
    supabase = get_supabase()
    orgs = (
        supabase.table("org_groups")
        .select("*")
        .order("score", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    if not orgs:
        return []

    bans = (
        supabase.table("org_bans")
        .select("org_group_id, stage, is_active, created_at")
        .in_("org_group_id", [o["id"] for o in orgs])
        .eq("is_active", True)
        .execute()
        .data
    )
    ban_by_org = {}
    for b in bans:
        ban_by_org.setdefault(b["org_group_id"], b)

    return [
        {
            **o,
            # Name these the way the client reads them, so the admin table
            # does not have to know the column names.
            "score_points": o.get("score") or 0,
            "successful_events_count": o.get("successful_event_count") or 0,
            "banned": o["id"] in ban_by_org,
            "ban_stage": ban_by_org.get(o["id"], {}).get("stage"),
        }
        for o in orgs
    ]


@router.get("/support-tickets")
def list_all_support_tickets(current_user: dict = Depends(get_current_user)):
    """Everything waiting on a support decision, from both sources.

    This read only support_tickets, while theft reports are written to
    ticket_theft_reports by a separate flow. Nothing joined the two, so
    a filed theft report was stored correctly and then appeared nowhere
    an admin looks -- the queue showed an empty table while real reports
    sat unattended.

    Both are normalised into one shape with a `source` discriminator
    rather than returned as two lists, because the admin's question is
    "what needs attention", not "which table is it in".
    """
    require_super_admin(current_user)
    supabase = get_supabase()

    tickets = (
        supabase.table("support_tickets")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    thefts = (
        supabase.table("ticket_theft_reports")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )

    user_ids = list(
        {t["raised_by"] for t in tickets if t.get("raised_by")}
        | {r["reported_by"] for r in thefts if r.get("reported_by")}
    )
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, email")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    # Theft reports carry the ticket and event an admin needs to judge
    # them; without those the row is an id and a timestamp.
    ticket_ids = [r["ticket_id"] for r in thefts if r.get("ticket_id")]
    tickets_by_id, events_by_id = {}, {}
    if ticket_ids:
        tk = supabase.table("tickets").select("*").in_("id", ticket_ids).execute()
        tickets_by_id = {t["id"]: t for t in tk.data}
        event_ids = list({t["event_id"] for t in tk.data if t.get("event_id")})
        if event_ids:
            ev = (
                supabase.table("events")
                .select("id, title, starts_at, venue")
                .in_("id", event_ids)
                .execute()
            )
            events_by_id = {e["id"]: e for e in ev.data}

    items = [
        {
            **t,
            "source": "support_ticket",
            "kind": t.get("category") or "Support request",
            "raised_by_user": users_by_id.get(t.get("raised_by")),
        }
        for t in tickets
    ]

    for r in thefts:
        tk = tickets_by_id.get(r.get("ticket_id")) or {}
        items.append({
            **r,
            "source": "theft_report",
            "kind": "Stolen ticket",
            # Aliased to the support shape so one table renders both
            # without branching on every field.
            "raised_by": r.get("reported_by"),
            "raised_by_user": users_by_id.get(r.get("reported_by")),
            "subject": f"Stolen ticket · {(events_by_id.get(tk.get('event_id')) or {}).get('title', 'event')}",
            "ticket": {
                "id": tk.get("id"),
                "status": tk.get("status"),
                "booking_code": (tk.get("verify_code") or "")[:8].upper(),
            },
            "event": events_by_id.get(tk.get("event_id")),
        })

    # Pending first, then newest. An admin opens this page to find what
    # is unresolved, not to read history.
    items.sort(
        key=lambda i: (
            0 if (i.get("status") in ("open", "pending")) else 1,
            i.get("created_at") or "",
        ),
        reverse=False,
    )
    items.sort(key=lambda i: i.get("created_at") or "", reverse=True)
    items.sort(key=lambda i: 0 if i.get("status") in ("open", "pending") else 1)
    return items


def _audit(supabase, actor_id: str, action_type: str, target_type: str,
           target_id: str, metadata: dict | None = None) -> None:
    """Record an administrative action.

    Nothing in the codebase wrote to audit_log, so the audit page read an
    always-empty table. Super admin edits are the clearest case for it:
    they change another organiser's event, and without a record there is
    nothing to say who did it or what it was before.

    Never allowed to break the operation it is recording -- a failed log
    write must not roll back a change that already happened.
    """
    try:
        supabase.table("audit_log").insert({
            "actor_id": actor_id,
            "action_type": action_type,
            "target_type": target_type,
            "target_id": target_id,
            "metadata": metadata or {},
        }).execute()
    except Exception:
        logger.exception("audit write failed: %s on %s", action_type, target_id)


# Statuses a super admin may set. Wider than the organiser's set, which
# is limited to draft/live/early_access/on_sale, because cancelling or
# postponing someone else's event is exactly the intervention this
# surface exists for. sold_out is excluded deliberately: it is a
# consequence of tickets running out, not a label to apply by hand.
SUPER_EVENT_STATUSES = {
    "draft", "live", "early_access", "on_sale",
    "ongoing", "completed", "cancelled", "postponed",
}
SUPER_EVENT_VISIBILITY = {"public", "unlisted", "private"}


@router.get("/super/events")
def list_all_events(
    q: str | None = None,
    status: str | None = None,
    limit: int = Query(100, le=300),
    current_user: dict = Depends(get_current_user),
):
    """Every event on the platform, whatever its state.

    Public discovery filters to published statuses and public
    visibility, which is correct there and useless here -- the events a
    super admin most needs to reach are precisely the drafts, the
    private ones and the cancelled ones that discovery hides.
    """
    require_super_admin(current_user)
    supabase = get_supabase()

    query = supabase.table("events").select("*")
    if status and status != "all":
        query = query.eq("status", status)
    if q:
        query = query.or_(f"title.ilike.%{q}%,venue.ilike.%{q}%")

    rows = query.order("starts_at", desc=True).limit(limit).execute().data or []
    events = _enrich_events(supabase, rows, current_user)

    # The admin table lists events belonging to other people, so it has
    # to name the college as well as the organiser -- "who owns this"
    # is the first question on this screen.
    college_ids = list({e.get("college_id") for e in events if e.get("college_id")})
    colleges = {}
    if college_ids:
        colleges = {
            c["id"]: c["name"]
            for c in supabase.table("colleges").select("id, name").in_("id", college_ids).execute().data or []
        }

    for e in events:
        e["college_name"] = colleges.get(e.get("college_id"))
    return events


@router.patch("/super/events/{event_id}")
def update_any_event(
    event_id: str,
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
):
    """Edit any event's timing, status, visibility or headline details.

    Only the listed fields are writable. Taking the request body as a
    patch wholesale would let a caller set org_group_id or college_id
    and move an event to a different owner, which is not what this
    screen is for.
    """
    require_super_admin(current_user)
    supabase = get_supabase()

    existing = supabase.table("events").select("*").eq("id", event_id).execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    before = existing[0]

    EDITABLE = {"title", "venue", "description", "starts_at", "ends_at",
                "capacity", "status", "visibility"}
    # The serializer renames three columns on the way out -- status is
    # published as `state`, starts_at as `start_date`, ends_at as
    # `end_date` -- so those are the names the entire client vocabulary
    # uses. Accept them here rather than making one screen translate
    # back into column names it never sees anywhere else. Sending a
    # field under both names is a caller bug, so the column name wins
    # and the alias is ignored rather than silently overriding it.
    CLIENT_ALIASES = {"state": "status", "start_date": "starts_at", "end_date": "ends_at"}
    body = dict(body or {})
    for alias, column in CLIENT_ALIASES.items():
        if alias in body and column not in body:
            body[column] = body.pop(alias)
    patch = {k: v for k, v in body.items() if k in EDITABLE}
    if not patch:
        raise HTTPException(status_code=422, detail="No editable fields supplied.")

    if "status" in patch and patch["status"] not in SUPER_EVENT_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {', '.join(sorted(SUPER_EVENT_STATUSES))}",
        )
    if "visibility" in patch and patch["visibility"] not in SUPER_EVENT_VISIBILITY:
        raise HTTPException(
            status_code=422,
            detail=f"visibility must be one of: {', '.join(sorted(SUPER_EVENT_VISIBILITY))}",
        )

    if "title" in patch:
        patch["title"] = (patch["title"] or "").strip()
        if not patch["title"]:
            raise HTTPException(status_code=422, detail="Title cannot be empty.")

    if "capacity" in patch and patch["capacity"] is not None:
        try:
            patch["capacity"] = int(patch["capacity"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Capacity must be a whole number.")
        if patch["capacity"] < 0:
            raise HTTPException(status_code=422, detail="Capacity cannot be negative.")

    # An end before its start is the one combination that silently
    # breaks every downstream duration calculation, so it is rejected
    # against the merged record rather than only against what was sent.
    starts = patch.get("starts_at", before.get("starts_at"))
    ends = patch.get("ends_at", before.get("ends_at"))
    if starts and ends:
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

    # Record only what actually changed, with both sides of each change,
    # so the log can answer "what was this before" without a snapshot.
    changed = {
        key: {"from": before.get(key), "to": value}
        for key, value in patch.items()
        if before.get(key) != value
    }
    if changed:
        _audit(
            supabase, current_user["id"], "super_admin.event_updated", "event", event_id,
            {"title": before.get("title"), "changes": changed},
        )

    return _enrich_events(supabase, updated, current_user)[0]


@router.get("/platform-stats")
def platform_stats(
    days: int = Query(14, ge=7, le=60),
    current_user: dict = Depends(get_current_user),
):
    """Headline counts for the super admin dashboard, each with a daily
    series behind it.

    The dashboard displayed four hard-coded numbers -- 23 organisers, a
    revenue figure of Rs 2.4 crore -- that were never read from anything.
    A fabricated metric is worse than an absent one: it looks like a
    measurement, so it gets believed and acted on. Every number here is
    counted from a table, and where a trend cannot be derived the series
    comes back empty and the client draws no sparkline rather than
    inventing a shape.

    Rows are fetched by created_at once and bucketed in Python. Asking
    the database for one count per day would be `days` round trips per
    metric for data that is a few hundred rows wide.
    """
    require_super_admin(current_user)
    supabase = get_supabase()

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    def series(table: str, column: str = "created_at", **filters) -> list[int]:
        """Count rows per day over the window, oldest bucket first."""
        try:
            q = supabase.table(table).select(column).gte(column, since)
            for key, value in filters.items():
                q = q.eq(key, value)
            rows = q.execute().data or []
        except Exception:
            # A metric that cannot be read must not take the whole
            # dashboard down with it; the card renders without a trend.
            logger.exception("platform stats: series failed for %s", table)
            return []

        buckets: dict[str, int] = {}
        for row in rows:
            raw = row.get(column)
            if not raw:
                continue
            buckets[str(raw)[:10]] = buckets.get(str(raw)[:10], 0) + 1

        today = datetime.now(timezone.utc).date()
        return [
            buckets.get((today - timedelta(days=offset)).isoformat(), 0)
            for offset in range(days - 1, -1, -1)
        ]

    def total(table: str, **filters) -> int:
        try:
            q = supabase.table(table).select("id", count="exact")
            for key, value in filters.items():
                q = q.eq(key, value)
            return q.execute().count or 0
        except Exception:
            logger.exception("platform stats: count failed for %s", table)
            return 0

    # Revenue is summed from captured orders only. Pending and failed
    # orders are money that does not exist yet.
    revenue = 0
    try:
        paid = (
            supabase.table("orders")
            .select("total_amount, created_at")
            .eq("status", "paid")
            .gte("created_at", since)
            .execute()
            .data
            or []
        )
        revenue = sum(int(o.get("total_amount") or 0) for o in paid)
    except Exception:
        logger.exception("platform stats: revenue failed")
        paid = []

    revenue_buckets: dict[str, int] = {}
    for order in paid:
        day = str(order.get("created_at") or "")[:10]
        if day:
            revenue_buckets[day] = revenue_buckets.get(day, 0) + int(
                order.get("total_amount") or 0
            )
    today = datetime.now(timezone.utc).date()
    revenue_series = [
        revenue_buckets.get((today - timedelta(days=offset)).isoformat(), 0)
        for offset in range(days - 1, -1, -1)
    ]

    open_support = 0
    try:
        open_support = (
            supabase.table("support_tickets")
            .select("id", count="exact")
            .in_("status", ["open", "pending"])
            .execute()
            .count
            or 0
        )
        open_support += (
            supabase.table("ticket_theft_reports")
            .select("id", count="exact")
            .eq("status", "pending")
            .execute()
            .count
            or 0
        )
    except Exception:
        logger.exception("platform stats: support count failed")

    return {
        "window_days": days,
        "metrics": [
            {
                "key": "organisers",
                "label": "Active organisers",
                "value": total("org_groups"),
                "series": series("org_groups"),
                "format": "count",
            },
            {
                "key": "events",
                "label": "Events created",
                "value": total("events"),
                "series": series("events"),
                "format": "count",
            },
            {
                "key": "support",
                "label": "Awaiting support",
                "value": open_support,
                # A backlog is a level, not a rate -- a daily count of
                # arrivals would say nothing about how many are waiting.
                "series": [],
                "format": "count",
            },
            {
                "key": "revenue",
                "label": f"Revenue, last {days} days",
                "value": revenue,
                "series": revenue_series,
                # orders.total_amount is stored in rupees; only the
                # Razorpay handoff converts to paise.
                "format": "currency",
            },
        ],
    }


@router.get("/audit-log")
def list_audit_log(
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user),
):
    """Recent administrative actions, with the actor and target named.

    The raw rows carry actor_id and target_id as bare UUIDs, which is
    not something anyone can read off a screen. The client was also
    reading `actor`, `target` and `timestamp`, none of which are columns
    on this table -- so even once the log had rows, every cell would
    have rendered blank. Both names are supplied: the real column and
    the one the client already asks for.
    """
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = (
        supabase.table("audit_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    ) or []

    actor_ids = list({r["actor_id"] for r in rows if r.get("actor_id")})
    actors = {}
    if actor_ids:
        actors = {
            u["id"]: (u.get("full_name") or u.get("email") or "Unknown")
            for u in supabase.table("users").select("id, full_name, email").in_("id", actor_ids).execute().data or []
        }

    event_ids = list({r["target_id"] for r in rows if r.get("target_type") == "event" and r.get("target_id")})
    event_titles = {}
    if event_ids:
        event_titles = {
            e["id"]: e["title"]
            for e in supabase.table("events").select("id, title").in_("id", event_ids).execute().data or []
        }

    out = []
    for r in rows:
        meta = r.get("metadata") or {}
        target_label = event_titles.get(r.get("target_id")) or meta.get("title")
        out.append({
            **r,
            "actor": actors.get(r.get("actor_id"), "System"),
            "target": target_label or f"{r.get('target_type') or 'record'} {str(r.get('target_id') or '')[:8]}",
            "timestamp": r.get("created_at"),
            # A flat summary of what moved, so the table can show the
            # substance of a change without unpacking the diff itself.
            "summary": ", ".join(sorted((meta.get("changes") or {}).keys())) or None,
        })
    return out


@router.get("/scoring-config")
def list_scoring_config(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    return supabase.table("scoring_config").select("*").order("key").execute().data


# ── user lookup + admin management ────────────────────────────────

@router.get("/users/search")
def search_users(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_user)):
    """Find a user by email or name so an admin can be granted a role.
    Super-admin only: this exposes other people's email addresses."""
    require_super_admin(current_user)
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("id, email, full_name, avatar_url, customer_level, college_id")
        .or_(f"email.ilike.%{q}%,full_name.ilike.%{q}%")
        .limit(20)
        .execute()
    )
    return result.data


@router.get("/super-admins")
def list_super_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("super_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    granted = [{**r, "user": users_by_id.get(r["user_id"])} for r in rows]

    # Surface the env-var bootstrap admins too, so the list reflects who
    # actually has access rather than only the DB-granted subset.
    bootstrap = [e.strip() for e in settings.super_admin_emails.split(",") if e.strip()]
    return {"granted": granted, "bootstrap_emails": bootstrap}


@router.post("/super-admins")
def add_super_admin(body: SuperAdminCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()

    target = supabase.table("users").select("id, email").eq("id", body.user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    existing = supabase.table("super_admins").select("id").eq("user_id", body.user_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="That user is already a super admin")

    inserted = (
        supabase.table("super_admins")
        .insert({"user_id": body.user_id, "granted_by": current_user["id"]})
        .execute()
    )
    return {**inserted.data[0], "user": target.data[0]}


@router.delete("/super-admins/{user_id}")
def remove_super_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    if user_id == current_user["id"]:
        # Losing your own access mid-session is never the intent, and
        # could leave the platform with no reachable admin.
        raise HTTPException(status_code=409, detail="You cannot remove your own super admin access")

    supabase = get_supabase()
    supabase.table("super_admins").delete().eq("user_id", user_id).execute()
    return {"removed": user_id}


@router.get("/college-admins/all")
def list_all_college_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("college_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    college_ids = [r["college_id"] for r in rows if r.get("college_id")]

    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    colleges_by_id = {}
    if college_ids:
        cols = supabase.table("colleges").select("id, name").in_("id", college_ids).execute()
        colleges_by_id = {c["id"]: c for c in cols.data}

    return [
        {**r, "user": users_by_id.get(r["user_id"]), "college": colleges_by_id.get(r.get("college_id"))}
        for r in rows
    ]


# ── super admin step-up verification ──────────────────────────────
#
# Being a super admin is decided by account (env allowlist or the
# super_admins table). This adds a second factor on top: a code emailed
# to the admin, required before the panel opens. It is a step-up check on
# an already-authenticated session, not a second login -- so it cannot be
# used to gain access, only to confirm the person holding the session
# also controls the mailbox.
SUPER_ADMIN_OTP_TTL = 600


@router.post("/auth/super-admin/request-code")
def request_super_admin_code(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email address.")

    code = f"{secrets.randbelow(1_000_000):06d}"

    # Send first, store second. Storing before sending leaves a valid code
    # sitting in Redis after a failed send -- accepted by the verify
    # endpoint but never delivered to anyone, which looks to the admin
    # like the code simply "doesn't work".
    try:
        send_email(
            to=email,
            subject="Festify admin access code",
            body=(
                f"Your Festify super admin access code is {code}.\n\n"
                f"It expires in {SUPER_ADMIN_OTP_TTL // 60} minutes.\n\n"
                "If you did not request this, someone may have access to your "
                "Festify session. Sign out on all devices."
            ),
        )
    except Exception as e:
        logger.exception("Could not send super admin code to %s", email)
        raise HTTPException(status_code=502, detail=str(e))

    redis_client.set_with_ttl(f"sa_otp:{current_user['id']}", code, SUPER_ADMIN_OTP_TTL)

    # Never return the code itself; only where it went.
    masked = email[0] + "***" + email[email.index("@"):] if "@" in email else "your email"
    return {"sent_to": masked, "expires_in_seconds": SUPER_ADMIN_OTP_TTL}


@router.post("/auth/super-admin/verify-code")
def verify_super_admin_code(body: SuperAdminOtpVerify, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    stored = redis_client.get(f"sa_otp:{current_user['id']}")
    if not stored:
        raise HTTPException(status_code=400, detail="No code pending, or it has expired. Request a new one.")
    if body.code != stored:
        raise HTTPException(status_code=400, detail="Incorrect code.")

    redis_client.delete(f"sa_otp:{current_user['id']}")
    # Short-lived grant: the panel re-verifies rather than trusting a
    # long-lived flag, so a stolen session is not permanently elevated.
    ticket = secrets.token_urlsafe(32)
    redis_client.set_with_ttl(f"sa_session:{current_user['id']}", ticket, 60 * 60)
    return {"verified": True, "expires_in_seconds": 3600}


@router.get("/auth/super-admin/status")
def super_admin_status(current_user: dict = Depends(get_current_user)):
    """Whether this session has passed the emailed-code check."""
    if not is_super_admin(current_user):
        return {"is_super_admin": False, "verified": False}
    return {
        "is_super_admin": True,
        "verified": bool(redis_client.get(f"sa_session:{current_user['id']}")),
    }


@router.get("/auth/my-roles")
def my_roles(current_user: dict = Depends(get_current_user)):
    """What admin surfaces the signed-in user may see. The client uses
    this to decide which nav entries to render."""
    supabase = get_supabase()
    college_rows = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .execute()
    )
    return {
        "is_super_admin": is_super_admin(current_user),
        "college_admin_of": [r["college_id"] for r in college_rows.data],
    }
