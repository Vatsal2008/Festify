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
