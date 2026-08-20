"""Prime Pass -- the paid membership.

Previously this existed only as UI copy: a badge component, a benefits
list and a "Coming soon" button. Nothing could grant the pass, so no
account ever held one and every benefit check read false.

Payment reuses the same Razorpay order/verify shape as ticket purchase,
so there is one payment flow in the codebase rather than two that drift.
"""
from datetime import datetime, timedelta, timezone

import razorpay.errors
from fastapi import APIRouter, Body, Depends, HTTPException

from app.core.razorpay_client import get_razorpay
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/prime-pass", tags=["prime-pass"])

# Prices in rupees. Annual is priced at ten months so the saving is
# obvious without needing a "% off" flag in the UI.
PLANS = {
    "monthly": {"plan": "monthly", "label": "Monthly", "amount": 99, "days": 30},
    "annual": {"plan": "annual", "label": "Annual", "amount": 990, "days": 365},
}

BENEFITS = [
    "Early access window — buy before general sale",
    "Dedicated Prime ticket pool on every event",
    "Prime Pass pool for sold-out events",
    "Priority review visibility (1.5× weight)",
    "Prime badge on your profile and reviews",
    "Fewer ads, cleaner experience",
]


def get_active_pass(supabase, user_id: str) -> dict | None:
    """The user's live pass, expiring it in passing if the date has gone.

    Expiry is settled on read rather than by a scheduled job: there is no
    scheduler in this deployment, and a pass that looks active for days
    after it lapsed would hand out benefits nobody paid for.
    """
    result = (
        supabase.table("prime_passes")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    if not result.data:
        return None

    current = result.data[0]
    expires = current.get("expires_at")
    if expires:
        try:
            if datetime.fromisoformat(expires.replace("Z", "+00:00")) < datetime.now(timezone.utc):
                supabase.table("prime_passes").update({"status": "expired"}).eq(
                    "id", current["id"]
                ).execute()
                return None
        except ValueError:
            pass
    return current


@router.get("/plans")
def list_plans():
    return {"plans": list(PLANS.values()), "benefits": BENEFITS, "currency": "INR"}


@router.get("/me")
def my_pass(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    active = get_active_pass(supabase, current_user["id"])
    history = (
        supabase.table("prime_passes")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )
    return {
        "has_prime_pass": bool(active),
        "pass": active,
        "history": history.data,
        "benefits": BENEFITS,
    }


@router.post("/orders")
def create_pass_order(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    plan_key = (body or {}).get("plan")
    plan = PLANS.get(plan_key)
    if not plan:
        raise HTTPException(status_code=422, detail="Choose either the monthly or annual plan.")

    supabase = get_supabase()
    if get_active_pass(supabase, current_user["id"]):
        raise HTTPException(status_code=409, detail="You already have an active Prime Pass.")

    row = (
        supabase.table("prime_passes")
        .insert({
            "user_id": current_user["id"],
            "plan": plan["plan"],
            "amount": plan["amount"],
            "status": "pending",
        })
        .execute()
        .data[0]
    )

    razorpay_order = get_razorpay().order.create({
        "amount": plan["amount"] * 100,  # paise
        "currency": "INR",
        "receipt": row["id"],
        "notes": {"prime_pass_id": row["id"], "plan": plan["plan"]},
    })

    supabase.table("prime_passes").update(
        {"razorpay_order_id": razorpay_order["id"]}
    ).eq("id", row["id"]).execute()

    return {
        "prime_pass_id": row["id"],
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id": get_razorpay().auth[0],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "plan": plan,
    }


def _activate(supabase, row: dict, payment_id: str) -> dict:
    plan = PLANS[row["plan"]]
    now = datetime.now(timezone.utc)
    updated = (
        supabase.table("prime_passes")
        .update({
            "status": "active",
            "razorpay_payment_id": payment_id,
            "starts_at": now.isoformat(),
            "expires_at": (now + timedelta(days=plan["days"])).isoformat(),
        })
        .eq("id", row["id"])
        .execute()
        .data[0]
    )
    # customer_level drives the Prime badge and the early-access checks
    # that were written before this table existed, so keep it in step.
    supabase.table("users").update({"customer_level": "prime"}).eq(
        "id", row["user_id"]
    ).execute()
    return updated


@router.post("/orders/{pass_id}/verify")
def verify_pass_payment(
    pass_id: str, body: dict = Body(...), current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    result = supabase.table("prime_passes").select("*").eq("id", pass_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Prime Pass order not found")
    row = result.data[0]

    if row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if row["status"] == "active":
        return {"activated": True, "pass": row, "already_active": True}

    try:
        get_razorpay().utility.verify_payment_signature({
            "razorpay_order_id": row["razorpay_order_id"],
            "razorpay_payment_id": body.get("razorpay_payment_id"),
            "razorpay_signature": body.get("razorpay_signature"),
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    return {"activated": True, "pass": _activate(supabase, row, body["razorpay_payment_id"])}


@router.post("/orders/{pass_id}/sync")
def sync_pass_order(pass_id: str, current_user: dict = Depends(get_current_user)):
    """Reconcile against Razorpay when the in-page callback was lost.

    Same failure this codebase already hit on ticket purchase: a
    redirect-based method navigates the browser away and destroys the
    handler that would have confirmed the payment.
    """
    supabase = get_supabase()
    result = supabase.table("prime_passes").select("*").eq("id", pass_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Prime Pass order not found")
    row = result.data[0]

    if row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if row["status"] == "active":
        return {"activated": True, "pass": row, "already_active": True}
    if not row.get("razorpay_order_id"):
        raise HTTPException(status_code=409, detail="This order has no payment attached.")

    payments = get_razorpay().order.payments(row["razorpay_order_id"])
    captured = next(
        (p for p in payments.get("items", []) if p.get("status") in ("captured", "authorized")),
        None,
    )
    if not captured:
        raise HTTPException(status_code=409, detail="No completed payment found for this order yet.")

    return {"activated": True, "pass": _activate(supabase, row, captured["id"])}
