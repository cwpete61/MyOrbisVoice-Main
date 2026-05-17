"""Environment-driven configuration for the lead engine service."""
import os

# Shared secret the app API sends as X-Internal-Token. Defense-in-depth on top
# of the private Docker network. Empty = no check (local dev only).
INTERNAL_TOKEN = os.environ.get("LEADENGINE_INTERNAL_TOKEN", "")

# Google Places API (New) key — the Maps business-data source. Metered,
# pay-per-call. Without it, searches fail fast with a clear error.
GOOGLE_PLACES_API_KEY = os.environ.get("GOOGLE_PLACES_API_KEY", "")

# Optional proxy URL for the website-email crawl egress. Empty = direct, which
# is fine for the email crawl (many different small sites, low ban risk).
PROXY_URL = os.environ.get("LEADENGINE_PROXY_URL", "")
