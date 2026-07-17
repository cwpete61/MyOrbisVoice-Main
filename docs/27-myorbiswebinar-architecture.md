# 27 — MyOrbisWebinar architecture

> **Status: as-built.** This describes what is in the tree, not a plan. Where an earlier
> design doc disagrees, this wins. Verified by driving the live API and UI on
> 2026-07-05; every claim below was observed, not assumed.
>
> Superseded: `MyOrbisWebinar/docs/MyOrbisWebinar-product-architecture.md` (lived outside
> this repo, described a greenfield separate repo + a standalone Vite prototype — neither
> is what got built).

## 1. What it is

A customer-acquisition product that happens to use webinars. Measured by pipeline, not
attendance. Async/evergreen: a registrant watches on demand, every interaction lands on
an append-only event log, and the lead is scored live. The differentiator is the **hero
rule** — a lead who engaged and clicked the offer but never booked gets an automated
MyOrbisVoice call, if and only if they consented to one.

**Not** the same thing as *Webinar Marketing* (`services/webinar-marketing/`), which is
outbound invite-list discovery (search → crawl → scrape → verify). They share a word and
zero code.

## 2. Where it lives

Inside this monorepo. There is no separate repo and no `apps/webinar` app.

| Layer | Path |
|---|---|
| API routes | `apps/api/src/routes/webinar.ts` |
| Services | `apps/api/src/services/webinar/` |
| Tenant UI | `apps/web/src/app/(dashboard)/webinars/` |
| Public page | `apps/web/src/app/webinar/[slug]/` |
| Schema | `prisma/schema.prisma` (models ~3440+) |
| Migration | `prisma/migrations/20260705000000_catch_up_schema_drift/` |

It does **not** depend on the Account Hub. The Hub is designed but not running
(`HUB_URL` unset, `OIDC_ENABLED` off, cutover not executed), so everything it needs —
identity, CRM, compliance, outbound voice — comes from Voice as in-repo imports.

## 3. Multi-tenancy

Every tenant owns its own webinars. Tenant comes from the session, exactly like
contacts/appointments.

```
router.use('/webinars', authenticate, requireTenantContext)
const tenantId = tenantOf(req)          // NOT req.user!.currentTenantId!
```

Two things worth knowing:

- **Routes are at `/api/webinars`, not `/api/admin/webinars`.** `marketing-kit.ts` mounts
  an adminRouter at `/api/admin` with a blanket `requirePlatformAdmin` and registers at
  `/` *before* this router, so any `/api/admin/*` path is platform-gated before it is
  reached. A tenant-facing product cannot live in that namespace.
- **`tenantOf(req)` instead of the house `req.user!.currentTenantId!`.** That `!` asserts
  non-null on a `string | null`. It holds today only because tenantId and isPlatformRole
  derive from the same membership, so a platform role implies a tenant. Nothing enforces
  that. `where: { tenantId: undefined }` makes Prisma drop the filter and return every
  tenant's rows, so this fails closed with a 403 instead.

Platform staff reach a tenant's webinars by impersonating it
(`POST /api/admin/tenants/:id/impersonate`), which mints a tenant-scoped token. There is
no bypass, by design.

**Verified:** tenant B lists → `[]`; GET tenant A's webinar by id → 404 (not 403 — no
existence leak); A's leads → 404; A's person timeline → `{person:null, events:[], score:null}`.

## 4. The spine

```
WebinarPerson ──< Registrant        identity (email-exact → phone-exact → new;
     │                              ambiguous flagged, never auto-merged)
     ├──< InteractionEvent          append-only, typed + zod-validated, traceId dedup
     └──< EngagementScore           materialized; recomputed per person on append
```

`WebinarPerson.contactId` is a soft link to a Voice `Contact` (no FK). It matters more
than it looks: `OutboundCallAttempt.contactId` is a **required** FK and `optedOutVoice`
lives only on `Contact`, so a person without one is both un-callable and un-gateable.
Contacts are therefore created at **registration**, not at booking — the hero rule targets
people who *didn't* book, and without this it could never fire for its own target.

Scoring is a pure function (`scoring.service.ts`), config-injectable, 0–100 on two axes
(intent, attention) → HOT/WARM/COLD, with floors for BOOKED/PURCHASED.

## 5. The loop

```
register (+consent?) → watch (30s heartbeats) → score
   ├─ books    → Appointment + BOOKED  (score floor 85 → HOT)
   └─ doesn't  → hero rule → consented?  → MyOrbisVoice call → CALLED(outcome)
                             not consented → suppressed by the compliance gate
```

- **BOOKED** (`bookFromWebinar`) reuses `createAppointment` and its 10-minute dedupe
  guard. Repeat booking returns the same appointment.
- **CALLED** is produced by `outcome-worker.service.ts` (30s tick, re-entrancy guard,
  one bridge `OutboundCampaign` per webinar carrying the agent's script, one attempt per
  contact).

## 6. Consent — the legal boundary

This is the part to not break.

- A Contact created from a webinar is born **`optedOutVoice: true`** (the compliance
  wall), matching every other cold-lead path. `createContact` defaults to opted-**in**,
  which is wrong for a webinar lead.
- Only an explicit, user-ticked checkbox calls `processOptIn`, which clears the flag
  **and** writes the `OptOutLog` audit row — the consent is provable, not implied.
- The call is placed via `dispatchPendingCalls` **deliberately**: its
  `if (attempt.contact.optedOutVoice)` check is the **only** voice opt-out gate in the
  codebase (the voice-gateway has none). Any path around it would be ungated.
- `CALLED` is emitted only for a dial that actually left. `opted_out_voice` and
  `dispatch_error` are not calls: counting them would lie on the timeline and burn the
  customer's metered allowance.

**Verified live** with deliberately-invalid Twilio creds (no real call possible):
```
devon  optedOutVoice=true  → FAILED / opted_out_voice        (never reached Twilio)
marcus optedOutVoice=false → FAILED / dispatch_error: 20003  (passed gate, hit Twilio)
```
The only difference between them was the checkbox. The assertion is mutation-tested.

## 7. Plan gates

Keys (`services/webinar/entitlement.ts`), fail **closed** — a missing entitlement means
"not in plan", never "unlimited". `-1` = unlimited.

```
webinar_enabled                       is the product in the plan
webinar_max_active                    published webinars (drafts are free)
included_webinar_ai_calls_per_month   the meter
webinar_white_label                   hides the "Powered by MyOrbis" mark
```

**The meter is AI calls, not registrants.** The pitch is "pipeline, not attendance";
billing per attendee would contradict it and would charge for top-funnel success while
the cost (Twilio + OpenAI realtime) sits at the bottom. Usage counts `CALLED` events, so
suppressed/failed calls cost the customer nothing.

Gates apply to **writes only** — reads stay open so a lapsed tenant can still see leads it
already paid to generate.

Provisional tiers live in `prisma/seed.ts` (Free 1/0 · Basic 3/25 · Pro ∞/100 ·
Premier ∞/250 · Enterprise ∞/∞ · **LTD not included**). The platform's own tenant
(`orbis-platform`) is granted directly as `MANUAL` — it has no Subscription, so nothing
would sync entitlements to it and the gate would lock us out of our own product. Its
200-call cap is a **spend guardrail**, not a paywall: in-house webinars still burn real
Twilio/OpenAI money, and a worker bug could dial hundreds of people overnight.

## 8. The public page

White-label. It belongs to the **tenant**, and their prospects see **their** brand
(`BusinessProfile.brandName` → `Tenant.displayName`), never ours. It was hardcoded to
"MyOrbisAgents", which showed every tenant's prospects the wrong company. Branding it
"MyOrbisWebinar" would be equally wrong — that is what we sell to the tenant, and it
belongs in their dashboard.

Watch heartbeats are **30s**. Each beat appends a row *and* triggers a full recompute
that re-reads the person's event list, so cost is quadratic in beats: a 45-min watch was
270 rows / ~36k row-reads at 10s, versus 90 / ~4k at 30s. Not 60s+ — short viewers would
round toward zero, and they are exactly the cold leads we still want scored.

## 9. Known gaps

- **Streaming is a stub.** `WatchStub` is a placeholder; `videoAssetRef` is unused. No
  provider sells a per-attendee engagement webhook — that instrumentation is ours to
  build on a video primitive (Mux / Cloudflare Stream / IVS).
- **`POLL_ANSWERED`, `REVIEWED`, `NO_SHOW`** have weights and schemas but no producers.
  `NO_SHOW` also has no `intentWeight`, so it scores 0.
- **`EngagementScore.stage`** is declared and never written.
- **Overage billing** does not exist — the cap just stops calls.
- **The happy path is unproven.** Dev has no Twilio credentials by design, so the
  compliance *gate* is proven but a connecting call is not. First real call needs a
  staging Twilio account.
- **Cost model is guesswork.** Tier math assumes ~$0.20–0.35/min and a ~3-min call.
  Replace with measured numbers before selling.
- **Reconcile is O(bridges × attempts)** per tick, and no index covers
  `where { personId, webinarId }` (it rides `[personId, ts]`). Both premature at current
  scale.
