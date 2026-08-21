import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_college_admin, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import OrgBanCreate, OrgFlagCreate, OrganizerApplicationCreate
from app.services.notifications import notify

router = APIRouter(tags=["organizer-admin"])
logger = logging.getLogger(__name__)

BAN_ESCALATION_ORDER = ("warning", "7d", "30d", "long")


@router.post("/organizer-applications")
def apply_as_organizer(
    body: OrganizerApplicationCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    routed_to = "college_admin" if body.college_id else "super_admin"

    try:
        inserted = (
            supabase.table("organizer_applications")
            .insert(
                {
                    "applicant_id": current_user["id"],
                    "college_id": body.college_id,
                    "routed_to": routed_to,
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(status_code=409, detail="You already have a pending application")
        raise
    return inserted.data[0]


@router.get("/organizer-applications/mine")
def my_applications(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("organizer_applications")
        .select("*")
        .eq("applicant_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("/organizer-applications/pending")
def pending_applications(college_id: str, current_user: dict = Depends(get_current_user)):
    require_college_admin(current_user["id"], college_id)
    supabase = get_supabase()
    result = (
        supabase.table("organizer_applications")
        .select("*")
        .eq("college_id", college_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    return _with_applicants(supabase, result.data)


def _with_applicants(supabase, rows: list) -> list:
    """Inline the applicant and college on each row.

    A reviewer needs to know who is asking; the raw table holds only
    applicant_id, and looking each one up from the client would be an
    N+1 against the admin table.
    """
    if not rows:
        return []

    user_ids = list({r["applicant_id"] for r in rows if r.get("applicant_id")})
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, email, avatar_url, college_id, college_verified_at")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    college_ids = list({r["college_id"] for r in rows if r.get("college_id")})
    colleges_by_id = {}
    if college_ids:
        cols = supabase.table("colleges").select("id, name").in_("id", college_ids).execute()
        colleges_by_id = {c["id"]: c for c in cols.data}

    return [
        {
            **r,
            "applicant": users_by_id.get(r.get("applicant_id")),
            "college": colleges_by_id.get(r.get("college_id")),
        }
        for r in rows
    ]


@router.get("/organizer-applications/all")
def all_applications(current_user: dict = Depends(get_current_user)):
    """Every application, for the super admin surface.

    Applications submitted without a college are routed to super_admin
    and have no college_id, so the college-scoped listing above can
    never return them -- without this they are invisible to everyone
    including the person who has to decide them.
    """
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = (
        supabase.table("organizer_applications")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return _with_applicants(supabase, rows)


@router.post("/organizer-applications/{application_id}/approve")
def approve_application(application_id: str, current_user: dict = Depends(get_current_user)):
    return _decide_application(application_id, current_user, "approved")


@router.post("/organizer-applications/{application_id}/reject")
def reject_application(application_id: str, current_user: dict = Depends(get_current_user)):
    return _decide_application(application_id, current_user, "rejected")


def _decide_application(application_id: str, current_user: dict, decision: str) -> dict:
    supabase = get_supabase()
    app_result = supabase.table("organizer_applications").select("*").eq("id", application_id).execute()
    if not app_result.data:
        raise HTTPException(status_code=404, detail="Application not found")
    application = app_result.data[0]

    if application["status"] != "pending":
        raise HTTPException(status_code=409, detail="Application already decided")

    if application["routed_to"] == "college_admin":
        require_college_admin(current_user["id"], application["college_id"])
    else:
        require_super_admin(current_user)

    updated = (
        supabase.table("organizer_applications")
        .update(
            {
                "status": decision,
                "reviewed_by": current_user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", application_id)
        .execute()
    )

    org = None
    if decision == "approved":
        org = _provision_org(supabase, application, current_user["id"])

    _notify_decision(application, decision, org)
    return {**updated.data[0], "org_group": org}


def _notify_decision(application: dict, decision: str, org: dict | None) -> None:
    applicant_id = application.get("applicant_id")
    if not applicant_id:
        return

    if decision == "approved":
        name = (org or {}).get("name") or "your organization"
        notify(
            user_id=applicant_id,
            type_key="organizer_application",
            title="You are now a Festify organizer",
            body=f"{name} is ready. Publish your first event from the dashboard.",
            link=f"/org/{(org or {}).get('id', '')}/dashboard",
            email_subject="Your Festify organizer application was approved",
            email_body="\n".join([
                "Your application to become an organizer has been approved.",
                "",
                f"Your organization: {name}",
                "",
                "Sign in and open the organizer dashboard to create your first",
                "event, add team members, and manage the gate on event day.",
            ]),
        )
    else:
        notify(
            user_id=applicant_id,
            type_key="organizer_application",
            title="Organizer application declined",
            body="You can apply again from your profile.",
            link="/organizer-application",
            email_subject="About your Festify organizer application",
            email_body="\n".join([
                "Your application to become an organizer was not approved this time.",
                "",
                "You can apply again from your profile page.",
            ]),
        )


def _provision_org(supabase, application: dict, approver_id: str) -> dict | None:
    """Create the organizer's group and make them its leader.

    Approval used to flip a status column and stop there, which left the
    applicant approved on paper and unable to do anything: publishing an
    event needs an org_group, and every organizer surface is keyed by
    org id. The decision is only meaningful once the group exists.
    """
    applicant_id = application.get("applicant_id")
    if not applicant_id:
        return None

    # Someone may already lead a group -- a second application, or an
    # earlier manual setup. Re-approving must not hand them a duplicate.
    existing = (
        supabase.table("org_member_roles")
        .select("org_group_id")
        .eq("user_id", applicant_id)
        .eq("role", "leader")
        .execute()
    )
    if existing.data:
        org_id = existing.data[0]["org_group_id"]
        found = supabase.table("org_groups").select("*").eq("id", org_id).execute()
        return found.data[0] if found.data else None

    applicant = supabase.table("users").select("full_name, email, college_id").eq(
        "id", applicant_id
    ).execute()
    profile = applicant.data[0] if applicant.data else {}

    # Name it after the applicant so the group is identifiable
    # immediately; they can rename it from the dashboard.
    display = (profile.get("full_name") or (profile.get("email") or "New").split("@")[0]).strip()
    name = f"{display}'s Group"

    org = (
        supabase.table("org_groups")
        .insert({
            "name": name,
            # Prefer the college on the application, falling back to the
            # applicant's own -- an application routed to a super admin
            # carries no college but the person may still belong to one.
            "college_id": application.get("college_id") or profile.get("college_id"),
            "is_college_committee": False,
        })
        .execute()
        .data[0]
    )

    supabase.table("org_member_roles").insert({
        "org_group_id": org["id"],
        "user_id": applicant_id,
        "role": "leader",
        "granted_by": approver_id,
    }).execute()

    logger.info("Provisioned org %s for applicant %s", org["id"], applicant_id)
    return org


@router.post("/org-groups/{org_group_id}/flags")
def flag_org_group(org_group_id: str, body: OrgFlagCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    org_result = supabase.table("org_groups").select("college_id").eq("id", org_group_id).execute()
    if not org_result.data:
        raise HTTPException(status_code=404, detail="Org group not found")

    require_college_admin(current_user["id"], org_result.data[0]["college_id"])

    inserted = (
        supabase.table("org_flags")
        .insert({"org_group_id": org_group_id, "flagged_by": current_user["id"], "reason": body.reason})
        .execute()
    )
    return inserted.data[0]


@router.post("/org-groups/{org_group_id}/bans")
def ban_org_group(org_group_id: str, body: OrgBanCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    if body.stage not in BAN_ESCALATION_ORDER:
        raise HTTPException(status_code=422, detail=f"stage must be one of {BAN_ESCALATION_ORDER}")

    supabase = get_supabase()

    if not body.override_escalation and body.stage in ("30d", "long"):
        history = (
            supabase.table("org_bans")
            .select("stage")
            .eq("org_group_id", org_group_id)
            .execute()
        )
        prior_stages = {row["stage"] for row in history.data}
        required_before = BAN_ESCALATION_ORDER[: BAN_ESCALATION_ORDER.index(body.stage)]
        if not set(required_before).issubset(prior_stages):
            raise HTTPException(
                status_code=409,
                detail=f"Must escalate through {required_before} first, or pass override_escalation=true",
            )

    inserted = (
        supabase.table("org_bans")
        .insert(
            {
                "org_group_id": org_group_id,
                "stage": body.stage,
                "reason": body.reason,
                "issued_by": current_user["id"],
            }
        )
        .execute()
    )
    # NOTE: §8.8's freeze-and-refund cascade (freezing active events, refunding
    # every ticket holder) is not implemented here -- it depends on real
    # Razorpay Route refund execution, which is blocked pending Route
    # approval (see conversation). This only records the ban itself.
    return inserted.data[0]
