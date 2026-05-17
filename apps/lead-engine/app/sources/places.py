"""Google Places API (New) client — Text Search for local businesses.

Official API: legal, no ToS violation, no IP-ban war, no proxy needed. Billed
per request; the field mask is kept tight so we only pay for fields we use.
"""
import requests

_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# Only the fields the lead engine actually uses — the field mask drives the
# Places billing SKU, so requesting less costs less.
_PLACE_FIELDS = [
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.primaryTypeDisplayName",
]

# Places Text Search hard cap: 20 results/page, 3 pages.
MAX_RESULTS = 60

_TIMEOUT = 30


class PlacesError(RuntimeError):
    """Raised when the Places API is misconfigured or returns an error."""


def search_businesses(industry: str, location: str, count: int, api_key: str) -> list[dict]:
    """Text-search Google Places for `{industry} in {location}`, return up to
    `count` normalized business records (capped at the Places 60-result max)."""
    if not api_key:
        raise PlacesError("GOOGLE_PLACES_API_KEY is not configured")

    want = max(1, min(count, MAX_RESULTS))
    query = f"{industry} in {location}".strip()
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": ",".join(_PLACE_FIELDS) + ",nextPageToken",
    }

    # pageSize must stay constant across paginated requests — the Places API
    # (New) rejects a paged request whose parameters drift from the first call.
    page_size = min(20, want)

    results: list[dict] = []
    page_token: str | None = None
    page = 0
    while len(results) < want:
        page += 1
        body: dict = {"textQuery": query, "pageSize": page_size}
        if page_token:
            body["pageToken"] = page_token
        try:
            resp = requests.post(_SEARCH_URL, json=body, headers=headers, timeout=_TIMEOUT)
        except requests.RequestException as exc:
            if page == 1:
                raise PlacesError(f"Places API request failed: {exc}") from exc
            break  # a later page failed — return the results gathered so far
        if resp.status_code != 200:
            if page == 1:
                raise PlacesError(f"Places API {resp.status_code}: {resp.text[:300]}")
            break
        data = resp.json()
        for place in data.get("places", []):
            results.append(normalize_place(place))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return results[:want]


def normalize_place(place: dict) -> dict:
    """Flatten one Places API place object into the lead engine's lead shape."""
    return {
        "businessName": (place.get("displayName") or {}).get("text", ""),
        "address": place.get("formattedAddress", ""),
        "phone": place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber"),
        "website": place.get("websiteUri"),
        "rating": place.get("rating"),
        "reviewCount": place.get("userRatingCount"),
        "category": (place.get("primaryTypeDisplayName") or {}).get("text"),
    }
