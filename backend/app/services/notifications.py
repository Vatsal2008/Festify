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
