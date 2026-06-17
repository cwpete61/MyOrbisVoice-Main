# Partner ManyChat Auto-DM Setup (optional)

How a partner wires **comment-a-keyword → auto-DM → lead in their CRM** using
their OWN ManyChat account and their OWN Facebook/Instagram page. Per-partner,
partner-owned, partner-paid. We provide the webhook + the template; we never own
their page or their ManyChat bill.

> You do NOT need ManyChat to capture leads. The `/beta` and `/quiz` links
> already drop opt-ins into your CRM, attributed to you. ManyChat only automates
> the "comment a keyword → I slide into their DMs" step. Set this up only if you
> want that automation.

## Architecture

```
Partner's FB/IG post (graphic + keyword)
        │  lead comments the keyword (e.g. BETA)
        ▼
Partner's ManyChat (their account, their page)
        │  triggers a flow: greet → collect name/phone/business
        ▼
ManyChat "External Request" action  ──POST──►  https://api.myorbisresults… /api/public/lead-optin
        │                                            (code = partner's referralCode)
        ▼
Lead lands in the PARTNER's CRM, tagged by track + keyword
```

## One-time setup (per partner, ~15 min)

1. **Create a ManyChat account** at manychat.com (free tier works to start;
   keyword automation needs the Pro tier, ~$15/mo past the free limits).
2. **Connect your Facebook Page** (and Instagram if you post there). ManyChat
   handles all the Meta permissions — no app review on your side.
3. **New Automation → trigger = "Comment on a post / story"** (or a Keyword
   trigger for DMs). Set the keyword to your campaign keyword: `BETA`, `TEST`,
   `WHO ANSWERS`, `MATH`, `EVAL`, or `QUIZ`.
4. **Build the DM flow** (scripts below): greet → ask for business name, name,
   best phone → confirm.
5. **Add an "External Request" action** as the LAST step:
   - **Method:** `POST`
   - **URL:** `https://api.myorbisvoice.com/api/public/lead-optin`
   - **Header:** `Content-Type: application/json`
   - **Body (JSON):** paste the body below, with YOUR referral code in `code`.
     Map the `{{...}}` merge tags to the fields you collected in the flow.
6. **Test** with your own comment, confirm the lead appears in your CRM
   (Partner → Contacts).

## External Request body (paste into ManyChat, swap in your code + fields)

```json
{
  "code": "YOUR_REFERRAL_CODE",
  "track": "beta",
  "businessName": "{{business_name}}",
  "contactName": "{{first_name}} {{last_name}}",
  "email": "{{email}}",
  "phone": "{{phone}}",
  "niche": "{{niche}}",
  "locale": "en",
  "consent": true
}
```

- `code` — your referral code (find it on the Marketing Strategy tab). This is
  what routes the lead to YOUR CRM.
- `track` — match the post's angle: `beta` / `phantom` / `competitor` / `math` /
  `afterhours` / `quiz`. Drives the keyword tag on the lead.
- `{{...}}` — ManyChat merge tags for the fields you captured. Use whatever field
  names your flow uses.
- `consent` — set `true` only after the lead agrees in-chat to be contacted.

A `200` response with `{"data":{"ok":true}}` means the lead saved. A `404`
("Unknown partner link") means the `code` is wrong.

## DM flow scripts (bilingual — match your post language)

**Opening (after they comment the keyword):**
EN: "Hey! Thanks for the interest 🙌 I run a free 15-minute evaluation — I call your business like a customer would and send you a one-page scorecard showing where calls turn into sales (or slip away). Want in? Reply YES."
ES: "¡Hola! Gracias por el interés 🙌 Hago una evaluación gratis de 15 minutos — llamo a tu negocio como un cliente y te mando un reporte de una página que muestra dónde las llamadas se vuelven ventas (o se escapan). ¿Le entras? Responde SÍ."

**Collect (one question per message):**
1. EN: "What's the business name?" / ES: "¿Cómo se llama el negocio?"
2. EN: "Your name?" / ES: "¿Tu nombre?"
3. EN: "Best phone to reach you?" / ES: "¿Mejor teléfono para contactarte?"
4. EN: "What kind of business? (e.g. HVAC, dental, salon)" / ES: "¿Qué tipo de negocio? (ej. HVAC, dental, salón)"

**Consent + close (before the External Request):**
EN: "Great — I'll reach out to set up your free evaluation. You keep the report either way, no pitch. Cool?" → on YES, fire the webhook.
ES: "Perfecto — te contacto para coordinar tu evaluación gratis. El reporte es tuyo de todas formas, sin venta. ¿Va?" → con SÍ, dispara el webhook.

**Recording consent (if the eval call will be recorded):**
EN: "Heads up: if I record the test call I'll tell you first and you can say no." / ES: "Aviso: si grabo la llamada de prueba, te aviso primero y puedes decir que no."

## Honesty + compliance

- Only fire the webhook (mark `consent: true`) AFTER the lead agrees in-chat.
- The lead is born opted-out of SMS + voice at the API level regardless — the
  partner follows up in the channel the lead used (DM/email) until explicit
  consent for calls/texts.
- Never auto-DM people who didn't engage — ManyChat's comment/keyword trigger
  keeps it opt-in by design. Don't scrape or cold-DM.

## Fallback (no ManyChat)

Skip all of the above and just paste your `/beta` or `/quiz` link in the post's
first comment or your bio: "comment KEYWORD, then tap my link." Same CRM result,
zero setup, $0.
