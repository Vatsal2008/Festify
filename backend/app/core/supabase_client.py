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
