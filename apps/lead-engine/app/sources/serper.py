"""Serper.dev Maps API client — Google Maps business listings.

Serper proxies Google Maps results through a simple REST API. Cheaper per
call than the official Places API. Billed in credits (a maps call is a few
credits). Returns ~20 results per page; we page up to the 60-result cap.
"""
import requests
from urllib.parse import urlsplit, urlunsplit

_MAPS_URL = "https://google.serper.dev/maps"
_PAGE_SIZE = 20
MAX_RESULTS = 60  # 20 results/page, capped at 3 pages
_TIMEOUT = 30


class SerperError(RuntimeError):
    """Raised when Serper is misconfigured or returns an error."""


def search_businesses(industry: str, location: str, count: int, api_key: str) -> list[dict]:
    """Search Serper Maps for `{industry} in {location}`, return up to `count`
    normalized business records (capped at MAX_RESULTS)."""
    if not api_key:
        raise SerperError("SERPER_API_KEY is not configured")

    want = max(1, min(count, MAX_RESULTS))
    query = f"{industry} in {location}".strip()
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}

    results: list[dict] = []
    page = 0
    while len(results) < want:
        page += 1
        try:
            resp = requests.post(
                _MAPS_URL, json={"q": query, "page": page}, headers=headers, timeout=_TIMEOUT
            )
        except requests.RequestException as exc:
            if page == 1:
                raise SerperError(f"Serper request failed: {exc}") from exc
            break  # a later page failed — return the results gathered so far
        if resp.status_code != 200:
            if page == 1:
                raise SerperError(f"Serper API {resp.status_code}: {resp.text[:300]}")
            break
        places = resp.json().get("places", [])
        if not places:
            break  # no more results
        for place in places:
            results.append(normalize_place(place))
        if len(places) < _PAGE_SIZE:
            break  # short page — this was the last one

    # Map rank = the business's 1-based position in Google's Maps results for
    # this query. Assigned by accumulation order (Serper returns results ranked)
    # so it's correct across pages regardless of Serper's per-page numbering.
    for index, result in enumerate(results):
        result["mapRank"] = index + 1
    return results[:want]


def normalize_place(place: dict) -> dict:
    """Flatten one Serper Maps place into the lead engine's lead shape."""
    return {
        "businessName": place.get("title", ""),
        "address": place.get("address", ""),
        "phone": place.get("phoneNumber"),
        "website": _clean_url(place.get("website")),
        "latitude": place.get("latitude"),
        "longitude": place.get("longitude"),
        "rating": place.get("rating"),
        "reviewCount": place.get("ratingCount"),
        "category": place.get("type"),
    }


def _clean_url(url: str | None) -> str | None:
    """Strip query string + fragment — Google Business website URLs arrive
    with UTM tags appended."""
    if not url or not url.strip():
        return None
    parts = urlsplit(url.strip())
    if not parts.netloc:
        return None
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
