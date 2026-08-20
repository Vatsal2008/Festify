from fastapi import APIRouter, Depends, HTTPException

from app.authz import is_college_admin, is_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import SupportTicketCreate, TicketTheftReportCreate

router = APIRouter(tags=["support"])


@router.post("/support-tickets")
def create_support_ticket(body: SupportTicketCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    inserted = (
        supabase.table("support_tickets")
        .insert(
            {
                "raised_by": current_user["id"],
                "category": body.category,
                "related_id": body.related_id,
                "routed_to": body.routed_to,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/support-tickets/mine")
def my_support_tickets(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("support_tickets")
        .select("*")
        .eq("raised_by", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("/support-tickets/{support_ticket_id}/resolve")
def resolve_support_ticket(support_ticket_id: str, current_user: dict = Depends(get_current_user)):
    if not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Only super admin can resolve support tickets currently")

    supabase = get_supabase()
    updated = (
        supabase.table("support_tickets")
        .update({"status": "resolved"})
        .eq("id", support_ticket_id)
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return updated.data[0]


@router.post("/ticket-theft-reports")
def report_ticket_theft(body: TicketTheftReportCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    ticket_result = supabase.table("tickets").select("id").eq("id", body.ticket_id).execute()
    if not ticket_result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")

    existing_reports = (
        supabase.table("ticket_theft_reports")
        .select("id", count="exact")
        .eq("ticket_id", body.ticket_id)
        .execute()
    )
    report_number = (existing_reports.count or 0) + 1

    inserted = (
        supabase.table("ticket_theft_reports")
        .insert(
            {
                "ticket_id": body.ticket_id,
                "reported_by": current_user["id"],
                "report_number": report_number,
            }
        )
        .execute()
    )
    return inserted.data[0]
