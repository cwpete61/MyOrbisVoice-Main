# DNS map

## Root domain
- `myorbisvoice.com` → Spaceship marketing host

## Application subdomains
- `app.myorbisvoice.com` → Contabo reverse proxy
- `n8n.myorbisvoice.com` → Contabo reverse proxy

## Optional service subdomains
- `notify.myorbisvoice.com` → transactional email provider
- `api.myorbisvoice.com` → optional dedicated API endpoint if separated later
- `assets.myorbisvoice.com` → optional asset CDN endpoint

## Mail DNS records

### Root-domain mail
Use root domain mail for human-operated mailboxes.

Required record classes:
- MX
- SPF
- DKIM
- DMARC

### Transactional sending subdomain
Use `notify.myorbisvoice.com` for app-generated mail.

Required record classes:
- SPF for the transactional sender
- DKIM for the transactional sender
- tracking / return-path records as required by the transactional provider
- DMARC policy aligned with sending behavior

## SSL coverage

TLS certificates must cover:
- `myorbisvoice.com`
- `app.myorbisvoice.com`
- `n8n.myorbisvoice.com`
- optional `notify.myorbisvoice.com`

## DNS ownership guidelines

1. Keep authoritative DNS in one place.
2. Use distinct records for marketing, app, and automation.
3. Avoid pointing mail records through the app host.
4. Keep transactional senders off the root human-mail path.
