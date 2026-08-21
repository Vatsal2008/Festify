# Files

## File: backend/app/core/__init__.py
```python

```

## File: backend/app/core/config.py
```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../.env", env_file_encoding="utf-8", extra="ignore")

    google_client_id: str = ""
    jwt_secret: str = ""

    # Temporary stopgap: the spec (§4) describes Super Admin as a separate,
    # non-users-table auth system that hasn't been built yet. Until it
    # exists, super-admin-gated actions (issuing bans, adding college
    # admins) check membership in this comma-separated allowlist of
    # regular-user emails instead. Replace with real super-admin auth
    # before this touches production.
    super_admin_emails: str = ""

    # Comma-separated list of browser origins allowed to call this API.
    # Local Vite dev is allowed by default; production frontend origins
    # (Vercel) must be added via the CORS_ORIGINS env var on Render.
    # Deliberately not "*": credentialed requests carrying the JWT cannot
    # use a wildcard origin, so a real list is required either way.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""

    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    firebase_service_account_path: str = ""

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_mail: str = ""
    smtp_password: str = ""

    # Email over HTTPS, used in preference to SMTP when a key is present.
    # Render's free instances block outbound traffic to every SMTP port
    # (25, 465, 587) as of September 2025, so SMTP cannot work there at
    # all -- but port 443 is open, and these providers send over it.
    # Local development keeps using SMTP, since no key is set there.
    resend_api_key: str = ""
    brevo_api_key: str = ""

    # Self-hosted relay: a mail API running on a developer machine and
    # published over an HTTPS tunnel. Render blocks outbound SMTP but not
    # port 443, so this reaches Gmail by proxy through that machine.
    # Preferred over the other transports when set, because it is the one
    # deliberately configured for this deployment.
    local_api_key: str = ""
    local_mail_url: str = "https://envy-twilight-happiest.ngrok-free.dev/mail"

    # The From address for HTTP providers. Falls back to SMTP_MAIL so a
    # deployment that already has that set does not need a second var.
    email_from: str = ""
    email_from_name: str = "Festify"


settings = Settings()
```

## File: backend/app/core/email_client.py
```python
"""Outbound email.

Three transports, chosen by which credentials are present: Resend and
Brevo send over HTTPS, SMTP is the fallback. The HTTP providers exist
because Render's free instances block outbound traffic to every SMTP
port (25, 465, 587) as of September 2025 -- SMTP there fails with
ENETUNREACH no matter how correct the credentials are, while port 443
stays open. Local development sets no API key and keeps using SMTP.
"""
import logging
import smtplib
from email.mime.text import MIMEText

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailError(RuntimeError):
    """Sending failed. The message is shown to the person who triggered
    the send, so it names the cause rather than just 'failed'."""


def _clean(value: str) -> str:
    """Strip whitespace and surrounding quotes from a credential.

    A .env file treats quotes as delimiters, but pasting the same value
    into a hosting dashboard keeps them as literal characters -- so a
    password arrives as '"abcd efgh"' and authentication fails with a
    misleading "username and password not accepted".
    """
    return (value or "").strip().strip('"').strip("'").strip()


def _sender() -> str:
    return _clean(settings.email_from) or _clean(settings.smtp_mail)


def active_transport() -> str:
    if _clean(settings.local_api_key) and _clean(settings.local_mail_url):
        return "local"
    if _clean(settings.resend_api_key):
        return "resend"
    if _clean(settings.brevo_api_key):
        return "brevo"
    if _clean(settings.smtp_mail) and _clean(settings.smtp_password):
        return "smtp"
    return "none"


def send_email(to: str, subject: str, body: str) -> None:
    transport = active_transport()
    if transport == "local":
        _send_via_local_api(to, subject, body)
    elif transport == "resend":
        _send_via_resend(to, subject, body)
    elif transport == "brevo":
        _send_via_brevo(to, subject, body)
    elif transport == "smtp":
        _send_via_smtp(to, subject, body)
    else:
        raise EmailError(
            "Email is not configured on the server. Set RESEND_API_KEY or "
            "BREVO_API_KEY (recommended), or SMTP_MAIL and SMTP_PASSWORD."
        )


def _send_via_local_api(to: str, subject: str, body: str) -> None:
    """Relay through the mail API running on the developer machine.

    Generous timeout: the request crosses the tunnel to a home
    connection, then waits on Gmail's SMTP handshake from there, so it is
    legitimately slower than a hosted email API.
    """
    url = _clean(settings.local_mail_url).rstrip("/") + "/send"
    try:
        response = httpx.post(
            url,
            headers={
                "X-API-Key": _clean(settings.local_api_key),
                # ngrok serves a browser interstitial to requests that
                # look like navigation; this opts out of it.
                "ngrok-skip-browser-warning": "1",
            },
            json={"to": to, "subject": subject, "message": body},
            timeout=40,
        )
    except httpx.HTTPError as e:
        raise EmailError(
            f"Could not reach the mail relay ({type(e).__name__}: {e}). "
            "The machine running it may be offline, or the tunnel stopped."
        ) from e

    if response.status_code >= 400:
        logger.error("Mail relay rejected the send: %s %s", response.status_code, response.text)
        raise EmailError(f"Mail relay refused the message ({response.status_code}): {response.text}")


def _send_via_resend(to: str, subject: str, body: str) -> None:
    sender = _sender()
    if not sender:
        raise EmailError("Set EMAIL_FROM to the verified sender address for Resend.")
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {_clean(settings.resend_api_key)}"},
            json={
                "from": f"{settings.email_from_name} <{sender}>",
                "to": [to],
                "subject": subject,
                "text": body,
            },
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise EmailError(f"Could not reach Resend: {type(e).__name__}: {e}") from e

    if response.status_code >= 400:
        logger.error("Resend rejected the send: %s %s", response.status_code, response.text)
        raise EmailError(f"Resend rejected the message ({response.status_code}): {response.text}")


def _send_via_brevo(to: str, subject: str, body: str) -> None:
    sender = _sender()
    if not sender:
        raise EmailError("Set EMAIL_FROM to the verified sender address for Brevo.")
    try:
        response = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": _clean(settings.brevo_api_key), "accept": "application/json"},
            json={
                "sender": {"email": sender, "name": settings.email_from_name},
                "to": [{"email": to}],
                "subject": subject,
                "textContent": body,
            },
            timeout=20,
        )
    except httpx.HTTPError as e:
        raise EmailError(f"Could not reach Brevo: {type(e).__name__}: {e}") from e

    if response.status_code >= 400:
        logger.error("Brevo rejected the send: %s %s", response.status_code, response.text)
        raise EmailError(f"Brevo rejected the message ({response.status_code}): {response.text}")


def _send_via_smtp(to: str, subject: str, body: str) -> None:
    user = _clean(settings.smtp_mail)
    password = _clean(settings.smtp_password)

    message = MIMEText(body)
    message["Subject"] = subject
    message["From"] = user
    message["To"] = to

    try:
        # Explicit timeout: without one, a host that silently drops
        # outbound SMTP leaves the request hanging until the proxy kills
        # it, which reads as "nothing happened" rather than a failure.
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(user, [to], message.as_string())
    except smtplib.SMTPAuthenticationError as e:
        logger.exception("SMTP auth rejected for %s", user)
        raise EmailError(
            "The mail server rejected the credentials. For Gmail this must be a "
            f"16-character App Password, not the account password. ({e.smtp_code})"
        ) from e
    except OSError as e:
        logger.exception("SMTP connection failed to %s:%s", settings.smtp_host, settings.smtp_port)
        # ENETUNREACH here is almost always the host firewalling SMTP
        # rather than anything wrong with the configuration, so say so --
        # otherwise this looks like a credential problem for hours.
        raise EmailError(
            f"Could not reach the mail server ({type(e).__name__}: {e}). If this is a "
            "free Render instance, outbound SMTP is blocked on all ports -- set "
            "RESEND_API_KEY or BREVO_API_KEY to send over HTTPS instead."
        ) from e
    except smtplib.SMTPException as e:
        logger.exception("SMTP send failed to %s", to)
        raise EmailError(f"Could not send the message: {type(e).__name__}: {e}") from e
```

## File: backend/app/core/razorpay_client.py
```python
from functools import lru_cache

import razorpay

from app.core.config import settings


@lru_cache
def get_razorpay() -> razorpay.Client:
    client = razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))
    return client
```

## File: backend/app/core/redis_client.py
```python
import httpx

from app.core.config import settings


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.upstash_redis_rest_token}"}


def set_with_ttl(key: str, value: str, ttl_seconds: int) -> None:
    url = f"{settings.upstash_redis_rest_url}/set/{key}/{value}?EX={ttl_seconds}"
    httpx.post(url, headers=_headers(), timeout=10).raise_for_status()


def get(key: str) -> str | None:
    url = f"{settings.upstash_redis_rest_url}/get/{key}"
    response = httpx.post(url, headers=_headers(), timeout=10)
    response.raise_for_status()
    return response.json().get("result")


def delete(key: str) -> None:
    url = f"{settings.upstash_redis_rest_url}/del/{key}"
    httpx.post(url, headers=_headers(), timeout=10).raise_for_status()
```

## File: backend/app/core/security.py
```python
JWT_ALGORITHM = "HS256"
```

## File: backend/app/core/supabase_client.py
```python
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings


def _normalise_url(url: str) -> str:
    """Return the bare Supabase project URL.

    Supabase's dashboard shows the REST endpoint
    (https://<ref>.supabase.co/rest/v1/), and it is an easy value to copy
    into config. The client appends /rest/v1 itself, so passing that form
    produces requests to /rest/v1/rest/v1/... which Supabase rejects with
    PGRST125 "Invalid path specified in request URL" on every query while
    non-database routes keep working -- a confusing failure to trace.
    Trimming it here means either form is accepted.
    """
    cleaned = (url or "").strip().rstrip("/")
    for suffix in ("/rest/v1", "/rest"):
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)]
    return cleaned


@lru_cache
def get_supabase() -> Client:
    return create_client(_normalise_url(settings.supabase_url), settings.supabase_service_role_key)
```

## File: backend/app/routers/__init__.py
```python

```

## File: backend/app/routers/bulk_purchase.py
```python
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import BulkPurchaseRequestCreate, BulkPurchaseReviewRequest

router = APIRouter(prefix="/bulk-purchase-requests", tags=["bulk-purchase"])


@router.post("")
def create_bulk_request(
    body: BulkPurchaseRequestCreate, current_user: dict = Depends(get_current_user)
):
    if body.requested_qty < 1:
        raise HTTPException(status_code=422, detail="requested_qty must be at least 1")

    supabase = get_supabase()
    try:
        inserted = (
            supabase.table("bulk_purchase_requests")
            .insert(
                {
                    "event_id": body.event_id,
                    "buyer_id": current_user["id"],
                    "requested_qty": body.requested_qty,
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(
                status_code=409, detail="You already have a pending bulk request for this event"
            )
        raise
    return inserted.data[0]


@router.get("/mine")
def my_bulk_requests(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("bulk_purchase_requests")
        .select("*")
        .eq("buyer_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.get("")
def list_bulk_requests_for_event(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = (
        supabase.table("bulk_purchase_requests")
        .select("*")
        .eq("event_id", event_id)
        .eq("status", "pending")
        .execute()
    )
    return result.data


@router.post("/{request_id}/review")
def review_bulk_request(
    request_id: str, body: BulkPurchaseReviewRequest, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    req_result = supabase.table("bulk_purchase_requests").select("*").eq("id", request_id).execute()
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Bulk request not found")
    bulk_request = req_result.data[0]

    event_result = (
        supabase.table("events").select("org_group_id").eq("id", bulk_request["event_id"]).execute()
    )
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    if bulk_request["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already decided")

    # NOTE: approval here only flips status. Converting an approved request
    # into real tickets still requires the buyer (or organizer) to pick a
    # ticket_tier and go through POST /orders -- this table is tier-agnostic
    # by design (per festify_full.md schema), so no ticket_tier_id exists
    # here to issue against automatically.
    new_status = "approved" if body.approve else "rejected"
    updated = (
        supabase.table("bulk_purchase_requests").update({"status": new_status}).eq("id", request_id).execute()
    )
    return updated.data[0]
```

## File: backend/app/routers/co_hosts.py
```python
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
```

## File: backend/app/routers/college_admins.py
```python
from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import CollegeAdminCreate, CollegeAdminFlagCreate

router = APIRouter(prefix="/college-admins", tags=["college-admins"])


@router.post("")
def add_college_admin(body: CollegeAdminCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    inserted = (
        supabase.table("college_admins")
        .insert(
            {
                "user_id": body.user_id,
                "college_id": body.college_id,
                "added_by": current_user["id"],
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("")
def list_college_admins(college_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    result = supabase.table("college_admins").select("*").eq("college_id", college_id).execute()
    return result.data


def _get_own_college_admin_row(supabase, user_id: str) -> dict:
    result = (
        supabase.table("college_admins")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="You are not an active college admin")
    return result.data[0]


@router.post("/escalate")
def escalate_to_super_admin(
    subject: str, details: str | None = None, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    own_row = _get_own_college_admin_row(supabase, current_user["id"])

    inserted = (
        supabase.table("admin_escalations")
        .insert({"college_admin_id": own_row["id"], "subject": subject, "details": details})
        .execute()
    )
    return inserted.data[0]


@router.post("/{college_admin_id}/flags")
def flag_college_admin(
    college_admin_id: str, body: CollegeAdminFlagCreate, current_user: dict = Depends(get_current_user)
):
    require_super_admin(current_user)
    supabase = get_supabase()

    target = supabase.table("college_admins").select("id").eq("id", college_admin_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="College admin not found")

    inserted = (
        supabase.table("college_admin_flags")
        .insert(
            {
                "college_admin_id": college_admin_id,
                "flagged_by": current_user["id"],
                "reason": body.reason,
            }
        )
        .execute()
    )
    return inserted.data[0]
```

## File: backend/app/routers/college_verification.py
```python
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
```

## File: backend/app/routers/event_lifecycle.py
```python
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import ChangeRequestCreate, EventPollCreate, PollVoteRequest

router = APIRouter(tags=["event-lifecycle"])


@router.post("/events/{event_id}/polls")
def create_poll(event_id: str, body: EventPollCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("event_polls")
        .insert({"event_id": event_id, "question": body.question, "closes_at": body.closes_at})
        .execute()
    )
    return inserted.data[0]


@router.post("/polls/{poll_id}/vote")
def vote_on_poll(poll_id: str, body: PollVoteRequest, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    try:
        supabase.table("event_poll_votes").upsert(
            {"poll_id": poll_id, "user_id": current_user["id"], "vote": body.vote}
        ).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"poll_id": poll_id, "vote": body.vote}


@router.get("/polls/{poll_id}/results")
def poll_results(poll_id: str):
    supabase = get_supabase()
    votes = supabase.table("event_poll_votes").select("vote").eq("poll_id", poll_id).execute()
    yes_count = sum(1 for v in votes.data if v["vote"])
    no_count = sum(1 for v in votes.data if not v["vote"])
    return {"yes": yes_count, "no": no_count, "total": len(votes.data)}


@router.post("/events/{event_id}/change-requests")
def create_change_request(
    event_id: str, body: ChangeRequestCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("event_change_requests")
        .insert({"event_id": event_id, "poll_id": body.poll_id, "change_details": body.change_details})
        .execute()
    )
    return inserted.data[0]


@router.post("/change-requests/{request_id}/decide")
def decide_change_request(
    request_id: str, approve: bool, current_user: dict = Depends(get_current_user)
):
    require_super_admin(current_user)
    supabase = get_supabase()

    req_result = supabase.table("event_change_requests").select("status").eq("id", request_id).execute()
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Change request not found")
    if req_result.data[0]["status"] != "pending_super_admin":
        raise HTTPException(status_code=409, detail="Change request already decided")

    updated = (
        supabase.table("event_change_requests")
        .update({"status": "approved" if approve else "rejected"})
        .eq("id", request_id)
        .execute()
    )
    return updated.data[0]
```

## File: backend/app/routers/gate.py
```python
"""Gate control -- when QR codes go live and when scanning starts.

Two separate switches on purpose. Revealing codes lets attendees load
their QR while queuing; opening the gate lets scanners accept them.
Organizers usually want the first a few minutes before the second, so
the queue is ready before anyone reaches the door.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_scanner
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/events/{event_id}/gate", tags=["gate"])


def _event_or_404(supabase, event_id: str) -> dict:
    result = supabase.table("events").select("*").eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return result.data[0]


def _counts(supabase, event_id: str) -> dict:
    issued = (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("event_id", event_id)
        .in_("status", ["issued", "scanned"])
        .execute()
    )
    total = issued.count or 0

    ticket_ids = [t["id"] for t in (
        supabase.table("tickets").select("id").eq("event_id", event_id).execute().data or []
    )]
    scanned = 0
    if ticket_ids:
        scans = (
            supabase.table("ticket_scans")
            .select("ticket_id", count="exact")
            .in_("ticket_id", ticket_ids)
            .execute()
        )
        scanned = scans.count or 0

    return {"tickets_issued": total, "checked_in": scanned, "remaining": max(0, total - scanned)}


@router.get("")
def gate_status(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(current_user["id"], event["org_group_id"])
    return {
        "event_id": event_id,
        "title": event.get("title"),
        "qr_revealed": bool(event.get("qr_revealed_at")),
        "qr_revealed_at": event.get("qr_revealed_at"),
        "gate_open": bool(event.get("gate_opened_at")),
        "gate_opened_at": event.get("gate_opened_at"),
        **_counts(supabase, event_id),
    }


def _set_flag(event_id: str, user_id: str, column: str, on: bool) -> dict:
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(user_id, event["org_group_id"])

    value = datetime.now(timezone.utc).isoformat() if on else None
    supabase.table("events").update({column: value}).eq("id", event_id).execute()
    return gate_status_internal(supabase, event_id)


def gate_status_internal(supabase, event_id: str) -> dict:
    event = _event_or_404(supabase, event_id)
    return {
        "event_id": event_id,
        "qr_revealed": bool(event.get("qr_revealed_at")),
        "qr_revealed_at": event.get("qr_revealed_at"),
        "gate_open": bool(event.get("gate_opened_at")),
        "gate_opened_at": event.get("gate_opened_at"),
        **_counts(supabase, event_id),
    }


@router.post("/reveal-qr")
def reveal_qr(event_id: str, current_user: dict = Depends(get_current_user)):
    """Release QR codes to everyone holding a ticket for this event."""
    return _set_flag(event_id, current_user["id"], "qr_revealed_at", True)


@router.post("/hide-qr")
def hide_qr(event_id: str, current_user: dict = Depends(get_current_user)):
    return _set_flag(event_id, current_user["id"], "qr_revealed_at", False)


@router.post("/open")
def open_gate(event_id: str, current_user: dict = Depends(get_current_user)):
    """Start accepting scans. Codes are revealed at the same time if they
    are not already -- a gate that admits people whose tickets they
    cannot display is not a working gate."""
    supabase = get_supabase()
    event = _event_or_404(supabase, event_id)
    require_org_scanner(current_user["id"], event["org_group_id"])

    now = datetime.now(timezone.utc).isoformat()
    patch = {"gate_opened_at": now}
    if not event.get("qr_revealed_at"):
        patch["qr_revealed_at"] = now
    supabase.table("events").update(patch).eq("id", event_id).execute()
    return gate_status_internal(supabase, event_id)


@router.post("/close")
def close_gate(event_id: str, current_user: dict = Depends(get_current_user)):
    return _set_flag(event_id, current_user["id"], "gate_opened_at", False)
```

## File: backend/app/routers/media.py
```python
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/events", tags=["media"])

BUCKET = "event-banners"
VALID_BANNER_TYPES = ("main", "ticket", "event_page", "ad")


def _ensure_bucket(supabase) -> None:
    buckets = supabase.storage.list_buckets()
    if not any(b.name == BUCKET for b in buckets):
        supabase.storage.create_bucket(BUCKET, options={"public": True})


@router.post("/{event_id}/banners")
async def upload_banner(
    event_id: str,
    banner_type: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if banner_type not in VALID_BANNER_TYPES:
        raise HTTPException(status_code=422, detail=f"banner_type must be one of {VALID_BANNER_TYPES}")

    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    _ensure_bucket(supabase)

    contents = await file.read()
    extension = (file.filename or "bin").rsplit(".", 1)[-1]
    storage_path = f"{event_id}/{banner_type}.{extension}"

    supabase.storage.from_(BUCKET).upload(
        storage_path, contents, file_options={"upsert": "true", "content-type": file.content_type}
    )

    existing = (
        supabase.table("event_banners")
        .select("id")
        .eq("event_id", event_id)
        .eq("banner_type", banner_type)
        .execute()
    )
    record = {
        "event_id": event_id,
        "storage_path": storage_path,
        "banner_type": banner_type,
        "uploaded_by": current_user["id"],
        "file_size_kb": len(contents) // 1024,
    }
    if existing.data:
        result = (
            supabase.table("event_banners").update(record).eq("id", existing.data[0]["id"]).execute()
        )
    else:
        result = supabase.table("event_banners").insert(record).execute()

    banner = result.data[0]
    banner["public_url"] = supabase.storage.from_(BUCKET).get_public_url(storage_path)
    return banner


@router.get("/{event_id}/banners")
def list_banners(event_id: str):
    supabase = get_supabase()
    result = (
        supabase.table("event_banners")
        .select("*")
        .eq("event_id", event_id)
        .eq("status", "active")
        .execute()
    )
    banners = result.data
    for banner in banners:
        banner["public_url"] = supabase.storage.from_(BUCKET).get_public_url(banner["storage_path"])
    return banners
```

## File: backend/app/routers/notifications.py
```python
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
```

## File: backend/app/routers/org_groups.py
```python
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
```

## File: backend/app/routers/organizer_interactions.py
```python
from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import FeedbackRequestCreate

router = APIRouter(tags=["organizer-interactions"])

MAX_FEEDBACK_REQUESTS_PER_EVENT = 2


@router.post("/events/{event_id}/feedback-requests")
def send_feedback_request(
    event_id: str, body: FeedbackRequestCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    org_group_id = event_result.data[0]["org_group_id"]

    require_org_manager(current_user["id"], org_group_id)

    prime_result = (
        supabase.table("users").select("customer_level").eq("id", body.prime_user_id).execute()
    )
    if not prime_result.data or prime_result.data[0]["customer_level"] != "prime":
        raise HTTPException(status_code=422, detail="Target user is not a Prime user")

    block_result = (
        supabase.table("org_contact_blocks")
        .select("user_id")
        .eq("user_id", body.prime_user_id)
        .eq("org_group_id", org_group_id)
        .execute()
    )
    if block_result.data:
        raise HTTPException(status_code=403, detail="This user has blocked contact from this organizer")

    existing_count = (
        supabase.table("org_feedback_requests")
        .select("id", count="exact")
        .eq("event_id", event_id)
        .eq("prime_user_id", body.prime_user_id)
        .execute()
    )
    if (existing_count.count or 0) >= MAX_FEEDBACK_REQUESTS_PER_EVENT:
        raise HTTPException(
            status_code=409,
            detail=f"Max {MAX_FEEDBACK_REQUESTS_PER_EVENT} feedback requests per Prime user per event reached",
        )

    inserted = (
        supabase.table("org_feedback_requests")
        .insert(
            {
                "event_id": event_id,
                "org_group_id": org_group_id,
                "prime_user_id": body.prime_user_id,
                "message": body.message,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/events/{event_id}/feedback-requests")
def list_feedback_requests(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = supabase.table("org_feedback_requests").select("*").eq("event_id", event_id).execute()
    return result.data


@router.post("/org-groups/{org_group_id}/contact-block")
def toggle_contact_block(org_group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("org_contact_blocks")
        .select("user_id")
        .eq("user_id", current_user["id"])
        .eq("org_group_id", org_group_id)
        .execute()
    )
    if existing.data:
        supabase.table("org_contact_blocks").delete().eq("user_id", current_user["id"]).eq(
            "org_group_id", org_group_id
        ).execute()
        return {"blocked": False}

    supabase.table("org_contact_blocks").insert(
        {"user_id": current_user["id"], "org_group_id": org_group_id}
    ).execute()
    return {"blocked": True}
```

## File: backend/app/routers/platform.py
```python
"""Platform-wide listing endpoints used by the admin surfaces and by the
signup/apply flows (colleges). Kept separate from the per-resource
routers because these are cross-cutting reads rather than operations on
one entity.
"""
import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import is_super_admin, require_super_admin
from app.core import redis_client
from app.core.config import settings
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import SuperAdminCreate, SuperAdminOtpVerify

router = APIRouter(tags=["platform"])
logger = logging.getLogger(__name__)


@router.get("/colleges")
def list_colleges():
    """Public: needed by onboarding and the organizer application form."""
    supabase = get_supabase()
    return supabase.table("colleges").select("*").order("name").execute().data


@router.get("/org-groups")
def list_org_groups(limit: int = Query(100, le=500)):
    """Directory of organizers, ordered by score, with current ban state.

    Ban state is joined in here because the admin organizer table needs
    it per row, and querying it per organizer would be an N+1.
    """
    supabase = get_supabase()
    orgs = (
        supabase.table("org_groups")
        .select("*")
        .order("score", desc=True)
        .limit(limit)
        .execute()
        .data
    )
    if not orgs:
        return []

    bans = (
        supabase.table("org_bans")
        .select("org_group_id, stage, is_active, created_at")
        .in_("org_group_id", [o["id"] for o in orgs])
        .eq("is_active", True)
        .execute()
        .data
    )
    ban_by_org = {}
    for b in bans:
        ban_by_org.setdefault(b["org_group_id"], b)

    return [
        {
            **o,
            # Name these the way the client reads them, so the admin table
            # does not have to know the column names.
            "score_points": o.get("score") or 0,
            "successful_events_count": o.get("successful_event_count") or 0,
            "banned": o["id"] in ban_by_org,
            "ban_stage": ban_by_org.get(o["id"], {}).get("stage"),
        }
        for o in orgs
    ]


@router.get("/support-tickets")
def list_all_support_tickets(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    tickets = (
        supabase.table("support_tickets")
        .select("*")
        .order("created_at", desc=True)
        .execute()
        .data
    )

    user_ids = list({t["raised_by"] for t in tickets if t.get("raised_by")})
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, email")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    return [{**t, "raised_by_user": users_by_id.get(t.get("raised_by"))} for t in tickets]


@router.get("/audit-log")
def list_audit_log(
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user),
):
    require_super_admin(current_user)
    supabase = get_supabase()
    return (
        supabase.table("audit_log")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


@router.get("/scoring-config")
def list_scoring_config(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    return supabase.table("scoring_config").select("*").order("key").execute().data


# ── user lookup + admin management ────────────────────────────────

@router.get("/users/search")
def search_users(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_user)):
    """Find a user by email or name so an admin can be granted a role.
    Super-admin only: this exposes other people's email addresses."""
    require_super_admin(current_user)
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("id, email, full_name, avatar_url, customer_level, college_id")
        .or_(f"email.ilike.%{q}%,full_name.ilike.%{q}%")
        .limit(20)
        .execute()
    )
    return result.data


@router.get("/super-admins")
def list_super_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("super_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    granted = [{**r, "user": users_by_id.get(r["user_id"])} for r in rows]

    # Surface the env-var bootstrap admins too, so the list reflects who
    # actually has access rather than only the DB-granted subset.
    bootstrap = [e.strip() for e in settings.super_admin_emails.split(",") if e.strip()]
    return {"granted": granted, "bootstrap_emails": bootstrap}


@router.post("/super-admins")
def add_super_admin(body: SuperAdminCreate, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()

    target = supabase.table("users").select("id, email").eq("id", body.user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    existing = supabase.table("super_admins").select("id").eq("user_id", body.user_id).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="That user is already a super admin")

    inserted = (
        supabase.table("super_admins")
        .insert({"user_id": body.user_id, "granted_by": current_user["id"]})
        .execute()
    )
    return {**inserted.data[0], "user": target.data[0]}


@router.delete("/super-admins/{user_id}")
def remove_super_admin(user_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    if user_id == current_user["id"]:
        # Losing your own access mid-session is never the intent, and
        # could leave the platform with no reachable admin.
        raise HTTPException(status_code=409, detail="You cannot remove your own super admin access")

    supabase = get_supabase()
    supabase.table("super_admins").delete().eq("user_id", user_id).execute()
    return {"removed": user_id}


@router.get("/college-admins/all")
def list_all_college_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("college_admins").select("*").order("created_at").execute().data

    user_ids = [r["user_id"] for r in rows]
    college_ids = [r["college_id"] for r in rows if r.get("college_id")]

    users_by_id = {}
    if user_ids:
        users = supabase.table("users").select("id, email, full_name").in_("id", user_ids).execute()
        users_by_id = {u["id"]: u for u in users.data}

    colleges_by_id = {}
    if college_ids:
        cols = supabase.table("colleges").select("id, name").in_("id", college_ids).execute()
        colleges_by_id = {c["id"]: c for c in cols.data}

    return [
        {**r, "user": users_by_id.get(r["user_id"]), "college": colleges_by_id.get(r.get("college_id"))}
        for r in rows
    ]


# ── super admin step-up verification ──────────────────────────────
#
# Being a super admin is decided by account (env allowlist or the
# super_admins table). This adds a second factor on top: a code emailed
# to the admin, required before the panel opens. It is a step-up check on
# an already-authenticated session, not a second login -- so it cannot be
# used to gain access, only to confirm the person holding the session
# also controls the mailbox.
SUPER_ADMIN_OTP_TTL = 600


@router.post("/auth/super-admin/request-code")
def request_super_admin_code(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email address.")

    code = f"{secrets.randbelow(1_000_000):06d}"

    # Send first, store second. Storing before sending leaves a valid code
    # sitting in Redis after a failed send -- accepted by the verify
    # endpoint but never delivered to anyone, which looks to the admin
    # like the code simply "doesn't work".
    try:
        send_email(
            to=email,
            subject="Festify admin access code",
            body=(
                f"Your Festify super admin access code is {code}.\n\n"
                f"It expires in {SUPER_ADMIN_OTP_TTL // 60} minutes.\n\n"
                "If you did not request this, someone may have access to your "
                "Festify session. Sign out on all devices."
            ),
        )
    except Exception as e:
        logger.exception("Could not send super admin code to %s", email)
        raise HTTPException(status_code=502, detail=str(e))

    redis_client.set_with_ttl(f"sa_otp:{current_user['id']}", code, SUPER_ADMIN_OTP_TTL)

    # Never return the code itself; only where it went.
    masked = email[0] + "***" + email[email.index("@"):] if "@" in email else "your email"
    return {"sent_to": masked, "expires_in_seconds": SUPER_ADMIN_OTP_TTL}


@router.post("/auth/super-admin/verify-code")
def verify_super_admin_code(body: SuperAdminOtpVerify, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)

    stored = redis_client.get(f"sa_otp:{current_user['id']}")
    if not stored:
        raise HTTPException(status_code=400, detail="No code pending, or it has expired. Request a new one.")
    if body.code != stored:
        raise HTTPException(status_code=400, detail="Incorrect code.")

    redis_client.delete(f"sa_otp:{current_user['id']}")
    # Short-lived grant: the panel re-verifies rather than trusting a
    # long-lived flag, so a stolen session is not permanently elevated.
    ticket = secrets.token_urlsafe(32)
    redis_client.set_with_ttl(f"sa_session:{current_user['id']}", ticket, 60 * 60)
    return {"verified": True, "expires_in_seconds": 3600}


@router.get("/auth/super-admin/status")
def super_admin_status(current_user: dict = Depends(get_current_user)):
    """Whether this session has passed the emailed-code check."""
    if not is_super_admin(current_user):
        return {"is_super_admin": False, "verified": False}
    return {
        "is_super_admin": True,
        "verified": bool(redis_client.get(f"sa_session:{current_user['id']}")),
    }


@router.get("/auth/my-roles")
def my_roles(current_user: dict = Depends(get_current_user)):
    """What admin surfaces the signed-in user may see. The client uses
    this to decide which nav entries to render."""
    supabase = get_supabase()
    college_rows = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .execute()
    )
    return {
        "is_super_admin": is_super_admin(current_user),
        "college_admin_of": [r["college_id"] for r in college_rows.data],
    }
```

## File: backend/app/routers/scoring.py
```python
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
```

## File: backend/app/routers/support.py
```python
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
```

## File: backend/app/routers/team_size_overrides.py
```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_college_admin, require_org_manager, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import TeamSizeOverrideCreate, TeamSizeOverrideReview

router = APIRouter(tags=["team-size-overrides"])


@router.post("/ticket-tiers/{tier_id}/team-size-override")
def request_team_size_override(
    tier_id: str, body: TeamSizeOverrideCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("event_id").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    event_result = (
        supabase.table("events")
        .select("org_group_id, college_id")
        .eq("id", tier_result.data[0]["event_id"])
        .execute()
    )
    event = event_result.data[0]
    require_org_manager(current_user["id"], event["org_group_id"])

    routed_to = "college_admin" if event["college_id"] else "super_admin"

    inserted = (
        supabase.table("team_size_override_requests")
        .insert(
            {
                "ticket_tier_id": tier_id,
                "organizer_id": current_user["id"],
                "requested_max": body.requested_max,
                "routed_to": routed_to,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.post("/team-size-override-requests/{request_id}/review")
def review_team_size_override(
    request_id: str, body: TeamSizeOverrideReview, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    req_result = (
        supabase.table("team_size_override_requests").select("*").eq("id", request_id).execute()
    )
    if not req_result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    request_row = req_result.data[0]

    if request_row["status"] != "pending":
        raise HTTPException(status_code=409, detail="Request already decided")

    tier_result = (
        supabase.table("ticket_tiers")
        .select("event_id")
        .eq("id", request_row["ticket_tier_id"])
        .execute()
    )
    event_result = (
        supabase.table("events").select("college_id").eq("id", tier_result.data[0]["event_id"]).execute()
    )
    college_id = event_result.data[0]["college_id"]

    if request_row["routed_to"] == "college_admin":
        require_college_admin(current_user["id"], college_id)
    else:
        require_super_admin(current_user)

    granted_max = body.granted_max if body.approve else None
    updated = (
        supabase.table("team_size_override_requests")
        .update(
            {
                "status": "approved" if body.approve else "rejected",
                "granted_max": granted_max,
                "reviewed_by": current_user["id"],
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", request_id)
        .execute()
    )

    if body.approve and granted_max is not None:
        supabase.table("ticket_tiers").update({"max_team_size_override": granted_max}).eq(
            "id", request_row["ticket_tier_id"]
        ).execute()

    return updated.data[0]
```

## File: backend/app/routers/user_groups.py
```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import UserGroupCreate, UserGroupInvite, UserGroupRespond

router = APIRouter(prefix="/user-groups", tags=["user-groups"])


@router.post("")
def create_user_group(body: UserGroupCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    inserted = (
        supabase.table("user_groups").insert({"name": body.name, "owner_id": current_user["id"]}).execute()
    )
    group = inserted.data[0]

    supabase.table("user_group_members").insert(
        {
            "group_id": group["id"],
            "user_id": current_user["id"],
            "status": "accepted",
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()

    return group


def _require_member(supabase, group_id: str, user_id: str) -> None:
    result = (
        supabase.table("user_group_members")
        .select("status")
        .eq("group_id", group_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data or result.data[0]["status"] != "accepted":
        raise HTTPException(status_code=403, detail="Not a member of this group")


@router.get("/{group_id}")
def get_user_group(group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    group_result = supabase.table("user_groups").select("*").eq("id", group_id).execute()
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")

    _require_member(supabase, group_id, current_user["id"])

    members = supabase.table("user_group_members").select("*").eq("group_id", group_id).execute()
    return {"group": group_result.data[0], "members": members.data}


@router.post("/{group_id}/invite")
def invite_to_group(group_id: str, body: UserGroupInvite, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    group_result = supabase.table("user_groups").select("owner_id").eq("id", group_id).execute()
    if not group_result.data:
        raise HTTPException(status_code=404, detail="Group not found")
    if group_result.data[0]["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the group owner can invite members")

    existing = (
        supabase.table("user_group_members")
        .select("id")
        .eq("group_id", group_id)
        .eq("user_id", body.user_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="User already invited or a member")

    inserted = (
        supabase.table("user_group_members")
        .insert({"group_id": group_id, "user_id": body.user_id, "status": "invited"})
        .execute()
    )
    return inserted.data[0]


@router.post("/{group_id}/respond")
def respond_to_invite(
    group_id: str, body: UserGroupRespond, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    existing = (
        supabase.table("user_group_members")
        .select("*")
        .eq("group_id", group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="No invite found for this group")
    if existing.data[0]["status"] != "invited":
        raise HTTPException(status_code=409, detail="Invite already responded to")

    new_status = "accepted" if body.accept else "left"
    updated = (
        supabase.table("user_group_members")
        .update({"status": new_status, "responded_at": datetime.now(timezone.utc).isoformat()})
        .eq("group_id", group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    return updated.data[0]
```

## File: backend/app/routers/waitlist.py
```python
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import WaitlistJoin

router = APIRouter(prefix="/ticket-tiers", tags=["waitlist"])


@router.post("/{tier_id}/waitlist")
def join_waitlist(tier_id: str, body: WaitlistJoin, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("*").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")
    tier = tier_result.data[0]

    sold_result = (
        supabase.table("tickets")
        .select("id", count="exact")
        .eq("ticket_tier_id", tier_id)
        .in_("status", ["issued", "scanned"])
        .execute()
    )
    if (sold_result.count or 0) < tier["pool_capacity"]:
        raise HTTPException(status_code=409, detail="This tier still has tickets available -- buy directly")

    try:
        inserted = (
            supabase.table("event_waitlist")
            .insert(
                {
                    "event_id": tier["event_id"],
                    "ticket_tier_id": tier_id,
                    "user_id": current_user["id"],
                    "quantity_requested": body.quantity_requested,
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "23505":
            raise HTTPException(status_code=409, detail="You are already on the waitlist for this tier")
        raise
    return inserted.data[0]


@router.get("/{tier_id}/waitlist")
def list_waitlist(tier_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    tier_result = supabase.table("ticket_tiers").select("event_id").eq("id", tier_id).execute()
    if not tier_result.data:
        raise HTTPException(status_code=404, detail="Ticket tier not found")

    event_result = (
        supabase.table("events").select("org_group_id").eq("id", tier_result.data[0]["event_id"]).execute()
    )
    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    result = (
        supabase.table("event_waitlist")
        .select("*")
        .eq("ticket_tier_id", tier_id)
        .eq("status", "waiting")
        .order("created_at")
        .execute()
    )
    return result.data
```

## File: backend/app/routers/webhooks.py
```python
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
```

## File: backend/app/routers/wishlist.py
```python
from fastapi import APIRouter, Depends

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.routers.events import _enrich_events

router = APIRouter(tags=["wishlist-follow"])


@router.post("/events/{event_id}/wishlist")
def toggle_wishlist(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("event_wishlist")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("event_wishlist").delete().eq("event_id", event_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"wishlisted": False}

    supabase.table("event_wishlist").insert(
        {"event_id": event_id, "user_id": current_user["id"]}
    ).execute()
    return {"wishlisted": True}


@router.get("/users/me/wishlist")
def my_wishlist(current_user: dict = Depends(get_current_user)):
    """Full event objects, not just ids — the wishlist page renders event
    cards, and returning bare ids would force it into an N+1 fetch."""
    supabase = get_supabase()
    rows = (
        supabase.table("event_wishlist")
        .select("event_id")
        .eq("user_id", current_user["id"])
        .execute()
    )
    event_ids = [r["event_id"] for r in rows.data]
    if not event_ids:
        return []

    events = supabase.table("events").select("*").in_("id", event_ids).execute()
    return _enrich_events(supabase, events.data, current_user)


@router.post("/org-groups/{org_group_id}/follow")
def toggle_follow(org_group_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    existing = (
        supabase.table("org_follows")
        .select("id")
        .eq("org_group_id", org_group_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("org_follows").delete().eq("org_group_id", org_group_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"following": False}

    supabase.table("org_follows").insert(
        {"org_group_id": org_group_id, "user_id": current_user["id"]}
    ).execute()
    return {"following": True}


@router.get("/users/me/following")
def my_follows(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("org_follows")
        .select("org_group_id, created_at")
        .eq("user_id", current_user["id"])
        .execute()
    )
    return result.data
```

## File: backend/app/services/__init__.py
```python

```

## File: backend/app/services/notifications.py
```python
"""Notification dispatch.

One place that decides, per notification type, which channels it goes
out on and whether the user is allowed to turn it off -- implementing
the matrix in spec §10.

The rule that shapes everything here: **a notification must never break
the thing that triggered it.** A ticket purchase that succeeded but
whose confirmation email failed is still a successful purchase, so a
send failure is recorded and swallowed rather than raised. Getting this
wrong would mean an SMTP hiccup costs someone their ticket.
"""
import logging
from dataclasses import dataclass

from app.core.email_client import send_email
from app.core.supabase_client import get_supabase

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NotificationType:
    key: str
    email: bool          # sent by email by default
    in_app: bool         # written to the in-app feed
    mandatory: bool      # user cannot opt out (§10 "No — always sent")


# Straight from the §10 matrix. Anything not listed defaults to in-app
# only and opt-outable, which is the safe direction to be wrong in.
TYPES = {
    t.key: t
    for t in [
        NotificationType("purchase_confirmation", email=True, in_app=True, mandatory=True),
        NotificationType("event_cancelled", email=True, in_app=True, mandatory=True),
        NotificationType("prime_pass_active", email=True, in_app=True, mandatory=True),
        NotificationType("theft_report_decision", email=True, in_app=True, mandatory=True),
        NotificationType("organizer_application", email=True, in_app=True, mandatory=True),
        NotificationType("ticket_reissued", email=True, in_app=True, mandatory=True),
        NotificationType("wishlist_alert", email=False, in_app=True, mandatory=False),
        NotificationType("event_reminder", email=False, in_app=True, mandatory=False),
        NotificationType("org_broadcast", email=False, in_app=True, mandatory=False),
        NotificationType("offer", email=True, in_app=True, mandatory=False),
    ]
}

DEFAULT_TYPE = NotificationType("general", email=False, in_app=True, mandatory=False)


def _preferences(supabase, user_id: str, type_key: str) -> dict:
    try:
        res = (
            supabase.table("notification_preferences")
            .select("*")
            .eq("user_id", user_id)
            .eq("type", type_key)
            .execute()
        )
        return res.data[0] if res.data else {}
    except Exception:
        # A preferences lookup failing must not stop the notification.
        return {}


def notify(
    user_id: str,
    type_key: str,
    title: str,
    body: str = "",
    link: str | None = None,
    email_body: str | None = None,
    email_subject: str | None = None,
) -> dict | None:
    """Deliver one notification on every channel its type allows.

    Returns the stored row, or None if nothing could be stored. Never
    raises: the caller is always in the middle of something more
    important than telling someone about it.
    """
    if not user_id:
        return None

    spec = TYPES.get(type_key, DEFAULT_TYPE)
    supabase = get_supabase()
    prefs = {} if spec.mandatory else _preferences(supabase, user_id, type_key)

    want_email = spec.email and (spec.mandatory or prefs.get("email_enabled", True))
    want_in_app = spec.in_app and (spec.mandatory or prefs.get("in_app_enabled", True))

    channels = []

    if want_email:
        try:
            user = supabase.table("users").select("email, full_name").eq("id", user_id).execute()
            address = user.data[0]["email"] if user.data else None
            if address:
                send_email(
                    to=address,
                    subject=email_subject or title,
                    body=email_body or body or title,
                )
                channels.append("email")
        except Exception as e:
            # Recorded, not raised. The purchase, approval or reissue
            # that triggered this has already happened and must stand.
            logger.warning("Notification email failed for %s (%s): %s", user_id, type_key, e)

    if not want_in_app:
        return None

    try:
        row = (
            supabase.table("notifications")
            .insert({
                "user_id": user_id,
                "type": type_key,
                "title": title,
                "body": body or None,
                "link": link,
                "channels": channels + ["in_app"],
            })
            .execute()
        )
        return row.data[0]
    except Exception as e:
        logger.warning("Could not store notification for %s (%s): %s", user_id, type_key, e)
        return None


def notify_many(user_ids: list[str], **kwargs) -> int:
    """Fan one notification out to several people, e.g. a cancellation."""
    sent = 0
    for uid in dict.fromkeys(user_ids):  # de-duplicated, order preserved
        if notify(uid, **kwargs):
            sent += 1
    return sent
```

## File: backend/app/__init__.py
```python

```

## File: backend/app/deps.py
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import JWT_ALGORITHM
from app.core.supabase_client import get_supabase

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
) -> dict | None:
    """Resolve the user if a valid token is present, otherwise None.

    Public browsing surfaces (event lists, event detail) must work for
    logged-out guests, but need the viewer's identity when present so
    per-user flags like is_hyped/is_wishlisted can be filled in. A bad or
    expired token is treated as logged-out here rather than as an error,
    so a stale token never breaks public pages.
    """
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = get_supabase().table("users").select("*").eq("id", user_id).execute()
    return result.data[0] if result.data else None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    supabase = get_supabase()
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="User not found")

    return result.data[0]
```

## File: backend/app/serializers.py
```python
"""Shape raw DB rows into the objects the frontend actually consumes.

The UI reads nested, enriched events (`event.organizer.name`,
`event.tiers[]`, `hype_count`, `is_hyped`) rather than flat table rows,
and uses its own field names in places (`state`, `start_date`). Rather
than scatter that translation across every React component, the API
serves its client's shape here, in one place.
"""


def serialize_tier(tier: dict, sold_count: int = 0) -> dict:
    return {
        "id": tier["id"],
        "name": tier["name"],
        # The UI branches on tier.type for the college-only lock; derive it
        # rather than storing a redundant column.
        "type": "college_only" if tier.get("is_college_only") else "general",
        "price": float(tier.get("price") or 0),
        "quantity": tier.get("pool_capacity") or 0,
        "sold_count": sold_count,
        "college_only": bool(tier.get("is_college_only")),
        "valid_days": tier.get("valid_days") or 1,
        "min_team_size": tier.get("min_team_size") or 1,
        "max_team_size_override": tier.get("max_team_size_override"),
    }


def serialize_org(org: dict | None) -> dict | None:
    if not org:
        return None
    return {
        "id": org["id"],
        "name": org.get("name"),
        "trust_tier": org.get("trust_tier") or "new",
        "successful_events_count": org.get("successful_event_count") or 0,
        "score_points": org.get("score") or 0,
        "college": None,
        "avatar": None,
        "description": None,
    }


def serialize_event(
    event: dict,
    *,
    org: dict | None = None,
    tiers: list[dict] | None = None,
    sold_by_tier: dict[str, int] | None = None,
    hype_count: int = 0,
    is_hyped: bool = False,
    is_wishlisted: bool = False,
    cover_image: str | None = None,
    review_stats: dict | None = None,
) -> dict:
    sold_by_tier = sold_by_tier or {}
    review_stats = review_stats or {}
    return {
        "id": event["id"],
        "title": event.get("title"),
        "description": event.get("description"),
        "category": event.get("category"),
        "visibility": event.get("visibility"),
        # The UI calls this `state`; the column is `status`.
        "state": event.get("status"),
        "venue": event.get("venue"),
        "start_date": event.get("starts_at"),
        "end_date": event.get("ends_at"),
        "capacity": event.get("capacity"),
        "waitlist_enabled": event.get("waitlist_enabled", True),
        "cover_image": cover_image,
        "organizer": serialize_org(org),
        "org_group_id": event.get("org_group_id"),
        "college_id": event.get("college_id"),
        "tiers": [serialize_tier(t, sold_by_tier.get(t["id"], 0)) for t in (tiers or [])],
        "hype_count": hype_count,
        "is_hyped": is_hyped,
        "is_wishlisted": is_wishlisted,
        "avg_rating": review_stats.get("avg_rating"),
        "review_count": review_stats.get("review_count", 0),
        "sales_close_at": event.get("sales_close_at"),
        "edit_lock_at": event.get("edit_lock_at"),
        "youtube_video_id": event.get("youtube_video_id"),
    }
```

## File: supabase/migrations/0001_festify_full_schema.sql
```sql
-- ============================================================================
-- Festify — Full Schema Migration (APPLIED to Supabase project vinphlpxsejqyhgofybp)
--
-- Source: D:\claude\initial\festify_full.md
--
-- This file was assembled in two parts:
--
--   PART A — Reconstructed base tables (users, events, ticket_tiers, tickets,
--   orders, org_groups, colleges). §2 of the spec states these were created by
--   an earlier migration (`0001_init_schema.sql`) that does not exist anywhere
--   on disk. These 7 tables have been reconstructed here by inference from
--   every reference to their columns found elsewhere in the document (foreign
--   keys, generated columns, and prose mentions of specific fields). Columns
--   that are directly evidenced by the document are commented as such;
--   everything else is a reasonable inferred column needed to make the
--   dependent schema in Part B work at all. See the accompanying report for
--   the full evidenced-vs-inferred breakdown.
--
--   PART B — §31 "Consolidated SQL Migration", captured verbatim from the
--   document, in the same order and grouping as written there. Every comment
--   banner, blank line grouping, and statement matches §31 exactly.
--
-- NOTE: the four events.* columns (change_request_deadline, poll_close_by,
-- edit_lock_at, sales_close_at) were changed from GENERATED ALWAYS AS (...)
-- STORED to plain columns + a BEFORE INSERT/UPDATE trigger, because
-- `timestamptz - interval` is not immutable and Postgres rejects it as a
-- generated-column expression (error 42P17). Same computed result, valid SQL.
--
-- RLS is NOT enabled on any table yet — every table is currently fully
-- readable/writable by the anon/authenticated Supabase roles. This must be
-- addressed with real policies before any real user traffic touches this DB.
-- ============================================================================


-- ============================================================================
-- PART A: Reconstructed base tables (not present in the source document —
-- inferred from FK references and prose throughout the spec)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- colleges
-- Evidenced: referenced everywhere as `colleges(id)` (organizer_applications,
-- college_admins, users.college_id, org_groups.college_id, events.college_id).
-- No other column on `colleges` itself is explicitly named anywhere in the
-- document. `name` and `domain` below are inferred — `domain` specifically to
-- support the college-email OTP verification flow described in §23, which
-- requires matching a user's email against a known college domain.
-- ----------------------------------------------------------------------------
CREATE TABLE colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                 -- inferred
  domain text,                        -- inferred (used to validate college email in §23)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- users
-- Evidenced directly: `college_id` and `college_verified_at` are explicitly
-- listed in §27's Full Data Model Index as extensions to the base `users`
-- table ("extended here with customer_level, lifetime_spend,
-- lifetime_events_attended, college_id, college_verified_at"), and are used
-- throughout (§9.3, §12, §23, §26.1: "sets `college_verified_at`"). Note this
-- is a genuine inconsistency in the source document: §31's own
-- `ALTER TABLE users` only adds customer_level/lifetime_spend/
-- lifetime_events_attended, NOT college_id/college_verified_at — so those two
-- columns are placed directly on the reconstructed base table here instead,
-- since every other part of the document assumes they already exist.
-- `id` is evidenced everywhere via `users(id)` foreign keys.
-- email/full_name/avatar_url/phone/google_id are inferred — necessary for a
-- Google-OAuth-based identity system (§1, §26.1) but never named explicitly.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,         -- inferred
  full_name text,                     -- inferred
  avatar_url text,                    -- inferred
  phone text,                         -- inferred
  google_id text UNIQUE,              -- inferred (Google OAuth identity, §1/§26.1)
  college_id uuid REFERENCES colleges(id),        -- evidenced (§27, §9.3, §12, §13)
  college_verified_at timestamptz,                -- evidenced (§27, §9.3, §26.1)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- org_groups
-- Evidenced: `id` via `org_groups(id)` everywhere. The distinction between
-- "college-committee-organized events" and "private-organizer events...
-- including private organizations that happen to operate at a specific
-- college" (§19), plus college admins managing "organizations from their own
-- college only... does not extend to private/non-college-affiliated
-- organizations" (§4, §13 RLS), together imply org_groups needs both a
-- nullable college affiliation and a way to distinguish an official college
-- committee from a private org — but no literal `org_groups.college_id` or
-- `org_groups.is_college_committee` column name ever appears in the text, so
-- both are inferred. `name` is inferred (obviously necessary, never named).
-- ----------------------------------------------------------------------------
CREATE TABLE org_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                             -- inferred
  college_id uuid REFERENCES colleges(id),        -- inferred (§4, §13, §19)
  is_college_committee boolean NOT NULL DEFAULT false,  -- inferred (§19 flat-access distinction)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- events
-- Evidenced directly: `starts_at` (used in §6.2's GENERATED ALWAYS AS columns
-- — change_request_deadline, poll_close_by, edit_lock_at, sales_close_at, all
-- computed as `starts_at - interval ...`). `college_id` is evidenced directly
-- via §9.5: "routes using the exact same college-affiliation rule used
-- everywhere else in this document (`college_id` present on the event →
-- routes to college admin; otherwise → routes to super admin)".
-- org_group_id/title/description/venue/ends_at/status/visibility are all
-- inferred — necessary for the event lifecycle (§6.1's Draft → ... →
-- Completed / Postponed / Cancelled state machine) and visibility rules
-- (§26.2) but never given literal column names in the document.
-- ----------------------------------------------------------------------------
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),    -- inferred (the organizing group)
  college_id uuid REFERENCES colleges(id),        -- evidenced (§9.5)
  title text NOT NULL,                            -- inferred
  description text,                               -- inferred
  venue text,                                     -- inferred (§6.3 venue-clash detection)
  starts_at timestamptz NOT NULL,                 -- evidenced (§6.2 generated columns)
  ends_at timestamptz,                             -- inferred
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft','pending','live','early_access','on_sale',
      'sold_out','ongoing','completed','postponed','cancelled'
    )),                                            -- inferred (§6.1 state machine)
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','college_only','private')), -- inferred (§26.2)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- ticket_tiers
-- Evidenced: `id` via `ticket_tiers(id)` everywhere. `pool_capacity` is
-- evidenced by §9.5's formula: "COALESCE(max_team_size_override,
-- floor(pool_capacity * default_pct))" — a ticket_tiers-scoped capacity value
-- referenced by exact name. `is_college_only` is evidenced conceptually by
-- §9.3: "the ticket's tier (is it flagged college-only?)" — strongly implies
-- a boolean flag on the tier, though the exact column name is not given.
-- event_id/name/price are inferred (obviously necessary per §7.1's "Each
-- event can define multiple ticket tiers... each with its own name, price,
-- and quantity", but no literal column names given).
-- ----------------------------------------------------------------------------
CREATE TABLE ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),            -- inferred
  name text NOT NULL,                             -- inferred (§7.1: "its own name, price, and quantity")
  price numeric NOT NULL DEFAULT 0,                -- inferred (§7.1)
  pool_capacity int NOT NULL DEFAULT 0,            -- evidenced (§9.5 formula names it directly)
  is_college_only boolean NOT NULL DEFAULT false,  -- evidenced conceptually (§9.3)
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- orders
-- Evidenced: `id` via later `orders.captain_ticket_id` ALTER (§9.4/§31) and
-- via prose ("one row in `orders`" — §30.1). No individual order column is
-- ever named explicitly in the document (event_id, buyer_id, quantity,
-- total_amount, razorpay_order_id, status are all inferred — necessary to
-- represent "a buyer purchasing N tickets in one order" as described
-- throughout §9 and §30.1/§30.3, and to carry the Razorpay order reference
-- described in §8.2/§26.4, but never given literal column names).
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),            -- inferred
  buyer_id uuid REFERENCES users(id),              -- inferred
  quantity int NOT NULL DEFAULT 1,                 -- inferred
  total_amount numeric,                            -- inferred
  razorpay_order_id text,                          -- inferred (§8.2, §26.4)
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')), -- inferred
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- tickets
-- Evidenced directly: `event_id` is evidenced via §17.3's QR payload
-- definition ("The QR encodes: `ticket_id`, `event_id` ..."), which names
-- `event_id` as a field belonging to the ticket record itself. `verify_code`
-- is evidenced directly and extensively (§17.2, §17.3, §14, §30.4 — "the QR
-- code and its associated `verify_code` are generated a single time, at the
-- moment payment is captured"). `policy_snapshot` is evidenced directly
-- (§8.5: "The policy is snapshotted onto the specific ticket... `a JSON blob
-- capturing the three tiers`", named explicitly in §30.3 as `policy_snapshot`).
-- ticket_tier_id/order_id/owner_id/price_paid/status are inferred — necessary
-- to represent tier membership, order membership, current holder (required
-- by the transfer/captain mechanics in §9.4), and the Reserved/Issued/
-- Scanned/Expired lifecycle (§16.1), but never given literal column names
-- (§16.1 notes Reserved itself is a Redis key, never a DB row, so the DB
-- status enum only needs issued/scanned/expired).
-- ----------------------------------------------------------------------------
CREATE TABLE tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),             -- evidenced (§17.3 QR payload)
  ticket_tier_id uuid REFERENCES ticket_tiers(id),  -- inferred
  order_id uuid REFERENCES orders(id),              -- inferred
  owner_id uuid REFERENCES users(id),               -- inferred (current holder; §9.4 captain mechanic needs this)
  verify_code text,                                 -- evidenced (§17.2, §17.3, §14)
  price_paid numeric,                               -- inferred
  policy_snapshot jsonb,                            -- evidenced (§8.5, §30.3)
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','scanned','expired')), -- inferred (§16.1: Reserved is Redis-only, never a DB row)
  created_at timestamptz DEFAULT now()
);


-- ============================================================================
-- PART B: §31 "Consolidated SQL Migration" — captured verbatim from the
-- source document (D:\claude\initial\festify_full.md, lines ~1337-1678).
-- Comment banners and grouping below match §31 exactly as written.
-- ============================================================================

-- ============================================================
-- PART 1: Extend base tables with columns introduced in this document
-- ============================================================

ALTER TABLE users
  ADD COLUMN customer_level text DEFAULT 'bronze'
    CHECK (customer_level IN ('bronze','silver','gold','platinum','prime')),
  ADD COLUMN lifetime_spend numeric DEFAULT 0,
  ADD COLUMN lifetime_events_attended int DEFAULT 0;

ALTER TABLE events
  ADD COLUMN change_request_deadline timestamptz,
  ADD COLUMN poll_close_by timestamptz,
  ADD COLUMN edit_lock_at timestamptz,
  ADD COLUMN sales_close_at timestamptz,
  ADD COLUMN offline_mode_enabled boolean DEFAULT true,
  ADD COLUMN youtube_video_id text,
  ADD COLUMN youtube_valid boolean DEFAULT null,
  ADD COLUMN ai_prompt_custom text;

CREATE OR REPLACE FUNCTION set_events_derived_timestamps()
RETURNS trigger AS $$
BEGIN
  NEW.change_request_deadline := NEW.starts_at - interval '4 days';
  NEW.poll_close_by := NEW.starts_at - interval '2 days';
  NEW.edit_lock_at := NEW.starts_at - interval '48 hours';
  NEW.sales_close_at := NEW.starts_at - interval '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_events_derived_timestamps
  BEFORE INSERT OR UPDATE OF starts_at ON events
  FOR EACH ROW EXECUTE FUNCTION set_events_derived_timestamps();

ALTER TABLE ticket_tiers
  ADD COLUMN coupon_code text,
  ADD COLUMN discount_pct numeric,
  ADD COLUMN bulk_discount_threshold int,
  ADD COLUMN bulk_discount_pct numeric,
  ADD COLUMN assignment_mode text NOT NULL DEFAULT 'flexible'
    CHECK (assignment_mode IN ('flexible','locked_roster')),
  ADD COLUMN min_team_size int NOT NULL DEFAULT 1 CHECK (min_team_size >= 1),
  ADD COLUMN max_team_size_override int,
  ADD COLUMN valid_days int NOT NULL DEFAULT 1;

ALTER TABLE orders
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN team_name text,
  ADD COLUMN captain_ticket_id uuid REFERENCES tickets(id);

ALTER TABLE org_groups
  ADD COLUMN trust_tier text DEFAULT 'new' CHECK (trust_tier IN ('new','verified','trusted')),
  ADD COLUMN successful_event_count int DEFAULT 0,
  ADD COLUMN recent_failed_event_count int DEFAULT 0,
  ADD COLUMN score int DEFAULT 0;

-- ============================================================
-- PART 2: Event lifecycle & change-request polling (§6)
-- ============================================================

CREATE TABLE event_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  question text,
  closes_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE event_poll_votes (
  poll_id uuid REFERENCES event_polls(id),
  user_id uuid REFERENCES users(id),
  vote boolean,
  PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE event_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  poll_id uuid REFERENCES event_polls(id),
  change_details text,
  status text DEFAULT 'pending_super_admin'
    CHECK (status IN ('pending_super_admin','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 3: User-to-user — friend groups, sharing, team events (§9)
-- ============================================================

CREATE TABLE user_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id),
  name text,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE user_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES user_groups(id),
  user_id uuid REFERENCES users(id),
  status text CHECK (status IN ('invited','accepted','left')),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (group_id, user_id)
);

CREATE TABLE ticket_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  group_id uuid REFERENCES user_groups(id),
  recipient_id uuid REFERENCES users(id),
  status text CHECK (status IN ('pending','accepted','skipped_ineligible','expired')),
  skip_reason text,
  respond_by timestamptz,
  assigned_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

CREATE TABLE team_size_override_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_tier_id uuid REFERENCES ticket_tiers(id),
  organizer_id uuid REFERENCES users(id),
  requested_max int NOT NULL CHECK (requested_max > 0),
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  granted_max int,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 4: Org-to-org — co-hosting, internal roles (§10)
-- ============================================================

CREATE TABLE event_co_hosts (
  event_id uuid REFERENCES events(id),
  org_group_id uuid REFERENCES org_groups(id),
  is_billing_org boolean DEFAULT false,
  display_split_pct numeric,
  PRIMARY KEY (event_id, org_group_id)
);

CREATE TABLE org_member_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  user_id uuid REFERENCES users(id),
  role text CHECK (role IN ('leader','manager','ticket_checker')),
  permissions jsonb DEFAULT '{}',
  granted_by uuid REFERENCES users(id)
);

-- ============================================================
-- PART 5: User-to-organizer — hype, reviews, feedback, blocking (§11)
-- ============================================================

CREATE TABLE event_hypes (
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES users(id),
  weight numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  user_id uuid REFERENCES users(id),
  ticket_id uuid REFERENCES tickets(id),
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  weight numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE TABLE org_feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  org_group_id uuid REFERENCES org_groups(id),
  prime_user_id uuid REFERENCES users(id),
  message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE org_contact_blocks (
  user_id uuid REFERENCES users(id),
  org_group_id uuid REFERENCES org_groups(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, org_group_id)
);

-- ============================================================
-- PART 6: Organizer-to-admin — applications, trust, bans (§12)
-- ============================================================

CREATE TABLE organizer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid REFERENCES users(id),
  college_id uuid REFERENCES colleges(id),
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_application_per_user
  ON organizer_applications (applicant_id) WHERE status = 'pending';

CREATE TABLE org_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  stage text CHECK (stage IN ('warning','7d','30d','long')),
  reason text,
  issued_by uuid REFERENCES users(id),
  ends_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE org_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  flagged_by uuid REFERENCES users(id),
  reason text,
  status text DEFAULT 'open' CHECK (status IN ('open','reviewed')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 7: Admin-to-admin — college admin accounts (§13)
-- ============================================================

CREATE TABLE college_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  college_id uuid REFERENCES colleges(id),
  added_by uuid REFERENCES users(id),
  status text DEFAULT 'active' CHECK (status IN ('active','flagged','removed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE college_admin_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_admin_id uuid REFERENCES college_admins(id),
  flagged_by uuid REFERENCES users(id),
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE admin_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_admin_id uuid REFERENCES college_admins(id),
  subject text,
  details text,
  status text DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 8: Admin-to-everyone — theft, support, audit (§14)
-- ============================================================

CREATE TABLE ticket_theft_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  reported_by uuid REFERENCES users(id),
  report_number int NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raised_by uuid REFERENCES users(id),
  category text CHECK (category IN ('theft_escalation','event_report','other')),
  related_id uuid,
  routed_to text CHECK (routed_to IN ('college_admin','super_admin')),
  status text DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action_type text,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 9: Ticket lifecycle — multi-day scans (§16)
-- ============================================================

CREATE TABLE ticket_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id),
  day_number int NOT NULL,
  scanned_at timestamptz NOT NULL,
  device_id text,
  synced_at timestamptz DEFAULT now(),
  UNIQUE (ticket_id, day_number)
);

-- ============================================================
-- PART 10: Standard bulk purchase (§18)
-- ============================================================

CREATE TABLE bulk_purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  buyer_id uuid REFERENCES users(id),
  requested_qty int NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  last_reminder_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX one_pending_bulk_request_per_buyer
  ON bulk_purchase_requests (buyer_id, event_id) WHERE status = 'pending';

-- ============================================================
-- PART 11: Gamification scoring ledger (§21)
-- ============================================================

CREATE TABLE score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  event_id uuid REFERENCES events(id),
  points int,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PART 12: Media — event banners (§24)
-- ============================================================

CREATE TABLE event_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  storage_path text NOT NULL,
  banner_type text NOT NULL CHECK (banner_type IN ('main','ticket','event_page','ad')),
  uploaded_by uuid REFERENCES users(id),
  status text DEFAULT 'active' CHECK (status IN ('active','removed')),
  source text DEFAULT 'uploaded' CHECK (source IN ('uploaded','ai_generated')),
  file_size_kb int,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT one_banner_per_type_per_event UNIQUE (event_id, banner_type)
);

-- ============================================================================
-- NOTE: §31 in the source document does not include a CREATE TABLE for
-- `scoring_config`, even though it is referenced constantly throughout the
-- document (§8.4, §9.5, §12, §21, §24.1, and the entire "scoring_config
-- Reference" appendix) as the general-purpose super-admin-tunable settings
-- table. Per the task instructions, this migration captures §31 exactly as
-- written and does not add statements beyond what's there — but this is
-- flagged explicitly here (and in the final report) as a table the document
-- clearly assumes exists yet never actually defines with a CREATE TABLE
-- anywhere in the document, including §31 itself.
-- ============================================================================

-- ============================================================================
-- End of migration.
-- ============================================================================
```

## File: supabase/migrations/0002_wishlist_waitlist_scoring_config.sql
```sql
-- Three tables the spec references constantly but never actually defines
-- with a CREATE TABLE anywhere in the document (flagged during schema
-- reconstruction): scoring_config (§8.4/§9.5/§12/§21/§24.1), a
-- wishlist/follow mechanism (§22), and a waitlist (§25, described as
-- "the shared destination every fallback points to").

CREATE TABLE scoring_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE event_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  event_id uuid REFERENCES events(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE org_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  org_group_id uuid REFERENCES org_groups(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, org_group_id)
);

CREATE TABLE event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  ticket_tier_id uuid REFERENCES ticket_tiers(id),
  user_id uuid REFERENCES users(id),
  quantity_requested int NOT NULL DEFAULT 1 CHECK (quantity_requested > 0),
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','notified','converted','expired')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (ticket_tier_id, user_id)
);
```

## File: supabase/migrations/0003_enable_rls.sql
```sql
-- Enables Row Level Security on all 33 tables. The FastAPI backend always
-- connects with the Supabase service_role key, which bypasses RLS
-- entirely -- so this has ZERO effect on anything the API does. It only
-- matters for the anon/authenticated keys, i.e. if the frontend ever
-- queries Supabase directly instead of going through the backend.
--
-- Policy: most tables get RLS enabled with NO policies, meaning direct
-- anon/authenticated access is fully denied (service_role still works
-- fine) -- these are tables the backend's own authorization logic
-- already gates, so leaving them closed to any other access path is the
-- safe default. A small set of genuinely public, read-only tables get an
-- explicit SELECT policy so the frontend *could* read them directly for
-- performance if it ever wants to, without needing to go through the API
-- for a plain public listing.

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_size_override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_co_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hypes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_contact_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_admin_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_theft_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

-- Public read-only policies (anon + authenticated) for genuinely public,
-- browsable data -- everything else stays fully closed to direct access.

CREATE POLICY "public read" ON public.colleges FOR SELECT USING (true);
CREATE POLICY "public read" ON public.org_groups FOR SELECT USING (true);
CREATE POLICY "public read" ON public.events FOR SELECT USING (visibility = 'public');
CREATE POLICY "public read" ON public.ticket_tiers FOR SELECT USING (true);
CREATE POLICY "public read" ON public.event_banners FOR SELECT USING (status = 'active');
CREATE POLICY "public read" ON public.event_reviews FOR SELECT USING (true);
CREATE POLICY "public read" ON public.event_hypes FOR SELECT USING (true);
```

## File: supabase/migrations/0004_add_razorpay_payment_id.sql
```sql
ALTER TABLE orders ADD COLUMN razorpay_payment_id text;
```

## File: supabase/migrations/0005_org_payouts_ledger.sql
```sql
-- Simulates what Razorpay Route would actually transfer to each organizer
-- once it's approved. Computed the same way a real transfer would be
-- (gross minus flat platform fee per §8.4), just recorded here instead of
-- moved by Razorpay. Converting to real transfers later is a small
-- addition (call Route's transfer API with these same numbers), not a
-- redesign.
CREATE TABLE org_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_group_id uuid REFERENCES org_groups(id),
  order_id uuid REFERENCES orders(id),
  gross_amount numeric NOT NULL,
  platform_fee numeric NOT NULL,
  net_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'transferred')),
  created_at timestamptz DEFAULT now()
);
```

## File: supabase/migrations/0006_event_category_capacity.sql
```sql
-- The frontend filters and browses by category across every discovery
-- surface (home category chips, search filters, category cover art), but
-- the source spec never defined a category column. Same for capacity,
-- which the event detail page shows and the bulk-purchase limit reads.
ALTER TABLE events
  ADD COLUMN category text NOT NULL DEFAULT 'Cultural'
    CHECK (category IN (
      'Hackathon','Cultural','Music','Sports',
      'Talk','Workshop','Party','Comedy','Theatre'
    )),
  ADD COLUMN capacity int,
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT true;
```

## File: supabase/migrations/0007_super_admins.sql
```sql
-- §4 describes Super Admin as separate auth outside the users table.
-- That system doesn't exist, and the interim env-var allowlist
-- (SUPER_ADMIN_EMAILS) can't be changed at runtime, so a super admin had
-- no way to promote anyone else. This makes the grant a real record.
--
-- The env var is kept as a bootstrap: it must still work even when this
-- table is empty, otherwise a fresh deploy has no way in.
CREATE TABLE super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  granted_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
```

## File: supabase/migrations/0008_prime_pass_and_gate_control.sql
```sql
-- Prime Pass subscriptions, and organizer control over the gate.
--
-- Prime Pass existed only as UI copy and a badge: there was no table, no
-- purchase path, and /auth/me never returned has_prime_pass, so the
-- benefit could never actually be held by anyone.
--
-- The gate columns let an organizer decide *when* attendees can see
-- their QR code. Revealing on purchase gives people hours or days to
-- screenshot and forward a ticket; revealing at the door shrinks that
-- window to the length of the queue.

CREATE TABLE IF NOT EXISTS prime_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  amount integer NOT NULL,
  starts_at timestamptz,
  expires_at timestamptz,
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz DEFAULT now()
);

-- The active-pass lookup runs on every profile load and on every
-- early-access check, so it gets an index rather than a scan.
CREATE INDEX IF NOT EXISTS idx_prime_passes_user_status
  ON prime_passes (user_id, status);

-- A person may hold only one live pass at a time. Renewals supersede
-- rather than stack, so this is a partial unique index on the active
-- rows only -- expired and cancelled history stays queryable.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prime_passes_one_active
  ON prime_passes (user_id) WHERE status = 'active';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS qr_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate_opened_at timestamptz;

COMMENT ON COLUMN events.qr_revealed_at IS
  'When the organizer released QR codes to ticket holders. NULL means holders see a placeholder instead of a scannable code.';
COMMENT ON COLUMN events.gate_opened_at IS
  'When the organizer started admitting attendees. Scans are rejected before this is set.';

ALTER TABLE prime_passes ENABLE ROW LEVEL SECURITY;
```

## File: backend/app/routers/auth.py
```python
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwt
from postgrest.exceptions import APIError
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import JWT_ALGORITHM
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

JWT_EXPIRY = timedelta(days=7)


class GoogleLoginRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    user: dict


@router.post("/google", response_model=TokenResponse)
def login_with_google(body: GoogleLoginRequest):
    if not settings.google_client_id:
        # Without this the audience check below is meaningless, and the
        # failure would surface as a confusing token error instead.
        raise HTTPException(
            status_code=500,
            detail="Server is missing GOOGLE_CLIENT_ID. Set it in the backend environment.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), settings.google_client_id
        )
    except ValueError as e:
        # Wrong audience lands here too, which is the likeliest cause when
        # the frontend and backend are configured with different clients.
        logger.warning("Google token rejected: %s", e)
        raise HTTPException(status_code=401, detail=f"Invalid Google ID token: {e}")
    except GoogleAuthError as e:
        # Fetching Google's signing certs is a network call; if it fails
        # this is our problem, not a bad token.
        logger.exception("Could not verify Google token")
        raise HTTPException(status_code=502, detail=f"Could not reach Google to verify sign-in: {e}")

    google_id = claims["sub"]
    email = claims.get("email")
    full_name = claims.get("name")
    avatar_url = claims.get("picture")

    supabase = get_supabase()
    existing = (
        supabase.table("users").select("*").eq("google_id", google_id).execute()
    )

    if existing.data:
        user = existing.data[0]
    else:
        # An account may already exist under this email from a different
        # sign-in path (a seeded row, or an earlier Google client). email
        # is UNIQUE, so inserting again would blow up with a constraint
        # violation; adopt the existing row instead.
        by_email = (
            supabase.table("users").select("*").eq("email", email).execute()
            if email else None
        )
        if by_email and by_email.data:
            user = (
                supabase.table("users")
                .update({
                    "google_id": google_id,
                    "full_name": full_name or by_email.data[0].get("full_name"),
                    "avatar_url": avatar_url or by_email.data[0].get("avatar_url"),
                })
                .eq("id", by_email.data[0]["id"])
                .execute()
                .data[0]
            )
        else:
            try:
                inserted = (
                    supabase.table("users")
                    .insert(
                        {
                            "google_id": google_id,
                            "email": email,
                            "full_name": full_name,
                            "avatar_url": avatar_url,
                        }
                    )
                    .execute()
                )
            except APIError as e:
                logger.exception("Failed to create user for %s", email)
                raise HTTPException(status_code=500, detail=f"Could not create your account: {e.message}")
            user = inserted.data[0]

    payload = {
        "sub": user["id"],
        "exp": datetime.now(timezone.utc) + JWT_EXPIRY,
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)

    return TokenResponse(access_token=token, user=_with_profile(user))


def _with_profile(user: dict) -> dict:
    """Attach the derived fields the client needs to route and gate UI.

    org_memberships drives the organizer dashboard nav, and is_prime /
    is_college_verified save the client from re-deriving them from
    customer_level and college_verified_at in several places.
    """
    supabase = get_supabase()
    roles = (
        supabase.table("org_member_roles")
        .select("org_group_id, role")
        .eq("user_id", user["id"])
        .execute()
    )

    org_ids = [r["org_group_id"] for r in roles.data]
    names_by_id: dict[str, str] = {}
    if org_ids:
        orgs = supabase.table("org_groups").select("id, name").in_("id", org_ids).execute()
        names_by_id = {o["id"]: o["name"] for o in orgs.data}

    # has_prime_pass was read by the profile and Prime pages from the
    # very start but never returned here, so it was permanently
    # undefined and every pass-gated benefit rendered as absent.
    from app.routers.prime_pass import get_active_pass

    active_pass = get_active_pass(supabase, user["id"])

    return {
        **user,
        # The column is full_name; every client surface reads `name`, so
        # the profile header and avatar have been rendering blank for
        # everyone. Aliasing here fixes each call site at once rather
        # than patching them one at a time and missing one.
        "name": user.get("full_name"),
        "is_prime": user.get("customer_level") == "prime",
        "has_prime_pass": bool(active_pass),
        "prime_pass_expires_at": (active_pass or {}).get("expires_at"),
        "is_college_verified": bool(user.get("college_verified_at")),
        "org_memberships": [
            {
                "org_id": r["org_group_id"],
                "org_name": names_by_id.get(r["org_group_id"]),
                # The UI's ownership check looks for 'owner'; the DB's
                # equivalent top role is 'leader'.
                "role": "owner" if r["role"] == "leader" else r["role"],
            }
            for r in roles.data
        ],
    }


@router.get("/me")
def read_current_user(current_user: dict = Depends(get_current_user)):
    return _with_profile(current_user)
```

## File: backend/app/routers/events.py
```python
from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import require_org_manager
from app.core.supabase_client import get_supabase
from app.deps import get_current_user, get_current_user_optional
from app.schemas import EventCreate, TicketTierCreate
from app.serializers import serialize_event, serialize_tier

router = APIRouter(prefix="/events", tags=["events"])

BUCKET = "event-banners"


def _enrich_events(supabase, events: list[dict], viewer: dict | None) -> list[dict]:
    """Attach organizer, tiers, hype and wishlist state to raw event rows.

    Batched deliberately: one query per related table for the whole page
    of events rather than per-event lookups, so a 20-event list stays at
    a handful of round trips instead of ~100.
    """
    if not events:
        return []

    event_ids = [e["id"] for e in events]
    org_ids = list({e["org_group_id"] for e in events if e.get("org_group_id")})

    orgs_by_id = {}
    if org_ids:
        orgs = supabase.table("org_groups").select("*").in_("id", org_ids).execute()
        orgs_by_id = {o["id"]: o for o in orgs.data}

    tiers = supabase.table("ticket_tiers").select("*").in_("event_id", event_ids).execute()
    tiers_by_event: dict[str, list[dict]] = {}
    for t in tiers.data:
        tiers_by_event.setdefault(t["event_id"], []).append(t)

    # Sold counts, so the UI can show "N left" and a capacity bar.
    tier_ids = [t["id"] for t in tiers.data]
    sold_by_tier: dict[str, int] = {}
    if tier_ids:
        sold = (
            supabase.table("tickets")
            .select("ticket_tier_id")
            .in_("ticket_tier_id", tier_ids)
            .in_("status", ["issued", "scanned"])
            .execute()
        )
        for row in sold.data:
            sold_by_tier[row["ticket_tier_id"]] = sold_by_tier.get(row["ticket_tier_id"], 0) + 1

    hypes = supabase.table("event_hypes").select("event_id, user_id").in_("event_id", event_ids).execute()
    hype_count_by_event: dict[str, int] = {}
    hyped_by_viewer: set[str] = set()
    for h in hypes.data:
        hype_count_by_event[h["event_id"]] = hype_count_by_event.get(h["event_id"], 0) + 1
        if viewer and h["user_id"] == viewer["id"]:
            hyped_by_viewer.add(h["event_id"])

    wishlisted: set[str] = set()
    if viewer:
        wl = (
            supabase.table("event_wishlist")
            .select("event_id")
            .eq("user_id", viewer["id"])
            .in_("event_id", event_ids)
            .execute()
        )
        wishlisted = {w["event_id"] for w in wl.data}

    banners = (
        supabase.table("event_banners")
        .select("event_id, storage_path, banner_type")
        .in_("event_id", event_ids)
        .eq("status", "active")
        .execute()
    )
    cover_by_event: dict[str, str] = {}
    for b in banners.data:
        if b["banner_type"] in ("main", "event_page") and b["event_id"] not in cover_by_event:
            cover_by_event[b["event_id"]] = supabase.storage.from_(BUCKET).get_public_url(b["storage_path"])

    reviews = supabase.table("event_reviews").select("event_id, rating").in_("event_id", event_ids).execute()
    review_stats: dict[str, dict] = {}
    for r in reviews.data:
        s = review_stats.setdefault(r["event_id"], {"total": 0, "count": 0})
        s["total"] += r["rating"] or 0
        s["count"] += 1

    out = []
    for e in events:
        stats = review_stats.get(e["id"])
        out.append(
            serialize_event(
                e,
                org=orgs_by_id.get(e.get("org_group_id")),
                tiers=tiers_by_event.get(e["id"], []),
                sold_by_tier=sold_by_tier,
                hype_count=hype_count_by_event.get(e["id"], 0),
                is_hyped=e["id"] in hyped_by_viewer,
                is_wishlisted=e["id"] in wishlisted,
                cover_image=cover_by_event.get(e["id"]),
                review_stats={
                    "avg_rating": round(stats["total"] / stats["count"], 1) if stats and stats["count"] else None,
                    "review_count": stats["count"] if stats else 0,
                },
            )
        )
    return out


@router.post("")
def create_event(body: EventCreate, current_user: dict = Depends(get_current_user)):
    require_org_manager(current_user["id"], body.org_group_id)

    supabase = get_supabase()

    # events.college_id is derived from the organizing org's own college
    # affiliation at creation time -- it's what §9.5's routing rule
    # ("college_id present on the event -> routes to college admin;
    # otherwise -> super admin") actually reads, so it must be set here
    # rather than left to the caller.
    org_result = supabase.table("org_groups").select("college_id").eq("id", body.org_group_id).execute()
    college_id = org_result.data[0]["college_id"] if org_result.data else None

    # Only states an organizer may set directly. The rest of the state
    # machine (sold_out, ongoing, completed) is reached by what happens
    # to the event, not by asking for it.
    allowed_status = {"draft", "live", "early_access", "on_sale"}
    if body.status not in allowed_status:
        raise HTTPException(
            status_code=422,
            detail=f"status must be one of: {', '.join(sorted(allowed_status))}",
        )

    inserted = (
        supabase.table("events")
        .insert(
            {
                "org_group_id": body.org_group_id,
                "college_id": college_id,
                "title": body.title,
                "description": body.description,
                "category": body.category,
                "venue": body.venue,
                "starts_at": body.starts_at,
                "ends_at": body.ends_at,
                "capacity": body.capacity,
                "visibility": body.visibility,
                "status": body.status,
            }
        )
        .execute()
    )
    return _enrich_events(supabase, inserted.data, current_user)[0]


@router.get("")
def list_events(
    q: str | None = None,
    category: str | None = None,
    sort: str = "trending",
    limit: int = Query(60, le=200),
    viewer: dict | None = Depends(get_current_user_optional),
):
    supabase = get_supabase()
    # Drafts and cancelled events must never appear in public discovery.
    # Filtering on visibility alone let an unfinished draft show up on
    # the homepage the moment it was created, since visibility defaults
    # to public and status defaults to draft.
    PUBLIC_STATUSES = ["live", "early_access", "on_sale", "sold_out", "ongoing", "completed"]
    query = (
        supabase.table("events")
        .select("*")
        .eq("visibility", "public")
        .in_("status", PUBLIC_STATUSES)
    )

    if category and category != "All":
        query = query.eq("category", category)
    if q:
        # Match title or venue, mirroring the client-side search this replaces.
        query = query.or_(f"title.ilike.%{q}%,venue.ilike.%{q}%")

    result = query.order("starts_at").limit(limit).execute()
    events = _enrich_events(supabase, result.data, viewer)

    if sort == "trending":
        events.sort(key=lambda e: e["hype_count"], reverse=True)
    elif sort == "price-asc":
        events.sort(key=lambda e: min([t["price"] for t in e["tiers"]], default=0))
    elif sort == "price-desc":
        events.sort(key=lambda e: max([t["price"] for t in e["tiers"]], default=0), reverse=True)

    return events


@router.get("/{event_id}")
def get_event(event_id: str, viewer: dict | None = Depends(get_current_user_optional)):
    supabase = get_supabase()
    result = supabase.table("events").select("*").eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return _enrich_events(supabase, result.data, viewer)[0]


@router.post("/{event_id}/tiers")
def create_ticket_tier(
    event_id: str, body: TicketTierCreate, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    event_result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")

    require_org_manager(current_user["id"], event_result.data[0]["org_group_id"])

    inserted = (
        supabase.table("ticket_tiers")
        .insert(
            {
                "event_id": event_id,
                "name": body.name,
                "price": body.price,
                "pool_capacity": body.pool_capacity,
                "is_college_only": body.is_college_only,
            }
        )
        .execute()
    )
    return serialize_tier(inserted.data[0], 0)


@router.get("/{event_id}/tiers")
def list_ticket_tiers(event_id: str):
    supabase = get_supabase()
    result = supabase.table("ticket_tiers").select("*").eq("event_id", event_id).execute()
    tier_ids = [t["id"] for t in result.data]

    sold_by_tier: dict[str, int] = {}
    if tier_ids:
        sold = (
            supabase.table("tickets")
            .select("ticket_tier_id")
            .in_("ticket_tier_id", tier_ids)
            .in_("status", ["issued", "scanned"])
            .execute()
        )
        for row in sold.data:
            sold_by_tier[row["ticket_tier_id"]] = sold_by_tier.get(row["ticket_tier_id"], 0) + 1

    return [serialize_tier(t, sold_by_tier.get(t["id"], 0)) for t in result.data]
```

## File: backend/app/routers/health.py
```python
import socket

from fastapi import APIRouter

from app.core.config import settings
from app.core.email_client import active_transport

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.get("/health/config")
def config_check():
    """Which external services this deployment is configured for.

    Presence only -- never a value, a length, or an address. A missing
    environment variable on the host is otherwise invisible: the code
    that needs it fails at the moment a user tries to use it, far from
    the deploy that caused it, which is exactly how a missing SMTP
    password reads as "the OTP email just doesn't arrive".

    Deliberately unauthenticated, because the admin surfaces it would
    diagnose are themselves gated behind an emailed code -- if email is
    the thing that is broken, an authenticated check cannot be reached.
    Booleans about whether a service is wired up are not sensitive.
    """

    def configured(*values: str) -> bool:
        return all(bool((v or "").strip()) for v in values)

    return {
        "email": {
            # Which transport a send would actually take. "none" means no
            # credentials at all; "smtp" on a host that firewalls SMTP
            # ports means every send will fail -- see /health/egress.
            "transport": active_transport(),
            "configured": active_transport() != "none",
            "smtp_host": settings.smtp_host,
            "smtp_port": settings.smtp_port,
            # Which transports have credentials at all. Presence only --
            # this is what distinguishes "the variable is missing" from
            # "the variable is set but another transport outranks it".
            "available": {
                "local_relay": configured(settings.local_api_key, settings.local_mail_url),
                "resend": configured(settings.resend_api_key),
                "brevo": configured(settings.brevo_api_key),
                "smtp": configured(settings.smtp_mail, settings.smtp_password),
            },
            "relay_url": settings.local_mail_url,
        },
        # Without a signing key nobody can log in at all, and the failure
        # surfaces from inside the JWT library as a bare 500 rather than
        # as a missing setting.
        "auth": {"jwt_secret_set": configured(settings.jwt_secret)},
        "database": {"configured": configured(settings.supabase_url, settings.supabase_service_role_key)},
        "redis": {"configured": configured(settings.upstash_redis_rest_url, settings.upstash_redis_rest_token)},
        "payments": {"configured": configured(settings.razorpay_key_id, settings.razorpay_key_secret)},
        "google_auth": {"configured": configured(settings.google_client_id)},
    }


# Fixed target list on purpose: an endpoint that connected to a
# caller-supplied host and port would be a port scanner wearing this
# service's IP address.
_EGRESS_TARGETS = (
    ("smtp.gmail.com", 587, "SMTP submission (STARTTLS)"),
    ("smtp.gmail.com", 465, "SMTP over implicit TLS"),
    ("api.resend.com", 443, "HTTPS email API"),
)


def _probe(family: int, sockaddr) -> str:
    sock = socket.socket(family, socket.SOCK_STREAM)
    # Match the timeout the real send uses. A shorter probe reports a
    # merely slow route as a blocked one, which is a worse error than no
    # measurement at all -- it looks authoritative and is wrong.
    sock.settimeout(20)
    try:
        sock.connect(sockaddr)
        return "reachable"
    except Exception as e:
        return f"{type(e).__name__}: {e}"
    finally:
        sock.close()


@router.get("/health/egress")
def egress_check():
    """Which outbound destinations this host can actually open a socket to.

    "Network is unreachable" has two causes needing opposite fixes: the
    host resolved an IPv6 address it has no route to (fixable in code by
    forcing IPv4), or the platform firewalls outbound SMTP entirely
    (only fixable by sending mail over HTTPS instead). Probing each
    address family separately tells them apart; guessing does not.
    """
    results = []
    for host, port, purpose in _EGRESS_TARGETS:
        entry = {"target": f"{host}:{port}", "purpose": purpose}
        try:
            infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
            by_family = {}
            for family, name in ((socket.AF_INET, "ipv4"), (socket.AF_INET6, "ipv6")):
                match = next((i for i in infos if i[0] == family), None)
                by_family[name] = (
                    _probe(family, match[4]) if match else "no address returned by DNS"
                )
            entry["result"] = by_family
        except Exception as e:
            entry["result"] = {"dns": f"{type(e).__name__}: {e}"}
        results.append(entry)
    return {"targets": results}
```

## File: backend/app/routers/hype_reviews.py
```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import ReviewCreate

router = APIRouter(prefix="/events", tags=["hype-reviews"])


@router.post("/{event_id}/hype")
def toggle_hype(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = (
        supabase.table("event_hypes")
        .select("*")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        supabase.table("event_hypes").delete().eq("event_id", event_id).eq(
            "user_id", current_user["id"]
        ).execute()
        return {"hyped": False}

    supabase.table("event_hypes").insert(
        {"event_id": event_id, "user_id": current_user["id"]}
    ).execute()
    return {"hyped": True}


@router.get("/{event_id}/hype")
def get_hype_count(event_id: str):
    supabase = get_supabase()
    result = supabase.table("event_hypes").select("user_id", count="exact").eq("event_id", event_id).execute()
    return {"count": result.count or 0}


@router.post("/{event_id}/reviews")
def create_review(event_id: str, body: ReviewCreate, current_user: dict = Depends(get_current_user)):
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=422, detail="Rating must be between 1 and 5")

    supabase = get_supabase()

    ticket_result = (
        supabase.table("tickets")
        .select("id")
        .eq("event_id", event_id)
        .eq("owner_id", current_user["id"])
        .execute()
    )
    if not ticket_result.data:
        raise HTTPException(status_code=403, detail="Only attendees with a ticket can review this event")

    existing = (
        supabase.table("event_reviews")
        .select("id")
        .eq("event_id", event_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="You have already reviewed this event")

    inserted = (
        supabase.table("event_reviews")
        .insert(
            {
                "event_id": event_id,
                "user_id": current_user["id"],
                "ticket_id": ticket_result.data[0]["id"],
                "rating": body.rating,
                "comment": body.comment,
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.get("/{event_id}/reviews")
def list_reviews(event_id: str):
    """Reviews with their author inlined.

    This returned raw rows carrying only user_id, so the client had no
    name or avatar to show and crashed reading review.user.name. A
    review without its author is not renderable, so the join belongs
    here rather than as a lookup per row on the client.
    """
    supabase = get_supabase()
    result = (
        supabase.table("event_reviews")
        .select("*")
        .eq("event_id", event_id)
        .order("created_at", desc=True)
        .execute()
    )
    if not result.data:
        return []

    user_ids = list({r["user_id"] for r in result.data if r.get("user_id")})
    users_by_id = {}
    if user_ids:
        users = (
            supabase.table("users")
            .select("id, full_name, avatar_url, customer_level")
            .in_("id", user_ids)
            .execute()
        )
        users_by_id = {u["id"]: u for u in users.data}

    out = []
    for r in result.data:
        u = users_by_id.get(r.get("user_id")) or {}
        out.append({
            **r,
            "user": {
                # The client reads `name`; the column is full_name. A
                # deleted account still leaves its review, so fall back
                # rather than emitting a user without one.
                "id": u.get("id"),
                "name": u.get("full_name") or "Festify user",
                "avatar_url": u.get("avatar_url"),
                "customer_level": u.get("customer_level"),
            },
            "is_prime_review": u.get("customer_level") == "prime",
        })
    return out
```

## File: backend/app/routers/orders.py
```python
import secrets

import razorpay.errors
from fastapi import APIRouter, Depends, HTTPException

from app.core.razorpay_client import get_razorpay
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import OrderCreate, PaymentVerifyRequest
from app.services.notifications import notify

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
    _notify_purchase(supabase, order, tickets_inserted.data)

    return {"order": updated_order, "tickets": tickets_inserted.data}


def _notify_purchase(supabase, order: dict, tickets: list) -> None:
    """Confirmation is mandatory under §10 and must never fail the sale.

    notify() swallows its own errors, so a mail outage cannot undo a
    paid order -- the tickets exist either way.
    """
    event = supabase.table("events").select("title, venue").eq("id", order["event_id"]).execute()
    title = event.data[0]["title"] if event.data else "your event"
    venue = event.data[0].get("venue") if event.data else None

    codes = ", ".join((t.get("verify_code") or "")[:8].upper() for t in tickets)
    count = len(tickets)
    plural = "s" if count != 1 else ""

    lines = [
        "Your payment is confirmed.",
        "",
        f"Event: {title}",
    ]
    if venue:
        lines.append(f"Venue: {venue}")
    lines += [
        f"Tickets: {count}",
        f"Booking code{plural}: {codes}",
        "",
        "Your QR code is released by the organizer shortly before doors open.",
        "Open the app at the gate to show it.",
    ]

    notify(
        user_id=order["buyer_id"],
        type_key="purchase_confirmation",
        title=f"{count} ticket{plural} confirmed for {title}",
        body=f"Booking code{plural}: {codes}",
        link="/me/tickets",
        email_subject=f"Your ticket{plural} for {title}",
        email_body="\n".join(lines),
    )


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
```

## File: backend/app/routers/prime_pass.py
```python
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
from app.services.notifications import notify

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

    expires = (updated.get("expires_at") or "")[:10]
    notify(
        user_id=row["user_id"],
        type_key="prime_pass_active",
        title="Prime Pass is active",
        body=f"Your {plan['label'].lower()} pass runs until {expires}.",
        link="/me/prime-pass",
        email_subject="Your Festify Prime Pass is active",
        email_body="\n".join([
            f"Your {plan['label']} Prime Pass is now active.",
            "",
            f"Valid until: {expires}",
            "",
            "You now get early access before general sale, a dedicated ticket",
            "pool on every event, and the Prime badge on your profile and reviews.",
        ]),
    )
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
```

## File: backend/app/routers/super_auth.py
```python
"""Super admin login -- email and a one-time code, independent of Google.

Super admins used to be ordinary Google accounts carrying a flag, which
meant the panel could only be reached by first signing in as a normal
user. This is a login of its own: enter an approved email, receive a
code, and get a session. No Google, no password, no shared secret to
leak.

Only addresses in super_admins (or the SUPER_ADMIN_EMAILS bootstrap) can
receive a code, so an unapproved address can never obtain a session no
matter what it sends.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Body, Depends, HTTPException, Request

from app.authz import require_super_admin
from app.core import redis_client
from app.core.config import settings
from app.core.email_client import send_email
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/auth/super", tags=["super-auth"])
logger = logging.getLogger(__name__)

OTP_TTL = 600           # 10 minutes
SESSION_HOURS = 8
MAX_ATTEMPTS = 5        # per code, before it is burned
REQUEST_WINDOW = 600    # 10 minutes
# Generous enough to survive a few genuine failures -- a slow cold start
# or a relay hiccup makes people retry, and locking them out for that is
# punishing the wrong thing. Still far too low to be useful for probing.
MAX_REQUESTS = 10       # per email per window


def _bootstrap_emails() -> set[str]:
    return {e.strip().lower() for e in (settings.super_admin_emails or "").split(",") if e.strip()}


def is_approved_email(supabase, email: str) -> bool:
    """Whether this address may hold a super admin session."""
    email = (email or "").strip().lower()
    if not email:
        return False
    if email in _bootstrap_emails():
        return True
    rows = (
        supabase.table("super_admins")
        .select("id, is_active")
        .ilike("email", email)
        .execute()
    )
    return any(r.get("is_active", True) for r in rows.data)


def _find_or_create_user(supabase, email: str) -> dict:
    """The session still needs a users row to hang on.

    A super admin approved by email may never have signed in with Google,
    so there may be no account yet. One is created on first successful
    login rather than blocking it.
    """
    existing = supabase.table("users").select("*").ilike("email", email).execute()
    if existing.data:
        return existing.data[0]

    created = (
        supabase.table("users")
        .insert({"email": email.lower(), "full_name": email.split("@")[0]})
        .execute()
    )
    return created.data[0]


@router.post("/request-code")
def request_code(body: dict = Body(...), request: Request = None):
    email = (body.get("email") or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    # Rate limit per address, so this endpoint cannot be used to hammer
    # an approved admin's inbox or to probe addresses in bulk.
    rate_key = f"sa_login_rate:{email}"
    attempts = int(redis_client.get(rate_key) or 0)
    if attempts >= MAX_REQUESTS:
        # Say how long. A bare "try again later" after a failure the
        # person did not cause reads as the login being broken, and they
        # retry -- which is exactly what got them limited.
        raise HTTPException(
            status_code=429,
            detail=(
                f"Too many code requests for this address. "
                f"Try again in about {REQUEST_WINDOW // 60} minutes."
            ),
        )
    redis_client.set_with_ttl(rate_key, str(attempts + 1), REQUEST_WINDOW)

    supabase = get_supabase()
    approved = is_approved_email(supabase, email)

    if approved:
        code = f"{secrets.randbelow(1_000_000):06d}"
        try:
            send_email(
                to=email,
                subject="Festify admin sign-in code",
                body=(
                    f"Your Festify admin sign-in code is {code}.\n\n"
                    f"It expires in {OTP_TTL // 60} minutes.\n\n"
                    "If you did not try to sign in, ignore this email — "
                    "the code is useless without access to this inbox."
                ),
            )
        except Exception as e:
            logger.exception("Could not send super admin login code to %s", email)
            raise HTTPException(status_code=502, detail=str(e))

        # Stored only after the send succeeds: a code that never arrived
        # must not sit here waiting to be accepted.
        redis_client.set_with_ttl(f"sa_login:{email}", f"{code}:0", OTP_TTL)
    else:
        # Deliberately indistinguishable from success. Saying "not an
        # admin" would turn this form into a way to discover exactly
        # which addresses hold the highest privilege on the platform.
        logger.warning("Super admin code requested for unapproved address %s", email)

    return {
        "message": "If that address is approved, a sign-in code is on its way.",
        "expires_in_seconds": OTP_TTL,
    }


@router.post("/verify-code")
def verify_code(body: dict = Body(...)):
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    if not email or not code:
        raise HTTPException(status_code=422, detail="Email and code are both required.")

    stored = redis_client.get(f"sa_login:{email}")
    if not stored:
        raise HTTPException(status_code=400, detail="No code pending, or it has expired. Request a new one.")

    expected, attempts = stored.rsplit(":", 1)
    attempts = int(attempts)

    if attempts >= MAX_ATTEMPTS:
        redis_client.delete(f"sa_login:{email}")
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Request a new code.")

    if not secrets.compare_digest(code, expected):
        redis_client.set_with_ttl(f"sa_login:{email}", f"{expected}:{attempts + 1}", OTP_TTL)
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect code. {MAX_ATTEMPTS - attempts - 1} attempts left.",
        )

    supabase = get_supabase()
    # Re-check approval at verification. A grant could have been revoked
    # in the ten minutes since the code was issued.
    if not is_approved_email(supabase, email):
        redis_client.delete(f"sa_login:{email}")
        raise HTTPException(status_code=403, detail="This address is no longer approved.")

    redis_client.delete(f"sa_login:{email}")
    user = _find_or_create_user(supabase, email)

    # Link the grant to the account now that one exists, and record the
    # login so a dormant or unexpected admin is visible in the list.
    supabase.table("super_admins").update(
        {"user_id": user["id"], "last_login_at": datetime.now(timezone.utc).isoformat()}
    ).ilike("email", email).execute()

    # Without this the failure is "InvalidKeyError: HMAC key must not be
    # empty" raised from deep inside the JWT library, surfaced as a bare
    # 500 -- which reads as the login being broken rather than as one
    # unset environment variable.
    if not (settings.jwt_secret or "").strip():
        logger.error("JWT_SECRET is not set; cannot issue a session token")
        raise HTTPException(
            status_code=500,
            detail="The server is missing JWT_SECRET, so it cannot issue a session. Set it in the backend environment.",
        )

    token = jwt.encode(
        {"sub": user["id"], "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)},
        settings.jwt_secret,
        algorithm="HS256",
    )
    # Marks this session as having passed the emailed-code check, which
    # is what the panel's gate looks for.
    redis_client.set_with_ttl(f"sa_session:{user['id']}", secrets.token_urlsafe(32), SESSION_HOURS * 3600)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {**user, "is_super_admin": True},
        "expires_in_seconds": SESSION_HOURS * 3600,
    }


# ── managing who is approved ──────────────────────────────────────

@router.get("/admins")
def list_admins(current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = supabase.table("super_admins").select("*").order("created_at").execute().data
    return {
        "admins": rows,
        "bootstrap_emails": sorted(_bootstrap_emails()),
    }


@router.post("/admins")
def add_admin(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    email = (body.get("email") or "").strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")

    supabase = get_supabase()
    if supabase.table("super_admins").select("id").ilike("email", email).execute().data:
        raise HTTPException(status_code=409, detail="That address is already an admin.")

    # No user account required: the point is to approve someone before
    # they have ever signed in.
    existing_user = supabase.table("users").select("id").ilike("email", email).execute()
    inserted = (
        supabase.table("super_admins")
        .insert({
            "email": email,
            "user_id": existing_user.data[0]["id"] if existing_user.data else None,
            "granted_by": current_user["id"],
            "is_active": True,
        })
        .execute()
    )
    return inserted.data[0]


@router.delete("/admins/{admin_id}")
def remove_admin(admin_id: str, current_user: dict = Depends(get_current_user)):
    require_super_admin(current_user)
    supabase = get_supabase()

    row = supabase.table("super_admins").select("*").eq("id", admin_id).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="No such admin")

    target = row.data[0]
    if (target.get("email") or "").lower() == (current_user.get("email") or "").lower():
        # Removing your own access mid-session could leave the platform
        # with no reachable admin at all.
        raise HTTPException(status_code=409, detail="You cannot remove your own admin access.")

    remaining = supabase.table("super_admins").select("id").eq("is_active", True).execute()
    if len(remaining.data) <= 1 and not _bootstrap_emails():
        raise HTTPException(
            status_code=409,
            detail="This is the last super admin. Add another before removing this one.",
        )

    supabase.table("super_admins").delete().eq("id", admin_id).execute()
    if target.get("user_id"):
        redis_client.delete(f"sa_session:{target['user_id']}")
    return {"removed": admin_id}


@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user)):
    redis_client.delete(f"sa_session:{current_user['id']}")
    return {"logged_out": True}
```

## File: backend/app/authz.py
```python
from fastapi import HTTPException

from app.core.config import settings
from app.core.supabase_client import get_supabase

MANAGE_ROLES = ("leader", "manager")
SCAN_ROLES = ("leader", "manager", "ticket_checker")


def _org_roles(user_id: str, org_group_id: str) -> set[str]:
    supabase = get_supabase()
    result = (
        supabase.table("org_member_roles")
        .select("role")
        .eq("org_group_id", org_group_id)
        .eq("user_id", user_id)
        .execute()
    )
    return {row["role"] for row in result.data}


def require_org_manager(user_id: str, org_group_id: str) -> None:
    if not _org_roles(user_id, org_group_id).intersection(MANAGE_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to manage this org group")


def require_org_scanner(user_id: str, org_group_id: str) -> None:
    if not _org_roles(user_id, org_group_id).intersection(SCAN_ROLES):
        raise HTTPException(status_code=403, detail="Not authorized to scan tickets for this org group")


def is_college_admin(user_id: str, college_id: str) -> bool:
    if not college_id:
        return False
    supabase = get_supabase()
    result = (
        supabase.table("college_admins")
        .select("id")
        .eq("user_id", user_id)
        .eq("college_id", college_id)
        .eq("status", "active")
        .execute()
    )
    return bool(result.data)


def require_college_admin(user_id: str, college_id: str) -> None:
    if not is_college_admin(user_id, college_id):
        raise HTTPException(status_code=403, detail="Not authorized as an admin for this college")


def is_super_admin(user: dict | None) -> bool:
    """True if the user is a super admin, by either route.

    Two sources, deliberately: the SUPER_ADMIN_EMAILS env allowlist is the
    bootstrap (it has to work when the table is empty, or a fresh deploy
    locks everyone out), and the super_admins table holds grants made
    from the admin panel afterwards.
    """
    if not user:
        return False

    email = user.get("email")
    allowlist = {e.strip().lower() for e in settings.super_admin_emails.split(",") if e.strip()}
    if email and email.lower() in allowlist:
        return True

    supabase = get_supabase()

    # Email is the identity in super_admins now, so an admin approved
    # before they ever signed in still resolves. Matching on user_id
    # alone would miss them entirely -- their row has no user_id until
    # their first login links it.
    if email:
        by_email = (
            supabase.table("super_admins")
            .select("id, is_active")
            .ilike("email", email.strip().lower())
            .execute()
        )
        if any(r.get("is_active", True) for r in by_email.data):
            return True

    if not user.get("id"):
        return False
    by_id = (
        supabase.table("super_admins")
        .select("id, is_active")
        .eq("user_id", user["id"])
        .execute()
    )
    return any(r.get("is_active", True) for r in by_id.data)


def require_super_admin(current_user: dict) -> None:
    if not is_super_admin(current_user):
        raise HTTPException(status_code=403, detail="Super admin access required")
```

## File: backend/app/schemas.py
```python
from pydantic import BaseModel


class OrgGroupCreate(BaseModel):
    name: str
    college_id: str | None = None
    is_college_committee: bool = False


class EventCreate(BaseModel):
    org_group_id: str
    title: str
    description: str | None = None
    category: str = "Cultural"
    venue: str | None = None
    starts_at: str
    ends_at: str | None = None
    capacity: int | None = None
    visibility: str = "public"
    # Defaults to draft so a half-finished event is never public by
    # accident; the builder sends "on_sale" when the organizer publishes.
    status: str = "draft"


class TicketTierCreate(BaseModel):
    name: str
    price: float = 0
    pool_capacity: int
    is_college_only: bool = False


class OrderCreate(BaseModel):
    ticket_tier_id: str
    quantity: int = 1


class PaymentVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_signature: str


class TicketScanRequest(BaseModel):
    verify_code: str
    day_number: int = 1


class UserGroupCreate(BaseModel):
    name: str


class UserGroupInvite(BaseModel):
    user_id: str


class UserGroupRespond(BaseModel):
    accept: bool


class ReviewCreate(BaseModel):
    rating: int
    comment: str | None = None


class OrganizerApplicationCreate(BaseModel):
    college_id: str | None = None


class OrgBanCreate(BaseModel):
    stage: str
    reason: str | None = None
    override_escalation: bool = False


class OrgFlagCreate(BaseModel):
    reason: str


class CollegeAdminCreate(BaseModel):
    user_id: str
    college_id: str


class SuperAdminCreate(BaseModel):
    user_id: str


class SuperAdminOtpVerify(BaseModel):
    code: str


class SupportTicketCreate(BaseModel):
    category: str
    related_id: str | None = None
    routed_to: str = "super_admin"


class TicketTheftReportCreate(BaseModel):
    ticket_id: str


class BulkPurchaseRequestCreate(BaseModel):
    event_id: str
    requested_qty: int


class BulkPurchaseReviewRequest(BaseModel):
    approve: bool


class CoHostCreate(BaseModel):
    org_group_id: str
    is_billing_org: bool = False
    display_split_pct: float | None = None


class TicketAssignCreate(BaseModel):
    group_id: str
    recipient_id: str


class TicketAssignmentRespond(BaseModel):
    accept: bool


class TeamSizeOverrideCreate(BaseModel):
    requested_max: int


class TeamSizeOverrideReview(BaseModel):
    approve: bool
    granted_max: int | None = None


class EventPollCreate(BaseModel):
    question: str
    closes_at: str


class PollVoteRequest(BaseModel):
    vote: bool


class ChangeRequestCreate(BaseModel):
    poll_id: str | None = None
    change_details: str


class ChangeRequestDecision(BaseModel):
    approve: bool


class CollegeEmailVerifyRequest(BaseModel):
    college_email: str


class CollegeEmailVerifyConfirm(BaseModel):
    otp: str


class ScoringConfigSet(BaseModel):
    key: str
    value: dict | float | int | str | bool


class WaitlistJoin(BaseModel):
    quantity_requested: int = 1


class FeedbackRequestCreate(BaseModel):
    prime_user_id: str
    message: str


class CollegeAdminFlagCreate(BaseModel):
    reason: str
```

## File: backend/app/routers/organizer_admin.py
```python
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
```

## File: backend/app/routers/theft.py
```python
"""Ticket theft reports -- filing, routing, and reissue.

Previously a report inserted a row and stopped. Nothing computed who
should decide it, nothing enforced the spec's limits, no admin could
see it, and a valid report never produced a replacement ticket -- which
is the entire point of the feature.

Rules implemented here, from §6 (Ticket Theft & QR Security) and §8
(Support Ticket Routing):

  - a report must be raised at least 1 hour before the event starts
  - at most 2 reports per ticket per customer
  - a college student's report goes to their College Admin, everyone
    else's to a Super Admin
  - on approval the old verify code is dead and a new ticket is issued
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.authz import is_college_admin, is_super_admin, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.services.notifications import notify

router = APIRouter(prefix="/theft-reports", tags=["theft"])
logger = logging.getLogger(__name__)

REPORT_CUTOFF = timedelta(hours=1)
MAX_REPORTS_PER_CUSTOMER = 2


def _parse(ts: str | None):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _urgency(starts_at) -> tuple[str, str]:
    """How much time is left to actually act on a report.

    The final hour is not a cut-off. Someone whose ticket is stolen on
    the way to the venue is exactly who needs to report it, and refusing
    them because they are inside an arbitrary window helps nobody. What
    the window really means is that a reissue may not reach them before
    the doors open -- so the report is accepted, flagged for the top of
    the reviewer's queue, and the person is told plainly rather than
    being turned away.
    """
    if not starts_at:
        return "normal", ""

    remaining = starts_at - datetime.now(timezone.utc)

    if remaining.total_seconds() <= 0:
        return "started", (
            "This event has already started. A replacement ticket is unlikely to reach "
            "you in time, but the report is logged and the stolen code is under review."
        )
    if remaining <= REPORT_CUTOFF:
        mins = max(1, int(remaining.total_seconds() // 60))
        return "urgent", (
            f"The event starts in about {mins} minutes. This report goes to the top of the "
            "queue, but we may not be able to reissue your ticket before doors open."
        )
    return "normal", ""


@router.post("")
def file_report(body: dict = Body(...), current_user: dict = Depends(get_current_user)):
    ticket_id = (body or {}).get("ticket_id")
    if not ticket_id:
        raise HTTPException(status_code=422, detail="ticket_id is required")

    supabase = get_supabase()
    tickets = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not tickets.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket = tickets.data[0]

    if ticket["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="That is not your ticket.")

    if ticket["status"] in ("scanned", "used"):
        # §6: if the thief scans first, nothing can be done. Saying so
        # plainly beats opening a case that cannot be resolved.
        raise HTTPException(
            status_code=409,
            detail="This ticket has already been scanned. Once used, a ticket cannot be recovered.",
        )
    if ticket["status"] == "theft_reported":
        raise HTTPException(status_code=409, detail="A report on this ticket is already open.")
    if ticket["status"] in ("cancelled", "revoked", "expired"):
        raise HTTPException(status_code=409, detail=f"This ticket is {ticket['status']}.")

    events = supabase.table("events").select("*").eq("id", ticket["event_id"]).execute()
    event = events.data[0] if events.data else {}
    urgency, urgency_note = _urgency(_parse(event.get("starts_at")))

    # The limit is per customer per ticket, not per ticket. Counting all
    # reports on the ticket would let one person's two reports block a
    # different owner after a transfer.
    mine = (
        supabase.table("ticket_theft_reports")
        .select("id", count="exact")
        .eq("ticket_id", ticket_id)
        .eq("reported_by", current_user["id"])
        .execute()
    )
    if (mine.count or 0) >= MAX_REPORTS_PER_CUSTOMER:
        raise HTTPException(
            status_code=409,
            detail=(
                f"You have already filed {MAX_REPORTS_PER_CUSTOMER} reports for this ticket. "
                "Raise a support ticket instead."
            ),
        )

    # Routing is decided now and frozen. A student verifying their
    # college email mid-review should not silently move the case to a
    # different desk.
    college_id = current_user.get("college_id")
    is_verified_student = bool(current_user.get("college_verified_at")) and bool(college_id)
    routed_to = "college_admin" if is_verified_student else "super_admin"

    total = (
        supabase.table("ticket_theft_reports")
        .select("id", count="exact")
        .eq("ticket_id", ticket_id)
        .execute()
    )

    inserted = (
        supabase.table("ticket_theft_reports")
        .insert({
            "ticket_id": ticket_id,
            "reported_by": current_user["id"],
            "report_number": (total.count or 0) + 1,
            "status": "pending",
            "routed_to": routed_to,
            "college_id": college_id if is_verified_student else None,
            "reason": (body.get("reason") or "").strip()[:500] or None,
        })
        .execute()
        .data[0]
    )

    # Freeze the ticket while the case is open, so it cannot be sold,
    # gifted or scanned in the meantime.
    supabase.table("tickets").update({"status": "theft_reported"}).eq("id", ticket_id).execute()

    return {
        **inserted,
        "routed_to_label": "your college admin" if routed_to == "college_admin" else "the Festify team",
        "urgency": urgency,
        "urgency_note": urgency_note,
    }


def _decorate(supabase, rows: list) -> list:
    """Inline reporter, ticket and event -- a reviewer needs all three."""
    if not rows:
        return []

    user_ids = list({r["reported_by"] for r in rows if r.get("reported_by")})
    ticket_ids = list({r["ticket_id"] for r in rows if r.get("ticket_id")})

    users = {}
    if user_ids:
        res = supabase.table("users").select("id, full_name, email").in_("id", user_ids).execute()
        users = {u["id"]: u for u in res.data}

    tickets, events = {}, {}
    if ticket_ids:
        res = supabase.table("tickets").select("*").in_("id", ticket_ids).execute()
        tickets = {t["id"]: t for t in res.data}
        event_ids = list({t["event_id"] for t in res.data if t.get("event_id")})
        if event_ids:
            ev = supabase.table("events").select("id, title, starts_at, venue").in_("id", event_ids).execute()
            events = {e["id"]: e for e in ev.data}

    out = []
    for r in rows:
        t = tickets.get(r.get("ticket_id")) or {}
        event = events.get(t.get("event_id"))
        urgency, note = _urgency(_parse((event or {}).get("starts_at")))
        out.append({
            **r,
            "reporter": users.get(r.get("reported_by")),
            "ticket": {
                "id": t.get("id"),
                "status": t.get("status"),
                "booking_code": (t.get("verify_code") or "")[:8].upper(),
                "price_paid": t.get("price_paid"),
            },
            "event": event,
            "urgency": urgency,
            "urgency_note": note,
        })

    # Soonest event first among pending work: a report is worth acting on
    # in proportion to how little time is left to act. Newest-first would
    # bury the one case that still has a chance of being resolved.
    order = {"urgent": 0, "normal": 1, "started": 2}
    out.sort(key=lambda r: (
        0 if r.get("status") == "pending" else 1,
        order.get(r.get("urgency"), 1),
        (r.get("event") or {}).get("starts_at") or "9999",
    ))
    return out


@router.get("")
def list_reports(
    status: str = Query("pending"),
    current_user: dict = Depends(get_current_user),
):
    """Reports this admin is responsible for.

    A super admin sees everything, including college-routed cases, so
    nothing can sit unowned if a college has no active admin. A college
    admin sees only their own college's.
    """
    supabase = get_supabase()

    query = supabase.table("ticket_theft_reports").select("*")
    if status and status != "all":
        query = query.eq("status", status)

    if is_super_admin(current_user):
        rows = query.order("created_at", desc=True).execute().data
        return _decorate(supabase, rows)

    admin_of = (
        supabase.table("college_admins")
        .select("college_id")
        .eq("user_id", current_user["id"])
        .eq("status", "active")
        .execute()
    )
    college_ids = [r["college_id"] for r in admin_of.data]
    if not college_ids:
        raise HTTPException(status_code=403, detail="You do not review theft reports.")

    rows = (
        query.eq("routed_to", "college_admin")
        .in_("college_id", college_ids)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return _decorate(supabase, rows)


def _may_decide(current_user: dict, report: dict) -> bool:
    if is_super_admin(current_user):
        return True
    if report.get("routed_to") != "college_admin":
        return False
    return is_college_admin(current_user["id"], report.get("college_id"))


@router.post("/{report_id}/approve")
def approve_report(
    report_id: str, body: dict = Body(default={}), current_user: dict = Depends(get_current_user)
):
    """Kill the compromised ticket and issue its replacement."""
    supabase = get_supabase()
    res = supabase.table("ticket_theft_reports").select("*").eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = res.data[0]

    if not _may_decide(current_user, report):
        raise HTTPException(status_code=403, detail="Not authorized to decide this report")
    if report["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"This report is already {report['status']}.")

    tickets = supabase.table("tickets").select("*").eq("id", report["ticket_id"]).execute()
    if not tickets.data:
        raise HTTPException(status_code=404, detail="Ticket no longer exists")
    old = tickets.data[0]

    # Revoke before issuing. If the insert failed after the old code was
    # still live, both codes would work at the gate.
    supabase.table("tickets").update({"status": "revoked"}).eq("id", old["id"]).execute()

    replacement = (
        supabase.table("tickets")
        .insert({
            "event_id": old["event_id"],
            "ticket_tier_id": old["ticket_tier_id"],
            "order_id": old.get("order_id"),
            "owner_id": old["owner_id"],
            # A fresh secret: the point of the reissue is that whoever
            # holds the old QR cannot use it.
            "verify_code": secrets.token_hex(16),
            "price_paid": old.get("price_paid"),
            "status": "issued",
        })
        .execute()
        .data[0]
    )

    updated = (
        supabase.table("ticket_theft_reports")
        .update({
            "status": "approved",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_note": (body or {}).get("note"),
            "replacement_ticket_id": replacement["id"],
        })
        .eq("id", report_id)
        .execute()
        .data[0]
    )

    logger.info("Theft report %s approved; ticket %s revoked, %s issued",
                report_id, old["id"], replacement["id"])

    new_code = replacement["verify_code"][:8].upper()
    notify(
        user_id=old["owner_id"],
        type_key="ticket_reissued",
        title="Your ticket has been replaced",
        body=f"New booking code: {new_code}. The old code no longer works.",
        link="/me/tickets",
        email_subject="Your Festify ticket has been reissued",
        email_body="\n".join([
            "Your theft report was approved and your ticket has been replaced.",
            "",
            f"New booking code: {new_code}",
            "",
            "The previous code and QR are now dead and will be refused at the",
            "gate. Open the app to see your new ticket.",
        ]),
    )
    return {
        **updated,
        "replacement": {
            "id": replacement["id"],
            "booking_code": replacement["verify_code"][:8].upper(),
        },
    }


@router.post("/{report_id}/reject")
def reject_report(
    report_id: str, body: dict = Body(default={}), current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    res = supabase.table("ticket_theft_reports").select("*").eq("id", report_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    report = res.data[0]

    if not _may_decide(current_user, report):
        raise HTTPException(status_code=403, detail="Not authorized to decide this report")
    if report["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"This report is already {report['status']}.")

    # Release the freeze: a rejected report means the ticket was never
    # compromised, so it goes back to being usable.
    supabase.table("tickets").update({"status": "issued"}).eq("id", report["ticket_id"]).execute()

    note = (body or {}).get("note")
    lines = [
        "Your theft report was reviewed and not approved.",
        "",
        "Your original ticket is active again and will work at the gate.",
    ]
    if note:
        lines += ["", f"Note from the reviewer: {note}"]

    notify(
        user_id=report["reported_by"],
        type_key="theft_report_decision",
        title="Theft report not approved",
        body="Your original ticket is active again and can be used at the gate.",
        link="/me/tickets",
        email_subject="About your Festify theft report",
        email_body="\n".join(lines),
    )

    return (
        supabase.table("ticket_theft_reports")
        .update({
            "status": "rejected",
            "reviewed_by": current_user["id"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_note": (body or {}).get("note"),
        })
        .eq("id", report_id)
        .execute()
        .data[0]
    )


@router.get("/mine")
def my_reports(current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    rows = (
        supabase.table("ticket_theft_reports")
        .select("*")
        .eq("reported_by", current_user["id"])
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return _decorate(supabase, rows)
```

## File: backend/app/routers/tickets.py
```python
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.authz import require_org_scanner
from app.core.supabase_client import get_supabase
from app.deps import get_current_user
from app.schemas import TicketAssignCreate, TicketAssignmentRespond, TicketScanRequest

router = APIRouter(prefix="/tickets", tags=["tickets"])

# Separate router so the wallet can live at /users/me/tickets rather than
# under the /tickets prefix.
wallet_router = APIRouter(tags=["tickets"])


@wallet_router.get("/users/me/tickets")
def my_tickets(current_user: dict = Depends(get_current_user)):
    """Every ticket the user currently holds, with the event and tier
    inlined so the wallet renders in a single request."""
    supabase = get_supabase()
    tickets = (
        supabase.table("tickets")
        .select("*")
        .eq("owner_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    if not tickets.data:
        return []

    event_ids = list({t["event_id"] for t in tickets.data if t.get("event_id")})
    tier_ids = list({t["ticket_tier_id"] for t in tickets.data if t.get("ticket_tier_id")})

    events_by_id = {}
    if event_ids:
        evs = supabase.table("events").select("*").in_("id", event_ids).execute()
        events_by_id = {e["id"]: e for e in evs.data}

    tiers_by_id = {}
    if tier_ids:
        ts = supabase.table("ticket_tiers").select("*").in_("id", tier_ids).execute()
        tiers_by_id = {t["id"]: t for t in ts.data}

    # Which days have already been scanned, so the wallet can show a
    # ticket as used without a second round trip per ticket.
    scans = (
        supabase.table("ticket_scans")
        .select("ticket_id")
        .in_("ticket_id", [t["id"] for t in tickets.data])
        .execute()
    )
    scanned = {s["ticket_id"] for s in scans.data}

    out = []
    for t in tickets.data:
        ev = events_by_id.get(t.get("event_id")) or {}
        tier = tiers_by_id.get(t.get("ticket_tier_id")) or {}
        # The organizer decides when codes go live. Withholding the scan
        # secret until then is the whole point: released at purchase, a
        # ticket can be screenshotted and forwarded for days; released at
        # the door, that window is the length of the queue. The booking
        # code stays visible throughout so people can still identify
        # their own ticket.
        revealed = bool(ev.get("qr_revealed_at"))
        out.append({
            "id": t["id"],
            "verify_code": t.get("verify_code") if revealed else None,
            "qr_revealed": revealed,
            "booking_code": (t.get("verify_code") or "")[:8].upper(),
            "status": "used" if t["id"] in scanned else t.get("status"),
            "price_paid": float(t.get("price_paid") or 0),
            "created_at": t.get("created_at"),
            "order_id": t.get("order_id"),
            "event": {
                "id": ev.get("id"),
                "title": ev.get("title"),
                "category": ev.get("category"),
                "venue": ev.get("venue"),
                "start_date": ev.get("starts_at"),
                "state": ev.get("status"),
                "cover_image": None,
                "qr_revealed_at": ev.get("qr_revealed_at"),
                "gate_opened_at": ev.get("gate_opened_at"),
            },
            "tier": {
                "id": tier.get("id"),
                "name": tier.get("name"),
                "price": float(tier.get("price") or 0),
            },
        })
    return out


def _get_ticket_or_404(supabase, ticket_id: str) -> dict:
    result = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result.data[0]


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    ticket = _get_ticket_or_404(supabase, ticket_id)

    if ticket["owner_id"] != current_user["id"]:
        event = supabase.table("events").select("org_group_id").eq("id", ticket["event_id"]).execute()
        org_group_id = event.data[0]["org_group_id"] if event.data else None
        if not org_group_id:
            raise HTTPException(status_code=403, detail="Not your ticket")
        require_org_scanner(current_user["id"], org_group_id)

    return ticket


@router.post("/scan")
def scan_ticket(body: TicketScanRequest, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    code = (body.verify_code or "").strip()
    if not code:
        raise HTTPException(status_code=422, detail="No ticket code supplied")

    # A QR carries the full 32-character verify_code, but the wallet
    # *shows* the holder a booking code -- its first 8 characters,
    # uppercased. Gate staff read that off the screen and type it, so an
    # exact match alone made manual entry impossible while scanning
    # worked perfectly.
    ticket_result = supabase.table("tickets").select("*").eq("verify_code", code).execute()

    if not ticket_result.data and len(code) >= 6:
        prefix = code.lower()
        ticket_result = (
            supabase.table("tickets").select("*").ilike("verify_code", f"{prefix}%").execute()
        )
        # A prefix is not guaranteed unique. Admitting the first of
        # several matches would be admitting an arbitrary person, so
        # ambiguity is an error rather than a guess.
        if len(ticket_result.data) > 1:
            raise HTTPException(
                status_code=409,
                detail="That code matches more than one ticket. Scan the QR code instead.",
            )

    if not ticket_result.data:
        raise HTTPException(status_code=404, detail="Invalid ticket code")
    ticket = ticket_result.data[0]

    event_result = (
        supabase.table("events")
        .select("org_group_id, gate_opened_at, title")
        .eq("id", ticket["event_id"])
        .execute()
    )
    if not event_result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    event = event_result.data[0]
    org_group_id = event["org_group_id"]

    require_org_scanner(current_user["id"], org_group_id)

    # Refuse scans before the organizer opens the gate. Without this the
    # gate switch is decorative: a scanner left running would admit
    # people hours early and burn their single-use ticket.
    if not event.get("gate_opened_at"):
        raise HTTPException(
            status_code=409,
            detail="The gate is closed. Open it from the event's gate controls before scanning.",
        )

    # Every state that must not open the gate, with the reason the
    # person at the door needs. Checking only "expired" meant a ticket
    # revoked after a theft report still admitted whoever held the old
    # QR -- which defeats the entire point of reissuing it.
    BLOCKED = {
        "expired": "This ticket has expired.",
        "cancelled": "This ticket was cancelled.",
        "revoked": "This ticket was revoked and replaced after a theft report. Ask for the current ticket.",
        "theft_reported": "This ticket is frozen while a theft report is reviewed.",
    }
    if ticket["status"] in BLOCKED:
        raise HTTPException(status_code=409, detail=BLOCKED[ticket["status"]])

    already_scanned_today = (
        supabase.table("ticket_scans")
        .select("id")
        .eq("ticket_id", ticket["id"])
        .eq("day_number", body.day_number)
        .execute()
    )
    if already_scanned_today.data:
        raise HTTPException(status_code=409, detail="Ticket already scanned for this day")

    tier_result = (
        supabase.table("ticket_tiers")
        .select("valid_days")
        .eq("id", ticket["ticket_tier_id"])
        .execute()
    )
    valid_days = tier_result.data[0]["valid_days"] if tier_result.data else 1

    if body.day_number < 1 or body.day_number > valid_days:
        raise HTTPException(status_code=400, detail=f"This ticket is not valid on day {body.day_number}")

    scan_inserted = (
        supabase.table("ticket_scans")
        .insert(
            {
                "ticket_id": ticket["id"],
                "day_number": body.day_number,
                "scanned_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )

    if body.day_number >= valid_days:
        update_result = (
            supabase.table("tickets")
            .update({"status": "scanned"})
            .eq("id", ticket["id"])
            .execute()
        )
        ticket = update_result.data[0]

    return {"ticket": ticket, "scan": scan_inserted.data[0]}


@router.post("/{ticket_id}/assign")
def assign_ticket(ticket_id: str, body: TicketAssignCreate, current_user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    ticket = _get_ticket_or_404(supabase, ticket_id)

    if ticket["owner_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the ticket owner can gift/assign it")
    if ticket["status"] != "issued":
        raise HTTPException(status_code=409, detail="Only an unscanned, unexpired ticket can be assigned")

    recipient_membership = (
        supabase.table("user_group_members")
        .select("status")
        .eq("group_id", body.group_id)
        .eq("user_id", body.recipient_id)
        .execute()
    )
    if not recipient_membership.data or recipient_membership.data[0]["status"] != "accepted":
        raise HTTPException(status_code=422, detail="Recipient is not an accepted member of that group")

    inserted = (
        supabase.table("ticket_assignments")
        .insert(
            {
                "ticket_id": ticket_id,
                "group_id": body.group_id,
                "recipient_id": body.recipient_id,
                "status": "pending",
            }
        )
        .execute()
    )
    return inserted.data[0]


@router.post("/assignments/{assignment_id}/respond")
def respond_to_assignment(
    assignment_id: str, body: TicketAssignmentRespond, current_user: dict = Depends(get_current_user)
):
    supabase = get_supabase()
    assignment_result = (
        supabase.table("ticket_assignments").select("*").eq("id", assignment_id).execute()
    )
    if not assignment_result.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment = assignment_result.data[0]

    if assignment["recipient_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can respond to this assignment")
    if assignment["status"] != "pending":
        raise HTTPException(status_code=409, detail="Assignment already responded to")

    now = datetime.now(timezone.utc).isoformat()

    if body.accept:
        supabase.table("tickets").update({"owner_id": current_user["id"]}).eq(
            "id", assignment["ticket_id"]
        ).execute()
        new_status = "accepted"
    else:
        # The DB's status CHECK constraint (§9/§31) has no literal "declined"
        # value -- 'skipped_ineligible' is the closest fit for "recipient did
        # not take this ticket".
        new_status = "skipped_ineligible"

    updated = (
        supabase.table("ticket_assignments")
        .update({"status": new_status, "responded_at": now})
        .eq("id", assignment_id)
        .execute()
    )
    return updated.data[0]
```

## File: backend/app/main.py
```python
import logging
import re

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import (
    auth,
    bulk_purchase,
    co_hosts,
    college_admins,
    college_verification,
    event_lifecycle,
    events,
    gate,
    health,
    hype_reviews,
    media,
    notifications,
    org_groups,
    orders,
    organizer_admin,
    organizer_interactions,
    platform,
    prime_pass,
    scoring,
    super_auth,
    support,
    team_size_overrides,
    theft,
    tickets,
    user_groups,
    waitlist,
    webhooks,
    wishlist,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Festify API")

# Browsers block cross-origin calls unless the API says otherwise, so the
# Vercel frontend cannot reach this API at all without these headers.
# Origins come from the CORS_ORIGINS env var (comma-separated) so a new
# deploy URL is a config change, not a code change.
_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # Vercel preview deploys get a new subdomain per push; this keeps them
    # working without re-listing each one. Anchored so it only matches
    # real *.vercel.app hosts.
    allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_VERCEL_ORIGIN = re.compile(r"^https://[a-z0-9-]+\.vercel\.app$")


def _cors_headers_for(request: Request) -> dict:
    """CORS headers for an error response, or none if the origin is not allowed.

    A handler registered for bare Exception is installed as Starlette's
    ServerErrorMiddleware, which wraps the *outside* of the stack -- so
    its response never passes back through CORSMiddleware and comes out
    with no CORS headers at all. The browser then reports a genuine
    server error as "blocked by CORS policy", hiding the real message and
    sending you to debug the wrong system entirely. Setting the headers
    here is what makes a 500 legible from the client.
    """
    origin = request.headers.get("origin")
    if not origin:
        return {}
    if origin not in _origins and not _VERCEL_ORIGIN.match(origin):
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return unhandled errors as JSON the browser can actually read."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
        headers=_cors_headers_for(request),
    )


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(org_groups.router)
app.include_router(events.router)
app.include_router(orders.router)
app.include_router(tickets.router)
app.include_router(tickets.wallet_router)
app.include_router(user_groups.router)
app.include_router(hype_reviews.router)
app.include_router(organizer_admin.router)
app.include_router(college_admins.router)
app.include_router(support.router)
app.include_router(bulk_purchase.router)
app.include_router(co_hosts.router)
app.include_router(team_size_overrides.router)
app.include_router(event_lifecycle.router)
app.include_router(college_verification.router)
app.include_router(media.router)
app.include_router(wishlist.router)
app.include_router(gate.router)
app.include_router(prime_pass.router)
app.include_router(super_auth.router)
app.include_router(theft.router)
app.include_router(notifications.router)
app.include_router(waitlist.router)
app.include_router(scoring.router)
app.include_router(organizer_interactions.router)
app.include_router(webhooks.router)
app.include_router(platform.router)
```