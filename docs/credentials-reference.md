# Credentials Reference

> ⚠️ This file lists where credentials live + format expectations. Real values are stored encrypted in the DB (`Admin → System Settings`) or in `.env.prod` on the server. Do not paste real values here. Linked from CLAUDE.md.

### Hosting — Contabo Production Server
- **IP:** `147.93.183.4`
- **User:** `root`
- **Password:** `Orbis@8214@@!!` (fallback: `Orbis@8214`)
- **Docker network:** `myorbisvoice_net`
- **App domain:** `app.myorbisvoice.com`
- **API domain:** `api.myorbisvoice.com`
- **n8n domain:** `n8n.myorbisvoice.com` (internal only)

---

### Database — PostgreSQL (shared umoja-postgres container)
- **Host:** `localhost:5432` (container: `umoja-postgres`)
- **Database:** `voiceautomation`
- **User:** `voiceautomation`
- **Password:** `voiceautomation`
- **Connection string:** `postgresql://voiceautomation:voiceautomation@localhost:5432/voiceautomation`

---

### Auth
- **AUTH_SECRET:** *(stored in .env.prod on server — do not put here)*
- **N8N_ENCRYPTION_KEY:** *(stored in .env.prod on server — do not put here)*

---

### OpenAI
- **API Key:** *(enter via Admin → System Settings → OpenAI card — never store here)*
- **Default model:** `gpt-4o-mini`
- **Used for:** call summaries, agent reasoning, campaign assistance, email enrichment
- **Enter via:** Admin → System Settings → OpenAI card (stored encrypted in DB)

---

### Google OAuth (myorbisvoice project)
- **Project ID:** `myorbisvoice`
- **Client ID:** `548023119687-734aljh9786uh1k85kv0506coob25rje.apps.googleusercontent.com`
- **Client Secret:** *(enter via Admin → System Settings → Google OAuth card — never store here)*
- **Auth URI:** `https://accounts.google.com/o/oauth2/auth`
- **Token URI:** `https://oauth2.googleapis.com/token`
- **Correct Redirect URI:** `https://api.myorbisvoice.com/api/integrations/google/callback`
- **Enter via:** Admin → System Settings → Google OAuth card

> ⚠️ The downloaded JSON has `redirect_uris: ["https://app.myorbisvoice.com/"]` — this is wrong.
> The authorised redirect URI in Google Cloud Console must be set to:
> `https://api.myorbisvoice.com/api/integrations/google/callback`

---

### Reoon Email Verifier
- **API Key:** *(enter via Admin → System Settings → Reoon card — never store here)*
- **Mode:** `power`
- **Enter via:** Admin → System Settings → Reoon card

---

### Bunny.net Storage & Streaming
- **API Key (short):** *(enter via Admin → System Settings → Bunny.net card — never store here)*
- **API Key (long/full):** *(enter via Admin → System Settings → Bunny.net card — never store here)*
- **Storage Zone:** `orbisvoice`
- **Storage Password:** *(stored encrypted in DB — retrieve from Admin → System Settings → Bunny.net card)*
- **CDN Hostname:** `OrbisVoice.b-cdn.net`
- **Storage Region:** `de` (Frankfurt — uses `storage.bunnycdn.com`, NOT `de.storage.bunnycdn.com`)
- **Enter via:** Admin → System Settings → Bunny.net card
- **⚠️ CDN pull zone must be linked to the `orbisvoice` storage zone in Bunny dashboard for CDN URLs to serve. Audio is proxied via the API storage endpoint to bypass this requirement.**

---

### Twilio
- **Account SID:** *(enter from Twilio console → Account → General Settings)*
- **Auth Token:** *(enter from Twilio console → Account → General Settings)*
- **Platform phone number:** *(enter after purchasing a number in Twilio)*
- **Inbound webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/voice`
- **Recording webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/recording`
- **SMS webhook URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/sms`
- **Status callback URL:** `https://api.myorbisvoice.com/api/webhooks/twilio/status`
- **Enter via:** Admin → System Settings → Twilio card

---

### Stripe
- **Secret Key:** *(enter from Stripe dashboard → Developers → API Keys)*
- **Publishable Key:** *(enter from Stripe dashboard → Developers → API Keys)*
- **Webhook Secret:** *(enter from Stripe dashboard → Developers → Webhooks → signing secret)*
- **Webhook endpoint to register:** `https://api.myorbisvoice.com/api/webhooks/stripe`
- **Enter via:** Admin → System Settings → Stripe card

### Stripe Products & Pricing

| Plan | Code | Price | Interval | DB key |
|---|---|---|---|---|
| LTD (Lifetime Deal) | `ltd` | $497 one-time | ONE_TIME | `STRIPE_PRICE_LTD` |
| Basic | `basic_monthly` | $197/month | MONTHLY | `STRIPE_PRICE_BASIC` |
| Pro | `pro_monthly` | $497/month | MONTHLY | `STRIPE_PRICE_PRO` |
| Premier | `premier_monthly` | $997/month | MONTHLY | `STRIPE_PRICE_PREMIER` |
| Enterprise | `enterprise_monthly` | $1,997/month | MONTHLY | `STRIPE_PRICE_ENTERPRISE` |

**LTD notes:** One-time payment, 100 units max. Create as a one-time price in Stripe (not recurring).
**Price IDs:** Once created in Stripe, update each plan's `stripePriceId` in the DB via seed or direct SQL.

---

### Gemini Live (Google AI)
- **API Key:** *(enter from Google AI Studio — aistudio.google.com → Get API Key)*
- **Model:** `gemini-2.5-flash-native-audio-latest` (or override via `GEMINI_LIVE_MODEL` env var)
- **Used for:** real-time voice sessions (inbound calls, widget)
- **Set via:** `.env` file — `GEMINI_API_KEY=` (not yet in admin UI)

---

### Brand Color Palette (Marketing Site)
Teal swatch — 6 shades light to deep:
- `#3dbcbc` — Teal 1 (lightest)
- `#2aabab` — Teal 2
- `#1a9898` — Teal 3 (primary accent)
- `#158484` — Teal 4
- `#0f7070` — Teal 5
- `#0a5c5c` — Teal 6 (darkest)

