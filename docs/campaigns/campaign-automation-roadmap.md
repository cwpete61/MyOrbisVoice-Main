# Inbound Evaluation — Campaign Automation Roadmap

How the partner-led FB campaign automates as much as compliantly possible.
Principle: **automate everything except the 3 FB actions Meta requires a human
for** (join a group, post into a group, engage in a group). The platform paces,
tracks, and attributes; the human clicks. Never bots.

Diagram: `~/Antigravity/tools/diagrams/campaign-workflow.html`.

---

## 1. The two surfaces (the load-bearing fact)

**ManyChat auto-DM fires on comments on the partner's own Page / Instagram — NOT
on comments inside a group.** Meta won't let a page auto-message a random group
commenter. So:

- **FB Groups** = reach (manual posting, group-safe content).
- **Partner Page / IG** = automation surface (ManyChat comment→DM→CRM).
- **Opt-in page** (`/beta`, `/quiz`) = universal capture that works from anywhere,
  no ManyChat needed.

Groups feed the machine two compliant ways:
1. **Group → Page** — awareness post drives to the page, where ManyChat fires.
2. **Group → link** — drop the `/beta` / `/quiz` link (promo-allowed), lead fills
   it → CRM.

---

## 2. What's automated vs human

| Automated (platform) | Human, 1-click (Meta requires) | Never (ToS / refused) |
|---|---|---|
| Content gen (graphic + copy + keyword) | Join a group | Bot auto-join groups |
| Page/IG comment→DM→qualify→CRM (ManyChat) | Post into a group | Auto-post into groups |
| Opt-in pages + capture | Engage (like/comment) in a group | Auto-like / auto-follow / auto-reply |
| CRM tagging, Founding-25 counter | Connect ManyChat to their page | Scrape group members / mass-DM |
| Attribution + dashboards | | |
| **Pacing + warm-up coaching** (this roadmap) | | |

Content already runs on a **free LLM** (Groq/Gemini via `content_provider`) — $0.

---

## 3. "My Groups" — tracker + compliant cadence coach (next build)

A partner portal tab that turns manual group work into a tracked, paced,
attributable system. Does **not** auto-post, auto-join, or auto-engage — it
**orchestrates the human** so they look like (because they are) a good member.

### Why it helps
- **Attribution** — know which groups actually convert (opt-ins per group).
- **Anti-spam pacing** — stop burst-posting identical copy to N groups in minutes
  (the #1 ban trigger). Throttle + space + rotate content.
- **Warm-up coaching** — nudge the human to engage genuinely before posting.
- **Queue** — "post these, to these, today" checklist instead of guesswork.

### Schema
```
PartnerGroup {
  id            uuid
  partnerId     -> AffiliateAccount
  name          string
  url           string?
  niche         string        // enum from the niche taxonomy
  memberCount   int?
  promoRule     string?       // "fridays only" / "no promo" / "open"
  joinedAt      date
  status        active | left | banned
  createdAt updatedAt
}

PartnerGroupPost {            // one row per (group, post) the partner logs
  id            uuid
  partnerId     -> AffiliateAccount
  groupId       -> PartnerGroup
  track         string        // beta / phantom / competitor / math / afterhours / quiz
  keyword       string        // BETA / TEST / ...
  postedAt      datetime
  optinCount    int @default(0)   // rolled up from Contacts attributed to this group+track
}
```
Attribution tie-in: opt-in links carry `&g=<groupId>` (or per-group keyword
variants) → `lead-optin` stores it → roll up into `PartnerGroupPost.optinCount`.

### Cadence / warm-up rules (compliant — reminders + throttle, no automation)
- **Engage-first nudge:** "like/comment 2–3 posts in this group before posting."
- **Throttle:** cap logged-posts per hour; per-group cooldown (e.g. 1/week/group).
- **Spacing:** "wait ~90 min before the next group."
- **Content variation:** auto-serve a *different* line/graphic per group (reuse the
  A/B tracks + Generate-AI) so it's never identical cross-posting.
- **Cadence calendar:** drip across days, not bursts.

### Endpoints
- `GET/POST/PATCH/DELETE /api/partner/groups` — CRUD the partner's groups.
- `POST /api/partner/groups/:id/log-post` — record a post (enforces throttle/cooldown, returns the next-allowed time + the recommended content variant).
- `GET /api/partner/groups/board` — groups + per-group optin rollup + "post now / cooling down" status.

### UI (new tab under Campaigns → Inbound Evaluation, or a "My Groups" nav item)
- Add-group form (name, url, niche, member count, promo rule).
- Group cards: status (ready / cooling down), opt-ins, last posted, next-allowed.
- "Post now" → opens the right content variant + the group deep-link + logs it.
- Warm-up checklist shown before each post.

---

## 4. Compliance guardrails (hard rules)
- No auto-join, auto-post, auto-engage. The platform reminds + paces; the human acts.
- No scraping group internals or members. Group discovery = public research (swarm).
- Throttle exists to keep partners *under* FB's spam thresholds, not to evade
  detection of bad behavior — there is no bad behavior to hide.
- Lead is born opted-out of SMS/voice; follow-up in the channel they used until
  explicit consent.

---

## 5. Phased plan
1. **Niche CRM** — taxonomy enum, auto-tag, segment, per-niche pipeline. *(extends current CRM)*
2. **Niche content packs** — per-niche polls/posts/graphics + keyword. *(extends Marketing Strategy + Graphics; free LLM)*
3. **ManyChat portal connect** — flow-template install + status panel. *(extends the lead-optin webhook)*
4. **My Groups tracker + cadence coach** — §3 above. *(new)*
5. **Group directory (swarm-fed)** — curated niche→group list, manual join. *(new + swarm)*
6. **Page auto-posting** — Meta Graph API to the partner's own Page (groups stay manual). *(needs Meta app review)*
7. **Attribution dashboard** — per-group/niche/track opt-in rollups (mdv/portal).

Ship order: 1 → 2 → 3 → 4 (all in-house, no external approvals), then 5, then 6–7.

---

## 6. Dependencies
- Free content LLM: `content_provider` = groq/gemini (done).
- Swarm live (group directory, phase 5).
- Meta app review (page posting, phase 6).
- ManyChat = partner-owned (no platform integration).
