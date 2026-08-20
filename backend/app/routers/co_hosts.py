from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import CoHostCreate

router = APIRouter(prefix="/events", tags=["co-hosts"])


@router.post("/{event_id}/co-hosts")
def add_co_host(event_id: str, body: CoHostCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    if body.org_group_id == event_result.data[0]["org_group_id"]:
        raise HTTPException(status_code=422, detail="An org cannot co-host its own event")

    inserted = (
        supabase.table("event_co_hosts")
        .insert(
            {
                "event_id": event_id,
                "org_group_id": body.org_group_id,
                "is_billing_org": body.is_billing_org,
                "display_split_pct": body.display_split_pct,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/{event_id}/co-hosts")
def list_co_hosts(event_id: str):
    supabase = get_supabase()
    result = supabase.table("event_co_hosts").select("*").eq("event_id", event_id).execute()
    return result.data
