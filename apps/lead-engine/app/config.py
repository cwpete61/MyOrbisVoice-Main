"""Environment-driven configuration for the lead engine service."""
import os

# Shared secret the app API sends as X-Internal-Token. Defense-in-depth on top
# of the private Docker network. Empty = no check (local dev only).
INTERNAL_TOKEN = os.environ.get("LEADENGINE_INTERNAL_TOKEN", "")

# Residential proxy URL for scraping egress. Empty = direct connection, which
# is DEV-ONLY — production scraping without a proxy gets the host IP banned.
PROXY_URL = os.environ.get("LEADENGINE_PROXY_URL", "")
