"""Lead scoring + dedupe.

Score is a 0-100 completeness/quality signal — it drives the order the partner
reviews leads in (best first). It is NOT a "good prospect" judgment, just "how
reachable + complete is this record."
"""
from urllib.parse import urlparse


def score_lead(lead: dict) -> int:
    score = 0
    if lead.get("email"):
        score += 40  # the cold-email channel needs this — weight it highest
    if lead.get("phone"):
        score += 25
    if lead.get("website"):
        score += 15
    if lead.get("businessName"):
        score += 5
    rating = lead.get("rating")
    if isinstance(rating, (int, float)):
        score += min(15, int(rating * 3))  # 5.0 stars -> +15
    return min(score, 100)


def dedupe(leads: list[dict]) -> list[dict]:
    """Drop duplicates within one search. Key preference: website host, then
    phone digits, then lowercased business name. A lead with no usable key is
    kept (can't prove it's a dup)."""
    seen: set[str] = set()
    out: list[dict] = []
    for lead in leads:
        key = _host(lead.get("website")) or _digits(lead.get("phone")) \
            or (lead.get("businessName") or "").strip().lower()
        if not key:
            out.append(lead)
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(lead)
    return out


def _host(url: str | None) -> str:
    if not url:
        return ""
    return (urlparse(url).netloc or "").lower().removeprefix("www.")


def _digits(phone: str | None) -> str:
    if not phone:
        return ""
    return "".join(c for c in phone if c.isdigit())
