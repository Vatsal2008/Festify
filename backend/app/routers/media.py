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
