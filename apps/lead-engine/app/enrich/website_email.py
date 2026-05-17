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

# Pages most likely to carry a contact address, in crawl order.
_CONTACT_PATHS = ["", "contact", "contact-us", "about", "about-us"]

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
    """Return {"email": str|None, "socials": {platform: url}} for a website."""
    out: dict = {"email": None, "socials": {}}
    base = _normalize_url(website_url)
    if not base:
        return out

    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None
    emails: list[str] = []
    socials: dict[str, str] = {}

    for path in _CONTACT_PATHS:
        url = urljoin(base, path)
        html = _fetch(url, proxies)
        if html is None:
            continue
        emails.extend(_extract_emails(html))
        for platform, link in _extract_socials(html).items():
            socials.setdefault(platform, link)
        if emails:
            break  # found a contact email — no need to crawl further pages

    out["email"] = _best_email(emails, base)
    out["socials"] = socials
    return out


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
    """Prefer an address on the site's own domain; else the first found."""
    if not emails:
        return None
    site_host = (urlparse(base_url).netloc or "").lower().removeprefix("www.")
    domain = site_host.split(":")[0]
    for email in emails:
        if domain and email.lower().endswith("@" + domain):
            return email
    return emails[0]
