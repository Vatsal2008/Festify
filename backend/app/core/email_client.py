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
