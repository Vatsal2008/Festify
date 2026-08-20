import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core import redis_client
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import CollegeEmailVerifyConfirm, CollegeEmailVerifyRequest

router = APIRouter(prefix="/auth/verify-college-email", tags=["college-verification"])

OTP_TTL_SECONDS = 600


@router.post("/request")
def request_college_email_otp(
    body: CollegeEmailVerifyRequest, current_user: dict = Depends(get_current_user)
):
    if "@" not in body.college_email:
        raise HTTPException(status_code=422, detail="Invalid email address")
    domain = body.college_email.split("@", 1)[1].lower()

    supabase = get_supabase()
    college_result = supabase.table("colleges").select("id").eq("domain", domain).execute()
    if not college_result.data:
        raise HTTPException(status_code=422, detail="This email domain is not a recognized college")
    college_id = college_result.data[0]["id"]

    otp = f"{secrets.randbelow(1_000_000):06d}"

    # Send before storing. The other way round, a failed send still
    # leaves a code the confirm endpoint would accept, so the student
    # waits for an email that is never coming while the server believes
    # verification is under way.
    try:
        send_email(
            to=body.college_email,
            subject="Festify college email verification",
            body=f"Your verification code is {otp}. It expires in {OTP_TTL_SECONDS // 60} minutes.",
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    redis_client.set_with_ttl(
        f"college_otp:{current_user['id']}", f"{otp}:{college_id}:{body.college_email}", OTP_TTL_SECONDS
    )

    return {"message": "OTP sent", "expires_in_seconds": OTP_TTL_SECONDS}


@router.post("/confirm")
def confirm_college_email_otp(
    body: CollegeEmailVerifyConfirm, current_user: dict = Depends(get_current_user)
):
    stored = redis_client.get(f"college_otp:{current_user['id']}")
    if not stored:
        raise HTTPException(status_code=400, detail="No pending verification, or it has expired")

    otp, college_id, college_email = stored.split(":", 2)
    if body.otp != otp:
        raise HTTPException(status_code=400, detail="Incorrect code")

    supabase = get_supabase()
    updated = (
        supabase.table("users")
        .update({"college_id": college_id, "college_verified_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", current_user["id"])
        .execute()
    )

    redis_client.delete(f"college_otp:{current_user['id']}")
    return updated.data[0]
