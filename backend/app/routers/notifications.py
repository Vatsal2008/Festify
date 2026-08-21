"""In-app notification feed and per-type preferences."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.services.notifications import TYPES

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(
    limit: int = Query(50, le=200),
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    supabase = get_supabase()
    query = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", current_user["id"])
    )
    if unread_only:
        query = query.is_("read_at", "null")

    rows = query.order("created_at", desc=True).limit(limit).execute().data
    unread = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .is_("read_at", "null")
        .execute()
    )
    return {"notifications": rows, "unread_count": unread.count or 0}


@router.get("/notifications/unread-count")
def unread_count(current_user: dict = Depends(get_current_user)):
    """Cheap enough for the nav bell to poll."""
    supabase = get_supabase()
    res = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .is_("read_at", "null")
        .execute()
    )
    return {"unread_count": res.count or 0}


@router.post("/notifications/{notification_id}/read")
def mark_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = supabase.table("notifications").select("user_id").eq("id", notification_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Notification not found")
    if existing.data[0]["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your notification")

    return (
        supabase.table("notifications")
        .update({"read_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", notification_id)
        .execute()
        .data[0]
    )


@router.post("/notifications/read-all")
def mark_all_read(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    supabase.table("notifications").update(
        {"read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("user_id", current_user["id"]).is_("read_at", "null").execute()
    return {"read_all": True}


@router.get("/notification-preferences")
def get_preferences(current_user: dict = Depends(get_current_user)):
    """Current settings, with every opt-outable type listed.

    Types the spec marks as always-sent are reported as mandatory rather
    than omitted, so the UI can show them greyed out instead of
    pretending they do not exist.
    """
    supabase = get_supabase()
    saved = (
        supabase.table("notification_preferences")
        .select("*")
        .eq("user_id", current_user["id"])
        .execute()
        .data
    )
    by_type = {p["type"]: p for p in saved}

    out = []
    for key, spec in TYPES.items():
        pref = by_type.get(key, {})
        out.append({
            "type": key,
            "mandatory": spec.mandatory,
            "supports_email": spec.email,
            "email_enabled": True if spec.mandatory else pref.get("email_enabled", True),
            "in_app_enabled": True if spec.mandatory else pref.get("in_app_enabled", True),
            "push_enabled": True if spec.mandatory else pref.get("push_enabled", True),
        })
    return {"preferences": out}


@router.put("/notification-preferences")
def update_preferences(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    type_key = (body or {}).get("type")
    spec = TYPES.get(type_key)
    if not spec:
        raise HTTPException(status_code=422, detail="Unknown notification type")
    if spec.mandatory:
        raise HTTPException(
            status_code=409,
            detail="This notification is always sent and cannot be turned off.",
        )

    supabase = get_supabase()
    patch = {
        "user_id": current_user["id"],
        "type": type_key,
        **{
            k: bool(body[k])
            for k in ("email_enabled", "in_app_enabled", "push_enabled")
            if k in body
        },
    }
    return (
        supabase.table("notification_preferences")
        .upsert(patch, on_conflict="user_id,type")
        .execute()
        .data[0]
    )
