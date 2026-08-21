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
    college_admin_views,
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
app.include_router(college_admin_views.router)
app.include_router(support.router)
app.include_router(bulk_purchase.router)
app.include_router(co_hosts.router)
app.include_router(team_size_overrides.router)
app.include_router(event_lifecycle.router)
app.include_router(college_verification.router)
app.include_router(media.router)
app.include_router(media.maintenance_router)
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
