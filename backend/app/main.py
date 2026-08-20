import logging

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
    org_groups,
    orders,
    organizer_admin,
    organizer_interactions,
    platform,
    prime_pass,
    scoring,
    support,
    team_size_overrides,
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

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Return unhandled errors as a normal JSON response.

    Without this, an unhandled exception escapes past CORSMiddleware and
    Starlette returns a bare 500 with no CORS headers. The browser then
    reports it as "blocked by CORS policy: No Access-Control-Allow-Origin
    header", which sends you chasing a CORS problem that does not exist
    while the real error stays invisible. Handling it here keeps the
    response inside the middleware stack, so the CORS headers survive and
    the actual message reaches the client.
    """
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}"},
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
app.include_router(waitlist.router)
app.include_router(scoring.router)
app.include_router(organizer_interactions.router)
app.include_router(webhooks.router)
app.include_router(platform.router)
