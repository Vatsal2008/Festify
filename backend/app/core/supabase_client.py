import threading

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


_local = threading.local()


def get_supabase() -> Client:
    """One Supabase client per thread.

    This was an @lru_cache singleton, which made it one client for the
    whole process. Every endpoint here is a sync `def`, and FastAPI runs
    those in a threadpool, so any two concurrent requests were driving
    one httpx connection pool from two threads at once. httpx clients
    are not thread-safe, and the corruption surfaced as three unrelated
    looking faults, all intermittent and none reproducible on demand:

        RuntimeError: deque mutated during iteration
        RemoteProtocolError: ConnectionTerminated error_code:1
        APIError: JSON could not be generated -- 400 from Cloudflare
                  (a half-written request reaching the edge)

    The last one is the interesting one: a corrupted pool sends a
    malformed request, Cloudflare rejects it with an HTML 400, and the
    Supabase library reports it as a JSON parsing failure -- so the
    symptom names neither the cause nor even the right layer.

    Thread-local rather than per-request: the threadpool reuses its
    threads, so connections are still pooled and reused, but no pool is
    ever touched by two threads at once. Per-request would be correct
    too and would pay for a fresh TLS handshake every call.
    """
    client = getattr(_local, "client", None)
    if client is None:
        client = create_client(
            _normalise_url(settings.supabase_url), settings.supabase_service_role_key
        )
        _local.client = client
    return client
