"""Website contact enrichment — crawl a business site for an email + socials.

Low-risk: each lead's own small-business site, a handful of pages, plain HTTP
(no browser). Best-effort by design — a dead or hostile site yields empty
fields, never an exception, so one bad site can't fail a whole search.

Role inboxes (info@, contact@, hello@) are kept, not filtered: for a small
business that IS the contact address. Only true junk (noreply, image files
that happen to match the email regex) is dropped.
"""
import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Pages most likely to carry a contact address or an owner name, in crawl
# order. team / about pages are where the owner is usually named.
_CONTACT_PATHS = ["", "contact", "contact-us", "about", "about-us", "team", "our-team"]

# Best-effort owner detection. Inherently noisy — many small-business sites
# never name the owner in crawlable text — so a miss just leaves ownerName null.
_OWNER_TITLES = r"Owner|Co-?Owner|Founder|Co-?Founder|President|CEO|Principal|Proprietor|Managing Partner"
_NAME = r"(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,2}"
# "Jane Doe, Owner"  /  "Jane Doe - Founder"
_OWNER_NAME_FIRST = re.compile(rf"\b({_NAME})\s*[,\-–—]\s*(?:the\s+)?({_OWNER_TITLES})\b")
# "Owner: Jane Doe"  /  "Owner - Jane Doe"
_OWNER_TITLE_FIRST = re.compile(rf"\b({_OWNER_TITLES})\s*[:\-–—]\s*({_NAME})\b")
# Capitalized words that look like names to the regex but aren't.
_NOT_NAME = {
    "Contact", "About", "Our", "The", "Home", "Welcome", "Privacy", "Terms",
    "Meet", "Team", "Us", "Get", "Learn", "More", "Read", "Click", "Call",
    "Email", "View", "Site", "Page", "Service", "Services", "Hours", "Office",
}

# Substrings that mark a regex match as NOT a real contact email.
_JUNK = (
    "noreply", "no-reply", "donotreply", "example.com", "sentry.io",
    "wixpress.com", "@2x", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
)

_SOCIAL_HOSTS = {
    "linkedin.com": "linkedin",
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "youtube.com": "youtube",
    "tiktok.com": "tiktok",
}

_TIMEOUT = 12
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OrbisLeadBot/1.0)"}


def find_contact(website_url: str, proxy_url: str = "") -> dict:
    """Return {email, socials, ownerName, ownerTitle} scraped from a website."""
    out: dict = {"email": None, "socials": {}, "ownerName": None, "ownerTitle": None}
    base = _normalize_url(website_url)
    if not base:
        return out

    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
    emails: list[str] = []
    socials: dict[str, str] = {}
    owner: dict | None = None

    for path in _CONTACT_PATHS:
        html = _fetch(urljoin(base, path), proxies)
        if html is None:
            continue
        emails.extend(_extract_emails(html))
        for platform, link in _extract_socials(html).items():
            socials.setdefault(platform, link)
        if owner is None:
            owner = _extract_owner(html)
        # Stop once both are found — no need to crawl the remaining pages.
        if emails and owner:
            break

    out["email"] = _best_email(emails, base)
    out["socials"] = socials
    if owner:
        out["ownerName"] = owner["name"]
        out["ownerTitle"] = owner["title"]
    return out


def _extract_owner(html: str) -> dict | None:
    """Best-effort owner name + title from a page. Returns None on no match."""
    text = BeautifulSoup(html, "html.parser").get_text(" ")
    for regex, name_group, title_group in (
        (_OWNER_NAME_FIRST, 1, 2),
        (_OWNER_TITLE_FIRST, 2, 1),
    ):
        for m in regex.finditer(text):
            name = m.group(name_group).strip()
            if any(w in _NOT_NAME for w in name.split()):
                continue  # a heading like "Contact Us" matched the name shape
            title = m.group(title_group).strip()
            return {"name": name, "title": title.title() if title.islower() else title}
    return None


def _fetch(url: str, proxies: dict | None) -> str | None:
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT,
                            proxies=proxies, allow_redirects=True)
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    if "text/html" not in resp.headers.get("content-type", "").lower():
        return None
    return resp.text


def _normalize_url(raw: str) -> str | None:
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    parsed = urlparse(raw)
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}/"


def _extract_emails(html: str) -> list[str]:
    found: list[str] = []
    soup = BeautifulSoup(html, "html.parser")
    # mailto: links are the highest-confidence source.
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            # Validate — a mailto can carry an obfuscated/malformed address.
            if addr and _EMAIL_RE.fullmatch(addr):
                found.append(addr)
    # Plain-text matches anywhere in the page.
    found.extend(_EMAIL_RE.findall(soup.get_text(" ")))
    clean: list[str] = []
    seen: set[str] = set()
    for email in found:
        low = email.lower()
        if low in seen or any(j in low for j in _JUNK):
            continue
        seen.add(low)
        clean.append(email)
    return clean


def _extract_socials(html: str) -> dict[str, str]:
    socials: dict[str, str] = {}
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        host = (urlparse(href).netloc or "").lower().removeprefix("www.")
        for social_host, platform in _SOCIAL_HOSTS.items():
            # Exact host or a true subdomain — not "myfacebook.com".
            on_platform = host == social_host or host.endswith("." + social_host)
            if on_platform and platform not in socials:
                socials[platform] = href
    return socials


def _best_email(emails: list[str], base_url: str) -> str | None:
    """Return an address on the site's OWN domain, or nothing.

    A scraped lead feeds cold email. A wrong-company address — a vendor,
    analytics, or site-builder email embedded in the page — would mean
    emailing the wrong business and risking a spam complaint against our
    sending domain. So we accept only a same-domain match; if the site
    exposes no email on its own domain, the lead simply has no email.
    """
    if not emails:
        return None
    site_host = (urlparse(base_url).netloc or "").lower().removeprefix("www.").split(":")[0]
    if not site_host:
        return None
    for email in emails:
        domain = email.rsplit("@", 1)[-1].lower()
        if domain == site_host or domain.endswith("." + site_host) or site_host.endswith("." + domain):
            return email
    return None
