"""Event media -- upload, placement, ordering.

Replaces the single-banner-per-type model, which allowed exactly one
row per (event, banner_type) and so could not hold a gallery at all.
An event can now carry any number of gallery images plus one asset in
each single-slot placement (cover, hero video, ticket background,
detail background).

Uploads go to Supabase Storage; the database holds the path and the
metadata the client needs to lay the asset out without measuring it.
"""
import logging
import mimetypes
import re
import secrets

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.authz import is_super_admin, require_org_manager, require_super_admin
from app.core.supabase_client import get_supabase
from app.deps import get_current_user

router = APIRouter(prefix="/events", tags=["media"])
# Storage maintenance is platform-wide, not an operation on one event,
# so it gets its own prefix rather than hiding under /events/{id}.
maintenance_router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)

BUCKET = "event-media"

PLACEMENTS = ("cover", "gallery", "hero_video", "ticket_bg", "detail_bg")
SINGLE_SLOT = ("cover", "hero_video", "ticket_bg", "detail_bg")

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"}
VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}

# Generous enough for a short loop at reasonable quality, low enough
# that one upload cannot exhaust a free storage tier. Checked against
# the bytes actually read, not the declared Content-Length, which a
# client controls.
MAX_IMAGE_MB = 8
MAX_VIDEO_MB = 40


def _ensure_bucket(supabase) -> None:
    try:
        buckets = supabase.storage.list_buckets()
        if not any(getattr(b, "name", None) == BUCKET for b in buckets):
            supabase.storage.create_bucket(BUCKET, options={"public": True})
    except Exception as e:
        # A bucket that already exists raises here on some versions;
        # that is not a failure worth aborting an upload for.
        logger.debug("Bucket check for %s: %s", BUCKET, e)


def _public_url(supabase, path: str) -> str:
    return supabase.storage.from_(BUCKET).get_public_url(path)


# Every URL form YouTube hands out. Accepting only one means an
# organiser who copied from the share sheet, the address bar or a Short
# gets a rejection for a link that is perfectly valid.
YOUTUBE_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?(?:.*&)?v=)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtu\.be/)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/embed/)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/shorts/)([A-Za-z0-9_-]{11})"),
    re.compile(r"(?:youtube\.com/live/)([A-Za-z0-9_-]{11})"),
    re.compile(r"^([A-Za-z0-9_-]{11})$"),          # a bare id
]


def parse_youtube_id(value: str) -> str | None:
    value = (value or "").strip()
    for pattern in YOUTUBE_PATTERNS:
        m = pattern.search(value)
        if m:
            return m.group(1)
    return None


def _serialize(supabase, row: dict) -> dict:
    if row.get("kind") == "youtube":
        vid = row.get("external_id")
        return {
            **row,
            "youtube_id": vid,
            "url": f"https://www.youtube.com/watch?v={vid}",
            # Params tuned for a silent background loop: muted so it may
            # autoplay at all, playlist set to itself because that is the
            # only way the embed loops, and chrome suppressed as far as
            # the player allows.
            "embed_url": (
                f"https://www.youtube-nocookie.com/embed/{vid}"
                f"?autoplay=1&mute=1&loop=1&playlist={vid}&controls=0"
                f"&modestbranding=1&rel=0&playsinline=1&disablekb=1"
            ),
            "watch_embed_url": f"https://www.youtube-nocookie.com/embed/{vid}?rel=0&playsinline=1",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        }
    return {**row, "url": _public_url(supabase, row["storage_path"])}


def _require_manager_for_event(supabase, event_id: str, user: dict) -> dict:
    result = supabase.table("events").select("org_group_id").eq("id", event_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    # A super admin manages any event's media. This admitted only the
    # owning organiser, which left the platform-wide event surface able
    # to change an event's timing but not the banner sitting above it --
    # and the banner is the half people actually see.
    if is_super_admin(user):
        return result.data[0]
    require_org_manager(user["id"], result.data[0]["org_group_id"])
    return result.data[0]


@router.post("/{event_id}/media")
async def upload_media(
    event_id: str,
    file: UploadFile = File(...),
    placement: str = Form("gallery"),
    alt_text: str = Form(""),
    current_user: dict = Depends(get_current_user),
):
    if placement not in PLACEMENTS:
        raise HTTPException(status_code=422, detail=f"placement must be one of {', '.join(PLACEMENTS)}")

    supabase = get_supabase()
    _require_manager_for_event(supabase, event_id, current_user)

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type in IMAGE_TYPES:
        kind, limit = "image", MAX_IMAGE_MB
    elif content_type in VIDEO_TYPES:
        # Video files are not stored here. Object storage bills egress,
        # and an autoplaying hero loop is the most bandwidth-hungry
        # thing a page can do -- a few thousand views of one clip
        # consumes a month's free allowance. YouTube's bandwidth is
        # unmetered, so videos are linked rather than hosted.
        raise HTTPException(
            status_code=415,
            detail="Video files are not uploaded directly. Paste a YouTube link instead — it costs no bandwidth and plays anywhere.",
        )
    else:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type or 'unknown'}'. Images: JPEG, PNG, WebP, AVIF, GIF. Video: MP4, WebM, MOV.",
        )

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > limit:
        raise HTTPException(
            status_code=413,
            detail=f"That file is {size_mb:.1f}MB. The limit for {kind}s is {limit}MB.",
        )

    # hero_video is a video slot and ticket_bg/cover are stills; putting
    # a 40MB video behind a ticket would make the wallet unusable on
    # mobile data.
    if placement == "hero_video":
        raise HTTPException(
            status_code=422,
            detail="The hero video slot takes a YouTube link, not a file.",
        )
    if placement in ("cover", "ticket_bg") and kind != "image":
        raise HTTPException(status_code=422, detail=f"The {placement.replace('_', ' ')} slot needs an image.")

    extension = (file.filename or "bin").rsplit(".", 1)[-1].lower()[:8] or "bin"
    # Random suffix: reusing a deterministic path means a replaced asset
    # keeps its URL and every CDN and browser cache keeps serving the
    # old bytes.
    storage_path = f"{event_id}/{placement}-{secrets.token_hex(6)}.{extension}"

    _ensure_bucket(supabase)
    try:
        supabase.storage.from_(BUCKET).upload(
            storage_path, contents, file_options={"content-type": content_type, "upsert": "false"}
        )
    except Exception as e:
        logger.exception("Upload failed for event %s", event_id)
        raise HTTPException(status_code=502, detail=f"Could not store the file: {e}")

    # A single-slot placement replaces whatever is there. Marked removed
    # rather than deleted so the previous asset can be recovered.
    if placement in SINGLE_SLOT:
        supabase.table("event_media").update({"status": "removed"}).eq("event_id", event_id).eq(
            "placement", placement
        ).eq("status", "active").execute()

    existing = (
        supabase.table("event_media")
        .select("sort_order")
        .eq("event_id", event_id)
        .eq("placement", placement)
        .eq("status", "active")
        .order("sort_order", desc=True)
        .limit(1)
        .execute()
    )
    next_order = ((existing.data[0]["sort_order"] if existing.data else -1) or 0) + 1

    row = (
        supabase.table("event_media")
        .insert({
            "event_id": event_id,
            "storage_path": storage_path,
            "kind": kind,
            "placement": placement,
            "sort_order": next_order,
            "alt_text": (alt_text or "").strip()[:200] or None,
            "mime_type": content_type,
            "file_size_kb": len(contents) // 1024,
            "uploaded_by": current_user["id"],
        })
        .execute()
        .data[0]
    )
    return _serialize(supabase, row)


@router.post("/{event_id}/media/youtube")
def attach_youtube(event_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Attach a YouTube video by link.

    Videos are referenced rather than hosted: object storage bills for
    every byte served, and a looping hero video is the heaviest thing a
    page can request. YouTube absorbs that bandwidth for nothing.
    """
    supabase = get_supabase()
    _require_manager_for_event(supabase, event_id, current_user)

    placement = (body or {}).get("placement", "hero_video")
    if placement not in PLACEMENTS:
        raise HTTPException(status_code=422, detail=f"placement must be one of {', '.join(PLACEMENTS)}")
    if placement in ("cover", "ticket_bg"):
        raise HTTPException(
            status_code=422,
            detail=f"The {placement.replace('_', ' ')} slot needs a still image, not a video.",
        )

    video_id = parse_youtube_id((body or {}).get("url", ""))
    if not video_id:
        raise HTTPException(
            status_code=422,
            detail="That does not look like a YouTube link. Paste the address from the browser or the Share button.",
        )

    if placement in SINGLE_SLOT:
        supabase.table("event_media").update({"status": "removed"}).eq("event_id", event_id).eq(
            "placement", placement
        ).eq("status", "active").execute()

    existing = (
        supabase.table("event_media")
        .select("sort_order")
        .eq("event_id", event_id)
        .eq("placement", placement)
        .eq("status", "active")
        .order("sort_order", desc=True)
        .limit(1)
        .execute()
    )
    next_order = ((existing.data[0]["sort_order"] if existing.data else -1) or 0) + 1

    row = (
        supabase.table("event_media")
        .insert({
            "event_id": event_id,
            "external_id": video_id,
            "kind": "youtube",
            "placement": placement,
            "sort_order": next_order,
            "alt_text": ((body or {}).get("alt_text") or "").strip()[:200] or None,
            "source": "youtube",
            "uploaded_by": current_user["id"],
        })
        .execute()
        .data[0]
    )

    # Kept in step with the legacy column so anything still reading
    # events.youtube_video_id sees the same video.
    if placement == "hero_video":
        supabase.table("events").update({"youtube_video_id": video_id}).eq("id", event_id).execute()

    return _serialize(supabase, row)


@router.get("/{event_id}/media")
def list_media(event_id: str):
    """Public: the detail page and ticket both read this."""
    supabase = get_supabase()
    rows = (
        supabase.table("event_media")
        .select("*")
        .eq("event_id", event_id)
        .eq("status", "active")
        .order("placement")
        .order("sort_order")
        .execute()
        .data
    )
    items = [_serialize(supabase, r) for r in rows]

    # Grouped as well as flat: every consumer wants "the gallery" or
    # "the ticket background" rather than a list to filter itself.
    by_placement = {p: [] for p in PLACEMENTS}
    for item in items:
        by_placement.setdefault(item["placement"], []).append(item)

    return {
        "media": items,
        "gallery": by_placement["gallery"],
        "cover": (by_placement["cover"] or [None])[0],
        "hero_video": (by_placement["hero_video"] or [None])[0],
        "ticket_bg": (by_placement["ticket_bg"] or [None])[0],
        "detail_bg": (by_placement["detail_bg"] or [None])[0],
    }


@router.patch("/{event_id}/media/{media_id}")
def update_media(
    event_id: str, media_id: str, body: dict, current_user: dict = Depends(get_current_user)
):
    """Move an asset to another placement, reorder it, or retitle it."""
    supabase = get_supabase()
    _require_manager_for_event(supabase, event_id, current_user)

    patch = {}
    if "placement" in body:
        if body["placement"] not in PLACEMENTS:
            raise HTTPException(status_code=422, detail="Unknown placement")
        patch["placement"] = body["placement"]
        if body["placement"] in SINGLE_SLOT:
            supabase.table("event_media").update({"status": "removed"}).eq(
                "event_id", event_id
            ).eq("placement", body["placement"]).eq("status", "active").neq("id", media_id).execute()
    if "sort_order" in body:
        patch["sort_order"] = int(body["sort_order"])
    if "alt_text" in body:
        patch["alt_text"] = (body["alt_text"] or "").strip()[:200] or None

    if not patch:
        raise HTTPException(status_code=422, detail="Nothing to update")

    result = supabase.table("event_media").update(patch).eq("id", media_id).eq(
        "event_id", event_id
    ).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Media not found")
    return _serialize(supabase, result.data[0])


@router.post("/{event_id}/media/reorder")
def reorder_media(event_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Persist a whole gallery order in one call.

    Sent as a list of ids in their new order. Doing this per item would
    leave the gallery briefly inconsistent between requests.
    """
    supabase = get_supabase()
    _require_manager_for_event(supabase, event_id, current_user)

    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(status_code=422, detail="Send ids as a non-empty list")

    for index, media_id in enumerate(ids):
        supabase.table("event_media").update({"sort_order": index}).eq("id", media_id).eq(
            "event_id", event_id
        ).execute()
    return list_media(event_id)


def _sweep_candidates(supabase, older_than_days: int) -> list[dict]:
    """Soft-deleted rows old enough to reclaim, plus what they cost.

    Removal marks the row and leaves the object in the bucket, so a
    mistaken delete stays recoverable. Nothing ever came back for those
    objects, which means every removal was a permanent charge against
    storage for a file no longer reachable from the product.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=older_than_days)).isoformat()
    rows = (
        supabase.table("event_media")
        .select("id, event_id, storage_path, kind, source, file_size_kb, created_at")
        .eq("status", "removed")
        .lte("created_at", cutoff)
        .execute()
        .data
    ) or []
    # A YouTube attachment has no stored bytes; its row is reclaimable
    # but there is nothing in the bucket to delete.
    return [r for r in rows if r.get("storage_path")]


def _paths_absent(supabase, paths: list[str]) -> list[str]:
    """Which of these objects are genuinely not in the bucket.

    One listing per folder rather than one existence check per file:
    media is stored under the event id, so a sweep usually touches a
    handful of folders however many files it covers.
    """
    by_folder: dict[str, list[str]] = {}
    for path in paths:
        folder, _, name = path.rpartition("/")
        by_folder.setdefault(folder, []).append(name)

    absent: list[str] = []
    for folder, names in by_folder.items():
        try:
            present = {
                entry.get("name")
                for entry in (supabase.storage.from_(BUCKET).list(folder) or [])
                if isinstance(entry, dict)
            }
        except Exception:
            # Cannot prove absence, so assume the object is still there.
            # Keeping a row costs one wasted check next run; dropping it
            # wrongly loses the pointer for good.
            logger.exception("media sweep: could not list %s", folder)
            continue
        absent.extend(f"{folder}/{n}" for n in names if n not in present)
    return absent


@maintenance_router.get("/sweep/preview")
def preview_sweep(
    older_than_days: int = Query(30, ge=0, le=3650),
    current_user: dict = Depends(get_current_user),
):
    """What a sweep would reclaim, without touching anything.

    Deleting files is not something to trigger blind, so the count and
    the size are shown first and the destructive call is separate.
    """
    require_super_admin(current_user)
    supabase = get_supabase()
    rows = _sweep_candidates(supabase, older_than_days)
    return {
        "older_than_days": older_than_days,
        "count": len(rows),
        "bytes_kb": sum(int(r.get("file_size_kb") or 0) for r in rows),
        "oldest": min((r.get("created_at") or "" for r in rows), default=None),
    }


@maintenance_router.post("/sweep")
def sweep_media(
    older_than_days: int = Query(30, ge=0, le=3650),
    current_user: dict = Depends(get_current_user),
):
    """Delete the stored objects behind soft-deleted media, then the rows.

    Storage first, row second. If the object delete fails the row stays,
    so the next sweep tries again; dropping the row first would lose the
    only pointer to the file and make the leak permanent and untraceable.
    """
    require_super_admin(current_user)
    supabase = get_supabase()

    rows = _sweep_candidates(supabase, older_than_days)
    if not rows:
        return {"swept": 0, "freed_kb": 0, "failed": 0}

    paths = [r["storage_path"] for r in rows]
    by_path = {r["storage_path"]: r for r in rows}

    removed_paths: list[str] = []
    # Batched, because one request per object against a remote bucket is
    # the difference between a sweep that finishes and one that times
    # out on a few hundred files.
    #
    # The response is read rather than assumed. remove() does not raise
    # for a path that is not there -- it returns an empty list and looks
    # exactly like success -- so trusting the call would drop the row
    # while the object stayed, which is the leak this endpoint exists to
    # close, made permanent and now untraceable. Only paths the API
    # confirms it deleted are treated as gone.
    for start in range(0, len(paths), 100):
        batch = paths[start:start + 100]
        try:
            result = supabase.storage.from_(BUCKET).remove(batch)
            confirmed = {
                entry.get("name")
                for entry in (result or [])
                if isinstance(entry, dict) and entry.get("name")
            }
            removed_paths.extend(p for p in batch if p in confirmed)
            missed = [p for p in batch if p not in confirmed]
            # An unconfirmed path is either a failure or a file that was
            # already gone -- remove() answers [] for both. Left
            # undistinguished, a row whose object had vanished by some
            # other route could never be reclaimed and every future sweep
            # would report the same permanent failure. Listing settles
            # it: if the object is not there, there is nothing to leak
            # and the row is safe to drop.
            if missed:
                absent = _paths_absent(supabase, missed)
                removed_paths.extend(absent)
                still_failing = [p for p in missed if p not in set(absent)]
                if still_failing:
                    logger.warning(
                        "media sweep: %d objects could not be deleted; rows kept for the next run",
                        len(still_failing),
                    )
        except Exception:
            logger.exception("media sweep: storage delete failed for %d paths", len(batch))

    freed = 0
    swept_ids = []
    for path in removed_paths:
        row = by_path[path]
        try:
            supabase.table("event_media").delete().eq("id", row["id"]).execute()
            swept_ids.append(row["id"])
            freed += int(row.get("file_size_kb") or 0)
        except Exception:
            logger.exception("media sweep: row delete failed for %s", row["id"])

    return {
        "swept": len(swept_ids),
        "freed_kb": freed,
        "failed": len(rows) - len(swept_ids),
        "older_than_days": older_than_days,
    }


@router.delete("/{event_id}/media/{media_id}")
def delete_media(event_id: str, media_id: str, current_user: dict = Depends(get_current_user)):
    """Soft delete. The stored object is left in place so a mistaken
    removal is recoverable; a storage sweep can reclaim it later."""
    supabase = get_supabase()
    _require_manager_for_event(supabase, event_id, current_user)

    result = (
        supabase.table("event_media")
        .update({"status": "removed"})
        .eq("id", media_id)
        .eq("event_id", event_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Media not found")
    return {"removed": media_id}
