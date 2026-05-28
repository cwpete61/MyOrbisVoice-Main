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
          <div className="eyebrow">La cuenta que te está desangrando</div>
          <h2 className="h-section">
            Cada llamada que perdiste la semana pasada <span style={{color: "#FF7C7C"}}>pagó la renta de otro.</span>
          </h2>
          <p>No abriste un call center — abriste una empresa de techos, una clínica dental, un salón. Así que cuando el teléfono suena mientras estás a 9 metros de altura en una escalera, con las manos dentro de la boca de un paciente, o con las dos manos en el cabello de un cliente, esa llamada muere. El que llama no espera. Pulsa el siguiente resultado de Google. Su siguiente frase es <strong>"Hola, ¿tienes disponibilidad hoy?"</strong> — pero ya no te la está diciendo a ti.</p>
        </div>

        <div className="problem-grid">
          <BleedCard
            n="$340"
            l="ingreso promedio perdido por llamada perdida"
            sub="Negocios de servicios, promedio EE.UU."
            tone="red"
          />
          <BleedCard
            n="40%"
            l="de las llamadas entrantes caen en buzón"
            sub="En horario laboral. Fuera de horario: 78%."
            tone="red"
          />
          <BleedCard
            n="7 seg"
            l="paciencia del cliente para música de espera"
            sub="Después llaman al siguiente resultado en Google."
            tone="red"
          />
          <BleedCard
            n="$1,491"
            l="costo mensual del stack que necesitarías para arreglarlo"
            sub="Recepcionista + herramienta SMS + herramienta de correo + CRM + agendador + recuperación de llamadas perdidas"
            tone="amber"
          />
        </div>

        <div className="cost-slide-frame">
          <iframe
            src="/slides/cost-compare-es.html"
            title="Comparación de costos"
            loading="lazy"
            scrolling="no"
          />
        </div>
      </div>

      <style>{`
        .problem-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
          margin-bottom: 64px;
        }
        .cost-slide-frame {
          border-radius: var(--r-xl);
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
          background: var(--surface);
        }
        .cost-slide-frame iframe {
          display: block;
          width: 100%;
          height: clamp(520px, 78vh, 760px);
          border: 0;
          background: transparent;
        }
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
    { id: "inb", name: "Voz entrante", desc: "Llamadas telefónicas reales, contestadas al segundo timbre — 24/7.", glyph: "📞", live: true },
    { id: "out", name: "Voz saliente", desc: "Confirmaciones, seguimientos, recuperación de llamadas perdidas, nutrición de leads.", glyph: "📲", live: true },
    { id: "widget", name: "Widget en el sitio", desc: "Da clic al micrófono en tu propio sitio. Misma voz. Sin teléfono.", glyph: "◉", live: true },
    { id: "book", name: "Página pública de agenda", desc: "/book/tunombre — franja de 30 días, horarios reales, opción de escribir si no quieren hablar.", glyph: "▦", live: true },
    { id: "sms", name: "SMS (Twilio)", desc: "Mensajes salientes por tenant una vez que A2P 10DLC esté aprobado.", glyph: "✉", live: true },
    { id: "email", name: "Correo (Gmail OAuth)", desc: "Envío desde el buzón real del tenant, con su propia dirección.", glyph: "✉", live: true },
    { id: "wa", name: "WhatsApp", desc: "Cableado y esperando aprobación de Meta.", glyph: "◐", live: false },
  ];
  return (
    <section className="channels-section" id="how" data-screen-label="04 Channels">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Un cerebro, cada canal</div>
          <h2 className="h-section">
            Donde sea que un cliente te busque, <br/>
            <span style={{color: "var(--accent-hi)"}}>Orby ya está ahí.</span>
          </h2>
          <p>Tres canales de voz en vivo. Tres canales de mensajería en vivo. Un cerebro, un Business DNA, un CRM — para que el contexto nunca se pierda entre canales.</p>
        </div>

        <div className="channels-grid">
          {channels.map(c => (
            <div key={c.id} className={`channel-card ${!c.live ? "is-soon" : ""}`}>
              <div className="channel-head">
                <span className="channel-glyph">{c.glyph}</span>
                <span className="channel-name">{c.name}</span>
                {c.live ? <span className="badge-live">● EN VIVO</span> : <span className="badge-soon">PRONTO</span>}
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
              Un gemelo digital de <br/>
              <span style={{color: "var(--accent-hi)"}}>cómo TU negocio realmente opera.</span>
            </h2>
            <p style={{color: "var(--text-2)", fontSize: 18, lineHeight: 1.55, marginBottom: 32}}>
              La mayoría de los "agentes IA" son Agentes en blanco apuntados a un FAQ. Orby funciona porque cada tenant llena campos estructurados y versionados — no texto libre — que se inyectan en cada conversación. Identidad, servicios, precios, reglas de calificación de leads, políticas de escalación, reglas de reembolso, descargos legales. Editables como documentos. Versionados como código.
            </p>
            <ul className="dna-points">
              <li><span className="dna-bullet">→</span> <b>Versionado</b> — borrador → publicado → activo. Reversión si una edición sale mal.</li>
              <li><span className="dna-bullet">→</span> <b>Ensayado</b> — prueba al agente contra tu propio DNA antes de que hable con clientes.</li>
              <li><span className="dna-bullet">→</span> <b>Aplicado</b> — cada canal, cada llamada, cada campaña usa la misma fuente de verdad.</li>
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
    { id: "identity", label: "Identidad" },
    { id: "services", label: "Servicios" },
    { id: "pricing", label: "Precios" },
    { id: "appt", label: "Reglas de citas" },
    { id: "escalation", label: "Escalación" },
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
      ["cleanings", "$129 · 45 min · sin seguro requerido"],
      ["whitening", "$299 · 60 min"],
      ["emergency_visit", "mismo día · suma $75 de cargo"],
      ["root_canal", "$899-1400 · 90 min · aplica seguro"],
      ["pediatric", "[true] · desde 3 años"],
    ],
    pricing: [
      ["accepts_insurance", "[Aetna, Delta, BCBS, Cigna, Guardian]"],
      ["cash_discount", "5% si paga el mismo día"],
      ["payment_plans", "vía CareCredit"],
      ["no_show_fee", "$50 · sin cargo la primera vez"],
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
      ["legal_threat", "→ owner_voicemail · INMEDIATAMENTE"],
      ["medical_emergency", "→ \"llame al 911\" + SMS al dueño"],
      ["spanish_speaker", "→ continuar en es-LA · informal"],
      ["aggressive_caller", "→ desescalar · ofrecer llamada de humano"],
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
            <option value="v14">v14 (activa)</option>
            <option value="v13">v13</option>
            <option value="v12">v12</option>
            <option value="draft">v15 (borrador)</option>
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
          <span className="mono" style={{fontSize: 11, color: "var(--text-2)"}}>Activo en 7 agentes · 3 canales · 0 conflictos</span>
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
      verb: "agenda eventos reales en el calendario conectado",
      detail: "API de free/busy · reprograma · cancela · respeta buffers y horario laboral.",
      hot: "Conectado",
    },
    {
      name: "Gmail",
      glyph: "✉",
      verb: "envía correos de seguimiento desde el buzón del tenant",
      detail: "OAuth por tenant · no es un buzón compartido · reputación real de remitente.",
      hot: "Autorizado",
    },
    {
      name: "Stripe Connect",
      glyph: "💳",
      verb: "corre el ciclo de vida de suscripción + pagos a partners",
      detail: "Free · Basic · Pro · LTD · Premier · Enterprise + códigos de cortesía.",
      hot: "En vivo",
    },
    {
      name: "Twilio",
      glyph: "📞",
      verb: "es dueño de los números, llamadas, grabaciones y SMS",
      detail: "Entrante · saliente · A2P 10DLC · controles por número.",
      hot: "En vivo",
    },
  ];

  return (
    <section className="int-section" data-screen-label="06 Integrations">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Lo hace. No lo describe.</div>
          <h2 className="h-section">
            Orby no dice <span style={{fontStyle: "italic", color: "var(--text-3)"}}>"yo te lo agendaría."</span><br/>
            <span style={{color: "var(--accent-hi)"}}>Lo agenda.</span>
          </h2>
          <p>Llamadas API reales a los sistemas que tu negocio ya usa. Cada llamada termina con un resultado estructurado, resumen IA, transcripción con hablante etiquetado y una grabación que puedes escuchar.</p>
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
        Cada llamada termina con uno de estos →
      </div>
      <div className="outcome-tags">
        {outcomes.map(o => (
          <span key={o.tag} className="outcome-tag-chip" style={{['--oc']: o.c}}>
            <span className="oc-dot" />{o.tag}
          </span>
        ))}
        <span style={{color: "var(--text-3)", fontSize: 13, alignSelf: "center"}}>+ resumen IA, transcripción, grabación — siempre.</span>
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
      label: "Agendado",
      campaign: "Confirmación de cita",
      channels: [
        { ch: "Correo", t: "Confirmación enviada · 2s después de agendar" },
        { ch: "SMS",   t: "Recordatorio armado · 24h antes" },
        { ch: "SMS",   t: "Recordatorio armado · 1h antes" },
      ],
    },
    "missed-call": {
      label: "Llamada perdida",
      campaign: "Seguimiento de llamada perdida",
      channels: [
        { ch: "SMS",   t: "\"Perdona que no pudimos contestar — ¿agendamos?\" · 4 min" },
        { ch: "Voz",   t: "Reintento saliente de Orby · 1 hora" },
        { ch: "Correo", t: "Seguimiento si no contesta · al día siguiente" },
      ],
    },
    "qualified-lead": {
      label: "Lead calificado",
      campaign: "Nutrición de lead",
      channels: [
        { ch: "Correo", t: "Caso de estudio · día 1" },
        { ch: "SMS",   t: "Check-in suave · día 3" },
        { ch: "Voz",   t: "Llamada de calificación de Orby · día 7" },
      ],
    },
    "callback-requested": {
      label: "Devolución solicitada",
      campaign: "Seguimiento de devolución",
      channels: [
        { ch: "Voz",   t: "Saliente de Orby · a la hora solicitada" },
        { ch: "SMS",   t: "Confirmación de la ventana de devolución" },
      ],
    },
  };
  const active = tagFlows[activeTag];

  return (
    <section className="crm-section" data-screen-label="07 CRM & Campaigns">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Etiqueta → despliegue</div>
          <h2 className="h-section">
            Una etiqueta dispara <span style={{color: "var(--accent-hi)"}}>cada seguimiento</span>, en cada canal, en el orden correcto.
          </h2>
          <p>Cada llamada auto-etiqueta al contacto según el resultado. Las etiquetas disparan campañas. Las campañas se despliegan por canal con política de reintentos, sustitución de tokens (nombre, negocio, cita) y opt-outs por canal respetados automáticamente.</p>
        </div>

        <div className="crm-grid">
          <div className="crm-tags-panel">
            <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14}}>
              Da clic a una etiqueta →
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
              <div className="mono" style={{fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8}}>También rastreado por contacto</div>
              <div className="crm-fields">
                <span>cumpleaños</span><span>pareja</span><span>hijos</span><span>mascotas</span>
                <span>aniversario</span><span>horario preferido</span><span>cliente-desde</span><span>seguro</span>
                <span>vehículo</span><span>opt-outs</span>
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
              ✓ opt-outs respetados · ✓ tokens sustituidos · ✓ reintento al fallar
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
    { name: "Recepcionista en vivo", cost: "$4,200/mes", x: true },
    { name: "Herramienta de agenda (Calendly/Acuity)", cost: "$30/mes", x: true },
    { name: "Marketing por SMS (TextMagic/SimpleTexting)", cost: "$99/mes", x: true },
    { name: "Marketing por correo (Mailchimp/ActiveCampaign)", cost: "$149/mes", x: true },
    { name: "CRM básico (HubSpot Starter)", cost: "$50/mes", x: true },
    { name: "Servicio de recuperación de llamadas perdidas", cost: "$129/mes", x: true },
    { name: "Widget de chat para el sitio", cost: "$79/mes", x: true },
  ];
  const total = "$4,736/mes";
  return (
    <section className="replace-section" data-screen-label="08 Replaces">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">El stack que puedes despedir hoy</div>
          <h2 className="h-section">
            Cancela cinco suscripciones <br/>
            <span style={{color: "var(--accent-hi)"}}>y una vacante.</span>
          </h2>
          <p>Todos los demás te venden una pieza. La agenda no envía SMS. El SMS no agenda. El CRM no contesta el teléfono. Entonces unes seis herramientas a una recepcionista de medio tiempo y rezas que no se le caiga la pelota. <strong>Somos la única plataforma donde el mismo cerebro contesta la llamada, agenda el horario, manda la confirmación y persigue al que no se presentó — sin un segundo inicio de sesión.</strong></p>
        </div>

        <div className="replace-grid">
          <div className="replace-old">
            <div className="replace-head mono">Antes · lo que estás pagando hoy</div>
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
                <span className="replace-name">Total mensual</span>
                <span className="replace-cost" style={{color: "#FF7C7C", fontSize: 20}}>{total}</span>
              </li>
            </ul>
          </div>

          <div className="replace-new">
            <div className="replace-head mono" style={{color: "var(--accent-hi)"}}>Después · una plataforma</div>
            <div className="replace-new-card">
              <div className="brand-dot" style={{width: 56, height: 56, margin: "0 auto"}}/>
              <div style={{fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, marginTop: 18}}>MyOrbisVoice</div>
              <div style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.5, margin: "12px 0 24px", maxWidth: 360, textAlign: "center"}}>
                Recepcionista por voz + agenda + SMS + correo + CRM + recuperación de llamadas perdidas + widget del sitio — un cerebro, una cuenta, un Business DNA.
              </div>
              <div className="replace-new-price">
                <div className="rn-cost">desde $497<span>/mes</span></div>
                <a href="#cta" className="btn btn-cta">Ver precios →</a>
              </div>
            </div>
          </div>
        </div>

        <div className="not-list">
          <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 14}}>
            Y lo que NO somos (porque la honestidad vende mejor que el bombo)
          </div>
          <div className="not-grid">
            <div className="not-card">No somos un Agente genérico. Voz en tiempo real con Gemini Live, resultado estructurado en cada llamada.</div>
            <div className="not-card">No somos un CRM empresarial. Sin etapas de deal, sin kanban de pipeline, sin dashboards de sales ops.</div>
            <div className="not-card">No somos HubSpot. Hacemos campañas multicanal disparadas por etiquetas. No árboles de comportamiento con scoring de leads.</div>
            <div className="not-card">No somos Intercom. El agente contesta, pero no enviamos colas de tickets. Aún.</div>
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
   COMPARACIÓN — vs recepcionista / contestador / IA de voz empresarial
   ============================================================ */
function ComparisonSection() {
  const cols = ["Capacidad", "Contratar recepcionista", "Servicio genérico de contestación", "IA de voz empresarial", "MyOrbisVoice"];
  const rows = [
    ["Cobertura 24/7 incluyendo noches y fines de semana",
      { v: false }, { v: true }, { v: true }, { v: true, text: "Sí" }],
    ["Agenda citas reales en Google Calendar",
      { v: true }, { v: false }, { v: "warn", text: "Integración a la medida" }, { v: true, text: "Nativo, un clic" }],
    ["Campañas multicanal (teléfono + SMS + correo + WhatsApp)",
      { v: false }, { v: false }, { v: "warn", text: "Producto adicional" }, { v: true, text: "Por etiqueta, integrado" }],
    ["Latencia de voz sub-segundo (audio nativo de Orby)",
      { v: true }, { v: true }, { v: "warn", text: "Varía por proveedor" }, { v: true, text: "Siempre" }],
    ["Habla como tu negocio vía DNA de 5 capas",
      { v: true }, { v: false, text: "Lee de un script" }, { v: "warn", text: "Con consultores" }, { v: true, text: "Autoservicio, en español plano" }],
    ["En vivo en menos de una hora, sin desarrolladores",
      { v: false }, { v: true }, { v: false, text: "Implementación de 3 a 6 meses" }, { v: true, text: "Mediana de 20 minutos" }],
    ["Precio mensual transparente, sin contrato",
      { v: false, text: "~$40K/año en sueldo" }, { v: true }, { v: false, text: "Cotización" }, { v: true, text: "Desde $197/mes" }],
    ["Bilingüe EN/ES a la par (no traducción superpuesta)",
      { v: false, text: "Depende del contratado" }, { v: false, text: "Extra si acaso" }, { v: "warn", text: "Build a la medida" }, { v: true, text: "Integrado, desde el día uno" }],
    ["Recuerda al cliente entre llamadas (memoria entre sesiones)",
      { v: true, text: "La misma persona" }, { v: false }, { v: false, text: "Sin estado" }, { v: true, text: "Inyectado automático" }],
    ["Seguimiento multicanal automático según el resultado de la llamada",
      { v: false, text: "Manual" }, { v: false }, { v: "warn", text: "Producto adicional" }, { v: true, text: "Por etiqueta, campañas por defecto" }],
  ];

  const renderCell = (cell) => {
    if (typeof cell === "string") return cell;
    const icon = cell.v === true ? "✓" : cell.v === false ? "✕" : cell.v === "warn" ? "⚠" : "";
    const color = cell.v === true ? "var(--accent-hi)" : cell.v === false ? "var(--text-3)" : "#FFB341";
    return (
      <span style={{display: "inline-flex", alignItems: "center", gap: 8, color: color, fontWeight: cell.text ? 600 : 700}}>
        <span style={{fontFamily: "var(--font-display)", fontSize: 16, lineHeight: 1}}>{icon}</span>
        {cell.text && <span style={{fontWeight: 500}}>{cell.text}</span>}
      </span>
    );
  };

  return (
    <section className="compare-section" data-screen-label="09 Comparación">
      <div className="container">
        <div className="section-head" style={{textAlign: "center", margin: "0 auto 56px"}}>
          <div className="eyebrow" style={{justifyContent: "center", display: "flex"}}>Por qué MyOrbisVoice</div>
          <h2 className="h-section" style={{margin: "14px 0 18px"}}>
            Hecho para negocios pequeños de verdad.<br />
            <span style={{color: "var(--accent-hi)"}}>No para empresas que fingen servirlos.</span>
          </h2>
          <p style={{color: "var(--text-2)", margin: "0 auto", maxWidth: 680}}>
            El mercado de "recepcionistas IA" se divide entre Agentes de juguete y suites de call-center empresariales.
            Somos el punto medio práctico — valores por defecto de producción, configuración autoservicio, precios transparentes.
          </p>
        </div>

        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                {cols.map((c, i) => (
                  <th key={i} className={i === cols.length - 1 ? "compare-mine" : ""}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={ci === row.length - 1 ? "compare-mine" : ci === 0 ? "compare-cap" : ""}>
                      {ci === 0 ? cell : renderCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .compare-wrap {
          overflow-x: auto;
          border-radius: var(--r-lg);
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .compare-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          min-width: 720px;
        }
        .compare-table th,
        .compare-table td {
          padding: 16px 18px;
          text-align: left;
          vertical-align: top;
          border-bottom: 1px solid var(--border);
        }
        .compare-table thead th {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-3);
          background: var(--surface-2);
          font-weight: 600;
        }
        .compare-table .compare-mine {
          background: color-mix(in oklab, var(--brand) 14%, var(--surface));
          border-left: 1px solid color-mix(in oklab, var(--brand) 35%, var(--border));
          border-right: 1px solid color-mix(in oklab, var(--brand) 35%, var(--border));
        }
        .compare-table thead .compare-mine {
          background: color-mix(in oklab, var(--brand) 30%, var(--surface-2));
          color: var(--accent-hi);
          border-top: 1px solid color-mix(in oklab, var(--brand) 50%, var(--border));
          border-top-right-radius: var(--r-md);
          border-top-left-radius: var(--r-md);
        }
        .compare-table tbody tr:last-child td { border-bottom: none; }
        .compare-table tbody tr:last-child .compare-mine { border-bottom-right-radius: var(--r-md); border-bottom-left-radius: var(--r-md); }
        .compare-table .compare-cap {
          font-weight: 600;
          color: var(--text);
          font-family: var(--font-display);
          letter-spacing: -0.01em;
          font-size: 14px;
          max-width: 320px;
        }
        @media (max-width: 720px) {
          .compare-wrap { font-size: 13px; }
          .compare-table th, .compare-table td { padding: 12px 14px; }
        }
      `}</style>
    </section>
  );
}

/* ============================================================
   APPS — Dashboard navegador + Móvil (PWA) + Widget/WordPress
   ============================================================ */
function AppsSection() {
  return (
    <section className="apps-section" data-screen-label="10 Apps">
      <div className="container">
        <div className="section-head" style={{textAlign: "center", margin: "0 auto 56px"}}>
          <div className="eyebrow" style={{justifyContent: "center", display: "flex"}}>Usa Orby desde donde sea</div>
          <h2 className="h-section" style={{margin: "14px 0 18px"}}>
            Navegador. Bolsillo. Tu sitio.<br/>
            <span style={{color: "var(--accent-hi)"}}>Un solo Orby.</span>
          </h2>
          <p style={{color: "var(--text-2)", margin: "0 auto", maxWidth: 720}}>
            Un solo workspace, tres superficies. Dashboard en el navegador para la configuración profunda. App móvil para alertas en vivo. Widget + plugin de WordPress para soltar a Orby justo en el primer clic de tu cliente.
          </p>
        </div>

        <div className="apps-grid-3">
          {/* Dashboard navegador */}
          <div className="apps-card3">
            <div className="apps-mockup">
              <div className="browser-frame">
                <div className="br-chrome">
                  <span className="br-dot" /><span className="br-dot" /><span className="br-dot" />
                  <span className="br-url mono">app.myorbisvoice.com</span>
                </div>
                <div className="br-body">
                  <div className="br-sidebar">
                    <div className="br-side-item br-active">◎ Resumen</div>
                    <div className="br-side-item">▣ Citas</div>
                    <div className="br-side-item">✉ Campañas</div>
                    <div className="br-side-item">📞 Llamadas</div>
                    <div className="br-side-item">🧬 DNA</div>
                  </div>
                  <div className="br-main">
                    <div className="br-stat-row">
                      <div className="br-stat"><div className="br-stat-n">142</div><div className="br-stat-l mono">LLAMADAS</div></div>
                      <div className="br-stat"><div className="br-stat-n">68</div><div className="br-stat-l mono">AGENDADO</div></div>
                      <div className="br-stat"><div className="br-stat-n">$23k</div><div className="br-stat-l mono">ING</div></div>
                    </div>
                    <div className="br-rows">
                      <div className="br-row">
                        <div className="br-row-dot" style={{background: "#3FE3E3"}} />
                        <div className="br-row-name">María S.</div>
                        <div className="br-row-tag tag-booked">AGEND</div>
                      </div>
                      <div className="br-row">
                        <div className="br-row-dot" style={{background: "#FFB341"}} />
                        <div className="br-row-name">Jaime K.</div>
                        <div className="br-row-tag tag-callback">CB</div>
                      </div>
                      <div className="br-row">
                        <div className="br-row-dot" style={{background: "#9AE6B4"}} />
                        <div className="br-row-name">David L.</div>
                        <div className="br-row-tag tag-qualified">CAL</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="apps-meta">
              <div className="apps-card-eyebrow mono">Dashboard navegador</div>
              <h3 className="apps-card-title">Configura a fondo, ve todo.</h3>
              <p className="apps-card-sub">
                Donde vive el trabajo pesado: editor de Business DNA, motor de campañas multicanal, subida de base de conocimiento, portal de partners, registro de auditoría, cada grabación con transcripción y resumen IA.
              </p>
              <ul className="apps-card-list">
                <li>Editor de Business DNA (con versiones)</li>
                <li>Campañas por etiqueta</li>
                <li>Grabaciones + transcripciones + resumen IA</li>
                <li>CRM, portal de partners, auditoría</li>
              </ul>
              <div className="apps-card-cta">
                <a href="https://app.myorbisvoice.com/login" className="btn btn-ghost">Abrir dashboard →</a>
              </div>
            </div>
          </div>

          {/* Móvil PWA */}
          <div className="apps-card3">
            <div className="apps-mockup">
              <div className="phone-frame">
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="ph-statusbar">
                    <span className="ph-time">9:41</span>
                    <span className="ph-signals">●●● 5G</span>
                  </div>
                  <div className="ph-hero">
                    <div className="ph-orb" />
                    <div className="ph-hero-title">Orby</div>
                    <div className="ph-hero-sub mono">3 nuevos esta hora</div>
                  </div>
                  <div className="ph-cards">
                    <div className="ph-card">
                      <span className="ph-card-tag booked">AGENDADO</span>
                      <div className="ph-card-name">María S. — Dolor de muela</div>
                      <div className="ph-card-meta mono">2:15 PM · hoy</div>
                    </div>
                    <div className="ph-card">
                      <span className="ph-card-tag recovered">RECUPERADO</span>
                      <div className="ph-card-name">Jaime K. → saliente</div>
                      <div className="ph-card-meta mono">hace 2 min</div>
                    </div>
                    <div className="ph-card">
                      <span className="ph-card-tag dispatched">SMS ENV</span>
                      <div className="ph-card-name">17 recordatorios · 1h antes</div>
                      <div className="ph-card-meta mono">Mañana</div>
                    </div>
                  </div>
                  <div className="ph-tab">
                    <div className="ph-tab-item ph-tab-active">●</div>
                    <div className="ph-tab-item">▣</div>
                    <div className="ph-tab-item">✉</div>
                    <div className="ph-tab-item">⚙</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="apps-meta">
              <div className="apps-card-eyebrow mono">App móvil · PWA · añadir a inicio</div>
              <h3 className="apps-card-title">En vivo en tu bolsillo.</h3>
              <p className="apps-card-sub">
                Añade a la pantalla de inicio en iPhone y Android — sin pasar por la tienda de apps. Notificaciones push cuando una llamada agenda, llega un lead o se completa una campaña.
              </p>
              <ul className="apps-card-list">
                <li>Notificaciones de llamadas + citas en tiempo real</li>
                <li>Citas del día + llamadas perdidas</li>
                <li>Habla con Orby + última grabación en un toque</li>
                <li>Aprobar referidos de partners con un toque</li>
              </ul>
              <div className="apps-card-cta">
                <a href="/preview/" className="btn btn-ghost">Añadir a inicio →</a>
              </div>
            </div>
          </div>

          {/* Widget + WordPress */}
          <div className="apps-card3">
            <div className="apps-mockup">
              <div className="site-frame">
                <div className="site-chrome">
                  <span className="br-dot" /><span className="br-dot" /><span className="br-dot" />
                  <span className="br-url mono">tu-negocio.com</span>
                </div>
                <div className="site-body">
                  <div className="site-headline">Tu negocio</div>
                  <div className="site-skel"></div>
                  <div className="site-skel" style={{width: "70%"}}></div>
                  <div className="site-skel" style={{width: "85%"}}></div>
                  <div className="site-skel" style={{width: "60%"}}></div>
                  <div className="site-bubble">
                    <div className="bubble-orb" />
                    <div className="bubble-bod">
                      <div className="bubble-name">Habla con Orby</div>
                      <div className="bubble-sub mono">Siempre contesta</div>
                    </div>
                  </div>
                </div>
                <div className="site-snippet mono">
                  <span style={{color: "var(--text-3)"}}>{'<script src="'}</span>
                  <span style={{color: "var(--accent-hi)"}}>gateway.myorbisvoice.com/widget</span>
                  <span style={{color: "var(--text-3)"}}>{'"/>'}</span>
                </div>
              </div>
            </div>
            <div className="apps-meta">
              <div className="apps-card-eyebrow mono">Widget + plugin de WordPress</div>
              <h3 className="apps-card-title">Un clic en tu sitio.</h3>
              <p className="apps-card-sub">
                Suelta una sola línea de JavaScript en cualquier página — o instala el plugin de WordPress en un clic. El visitante toca el micrófono y tiene la misma conversación con Orby, sin necesidad de llamar.
              </p>
              <ul className="apps-card-list">
                <li>Incrustar en una línea en cualquier sitio</li>
                <li>Plugin de WordPress (descarga desde el dashboard)</li>
                <li>Botón flotante de micrófono, con tu marca</li>
                <li>Misma voz, mismo calendario, mismo CRM</li>
              </ul>
              <div className="apps-card-cta">
                <a href="https://app.myorbisvoice.com/signup" className="btn btn-ghost">Conseguir el código →</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .apps-grid-3 { display: grid; grid-template-columns: 1fr; gap: 28px; }
        @media (min-width: 1080px) { .apps-grid-3 { grid-template-columns: repeat(3, 1fr); gap: 24px; } }
        .apps-card3 { display: flex; flex-direction: column; padding: 28px; border: 1px solid var(--border); border-radius: var(--r-xl); background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 5%, var(--surface)), var(--surface) 60%); gap: 24px; }
        .apps-mockup { display: flex; align-items: center; justify-content: center; padding: 14px 0; min-height: 280px; }
        .apps-meta { display: flex; flex-direction: column; }
        .apps-card-eyebrow { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-hi); margin-bottom: 10px; }
        .apps-card-title { font-family: var(--font-display); font-weight: 700; font-size: 22px; letter-spacing: -0.02em; line-height: 1.1; color: var(--text); margin: 0 0 12px; }
        .apps-card-sub { color: var(--text-2); font-size: 13.5px; line-height: 1.55; margin: 0 0 14px; }
        .apps-card-list { list-style: none; padding: 0; margin: 0 0 22px; display: flex; flex-direction: column; gap: 7px; }
        .apps-card-list li { font-size: 13px; color: var(--text-2); padding-left: 20px; position: relative; }
        .apps-card-list li::before { content: "✓"; position: absolute; left: 0; top: 0; color: var(--accent-hi); font-weight: 700; font-family: var(--font-display); }
        .apps-card-cta { margin-top: auto; }

        .phone-frame { width: 200px; aspect-ratio: 9/19; background: #0a1518; border-radius: 28px; border: 6px solid #1F2A2A; box-shadow: 0 20px 50px -20px color-mix(in oklab, var(--brand) 50%, transparent); padding: 10px 8px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
        .phone-notch { width: 60px; height: 14px; background: #1F2A2A; border-radius: 0 0 8px 8px; position: absolute; top: 0; left: 50%; transform: translateX(-50%); z-index: 2; }
        .phone-screen { flex: 1; background: var(--canvas-0); border-radius: 18px; padding: 12px 10px 0; display: flex; flex-direction: column; overflow: hidden; }
        .ph-statusbar { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 8px; color: var(--text-3); padding: 0 2px 6px; }
        .ph-hero { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 0 10px; border-bottom: 1px solid var(--border); }
        .ph-orb { width: 32px; height: 32px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, var(--brand-hi), var(--brand) 55%, var(--brand-700) 100%); box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent), 0 0 16px color-mix(in oklab, var(--brand) 60%, transparent); }
        .ph-hero-title { font-family: var(--font-display); font-weight: 700; font-size: 13px; color: var(--text); }
        .ph-hero-sub { font-size: 8px; color: var(--accent-hi); letter-spacing: 0.14em; text-transform: uppercase; }
        .ph-cards { flex: 1; display: flex; flex-direction: column; gap: 5px; padding: 8px 0; overflow: hidden; }
        .ph-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
        .ph-card-tag { display: inline-block; padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.12em; color: #02181C; font-weight: 700; margin-bottom: 3px; }
        .ph-card-tag.booked { background: var(--brand-hi); }
        .ph-card-tag.recovered { background: #FF7C7C; }
        .ph-card-tag.dispatched { background: #7C9CFF; }
        .ph-card-name { font-size: 10px; font-weight: 600; color: var(--text); }
        .ph-card-meta { font-size: 8px; color: var(--text-3); margin-top: 2px; }
        .ph-tab { display: flex; justify-content: space-around; padding: 8px 0; border-top: 1px solid var(--border); background: var(--surface-2); margin: 0 -10px; }
        .ph-tab-item { font-size: 14px; color: var(--text-3); }
        .ph-tab-active { color: var(--accent-hi); }

        .browser-frame { width: 100%; max-width: 360px; background: var(--canvas-0); border-radius: 10px; border: 1px solid var(--border-strong); box-shadow: 0 20px 50px -20px color-mix(in oklab, var(--brand) 50%, transparent); overflow: hidden; }
        .br-chrome { display: flex; align-items: center; gap: 5px; padding: 7px 10px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
        .br-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border-strong); }
        .br-dot:nth-child(1) { background: #ff6b5b; }
        .br-dot:nth-child(2) { background: #ffb341; }
        .br-dot:nth-child(3) { background: #9AE6B4; }
        .br-url { flex: 1; font-size: 9px; color: var(--text-3); background: var(--surface); padding: 3px 8px; border-radius: 6px; margin-left: 6px; }
        .br-body { display: grid; grid-template-columns: 92px 1fr; min-height: 220px; }
        .br-sidebar { background: var(--surface-2); padding: 10px 6px; border-right: 1px solid var(--border); font-size: 9px; display: flex; flex-direction: column; gap: 3px; }
        .br-side-item { padding: 5px 7px; border-radius: 5px; color: var(--text-3); font-family: var(--font-mono); }
        .br-active { background: color-mix(in oklab, var(--brand) 14%, transparent); color: var(--accent-hi); }
        .br-main { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .br-stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .br-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 7px 8px; }
        .br-stat-n { font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--text); line-height: 1; }
        .br-stat-l { font-size: 7px; color: var(--text-3); margin-top: 3px; letter-spacing: 0.12em; }
        .br-rows { display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .br-row { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 8px; padding: 5px 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 10px; }
        .br-row-dot { width: 6px; height: 6px; border-radius: 50%; }
        .br-row-name { font-weight: 600; color: var(--text); }
        .br-row-tag { padding: 2px 5px; border-radius: 3px; font-family: var(--font-mono); font-size: 7px; letter-spacing: 0.12em; color: #02181C; font-weight: 700; }
        .tag-booked { background: var(--accent-hi); }
        .tag-callback { background: #FFB341; }
        .tag-qualified { background: #9AE6B4; }
        .tag-info { background: #7C9CFF; }

        .site-frame { width: 100%; max-width: 360px; background: #F4FAFA; border-radius: 10px; border: 1px solid var(--border-strong); box-shadow: 0 20px 50px -20px color-mix(in oklab, var(--brand) 50%, transparent); overflow: hidden; position: relative; }
        .site-chrome { display: flex; align-items: center; gap: 5px; padding: 7px 10px; background: #E6EEEE; border-bottom: 1px solid #D2DEDE; }
        .site-chrome .br-url { background: #FFFFFF; color: #4D5C5C; }
        .site-body { padding: 18px 16px 56px; min-height: 220px; position: relative; }
        .site-headline { font-family: var(--font-display); font-weight: 800; font-size: 16px; color: #1F2A2A; margin-bottom: 12px; }
        .site-skel { height: 6px; border-radius: 3px; background: #D2DEDE; margin-bottom: 8px; }
        .site-bubble { position: absolute; bottom: 14px; right: 14px; display: flex; align-items: center; gap: 8px; background: var(--brand); color: #02181C; padding: 8px 12px 8px 8px; border-radius: 999px; box-shadow: 0 8px 24px -6px color-mix(in oklab, var(--brand) 70%, transparent); }
        .bubble-orb { width: 22px; height: 22px; border-radius: 50%; background: radial-gradient(circle at 30% 30%, var(--brand-hi), var(--brand) 55%, var(--brand-800) 100%); box-shadow: 0 0 0 2px rgba(255,255,255,0.4); }
        .bubble-name { font-family: var(--font-display); font-weight: 700; font-size: 11px; }
        .bubble-sub { font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.7; }
        .site-snippet { padding: 7px 10px; background: #0a1518; color: var(--text-3); font-size: 9px; border-top: 1px solid #1F2A2A; overflow-x: auto; white-space: nowrap; }
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
            <div className="eyebrow">Base de conocimiento</div>
            <h3 className="h-section" style={{fontSize: 32, margin: "12px 0 14px"}}>
              Sube un PDF.<br/>
              Orby aprende tu negocio <span style={{color: "var(--accent-hi)"}}>para la hora de comer.</span>
            </h3>
            <p style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.55, marginBottom: 24}}>
              PDF · DOCX · XLSX · CSV · TXT · MD. Extraído, acotado para el presupuesto de contexto, inyectado en cada llamada. Política de garantía del techador → respuestas precisas sobre garantía. Lista de seguros del dentista → respuestas precisas sobre red de seguros. Sin cuello de botella humano.
            </p>
            <div className="kb-files">
              <FileChip name="garantia-2026.pdf" size="412 KB" status="indexed" />
              <FileChip name="seguros-aceptados.xlsx" size="38 KB" status="indexed" />
              <FileChip name="protocolos-emergencia.md" size="6 KB" status="indexed" />
              <FileChip name="precios-servicio.csv" size="24 KB" status="indexed" />
              <FileChip name="promo-2026-flyer.pdf" size="—" status="upload" />
            </div>
          </div>

          <div className="kb-card kb-card-memory">
            <div className="eyebrow">Memoria entre sesiones</div>
            <h3 className="h-section" style={{fontSize: 32, margin: "12px 0 14px"}}>
              "Hola Maria, <span style={{color: "var(--accent-hi)"}}>¿cómo está el perro?"</span>
            </h3>
            <p style={{color: "var(--text-2)", fontSize: 15, lineHeight: 1.55, marginBottom: 20}}>
              Los llamantes conocidos (match por caller-ID entrante, contactId saliente, búsqueda del widget) reciben una capa de Contexto del Cliente auto-inyectada: resúmenes previos, citas recientes, hechos de relación del CRM.
            </p>
            <div className="memory-card">
              <div className="memory-name">Maria Sanchez</div>
              <div className="memory-meta">Cliente desde Feb 2024 · 4 visitas · Aetna</div>
              <div className="memory-facts">
                <div><span>última visita</span> Limpieza · 14 de Feb, 2026</div>
                <div><span>mascotas</span> "Bandit" — Goldendoodle, 3 años</div>
                <div><span>idioma</span> ES preferido (tú informal)</div>
                <div><span>aniversario</span> 12 de Mayo</div>
              </div>
              <div className="memory-note mono">
                ⓘ Presupuesto de caracteres · referenciado naturalmente · nunca ofrecido sin pedirlo
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
      <span className="file-status mono">{status === "indexed" ? "✓ indexado" : "+ subir"}</span>
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
    { d: "2026-05-25", h: "Reestructura arquitectónica del agente Orby", b: "Meta de Enrutamiento de Especialistas · Handoff de un solo especialista · Transferencia directa · Tolerancia a mitad de flujo · Regla de propiedad de la acción. Todo entregado." },
    { d: "2026-05-23", h: "Media Center + Motor de Contenido Social", b: "13 ángulos · copy con gpt-4o-mini · fondos con gpt-image-1 · 10 composiciones Remotion · dashboard de QC. End-to-end en vivo." },
    { d: "2026-05-17", h: "Motor de leads (Fase 1)", b: "Búsqueda industria + ubicación vía Serper.dev → leads enriquecidos → CRM. Solo cold email por defecto." },
    { d: "2026-05-16", h: "Orby por partner · Bitácora central de llamadas · Monitor IA de conversación", b: "Cada partner tiene su propio Orby que contesta como su marca. Score de salud con código de color en cada llamada." },
    { d: "2026-05-13", h: "Página pública de agenda · recordatorios automáticos · memoria entre sesiones", b: "/book/<slug> · recordatorios de 24h + 1h armados automáticamente · llamantes recurrentes reconocidos entre sesiones." },
    { d: "2026-05-12", h: "PWA MyOrbisVoice Preview", b: "Preview móvil en myorbisresults.com/preview/." },
    { d: "2026-05-09", h: "Campos de relación CRM · campanita de notificaciones para partners · plugin de WordPress", b: "Cumpleaños · aniversario · mascotas · hijos. Más instalación del widget WP con un clic." },
  ];
  return (
    <section className="changelog-section" data-screen-label="10 Velocity Proof">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Velocidad > Vapor</div>
          <h2 className="h-section">
            Siete entregas mayores. <span style={{color: "var(--accent-hi)"}}>Últimos 30 días.</span>
          </h2>
          <p>No estás comprando una hoja de ruta. Estás comprando lo que ya está corriendo para tenants ahora mismo — y mejorando cada semana.</p>
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
      q: "¿Mis clientes van a saber que es una IA?",
      a: "Si preguntan, Orby les dice — no mentimos. Pero la gran mayoría no pregunta, porque la conversación fluye, la voz es cálida, y el agente sí completa la tarea. Vas a escuchar las grabaciones tú mismo y decides."
    },
    {
      q: "¿Qué pasa si Orby no puede manejar una llamada?",
      a: "Escalación configurable. Transferir a un humano, tomar un mensaje detallado + transcripción, agendar una devolución, o transferir a mitad de llamada a un miembro específico del equipo según intención. Tu Business DNA define las reglas."
    },
    {
      q: "¿Tengo que proporcionar el número de teléfono?",
      a: "No — compra un número Twilio directamente dentro de la plataforma. O porta tu número existente. Entrante, saliente y SMS se activan de forma independiente por número."
    },
    {
      q: "¿Cuánto tarda en estar en vivo?",
      a: "60 segundos para el widget del sitio. Mismo día para un número nuevo. 1–2 días para escribir tu Business DNA, ensayar a Orby y activar tu línea real."
    },
    {
      q: "Soporte en español — ¿en serio?",
      a: "Sí. Español latinoamericano, forma informal tú. Cada texto del dashboard, cada plantilla de correo, cada artículo de ayuda existe en ambos idiomas y se entrega junto. El idioma se guarda a nivel de usuario."
    },
    {
      q: "¿De verdad es una sola cuenta, o hay cargos por llamada?",
      a: "Tarifa mensual plana. Voz y SMS de Twilio se pasan a costo cuando se rebasan los límites del plan. Sin sorpresas de excedente del lado de la IA."
    },
  ];
  return (
    <section className="faq-section" data-screen-label="11 FAQ">
      <div className="container" style={{maxWidth: 880}}>
        <div className="section-head" style={{textAlign: "center", margin: "0 auto 56px"}}>
          <div className="eyebrow">Objeciones anticipadas</div>
          <h2 className="h-section">Preguntas que <span style={{color: "var(--accent-hi)"}}>estás a punto de escribir</span>.</h2>
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
          <div className="eyebrow" style={{justifyContent: "center", display: "flex"}}>La única llamada que vas a lamentar no haber hecho</div>
          <h2 className="h-display" style={{fontSize: "clamp(44px, 6vw, 88px)", margin: "18px auto 24px", maxWidth: 900, textAlign: "center"}}>
            Deja de leer. <br/>
            <span style={{color: "var(--accent-hi)", fontStyle: "italic"}}>Empieza a hablar.</span>
          </h2>
          <p style={{maxWidth: 640, margin: "0 auto 40px", color: "var(--text-2)", fontSize: 18, lineHeight: 1.55, textAlign: "center"}}>
            Cada minuto que pasaste leyendo esta página, tres clientes más cayeron en el buzón de otro. Toca abajo. Una conversación real con Orby se reproduce en tu navegador. Sin registro. Sin tarjeta. <strong>60 segundos para escuchar al único agente que agenda, hace seguimiento y cierra el ciclo en un solo lugar.</strong>
          </p>
          <div style={{display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap"}}>
            <a href="#orby-demo" className="btn btn-cta btn-cta-big">
              <span style={{fontSize: 22}}>🎙</span> ¡Habla con Orby AHORA!
            </a>
            <a href="https://app.myorbisvoice.com/signup" className="btn btn-signup btn-cta-big">
              ¡Regístrate AHORA! →
            </a>
            <a href="/pricing" className="btn btn-ghost btn-cta-big" style={{fontSize: 18}}>Ver precios →</a>
          </div>

          <div className="final-guarantee">
            <div className="guarantee-grid">
              <div><b>60s</b> en vivo · widget en cualquier sitio</div>
              <div><b>$0</b> de setup · sin tarjeta para empezar</div>
              <div><b>Tú eres dueño</b> de las grabaciones, transcripciones, calendario, contactos</div>
              <div><b>Cancela cuando quieras</b> · no encerramos tus datos</div>
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
              <img src="/assets/img/orbisvoice-logo-64.png" alt="" width="32" height="32" style={{borderRadius: 6, display: 'block'}} />
              <span>MyOrbisVoice</span>
            </div>
            <p style={{color: "var(--text-3)", fontSize: 13, marginTop: 14, maxWidth: 320, lineHeight: 1.5}}>
              Un sistema de agentes IA para pequeños negocios de servicio. Recepcionista por voz, agenda, seguimiento, CRM — una sola plataforma.
            </p>
            <div style={{marginTop: 20, color: "var(--text-3)", fontSize: 12}}>
              716 Washington St, Suite 2 · Allentown, PA 18102
            </div>
          </div>

          <div>
            <div className="footer-h mono">Producto</div>
            <ul><li>Funciones</li><li>Precios</li><li>Página de agenda</li><li>Plugin de WordPress</li><li>Integraciones</li></ul>
          </div>
          <div>
            <div className="footer-h mono">Para partners</div>
            <ul><li>Programa de partners</li><li>30% recurrente</li><li>Motor de leads</li><li>Kit de marketing</li><li>Herramienta de auditoría GBP</li></ul>
          </div>
          <div>
            <div className="footer-h mono">Familia</div>
            <ul><li>MyOrbisResults</li><li>MyOrbisLocal <span className="footer-soon">pronto</span></li><li>MyOrbisWeb <span className="footer-soon">pronto</span></li></ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>© 2026 MyOrbisVoice · Un producto de MyOrbisResults</div>
          <div className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>ES · EN próximamente en este sitio</div>
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
  CRMCampaignsSection, ReplaceSection, ComparisonSection, AppsSection, KnowledgeSection, ChangelogSection,
  FAQSection, FinalCTA, SiteFooter
});
