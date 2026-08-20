from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events
from app.schemas import OrgGroupCreate

router = APIRouter(prefix="/org-groups", tags=["org-groups"])


@router.post("")
def create_org_group(body: OrgGroupCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    inserted = (
        supabase.table("org_groups")
        .insert(
            {
                "name": body.name,
                "college_id": body.college_id,
                "is_college_committee": body.is_college_committee,
            }
        )
        .execute()
    )
    org_group = inserted.data[0]

    supabase.table("org_member_roles").insert(
        {
            "org_group_id": org_group["id"],
            "user_id": current_user["id"],
            "role": "leader",
            "granted_by": current_user["id"],
        }
    ).execute()

    return org_group


@router.get("/{org_group_id}")
def get_org_group(org_group_id: str):
    supabase = get_supabase()
    result = supabase.table("org_groups").select("*").eq("id", org_group_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Org group not found")
    return result.data[0]


@router.get("/{org_group_id}/events")
def list_org_events(org_group_id: str, current_user: dict = Depends(get_current_user)):
    """All of an org's events, including drafts and non-public ones —
    hence manager-gated, unlike the public GET /events."""
    require_org_manager(current_user["id"], org_group_id)

    supabase = get_supabase()
    result = (
        supabase.table("events")
        .select("*")
        .eq("org_group_id", org_group_id)
        .order("starts_at", desc=True)
        .execute()
    )
    return _enrich_events(supabase, result.data, current_user)


@router.get("/{org_group_id}/members")
def list_org_members(org_group_id: str, current_user: dict = Depends(get_current_user)):
    require_org_manager(current_user["id"], org_group_id)

    supabase = get_supabase()
    roles = (
        supabase.table("org_member_roles")
        .select("*")
        .eq("org_group_id", org_group_id)
        .execute()
    )
    user_ids = [r["user_id"] for r in roles.data]
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, email, avatar_url, customer_level")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    return [
        {
            "id": r["id"],
            "role": r["role"],
            "user": users_by_id.get(r["user_id"], {"id": r["user_id"]}),
        }
        for r in roles.data
    ]


@router.get("/{org_group_id}/payouts")
def get_org_payouts(org_group_id: str, current_user: dict = Depends(get_current_user)):
    require_org_manager(current_user["id"], org_group_id)

    supabase = get_supabase()
    result = (
        supabase.table("org_payouts")
        .select("*")
        .eq("org_group_id", org_group_id)
        .order("created_at", desc=True)
        .execute()
    )
    ledger = result.data
    simulated_total = sum(row["net_amount"] for row in ledger if row["status"] == "simulated")
    transferred_total = sum(row["net_amount"] for row in ledger if row["status"] == "transferred")

    return {
        "ledger": ledger,
        "simulated_pending_total": simulated_total,
        "actually_transferred_total": transferred_total,
        "note": "simulated_pending_total is what Route would send once approved -- no real transfer has happened.",
    }
