import secrets

import razorpay.errors
from fastapi import APIRouter, Depends, HTTPException

from app.core.razorpay_client import get_razorpay
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import OrderCreate, PaymentVerifyRequest

router = APIRouter(prefix="/orders", tags=["orders"])


def _check_capacity(supabase, tier_id: str, pool_capacity: int, requested_qty: int) -> None:
    sold_result = (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("ticket_tier_id", tier_id)
        .in_("status", ["issued", "scanned"])
        .execute()
    )
    sold_count = sold_result.count or 0
    if sold_count + requested_qty > pool_capacity:
        raise HTTPException(status_code=409, detail="Not enough tickets remaining in this tier")


@router.post("")
def create_order(body: OrderCreate, current_user: dict = Depends(get_current_user)):
    if body.quantity < 1:
        raise HTTPException(status_code=422, detail="Quantity must be at least 1")

    supabase = get_supabase()

    tier_result = supabase.table("ticket_tiers").select("*").eq("id", body.ticket_tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")
    tier = tier_result.data[0]

    _check_capacity(supabase, tier["id"], tier["pool_capacity"], body.quantity)

    total_amount = tier["price"] * body.quantity
    order_inserted = (
        supabase.table("orders")
        .insert(
            {
                "event_id": tier["event_id"],
                "buyer_id": current_user["id"],
                "quantity": body.quantity,
                "total_amount": total_amount,
                "status": "pending",
            }
        )
        .execute()
    )
    order = order_inserted.data[0]

    # NOTE: Razorpay Route (the marketplace-split product that would transfer
    # each organizer's share to their own Linked Account) is not enabled on
    # this account yet -- confirmed directly against Razorpay's live API,
    # not just the dashboard UI (see conversation). This order is a plain
    # single-merchant order: the full amount is captured to the platform's
    # own account with no transfers array. Wiring in transfers is a follow-up
    # once Route is approved -- the rest of this flow (order -> checkout ->
    # signature verification -> ticket issuance) doesn't need to change when
    # that happens, only this creation call gains a `transfers` field.
    razorpay_order = get_razorpay().order.create(
        {
            "amount": int(total_amount * 100),  # paise
            "currency": "INR",
            "receipt": order["id"],
            "notes": {"festify_order_id": order["id"], "ticket_tier_id": tier["id"]},
        }
    )

    order = (
        supabase.table("orders")
        .update({"razorpay_order_id": razorpay_order["id"]})
        .eq("id", order["id"])
        .execute()
        .data[0]
    )

    return {
        "order": order,
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id": get_razorpay().auth[0],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
    }


@router.post("/{order_id}/verify-payment")
def verify_payment(order_id: str, body: PaymentVerifyRequest, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    order_result = supabase.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_result.data[0]

    if order["buyer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    if order["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Order is already {order['status']}")

    try:
        get_razorpay().utility.verify_payment_signature(
            {
                "razorpay_order_id": order["razorpay_order_id"],
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    return _issue_tickets_for_order(supabase, order, body.razorpay_payment_id)


@router.post("/{order_id}/sync")
def sync_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Reconcile an order against Razorpay and issue tickets if it was paid.

    The client-side handler cannot be relied on. Redirect-based methods
    (netbanking, and UPI on some flows) navigate the browser away to the
    bank and back, which destroys the in-page callback that would
    otherwise call verify-payment -- so a genuinely captured payment can
    leave the order stuck at 'pending' with no ticket, which is exactly
    what happened in testing.

    This asks Razorpay directly rather than trusting anything the client
    says, so it is safe to call at any time and idempotent: an order that
    is already paid just returns its existing tickets.
    """
    supabase = get_supabase()

    order_result = supabase.table("orders").select("*").eq("id", order_id).execute()
    if not order_result.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_result.data[0]

    if order["buyer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")

    if order["status"] == "paid":
        tickets = supabase.table("tickets").select("*").eq("order_id", order_id).execute()
        return {"order": order, "tickets": tickets.data, "already_paid": True}

    if not order.get("razorpay_order_id"):
        raise HTTPException(status_code=409, detail="This order has no payment attached.")

    payments = get_razorpay().order.payments(order["razorpay_order_id"])
    captured = next(
        (p for p in payments.get("items", []) if p.get("status") in ("captured", "authorized")),
        None,
    )
    if not captured:
        raise HTTPException(
            status_code=409,
            detail="No completed payment found for this order yet.",
        )

    return _issue_tickets_for_order(supabase, order, captured["id"])


def _issue_tickets_for_order(supabase, order: dict, razorpay_payment_id: str) -> dict:
    # Get the tier via one of the order's would-be tickets isn't available
    # yet (none exist), so the tier is recovered from the Razorpay order's
    # notes stashed at creation time instead of a second parameter.
    tier_id = None
    razorpay_order = get_razorpay().order.fetch(order["razorpay_order_id"])
    tier_id = razorpay_order.get("notes", {}).get("ticket_tier_id")
    if not tier_id:
        raise HTTPException(status_code=500, detail="Could not resolve ticket tier for this order")

    tier_result = supabase.table("ticket_tiers").select("*").eq("id", tier_id).execute()
    tier = tier_result.data[0]

    # Re-check capacity at confirmation time too, not just at order creation
    # -- other buyers may have completed payment in between.
    _check_capacity(supabase, tier["id"], tier["pool_capacity"], order["quantity"])

    tickets_to_create = [
        {
            "event_id": order["event_id"],
            "ticket_tier_id": tier["id"],
            "order_id": order["id"],
            "owner_id": order["buyer_id"],
            "verify_code": secrets.token_hex(16),
            "price_paid": tier["price"],
            "status": "issued",
        }
        for _ in range(order["quantity"])
    ]
    tickets_inserted = supabase.table("tickets").insert(tickets_to_create).execute()

    updated_order = (
        supabase.table("orders")
        .update({"status": "paid", "razorpay_payment_id": razorpay_payment_id})
        .eq("id", order["id"])
        .execute()
        .data[0]
    )

    _record_simulated_payout(supabase, order)

    return {"order": updated_order, "tickets": tickets_inserted.data}


def _record_simulated_payout(supabase, order: dict) -> None:
    """Logs what a real Razorpay Route transfer would send to the
    organizer, without Route actually being enabled. platform_fee_flat is
    read from scoring_config (§8.4's flat-fee-per-ticket model); defaults
    to 0 if not yet configured, rather than failing the purchase."""
    event_result = supabase.table("events").select("org_group_id").eq("id", order["event_id"]).execute()
    if not event_result.data:
        return
    org_group_id = event_result.data[0]["org_group_id"]

    fee_config = supabase.table("scoring_config").select("value").eq("key", "platform_fee_flat").execute()
    platform_fee_per_ticket = fee_config.data[0]["value"] if fee_config.data else 0
    total_platform_fee = platform_fee_per_ticket * order["quantity"]
    gross_amount = order["total_amount"]
    net_amount = gross_amount - total_platform_fee

    supabase.table("org_payouts").insert(
        {
            "org_group_id": org_group_id,
            "order_id": order["id"],
            "gross_amount": gross_amount,
            "platform_fee": total_platform_fee,
            "net_amount": net_amount,
        }
    ).execute()


@router.get("/{order_id}")
def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("orders").select("*").eq("id", order_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data[0]
    if order["buyer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")

    tickets_result = supabase.table("tickets").select("*").eq("order_id", order_id).execute()
    return {"order": order, "tickets": tickets_result.data}
