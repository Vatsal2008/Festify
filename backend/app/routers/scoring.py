from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import ScoringConfigSet

router = APIRouter(tags=["scoring"])


@router.get("/scoring-config/{key}")
def get_scoring_config(key: str):
    supabase = get_supabase()
    result = supabase.table("scoring_config").select("*").eq("key", key).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No config value set for this key")
    return result.data[0]


@router.put("/scoring-config")
def set_scoring_config(body: ScoringConfigSet, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    result = (
        supabase.table("scoring_config")
        .upsert(
            {
                "key": body.key,
                "value": body.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user["id"],
            }
        )
        .execute()
    )
    return result.data[0]


@router.get("/org-groups/{org_group_id}/score")
def get_org_score(org_group_id: str):
    supabase = get_supabase()
    org_result = (
        supabase.table("org_groups")
        .select("score, trust_tier, successful_event_count, recent_failed_event_count")
        .eq("id", org_group_id)
        .execute()
    )
    if not org_result.data:
        raise HTTPException(status_code=404, detail="Org group not found")

    history = (
        supabase.table("score_events")
        .select("*")
        .eq("org_group_id", org_group_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {**org_result.data[0], "history": history.data}
