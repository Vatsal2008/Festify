"""Group ticket sharing, joined by a key rather than by invitation.

The problem this replaces: to share tickets you had to invite people by
user id, which means the leader must already know who everyone is
inside Festify. There is no user directory, and building one would mean
making every account searchable by strangers -- a real cost paid by
everyone so that a few people can find their friends.

A key sidesteps it. The leader creates a group against tickets they
have already bought, gets a short key, and sends it over whatever they
already use to talk to those friends. Nobody is exposed, no directory
exists, and the group is closed by default: you cannot find it, you can
only be told about it.

Seats and tickets are the same thing here. The group's size is how many
tickets the leader holds for that event, a ticket is assigned the moment
someone joins, and if the group is not full yet the next joiner takes
the next free one.

Authority is deliberately one-sided. The leader assigns, unassigns and
removes; a member cannot leave on their own. That is not an oversight:
these tickets were bought by the leader, and a member walking out with
one -- or dropping out an hour before doors and stranding the seat --
is the leader's problem to manage, not the member's to decide.
"""
import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException

from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/ticket-groups", tags=["ticket-groups"])
logger = logging.getLogger(__name__)

# Unambiguous alphabet: no O/0, no I/1/L. A key gets read aloud, typed
# from a screenshot and re-typed after autocorrect has had a go at it.
KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
KEY_LENGTH = 8

HOLDABLE = ("issued",)


def _make_key(supabase) -> str:
    for _ in range(12):
        key = "".join(secrets.choice(KEY_ALPHABET) for _ in range(KEY_LENGTH))
        exists = supabase.table("user_groups").select("id").eq("join_key", key).execute().data
        if not exists:
            return key
    raise HTTPException(status_code=500, detail="Could not allocate a join key. Try again.")


def _my_tickets_for_event(supabase, user_id: str, event_id: str) -> list[dict]:
    return (
        supabase.table("tickets")
        .select("*")
        .eq("owner_id", user_id)
        .eq("event_id", event_id)
        .in_("status", list(HOLDABLE))
        .order("created_at")
        .execute()
        .data
    ) or []


def _group_or_404(supabase, group_id: str) -> dict:
    rows = supabase.table("user_groups").select("*").eq("id", group_id).execute().data
    if not rows or rows[0].get("deleted_at"):
        raise HTTPException(status_code=404, detail="Group not found")
    return rows[0]


def _require_leader(group: dict, user: dict) -> None:
    if group["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the group leader can do that.")


def _serialize(supabase, group: dict, viewer_id: str) -> dict:
    members = (
        supabase.table("user_group_members")
        .select("*")
        .eq("group_id", group["id"])
        .execute()
        .data
    ) or []

    user_ids = list({m["user_id"] for m in members} | {group["owner_id"]})
    users = {
        u["id"]: u
        for u in (
            supabase.table("users").select("id, full_name, email, avatar_url").in_("id", user_ids).execute().data
            or []
        )
    }

    assignments = (
        supabase.table("ticket_assignments")
        .select("*")
        .eq("group_id", group["id"])
        .eq("status", "accepted")
        .execute()
        .data
    ) or []
    ticket_by_user = {a["recipient_id"]: a for a in assignments}

    ticket_ids = [a["ticket_id"] for a in assignments if a.get("ticket_id")]
    tickets = {}
    if ticket_ids:
        tickets = {
            t["id"]: t
            for t in (
                supabase.table("tickets").select("id, verify_code, status").in_("id", ticket_ids).execute().data
                or []
            )
        }

    event = (
        supabase.table("events").select("id, title, starts_at, venue").eq("id", group["event_id"]).execute().data
    )
    is_leader = group["owner_id"] == viewer_id

    def member_row(user_id: str) -> dict:
        a = ticket_by_user.get(user_id)
        t = tickets.get(a["ticket_id"]) if a else None
        u = users.get(user_id) or {}
        return {
            "user_id": user_id,
            "name": u.get("full_name") or "Festify user",
            # The leader coordinates real people and needs to tell them
            # apart; members see each other by name only.
            "email": u.get("email") if is_leader else None,
            "avatar_url": u.get("avatar_url"),
            "is_leader": user_id == group["owner_id"],
            "has_ticket": bool(t),
            "ticket_id": t["id"] if t else None,
            "booking_code": (t.get("verify_code") or "")[:8].upper() if t else None,
        }

    ordered = [group["owner_id"]] + [m["user_id"] for m in members if m["user_id"] != group["owner_id"]]
    rows = [member_row(uid) for uid in ordered]
    seated = sum(1 for r in rows if r["has_ticket"])

    return {
        "id": group["id"],
        "name": group["name"],
        "event": event[0] if event else None,
        "size": group.get("size") or 0,
        "members": rows,
        "seats_taken": seated,
        "seats_free": max(0, (group.get("size") or 0) - seated),
        "is_leader": is_leader,
        # The key is a credential: only the leader ever receives it.
        "join_key": group.get("join_key") if is_leader else None,
        "closed": bool(group.get("closed_at")),
        "created_at": group.get("created_at"),
    }


def _assign_next_free_ticket(supabase, group: dict, user_id: str) -> dict | None:
    """Hand this member the next unassigned ticket the leader holds."""
    held = _my_tickets_for_event(supabase, group["owner_id"], group["event_id"])
    taken = {
        a["ticket_id"]
        for a in (
            supabase.table("ticket_assignments")
            .select("ticket_id")
            .eq("group_id", group["id"])
            .eq("status", "accepted")
            .execute()
            .data
            or []
        )
    }
    free = [t for t in held if t["id"] not in taken]
    if not free:
        return None

    ticket = free[0]
    inserted = (
        supabase.table("ticket_assignments")
        .insert({
            "ticket_id": ticket["id"],
            "group_id": group["id"],
            "recipient_id": user_id,
            # Accepted outright: joining with the key IS the acceptance.
            # An invite-and-confirm round trip would leave seats in limbo
            # while the leader is trying to count heads.
            "status": "accepted",
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "responded_at": datetime.now(timezone.utc).isoformat(),
        })
        .execute()
        .data
    )
    return inserted[0] if inserted else None


@router.post("")
def create_group(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Open a group against tickets you already hold for one event."""
    supabase = get_supabase()
    event_id = (body or {}).get("event_id")
    if not event_id:
        raise HTTPException(status_code=422, detail="event_id is required")

    held = _my_tickets_for_event(supabase, current_user["id"], event_id)
    if not held:
        raise HTTPException(
            status_code=409,
            detail="You have no tickets for this event, so there is nothing to share.",
        )
    if len(held) < 2:
        raise HTTPException(
            status_code=409,
            detail="A group needs at least two tickets — one for you and one to share.",
        )

    existing = (
        supabase.table("user_groups")
        .select("id")
        .eq("owner_id", current_user["id"])
        .eq("event_id", event_id)
        .is_("deleted_at", "null")
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="You already have a group for this event.")

    events = supabase.table("events").select("title").eq("id", event_id).execute().data
    if not events:
        raise HTTPException(status_code=404, detail="Event not found")

    leader_name = (current_user.get("full_name") or "Festify user").strip()
    name = f"{leader_name} · {events[0]['title']} · Group"

    group = (
        supabase.table("user_groups")
        .insert({
            "owner_id": current_user["id"],
            "event_id": event_id,
            "name": name[:120],
            "join_key": _make_key(supabase),
            "size": len(held),
        })
        .execute()
        .data[0]
    )

    supabase.table("user_group_members").insert({
        "group_id": group["id"],
        "user_id": current_user["id"],
        "status": "accepted",
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    # The leader takes a seat immediately -- one of the tickets is theirs.
    _assign_next_free_ticket(supabase, group, current_user["id"])
    return _serialize(supabase, _group_or_404(supabase, group["id"]), current_user["id"])


@router.get("/mine")
def my_groups(current_user: dict = Depends(get_current_user)):
    """Groups this user leads or belongs to."""
    supabase = get_supabase()
    memberships = (
        supabase.table("user_group_members")
        .select("group_id")
        .eq("user_id", current_user["id"])
        .execute()
        .data
    ) or []
    ids = list({m["group_id"] for m in memberships})
    if not ids:
        return []
    groups = (
        supabase.table("user_groups")
        .select("*")
        .in_("id", ids)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
        .data
    ) or []
    return [_serialize(supabase, g, current_user["id"]) for g in groups]


@router.post("/join")
def join_with_key(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Join by key, and take a ticket if one is free."""
    supabase = get_supabase()
    key = ((body or {}).get("key") or "").strip().upper().replace(" ", "").replace("-", "")
    if not key:
        raise HTTPException(status_code=422, detail="Enter the group key.")

    rows = supabase.table("user_groups").select("*").eq("join_key", key).execute().data
    if not rows or rows[0].get("deleted_at"):
        # Deliberately the same answer for a wrong key and a deleted
        # group: distinguishing them turns this into a key oracle.
        raise HTTPException(status_code=404, detail="No group matches that key.")
    group = rows[0]

    if group.get("closed_at"):
        raise HTTPException(status_code=409, detail="That group is closed.")

    already = (
        supabase.table("user_group_members")
        .select("id")
        .eq("group_id", group["id"])
        .eq("user_id", current_user["id"])
        .execute()
        .data
    )
    if already:
        return _serialize(supabase, group, current_user["id"])

    seated = (
        supabase.table("ticket_assignments")
        .select("id", count="exact")
        .eq("group_id", group["id"])
        .eq("status", "accepted")
        .execute()
        .count
    ) or 0
    if seated >= (group.get("size") or 0):
        raise HTTPException(
            status_code=409,
            detail="That group is full — every ticket in it is taken.",
        )

    supabase.table("user_group_members").insert({
        "group_id": group["id"],
        "user_id": current_user["id"],
        "status": "accepted",
        "responded_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    _assign_next_free_ticket(supabase, group, current_user["id"])
    return _serialize(supabase, _group_or_404(supabase, group["id"]), current_user["id"])


@router.get("/{group_id}")
def get_group(group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    group = _group_or_404(supabase, group_id)
    member = (
        supabase.table("user_group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", current_user["id"])
        .execute()
        .data
    )
    if not member and group["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You are not in this group.")
    return _serialize(supabase, group, current_user["id"])


@router.post("/{group_id}/unassign")
def unassign(group_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Take a ticket back from a member, leaving them in the group."""
    supabase = get_supabase()
    group = _group_or_404(supabase, group_id)
    _require_leader(group, current_user)

    user_id = (body or {}).get("user_id")
    if not user_id:
        raise HTTPException(status_code=422, detail="user_id is required")
    if user_id == group["owner_id"]:
        raise HTTPException(status_code=409, detail="You cannot take your own ticket back.")

    supabase.table("ticket_assignments").update({"status": "revoked"}).eq(
        "group_id", group_id
    ).eq("recipient_id", user_id).eq("status", "accepted").execute()

    return _serialize(supabase, group, current_user["id"])


@router.post("/{group_id}/assign")
def assign(group_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Give a free ticket to a member who has none."""
    supabase = get_supabase()
    group = _group_or_404(supabase, group_id)
    _require_leader(group, current_user)

    user_id = (body or {}).get("user_id")
    if not user_id:
        raise HTTPException(status_code=422, detail="user_id is required")

    member = (
        supabase.table("user_group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
        .data
    )
    if not member:
        raise HTTPException(status_code=404, detail="That person is not in this group.")

    held = (
        supabase.table("ticket_assignments")
        .select("id")
        .eq("group_id", group_id)
        .eq("recipient_id", user_id)
        .eq("status", "accepted")
        .execute()
        .data
    )
    if held:
        raise HTTPException(status_code=409, detail="They already have a ticket in this group.")

    if not _assign_next_free_ticket(supabase, group, user_id):
        raise HTTPException(status_code=409, detail="No free tickets left in this group.")
    return _serialize(supabase, group, current_user["id"])


@router.delete("/{group_id}/members/{user_id}")
def remove_member(group_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove someone, returning their ticket to the pool.

    Only the leader. A member cannot remove themselves: the tickets are
    the leader's, and someone dropping out silently an hour before doors
    strands a seat nobody knows is free.
    """
    supabase = get_supabase()
    group = _group_or_404(supabase, group_id)
    _require_leader(group, current_user)

    if user_id == group["owner_id"]:
        raise HTTPException(status_code=409, detail="The leader cannot be removed from their own group.")

    supabase.table("ticket_assignments").update({"status": "revoked"}).eq(
        "group_id", group_id
    ).eq("recipient_id", user_id).eq("status", "accepted").execute()
    supabase.table("user_group_members").delete().eq("group_id", group_id).eq(
        "user_id", user_id
    ).execute()

    return _serialize(supabase, group, current_user["id"])


@router.post("/{group_id}/rotate-key")
def rotate_key(group_id: str, current_user: dict = Depends(get_current_user)):
    """Issue a new key, invalidating the old one."""
    supabase = get_supabase()
    group = _group_or_404(supabase, group_id)
    _require_leader(group, current_user)
    supabase.table("user_groups").update({"join_key": _make_key(supabase)}).eq(
        "id", group_id
    ).execute()
    return _serialize(supabase, _group_or_404(supabase, group_id), current_user["id"])
