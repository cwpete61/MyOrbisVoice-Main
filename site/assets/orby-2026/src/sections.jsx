/* global React */
const { useState, useEffect, useRef } = React;

/* ============================================================
   PROBLEM — PAS (Problem, Agitate, Solution)
   ============================================================ */
function ProblemSection() {
  return (
    <section className="problem-section" data-screen-label="02 Problem">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">The math that's bleeding you</div>
          <h2 className="h-section">
            Every missed call is a customer <span style={{color: "#FF7C7C"}}>handing money</span> to your competitor down the street.
          </h2>
          <p>You're not running a phone bank — you're a roofer, a dentist, a lawyer. But here's what's actually happening on your line today:</p>
        </div>

        <div className="problem-grid">
          <BleedCard
            n="$340"
            l="avg revenue lost per missed call"
            sub="Service businesses, US average"
            tone="red"
          />
          <BleedCard
            n="40%"
            l="of inbound calls hit voicemail"
            sub="During business hours. After hours: 78%."
            tone="red"
          />
          <BleedCard
            n="7 sec"
            l="caller patience for hold music"
            sub="Then they call the next listing on Google."
            tone="red"
          />
          <BleedCard
            n="$1,491"
            l="monthly cost of the stack you'd need to fix it"
            sub="Receptionist + SMS tool + email tool + CRM + scheduler + missed-call recovery"
            tone="amber"
          />
        </div>

        <div className="problem-cta">
          <div className="problem-cta-copy">
            <h3 className="h-section" style={{fontSize: "clamp(28px, 3.4vw, 44px)"}}>
              Hire a receptionist? <span style={{color: "var(--text-3)"}}>$4,200/mo, sleeps at night.</span><br/>
              Buy five tools? <span style={{color: "var(--text-3)"}}>$1,491/mo, never talks to each other.</span><br/>
              <span style={{color: "var(--accent-hi)"}}>Or hire Orby. Once.</span>
            </h3>
          </div>
          <a href="#orby-demo" className="btn btn-cta btn-cta-big">Talk To Orby NOW! →</a>
        </div>
      </div>

      <style>{`
        .problem-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 64px;
        }
        .problem-cta {
          background:
            radial-gradient(circle at 70% 30%, color-mix(in oklab, var(--brand) 18%, transparent), transparent 60%),
            var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          padding: 48px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 32px;
          align-items: center;
        }
        @media (max-width: 840px) { .problem-cta { grid-template-columns: 1fr; padding: 32px; } }
        .problem-cta-copy h3 { margin: 0; line-height: 1.25; }
      `}</style>
    </section>
  );
}

function BleedCard({ n, l, sub, tone }) {
  const c = tone === "red" ? "#FF7C7C" : tone === "amber" ? "#FFB341" : "var(--accent-hi)";
  return (
    <div className="bleed-card">
      <div className="bleed-bar" style={{background: c}} />
      <div className="bleed-n" style={{color: c}}>{n}</div>
      <div className="bleed-l">{l}</div>
      <div className="bleed-sub">{sub}</div>
      <style>{`
        .bleed-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .bleed-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; opacity: 0.8; }
        .bleed-n { font-family: var(--font-display); font-size: clamp(36px, 4vw, 52px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
        .bleed-l { font-size: 15px; font-weight: 600; margin-top: 10px; line-height: 1.35; }
        .bleed-sub { font-size: 12px; color: var(--text-3); margin-top: 6px; line-height: 1.4; }
      `}</style>
    </div>
  );
}

/* ============================================================
   CHANNELS — every place Orby works
   ============================================================ */
function ChannelsSection() {
  const channels = [
    { id: "inb", name: "Inbound voice", desc: "Real phone calls, picked up on ring 2 — 24/7.", glyph: "📞", live: true },
    { id: "out", name: "Outbound voice", desc: "Confirmations, follow-ups, missed-call recovery, lead nurture.", glyph: "📲", live: true },
    { id: "widget", name: "Website widget", desc: "Click the mic on your own site. Same voice. No phone needed.", glyph: "◉", live: true },
    { id: "book", name: "Public booking page", desc: "/book/yourname — 30-day strip, real slots, type-not-talk fallback.", glyph: "▦", live: true },
    { id: "sms", name: "SMS (Twilio)", desc: "Outbound text per tenant once A2P 10DLC clears.", glyph: "✉", live: true },
    { id: "email", name: "Email (Gmail OAuth)", desc: "Real mailbox dispatch from the tenant's own address.", glyph: "✉", live: true },
    { id: "wa", name: "WhatsApp", desc: "Wired and waiting on Meta approval.", glyph: "◐", live: false },
  ];
  return (
    <section className="channels-section" id="how" data-screen-label="04 Channels">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">One brain, every channel</div>
          <h2 className="h-section">
            Wherever a customer reaches out, <br/>
            <span style={{color: "var(--accent-hi)"}}>Orby is already there.</span>
          </h2>
          <p>Three live voice channels. Three live messaging channels. One brain, one Business DNA, one CRM — so context never gets dropped between channels.</p>
        </div>

        <div className="channels-grid">
          {channels.map(c => (
            <div key={c.id} className={`channel-card ${!c.live ? "is-soon" : ""}`}>
              <div className="channel-head">
                <span className="channel-glyph">{c.glyph}</span>
                <span className="channel-name">{c.name}</span>
                {c.live ? <span className="badge-live">● LIVE</span> : <span className="badge-soon">SOON</span>}
              </div>
              <div className="channel-desc">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .channels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 14px;
        }
        .channel-card {
          padding: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          transition: all 0.25s;
        }
        .channel-card:hover {
          border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
          transform: translateY(-2px);
        }
        .channel-card.is-soon { opacity: 0.65; }
        .channel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .channel-glyph { font-size: 22px; }
        .channel-name { font-family: var(--font-display); font-weight: 600; font-size: 17px; flex: 1; }
        .badge-live {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          color: var(--accent-hi);
          padding: 3px 7px;
          border-radius: var(--r-xs);
          background: color-mix(in oklab, var(--brand) 12%, transparent);
        }
        .badge-soon {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          color: var(--text-3);
          padding: 3px 7px;
          border-radius: var(--r-xs);
          background: var(--surface-2);
        }
        .channel-desc { color: var(--text-2); font-size: 14px; line-height: 1.5; }
      `}</style>
    </section>
  );
}

/* ============================================================
   BUSINESS DNA — versioned policies
   ============================================================ */
function DNASection() {
  return (
    <section className="dna-section" data-screen-label="05 Business DNA">
      <div className="container">
        <div className="dna-grid">
          <div className="dna-copy">
            <div className="eyebrow">Business DNA</div>
            <h2 className="h-section" style={{margin: "14px 0 18px"}}>
              A digital twin of <br/>
              <span style={{color: "var(--accent-hi)"}}>how YOUR business actually runs.</span>
            </h2>
            <p style={{color: "var(--text-2)", fontSize: 18, lineHeight: 1.55, marginBottom: 32}}>
              Most "AI agents" are a blank-slate chatbot pointed at a FAQ. Orby works because every tenant fills versioned, structured fields — not free-text — that get injected into every conversation. Identity, services, pricing, lead-qualification rules, escalation policies, refund rules, legal disclaimers. Editable like documents. Versioned like code.
            </p>
            <ul className="dna-points">
              <li><span className="dna-bullet">→</span> <b>Versioned</b> — draft → published → active. Rollback if a rewrite goes sideways.</li>
              <li><span className="dna-bullet">→</span> <b>Rehearsed</b> — test the agent against your own DNA before it talks to customers.</li>
              <li><span className="dna-bullet">→</span> <b>Enforced</b> — every channel, every call, every campaign uses the same source of truth.</li>
            </ul>
          </div>

          <DNAFile />
        </div>
      </div>

      <style>{`
        .dna-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 56px;
          align-items: center;
        }
        @media (min-width: 960px) {
          .dna-grid { grid-template-columns: 1fr 1.05fr; gap: 64px; }
        }
        .dna-points {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 14px;
          font-size: 15px; color: var(--text-2);
          line-height: 1.55;
        }
        .dna-bullet { color: var(--accent-hi); font-family: var(--font-display); font-weight: 700; margin-right: 8px; }
        .dna-points b { color: var(--text); font-weight: 600; }
      `}</style>
    </section>
  );
}

function DNAFile() {
  const [tab, setTab] = useState("identity");
  const [version, setVersion] = useState("v14");
  const tabs = [
    { id: "identity", label: "Identity" },
    { id: "services", label: "Services" },
    { id: "pricing", label: "Pricing" },
    { id: "appt", label: "Appointment rules" },
    { id: "escalation", label: "Escalation" },
  ];
  const content = {
    identity: [
      ["business_name", "Allentown Family Dental"],
      ["owner", "Dr. Priya Patel, DMD"],
      ["address", "412 N 19th St, Allentown, PA 18104"],
      ["phone", "+1 (610) 555-0144"],
      ["established", "2008"],
      ["languages", "[en, es]"],
      ["greeting_style", "warm.professional"],
    ],
    services: [
      ["cleanings", "$129 · 45 min · no insurance req"],
      ["whitening", "$299 · 60 min"],
      ["emergency_visit", "same-day · adds $75 fee"],
      ["root_canal", "$899-1400 · 90 min · insurance applies"],
      ["pediatric", "[true] · ages 3+"],
    ],
    pricing: [
      ["accepts_insurance", "[Aetna, Delta, BCBS, Cigna, Guardian]"],
      ["cash_discount", "5% if paid same day"],
      ["payment_plans", "via CareCredit"],
      ["no_show_fee", "$50 · waived first occurrence"],
    ],
    appt: [
      ["lead_time_minutes", "60"],
      ["max_advance_days", "60"],
      ["slot_length", "30"],
      ["buffer_before", "0"],
      ["buffer_after", "15"],
      ["emergency_override", "true"],
      ["double_book_owner", "false"],
    ],
    escalation: [
      ["pricing_dispute", "→ owner_voicemail"],
      ["legal_threat", "→ owner_voicemail · IMMEDIATELY"],
      ["medical_emergency", "→ \"call 911\" + owner SMS"],
      ["spanish_speaker", "→ continue in es-LA · informal"],
      ["aggressive_caller", "→ de-escalate · offer human callback"],
    ],
  };
  return (
    <div className="dna-file">
      <div className="dna-file-head">
        <div className="dna-file-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`dna-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="dna-version">
          <select value={version} onChange={e => setVersion(e.target.value)} className="dna-select">
            <option value="v14">v14 (active)</option>
            <option value="v13">v13</option>
            <option value="v12">v12</option>
            <option value="draft">v15 (draft)</option>
          </select>
        </div>
      </div>

      <div className="dna-file-body">
        <div className="dna-file-line dna-file-comment"># Business DNA · {tabs.find(t => t.id === tab).label.toLowerCase()} · {version}</div>
        {content[tab].map(([k, v], i) => (
          <div key={i} className="dna-file-line">
            <span className="dna-k">{k}</span>
            <span className="dna-eq">=</span>
            <span className="dna-v">{v}</span>
          </div>
        ))}
        <div className="dna-file-status">
          <span className="status-dot" />
          <span className="mono" style={{fontSize: 11, color: "var(--text-2)"}}>Active across 7 agents · 3 channels · 0 conflicts</span>
        </div>
      </div>

      <style>{`
        .dna-file {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          overflow: hidden;
          box-shadow: 0 30px 60px -30px rgba(0,0,0,0.5);
        }
        .dna-file-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          gap: 12px;
          flex-wrap: wrap;
        }
        .dna-file-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .dna-tab {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          padding: 6px 10px;
          border-radius: var(--r-xs);
          color: var(--text-3);
          transition: all 0.15s;
        }
        .dna-tab:hover { color: var(--text-2); }
        .dna-tab.active {
          background: color-mix(in oklab, var(--brand) 16%, transparent);
          color: var(--accent-hi);
        }
        .dna-select {
          font-family: var(--font-mono);
          font-size: 11px;
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: var(--r-xs);
          padding: 6px 8px;
        }
        .dna-file-body {
          padding: 20px;
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.7;
          min-height: 300px;
          display: flex; flex-direction: column;
        }
        .dna-file-line { display: flex; gap: 10px; }
        .dna-file-comment { color: var(--text-3); margin-bottom: 8px; }
        .dna-k { color: var(--accent-hi); min-width: 180px; }
        .dna-eq { color: var(--text-3); }
        .dna-v { color: var(--text); flex: 1; }
        .dna-file-status {
          margin-top: auto; padding-top: 16px;
          display: flex; align-items: center; gap: 10px;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   INTEGRATIONS — what Orby does, not describes
   ============================================================ */
function IntegrationsSection() {
  const integrations = [
    {
      name: "Google Calendar",
      glyph: "📅",
      verb: "books real events on the connected calendar",
      detail: "Free/busy API · reschedules · cancels · honors buffers + working hours.",
      hot: "Connected",
    },
    {
      name: "Gmail",
      glyph: "✉",
      verb: "sends follow-up email from the tenant's own mailbox",
      detail: "OAuth per tenant · not a shared inbox · real sender reputation.",
      hot: "OAuth'd",
    },
    {
      name: "Stripe Connect",
      glyph: "💳",
      verb: "runs the subscription lifecycle + partner payouts",
      detail: "Free · Basic · Pro · LTD · Premier · Enterprise + comp codes.",
      hot: "Live",
    },
    {
      name: "Twilio",
      glyph: "📞",
      verb: "owns the phone numbers, calls, recordings, SMS",
      detail: "Inbound · outbound · A2P 10DLC · per-number toggles.",
      hot: "Live",
    },
  ];

  return (
    <section className="int-section" data-screen-label="06 Integrations">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">It does. It doesn't describe.</div>
          <h2 className="h-section">
            Orby doesn't say <span style={{fontStyle: "italic", color: "var(--text-3)"}}>"I would book that for you."</span><br/>
            <span style={{color: "var(--accent-hi)"}}>It books it.</span>
          </h2>
          <p>Real API calls to the systems your business already uses. Every call ends with a structured outcome, AI summary, speaker-labeled transcript, and a recording you can listen to.</p>
        </div>

        <div className="int-grid">
          {integrations.map((it, i) => (
            <div key={it.name} className="int-card">
              <div className="int-head">
                <div className="int-glyph">{it.glyph}</div>
                <div className="int-name">{it.name}</div>
                <div className="int-badge"><span className="status-dot" />{it.hot}</div>
              </div>
              <div className="int-verb">
                Orby <span style={{color: "var(--accent-hi)"}}>{it.verb}.</span>
              </div>
              <div className="int-detail">{it.detail}</div>
            </div>
          ))}
        </div>

        <CallOutcomeRow />
      </div>

      <style>{`
        .int-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 14px;
          margin-bottom: 48px;
        }
        .int-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 22px;
          transition: all 0.25s;
        }
        .int-card:hover {
          border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
          background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 6%, var(--surface)), var(--surface) 60%);
        }
        .int-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .int-glyph { font-size: 22px; }
        .int-name { font-family: var(--font-display); font-weight: 600; font-size: 16px; flex: 1; }
        .int-badge {
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.1em;
          color: var(--accent-hi);
          display: flex; align-items: center; gap: 6px;
        }
        .int-verb { font-size: 15px; line-height: 1.45; margin-bottom: 10px; }
        .int-detail { font-size: 13px; color: var(--text-3); line-height: 1.5; }
      `}</style>
    </section>
  );
}

function CallOutcomeRow() {
  const outcomes = [
    { tag: "BOOKED", c: "#3FE3E3" },
    { tag: "CALLBACK_REQUESTED", c: "#FFB341" },
    { tag: "INFO_REQUEST", c: "#7C9CFF" },
    { tag: "MISSED_CALL", c: "#FF7C7C" },
    { tag: "QUALIFIED_LEAD", c: "#9AE6B4" },
  ];
  return (
    <div className="outcome-row-wrap">
      <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14}}>
        Every call ends with one of these →
      </div>
      <div className="outcome-tags">
        {outcomes.map(o => (
          <span key={o.tag} className="outcome-tag-chip" style={{['--oc']: o.c}}>
            <span className="oc-dot" />{o.tag}
          </span>
        ))}
        <span style={{color: "var(--text-3)", fontSize: 13, alignSelf: "center"}}>+ AI summary, transcript, recording — every time.</span>
      </div>
      <style>{`
        .outcome-row-wrap {
          padding: 24px;
          background: var(--surface-2);
          border-radius: var(--r-md);
          border: 1px dashed var(--border-strong);
        }
        .outcome-tags { display: flex; flex-wrap: wrap; gap: 10px; }
        .outcome-tag-chip {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          border-radius: var(--r-pill);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--oc);
          background: color-mix(in oklab, var(--oc) 10%, transparent);
          border: 1px solid color-mix(in oklab, var(--oc) 30%, transparent);
        }
        .oc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--oc); }
      `}</style>
    </div>
  );
}

/* ============================================================
   CRM + CAMPAIGNS — tag-driven multi-channel
   ============================================================ */
function CRMCampaignsSection() {
  const [activeTag, setActiveTag] = useState("missed-call");
  const tagFlows = {
    "booked": {
      label: "Booked",
      campaign: "Booking Confirmation",
      channels: [
        { ch: "Email", t: "Confirmation sent · 2s after booking" },
        { ch: "SMS",   t: "Reminder armed · 24h before" },
        { ch: "SMS",   t: "Reminder armed · 1h before" },
      ],
    },
    "missed-call": {
      label: "Missed call",
      campaign: "Missed-Call Follow-Up",
      channels: [
        { ch: "SMS",   t: "\"Sorry we missed you — want to book?\" · 4 min" },
        { ch: "Voice", t: "Orby outbound retry · 1 hour" },
        { ch: "Email", t: "Follow-up if no answer · next day" },
      ],
    },
    "qualified-lead": {
      label: "Qualified lead",
      campaign: "Lead Nurture",
      channels: [
        { ch: "Email", t: "Case study · day 1" },
        { ch: "SMS",   t: "Soft check-in · day 3" },
        { ch: "Voice", t: "Orby qualifying call · day 7" },
      ],
    },
    "callback-requested": {
      label: "Callback requested",
      campaign: "Callback Follow-Up",
      channels: [
        { ch: "Voice", t: "Orby outbound · at requested time" },
        { ch: "SMS",   t: "Confirmation of callback window" },
      ],
    },
  };
  const active = tagFlows[activeTag];

  return (
    <section className="crm-section" data-screen-label="07 CRM & Campaigns">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Tag → fan-out</div>
          <h2 className="h-section">
            One tag fires <span style={{color: "var(--accent-hi)"}}>every follow-up</span>, on every channel, in the right order.
          </h2>
          <p>Every call auto-tags the contact based on outcome. Tags trigger campaigns. Campaigns fan out per channel with retry policy, token substitution (name, business, appointment), and per-channel opt-outs honored automatically.</p>
        </div>

        <div className="crm-grid">
          <div className="crm-tags-panel">
            <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14}}>
              Click a tag →
            </div>
            <div className="crm-tags">
              {Object.entries(tagFlows).map(([k, v]) => (
                <button
                  key={k}
                  className={`crm-tag ${activeTag === k ? "active" : ""}`}
                  onClick={() => setActiveTag(k)}
                >
                  <span className="crm-tag-dot" />
                  {v.label}
                </button>
              ))}
            </div>

            <div className="crm-note">
              <div className="mono" style={{fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8}}>Also tracked per contact</div>
              <div className="crm-fields">
                <span>birthday</span><span>spouse</span><span>kids</span><span>pets</span>
                <span>anniversary</span><span>preferred time</span><span>customer-since</span><span>insurance</span>
                <span>vehicle</span><span>opt-outs</span>
              </div>
            </div>
          </div>

          <div className="crm-flow-panel">
            <div className="crm-flow-head">
              <span className="crm-flow-tag">{active.label}</span>
              <span style={{color: "var(--text-3)", margin: "0 8px"}}>→</span>
              <span className="crm-flow-campaign">{active.campaign}</span>
            </div>
            <div className="crm-flow">
              {active.channels.map((c, i) => (
                <div key={i} className="crm-flow-row" style={{animationDelay: `${i * 0.1}s`}}>
                  <div className="crm-flow-ch">{c.ch}</div>
                  <div className="crm-flow-line" />
                  <div className="crm-flow-action">{c.t}</div>
                </div>
              ))}
            </div>
            <div className="crm-flow-foot mono">
              ✓ opt-outs honored · ✓ tokens substituted · ✓ retry on failure
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .crm-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 960px) { .crm-grid { grid-template-columns: 0.7fr 1fr; } }
        .crm-tags-panel, .crm-flow-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 24px;
        }
        .crm-tags { display: flex; flex-direction: column; gap: 6px; margin-bottom: 32px; }
        .crm-tag {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px;
          border-radius: var(--r-sm);
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-2);
          text-align: left;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .crm-tag:hover { background: var(--surface-2); color: var(--text); }
        .crm-tag.active {
          background: color-mix(in oklab, var(--brand) 14%, var(--surface-2));
          color: var(--accent-hi);
          border-color: color-mix(in oklab, var(--brand) 35%, transparent);
        }
        .crm-tag-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-3);
        }
        .crm-tag.active .crm-tag-dot { background: var(--accent-hi); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent-hi) 25%, transparent); }

        .crm-note { padding-top: 24px; border-top: 1px solid var(--border); }
        .crm-fields { display: flex; flex-wrap: wrap; gap: 6px; }
        .crm-fields span {
          font-family: var(--font-mono); font-size: 11px;
          padding: 4px 8px;
          background: var(--surface-2);
          border-radius: var(--r-xs);
          color: var(--text-2);
        }

        .crm-flow-head {
          display: flex; align-items: center; flex-wrap: wrap;
          padding-bottom: 18px; border-bottom: 1px solid var(--border); margin-bottom: 24px;
        }
        .crm-flow-tag {
          padding: 6px 12px;
          background: color-mix(in oklab, var(--brand) 18%, transparent);
          color: var(--accent-hi);
          border-radius: var(--r-pill);
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.08em;
        }
        .crm-flow-campaign {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 17px;
        }
        .crm-flow { display: flex; flex-direction: column; gap: 14px; }
        .crm-flow-row {
          display: grid;
          grid-template-columns: 60px 24px 1fr;
          align-items: center;
          gap: 10px;
          animation: turnIn 0.4s ease-out backwards;
        }
        .crm-flow-ch {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--accent-hi);
          padding: 5px 8px;
          background: color-mix(in oklab, var(--brand) 12%, transparent);
          border-radius: var(--r-xs);
          text-align: center;
        }
        .crm-flow-line {
          height: 1px;
          background: linear-gradient(90deg, var(--accent-hi), transparent);
        }
        .crm-flow-action { font-size: 14px; color: var(--text-2); }
        .crm-flow-foot {
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid var(--border);
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--text-3);
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   DIFFERENTIATORS — what we are NOT, and the "stack we replace"
   ============================================================ */
function ReplaceSection() {
  const old = [
    { name: "Live receptionist", cost: "$4,200/mo", x: true },
    { name: "Scheduling tool (Calendly/Acuity)", cost: "$30/mo", x: true },
    { name: "SMS marketing (TextMagic/SimpleTexting)", cost: "$99/mo", x: true },
    { name: "Email marketing (Mailchimp/ActiveCampaign)", cost: "$149/mo", x: true },
    { name: "Basic CRM (HubSpot Starter)", cost: "$50/mo", x: true },
    { name: "Missed-call recovery service", cost: "$129/mo", x: true },
    { name: "Website chat widget", cost: "$79/mo", x: true },
  ];
  const total = "$4,736/mo";
  return (
    <section className="replace-section" data-screen-label="08 Replaces">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">The stack you can fire today</div>
          <h2 className="h-section">
            Cancel five subscriptions <br/>
            <span style={{color: "var(--accent-hi)"}}>and a job posting.</span>
          </h2>
        </div>

        <div className="replace-grid">
          <div className="replace-old">
            <div className="replace-head mono">Before · what you're paying for today</div>
            <ul className="replace-list">
              {old.map((it, i) => (
                <li key={i} className="replace-item">
                  <span className="replace-x">✕</span>
                  <span className="replace-name">{it.name}</span>
                  <span className="replace-cost">{it.cost}</span>
                </li>
              ))}
              <li className="replace-item replace-total">
                <span></span>
                <span className="replace-name">Monthly total</span>
                <span className="replace-cost" style={{color: "#FF7C7C", fontSize: 20}}>{total}</span>
              </li>
            </ul>
          </div>

          <div className="replace-new">
            <div className="replace-head mono" style={{color: "var(--accent-hi)"}}>After · one platform</div>
            <div className="replace-new-card">
              <div className="brand-dot" style={{width: 56, height: 56, margin: "0 auto"}}/>
              <div style={{fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, marginTop: 18}}>MyOrbisVoice</div>
              <div style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.5, margin: "12px 0 24px", maxWidth: 360, textAlign: "center"}}>
                Voice receptionist + scheduling + SMS + email + CRM + missed-call recovery + website widget — one brain, one bill, one Business DNA.
              </div>
              <div className="replace-new-price">
                <div className="rn-cost">starts at $497<span>/mo</span></div>
                <a href="#cta" className="btn btn-cta">See pricing →</a>
              </div>
            </div>
          </div>
        </div>

        <div className="not-list">
          <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14}}>
            And what we are NOT (because honesty sells better than hype)
          </div>
          <div className="not-grid">
            <div className="not-card">Not a generic chatbot. Real-time voice through Gemini Live, structured outcome on every call.</div>
            <div className="not-card">Not an enterprise CRM. No deal stages, no pipeline kanban, no sales-ops dashboards.</div>
            <div className="not-card">Not HubSpot. We do tag-driven multi-channel campaigns. Not behavior trees with lead scoring.</div>
            <div className="not-card">Not Intercom. The agent answers, but we don't ship ticketing queues. Yet.</div>
          </div>
        </div>
      </div>

      <style>{`
        .replace-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          align-items: stretch;
        }
        @media (min-width: 900px) { .replace-grid { grid-template-columns: 1fr 1fr; } }

        .replace-old, .replace-new {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 28px;
        }
        .replace-new {
          background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 10%, var(--surface)), var(--surface));
          border-color: color-mix(in oklab, var(--brand) 30%, var(--border));
        }
        .replace-head {
          font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--text-3); margin-bottom: 18px;
        }
        .replace-list { list-style: none; padding: 0; margin: 0; }
        .replace-item {
          display: grid; grid-template-columns: 24px 1fr auto;
          align-items: center; gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
          font-size: 15px;
        }
        .replace-x { color: #FF7C7C; font-weight: 600; }
        .replace-name { color: var(--text-2); }
        .replace-cost { font-family: var(--font-mono); font-size: 13px; color: var(--text); }
        .replace-total .replace-name { color: var(--text); font-weight: 600; }
        .replace-total { border-bottom: none; padding-top: 18px; }

        .replace-new-card {
          display: flex; flex-direction: column; align-items: center;
          padding: 16px 0 0;
          text-align: center;
        }
        .replace-new-price { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .rn-cost {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 40px;
          letter-spacing: -0.02em;
          color: var(--accent-hi);
          line-height: 1;
        }
        .rn-cost span { font-size: 16px; color: var(--text-3); font-weight: 500; }

        .not-list { margin-top: 56px; }
        .not-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        .not-card {
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          font-size: 13px;
          color: var(--text-2);
          line-height: 1.5;
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   KNOWLEDGE BASE + MEMORY
   ============================================================ */
function KnowledgeSection() {
  return (
    <section className="kb-section" data-screen-label="09 Knowledge & Memory">
      <div className="container">
        <div className="kb-grid">
          <div className="kb-card">
            <div className="eyebrow">Knowledge base</div>
            <h3 className="h-section" style={{fontSize: 32, margin: "12px 0 14px"}}>
              Drop a PDF.<br/>
              Orby learns your business <span style={{color: "var(--accent-hi)"}}>by lunch.</span>
            </h3>
            <p style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.55, marginBottom: 24}}>
              PDF · DOCX · XLSX · CSV · TXT · MD. Extracted, bounded for context budget, injected on every call. Roofer's warranty policy → accurate warranty answers. Dental insurance list → accurate in-network answers. No human bottleneck.
            </p>
            <div className="kb-files">
              <FileChip name="warranty-2026.pdf" size="412 KB" status="indexed" />
              <FileChip name="insurance-accepted.xlsx" size="38 KB" status="indexed" />
              <FileChip name="emergency-protocols.md" size="6 KB" status="indexed" />
              <FileChip name="service-pricing.csv" size="24 KB" status="indexed" />
              <FileChip name="2026-promo-flyer.pdf" size="—" status="upload" />
            </div>
          </div>

          <div className="kb-card kb-card-memory">
            <div className="eyebrow">Cross-session memory</div>
            <h3 className="h-section" style={{fontSize: 32, margin: "12px 0 14px"}}>
              "Hey Maria, <span style={{color: "var(--accent-hi)"}}>how's the dog?"</span>
            </h3>
            <p style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.55, marginBottom: 20}}>
              Known callers (inbound caller-ID match, outbound contactId, widget lookup) get a Caller Context layer auto-injected: prior summaries, recent appointments, CRM relationship facts.
            </p>
            <div className="memory-card">
              <div className="memory-name">Maria Sanchez</div>
              <div className="memory-meta">Customer since Feb 2024 · 4 visits · Aetna</div>
              <div className="memory-facts">
                <div><span>last visit</span> Cleaning · Feb 14, 2026</div>
                <div><span>pets</span> "Bandit" — Goldendoodle, 3 years</div>
                <div><span>language</span> ES preferred (informal tú)</div>
                <div><span>anniversary</span> May 12</div>
              </div>
              <div className="memory-note mono">
                ⓘ Char-budgeted · referenced naturally · never volunteered unprompted
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .kb-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
        }
        @media (min-width: 900px) { .kb-grid { grid-template-columns: 1fr 1fr; } }
        .kb-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 32px;
        }
        .kb-card-memory {
          background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 6%, var(--surface)), var(--surface) 60%);
        }
        .kb-files { display: flex; flex-direction: column; gap: 8px; }

        .memory-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 18px;
        }
        .memory-name { font-family: var(--font-display); font-weight: 700; font-size: 18px; margin-bottom: 4px; }
        .memory-meta { font-size: 12px; color: var(--text-3); margin-bottom: 14px; }
        .memory-facts { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
        .memory-facts > div { font-size: 13px; color: var(--text); display: grid; grid-template-columns: 110px 1fr; gap: 12px; }
        .memory-facts span { font-family: var(--font-mono); font-size: 10px; color: var(--text-3); letter-spacing: 0.1em; text-transform: uppercase; align-self: center; }
        .memory-note {
          font-size: 11px;
          color: var(--text-3);
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </section>
  );
}

function FileChip({ name, size, status }) {
  return (
    <div className={`file-chip file-chip-${status}`}>
      <span className="file-icon">📄</span>
      <span className="file-name mono">{name}</span>
      <span className="file-size mono">{size}</span>
      <span className="file-status mono">{status === "indexed" ? "✓ indexed" : "+ upload"}</span>
      <style>{`
        .file-chip {
          display: grid;
          grid-template-columns: 24px 1fr auto auto;
          gap: 12px;
          align-items: center;
          padding: 10px 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--r-sm);
          font-size: 12px;
        }
        .file-chip-upload {
          background: transparent;
          border-style: dashed;
          color: var(--text-3);
        }
        .file-icon { font-size: 14px; }
        .file-name { font-size: 12px; color: var(--text); }
        .file-size { color: var(--text-3); }
        .file-status { color: var(--accent-hi); font-size: 10px; letter-spacing: 0.12em; }
        .file-chip-upload .file-status { color: var(--text-3); }
      `}</style>
    </div>
  );
}

/* ============================================================
   PROOF — Recent shipped (changelog as velocity proof)
   ============================================================ */
function ChangelogSection() {
  const items = [
    { d: "2026-05-25", h: "Orby agent architecture overhaul", b: "Specialist Routing meta · Single-specialist Handoff · Direct transfer · Mid-flow tolerance · Action-ownership rule. All shipped." },
    { d: "2026-05-23", h: "Media Center + Social Content Engine", b: "13 angles · gpt-4o-mini copy · gpt-image-1 backgrounds · 10 Remotion compositions · QC dashboard. End-to-end live." },
    { d: "2026-05-17", h: "Lead engine (Phase 1)", b: "Industry + location search via Serper.dev → enriched leads → CRM. Cold-email-only by default." },
    { d: "2026-05-16", h: "Per-partner Orby · Central call log · AI conversation monitor", b: "Every partner gets their own Orby that answers as their brand. Color-coded health scoring on every call." },
    { d: "2026-05-13", h: "Public booking page · auto-reminders · cross-session memory", b: "/book/<slug> · 24h + 1h reminders armed automatically · returning callers recognized across sessions." },
    { d: "2026-05-12", h: "MyOrbisVoice Preview PWA", b: "Mobile preview at myorbisresults.com/preview/." },
    { d: "2026-05-09", h: "CRM relationship fields · partner notification bell · WordPress plugin", b: "Birthday · anniversary · pets · kids. Plus one-click WP widget install." },
  ];
  return (
    <section className="changelog-section" data-screen-label="10 Velocity Proof">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Velocity > Vapor</div>
          <h2 className="h-section">
            Seven major shipments. <span style={{color: "var(--accent-hi)"}}>Last 30 days.</span>
          </h2>
          <p>You're not buying a roadmap. You're buying the thing that's already running for tenants right now — and getting better every week.</p>
        </div>

        <div className="changelog">
          {items.map((it, i) => (
            <div key={i} className="changelog-row">
              <div className="changelog-date mono">{it.d}</div>
              <div className="changelog-line" />
              <div className="changelog-body">
                <div className="changelog-head">{it.h}</div>
                <div className="changelog-text">{it.b}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .changelog {
          display: flex; flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          overflow: hidden;
        }
        .changelog-row {
          display: grid;
          grid-template-columns: 120px 1px 1fr;
          gap: 24px;
          padding: 22px 28px;
          border-bottom: 1px solid var(--border);
        }
        .changelog-row:last-child { border-bottom: none; }
        @media (max-width: 720px) {
          .changelog-row { grid-template-columns: 1fr; gap: 8px; }
          .changelog-line { display: none; }
        }
        .changelog-date {
          font-size: 11px; color: var(--accent-hi); letter-spacing: 0.08em;
          align-self: center;
        }
        .changelog-line { background: var(--border); }
        .changelog-head { font-family: var(--font-display); font-weight: 600; font-size: 17px; margin-bottom: 4px; }
        .changelog-text { font-size: 14px; color: var(--text-2); line-height: 1.5; }
      `}</style>
    </section>
  );
}

/* ============================================================
   FAQ
   ============================================================ */
function FAQSection() {
  const [open, setOpen] = useState(0);
  const items = [
    {
      q: "Will my customers know it's an AI?",
      a: "If they ask, Orby tells them — we don't lie. But the vast majority don't ask, because the conversation is fluid, the voice is warm, and the agent actually completes the task. You'll listen to the recordings yourself and decide."
    },
    {
      q: "What happens if Orby can't handle a call?",
      a: "Configurable escalation. Forward to a human, take a detailed message + transcript, schedule a callback, or transfer mid-call to a specific staff member by intent. Your Business DNA defines the rules."
    },
    {
      q: "Do I need to provide the phone number?",
      a: "No — purchase a Twilio number directly inside the platform. Or port your existing number. Inbound, outbound, and SMS toggle independently per number."
    },
    {
      q: "How long to go live?",
      a: "60 seconds for the website widget. Same-day for a fresh phone number. 1–2 days to write your Business DNA, rehearse Orby, and flip the switch on your real line."
    },
    {
      q: "Spanish support — for real?",
      a: "Yes. Latin American Spanish, informal tú form. Every dashboard string, every email template, every help article exists in both languages and ships together. Locale saves at the user level."
    },
    {
      q: "Is it really one bill, or are there per-call charges?",
      a: "Flat monthly tier. Twilio voice + SMS pass-through at cost on usage above plan limits. No surprise overage on the AI side."
    },
  ];
  return (
    <section className="faq-section" data-screen-label="11 FAQ">
      <div className="container" style={{maxWidth: 880}}>
        <div className="section-head" style={{textAlign: "center", margin: "0 auto 56px"}}>
          <div className="eyebrow">Anticipated objections</div>
          <h2 className="h-section">Questions you're <span style={{color: "var(--accent-hi)"}}>about to type</span>.</h2>
        </div>

        <div className="faq-list">
          {items.map((it, i) => (
            <button key={i} className={`faq-item ${open === i ? "open" : ""}`} onClick={() => setOpen(open === i ? -1 : i)}>
              <div className="faq-q">
                <span>{it.q}</span>
                <span className="faq-toggle">{open === i ? "−" : "+"}</span>
              </div>
              <div className="faq-a"><div>{it.a}</div></div>
            </button>
          ))}
        </div>
      </div>
      <style>{`
        .faq-list { display: flex; flex-direction: column; gap: 8px; }
        .faq-item {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 0;
          text-align: left;
          width: 100%;
          transition: border-color 0.2s;
        }
        .faq-item.open { border-color: color-mix(in oklab, var(--brand) 40%, var(--border)); }
        .faq-q {
          display: flex; justify-content: space-between; align-items: center;
          padding: 20px 24px;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 17px;
        }
        .faq-toggle {
          font-family: var(--font-display); font-weight: 400; font-size: 24px;
          color: var(--accent-hi);
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in oklab, var(--brand) 12%, transparent);
        }
        .faq-a {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.3s ease;
        }
        .faq-item.open .faq-a { grid-template-rows: 1fr; }
        .faq-a > div {
          overflow: hidden;
          padding: 0 24px;
          color: var(--text-2);
          font-size: 15px;
          line-height: 1.55;
        }
        .faq-item.open .faq-a > div { padding: 0 24px 22px; }
      `}</style>
    </section>
  );
}

/* ============================================================
   FINAL CTA — aggressive close
   ============================================================ */
function FinalCTA() {
  return (
    <section className="final-cta" id="cta" data-screen-label="12 Final CTA">
      <div className="bg-aurora" style={{opacity: 0.9}} />
      <div className="container" style={{position: "relative", zIndex: 1}}>
        <div className="final-inner">
          <div className="eyebrow" style={{justifyContent: "center", display: "flex"}}>Last chance to keep losing calls</div>
          <h2 className="h-display" style={{fontSize: "clamp(44px, 6vw, 88px)", margin: "18px auto 24px", maxWidth: 900, textAlign: "center"}}>
            Stop reading. <br/>
            <span style={{color: "var(--accent-hi)", fontStyle: "italic"}}>Start talking.</span>
          </h2>
          <p style={{maxWidth: 600, margin: "0 auto 40px", color: "var(--text-2)", fontSize: 18, lineHeight: 1.55, textAlign: "center"}}>
            Tap below. A real Orby conversation will play out in your browser. No signup. No card. Take 60 seconds and decide.
          </p>
          <div style={{display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap"}}>
            <a href="#orby-demo" className="btn btn-cta btn-cta-big">
              <span style={{fontSize: 22}}>🎙</span> Talk To Orby NOW!
            </a>
            <a href="/pricing" className="btn btn-ghost btn-cta-big" style={{fontSize: 18}}>See pricing →</a>
          </div>

          <div className="final-guarantee">
            <div className="guarantee-grid">
              <div><b>60s</b> to live · widget on any site</div>
              <div><b>$0</b> setup · no card to start</div>
              <div><b>You own</b> the recordings, transcripts, calendar, contacts</div>
              <div><b>Cancel anytime</b> · we don't lock data</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .final-cta {
          background: radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--brand) 18%, var(--bg)), var(--bg) 60%);
          overflow: hidden;
          position: relative;
        }
        .final-guarantee {
          margin-top: 56px;
          padding-top: 32px;
          border-top: 1px solid var(--border);
        }
        .guarantee-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          font-size: 14px;
          color: var(--text-2);
          text-align: center;
        }
        .guarantee-grid b { color: var(--accent-hi); font-weight: 700; font-family: var(--font-display); }
      `}</style>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand-mark">
              <div className="brand-dot" />
              <span>MyOrbisVoice</span>
            </div>
            <p style={{color: "var(--text-3)", fontSize: 13, marginTop: 14, maxWidth: 320, lineHeight: 1.5}}>
              An AI agent system for small service businesses. Voice receptionist, scheduling, follow-up, CRM — one platform.
            </p>
            <div style={{marginTop: 20, color: "var(--text-3)", fontSize: 12}}>
              716 Washington St, Suite 2 · Allentown, PA 18102
            </div>
          </div>

          <div>
            <div className="footer-h mono">Product</div>
            <ul><li>Features</li><li>Pricing</li><li>Booking page</li><li>WordPress plugin</li><li>Integrations</li></ul>
          </div>
          <div>
            <div className="footer-h mono">For partners</div>
            <ul><li>Partner program</li><li>30% recurring</li><li>Lead engine</li><li>Marketing kit</li><li>GBP audit tool</li></ul>
          </div>
          <div>
            <div className="footer-h mono">Family</div>
            <ul><li>MyOrbisResults</li><li>MyOrbisLocal <span className="footer-soon">soon</span></li><li>MyOrbisWeb <span className="footer-soon">soon</span></li></ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>© 2026 MyOrbisVoice · A MyOrbisResults product</div>
          <div className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>EN · ES coming to this site</div>
        </div>
      </div>
      <style>{`
        .site-footer {
          padding: 80px 0 32px;
          border-top: 1px solid var(--border);
          background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--brand) 4%, transparent));
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 56px;
        }
        @media (max-width: 760px) { .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; } }
        .footer-h { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); margin-bottom: 16px; }
        .footer-grid ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
        .footer-grid li { font-size: 13px; color: var(--text-2); cursor: pointer; transition: color 0.15s; }
        .footer-grid li:hover { color: var(--accent-hi); }
        .footer-soon {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--text-3);
          padding: 2px 5px;
          background: var(--surface);
          border-radius: 4px;
          margin-left: 4px;
        }
        .footer-bottom {
          display: flex; justify-content: space-between;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
          gap: 10px;
        }
      `}</style>
    </footer>
  );
}

Object.assign(window, {
  ProblemSection, ChannelsSection, DNASection, IntegrationsSection,
  CRMCampaignsSection, ReplaceSection, KnowledgeSection, ChangelogSection,
  FAQSection, FinalCTA, SiteFooter
});
