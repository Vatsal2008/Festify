import razorpay.errors
from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.razorpay_client import get_razorpay
from app.core.supabase_client import get_supabase
from app.routers.orders import _issue_tickets_for_order

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/razorpay")
async def razorpay_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    try:
        get_razorpay().utility.verify_webhook_signature(
            body.decode("utf-8"), signature, settings.razorpay_webhook_secret
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event")

    if event == "payment.captured":
        payment_entity = payload["payload"]["payment"]["entity"]
        razorpay_order_id = payment_entity["order_id"]
        razorpay_payment_id = payment_entity["id"]

        supabase = get_supabase()
        order_result = (
            supabase.table("orders").select("*").eq("razorpay_order_id", razorpay_order_id).execute()
        )
        if order_result.data and order_result.data[0]["status"] == "pending":
            # This is the backup confirmation path -- the primary path is
            # the client calling POST /orders/{id}/verify-payment right
            # after checkout. Idempotent: only acts if still pending, so it
            # safely no-ops if verify-payment already handled it (or vice
            # versa).
            _issue_tickets_for_order(supabase, order_result.data[0], razorpay_payment_id)

    return {"status": "ok"}
