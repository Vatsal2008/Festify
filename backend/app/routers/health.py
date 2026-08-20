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
