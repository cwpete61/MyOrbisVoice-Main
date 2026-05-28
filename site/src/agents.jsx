/* global React */
const { useState, useEffect, useRef } = React;

const AGENTS = [
  { id: "orch", name: "Orchestrator", role: "Routes mid-call to the right specialist", color: "#3FE3E3", glyph: "◎" },
  { id: "secy", name: "Secretary", role: "Picks up, takes messages, handles after-hours", color: "#7C9CFF", glyph: "✉" },
  { id: "appt", name: "Appointment", role: "Books, reschedules, cancels on your calendar", color: "#3FE3E3", glyph: "▣" },
  { id: "sales", name: "Sales", role: "Qualifies leads, pulls live pricing from DNA", color: "#FFB341", glyph: "$" },
  { id: "cs", name: "Customer Service", role: "Resolves issues, escalates by your rules", color: "#FF7C7C", glyph: "?" },
  { id: "mkt", name: "Marketing", role: "Nurtures, dispatches multi-channel campaigns", color: "#C77CFF", glyph: "✦" },
  { id: "asst", name: "Assistant", role: "Catch-all for unrouted intent", color: "#9AE6B4", glyph: "•" },
];

const HANDOFF_SCENE = [
  { who: "caller", text: "Hi, I'm calling about your service plans." },
  { who: "agent", id: "secy", text: "Sure, let me get you to the right person." },
  { route: "secy", to: "sales" },
  { who: "agent", id: "sales", text: "We have three tiers, starting at $497/mo. What's your business?" },
  { who: "caller", text: "Roofing. Actually — can you also book me for next Tuesday?" },
  { route: "sales", to: "appt" },
  { who: "agent", id: "appt", text: "Tuesday at 10 AM works. Confirming now." },
];

function AgentSystem() {
  const [activeId, setActiveId] = useState("orch");
  const [routes, setRoutes] = useState([]); // [{from,to,t}]
  const [transcript, setTranscript] = useState([]);
  const [step, setStep] = useState(0);
  const intervalRef = useRef(null);
  const stepRef = useRef(0);

  useEffect(() => {
    function tick() {
      const i = stepRef.current % HANDOFF_SCENE.length;
      const s = HANDOFF_SCENE[i];
      if (s.route) {
        setActiveId(s.to);
        setRoutes(r => [...r.slice(-2), { from: s.route, to: s.to, t: Date.now() }]);
      } else {
        setTranscript(t => {
          const next = [...t, s];
          return next.slice(-6);
        });
        if (s.who === "agent") setActiveId(s.id);
      }
      stepRef.current += 1;
      if (stepRef.current % HANDOFF_SCENE.length === 0) {
        setTimeout(() => {
          setTranscript([]);
          setRoutes([]);
          setActiveId("orch");
        }, 2500);
      }
    }
    intervalRef.current = setInterval(tick, 2200);
    tick();
    return () => clearInterval(intervalRef.current);
  }, []);

  // hexagon orbit layout
  const positions = AGENTS.map((a, i) => {
    if (a.id === "orch") return { x: 50, y: 50 };
    const angle = ((i - 1) / 6) * Math.PI * 2 - Math.PI / 2;
    const r = 38;
    return {
      x: 50 + Math.cos(angle) * r,
      y: 50 + Math.sin(angle) * r,
    };
  });

  return (
    <section className="agents-section" data-screen-label="03 Seven Agents">
      <div className="bg-aurora" style={{opacity: 0.4}} />
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">The differentiator</div>
          <h2 className="h-section">
            Orby isn't just one Agent. <br/>
            <span style={{color: "var(--accent-hi)"}}>It's seven specialist agents</span> wearing one voice.
          </h2>
          <p>
            Behind a single warm hello, an Orchestrator hands the caller mid-conversation to the right specialist —
            Secretary, Appointment, Sales, Service, Marketing, Assistant. The caller never hears the handoff. You never staff seven seats.
          </p>
        </div>

        <div className="agent-stage">
          <div className="agent-orbit" aria-hidden="true">
            <svg className="orbit-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3FE3E3" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#3FE3E3" stopOpacity="0"/>
                </radialGradient>
              </defs>
              <circle cx="50" cy="50" r="40" fill="url(#centerGrad)"/>
              <circle cx="50" cy="50" r="38" fill="none" stroke="#3FE3E3" strokeOpacity="0.15" strokeDasharray="0.4 0.6"/>
              {AGENTS.slice(1).map((a, i) => {
                const p = positions[i+1];
                return (
                  <line key={a.id}
                    x1="50" y1="50" x2={p.x} y2={p.y}
                    stroke={activeId === a.id ? a.color : "currentColor"}
                    strokeOpacity={activeId === a.id ? 0.6 : 0.1}
                    strokeWidth="0.25"
                    style={{transition: "all 0.4s"}}
                  />
                );
              })}
              {routes.map((r, i) => {
                const from = positions[AGENTS.findIndex(a => a.id === r.from)];
                const to = positions[AGENTS.findIndex(a => a.id === r.to)];
                return (
                  <line key={r.t + "-" + i}
                    x1={from.x} y1={from.y}
                    x2={to.x} y2={to.y}
                    stroke="#3FE3E3"
                    strokeWidth="0.5"
                    strokeDasharray="1 1"
                    className="route-line"
                  />
                );
              })}
            </svg>
            {AGENTS.map((a, i) => {
              const p = positions[i];
              const active = activeId === a.id;
              return (
                <div
                  key={a.id}
                  className={`agent-node ${active ? "active" : ""} ${a.id === "orch" ? "agent-orch" : ""}`}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    ['--ac']: a.color,
                  }}
                >
                  <div className="agent-dot">
                    <span className="agent-glyph">{a.glyph}</span>
                  </div>
                  <div className="agent-name">{a.name}</div>
                </div>
              );
            })}
          </div>

          <div className="agent-panel">
            <div className="ap-head">
              <div className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-3)"}}>
                Live handoff · same caller · zero hold
              </div>
            </div>
            <div className="ap-transcript">
              {transcript.length === 0 && (
                <div style={{textAlign: "center", padding: 40, color: "var(--text-3)", fontSize: 13}}>
                  Listening for routing signals…
                </div>
              )}
              {transcript.map((t, i) => {
                if (t.who === "caller") {
                  return <div key={i} className="ap-line ap-line-caller">{t.text}</div>;
                }
                const agent = AGENTS.find(a => a.id === t.id);
                return (
                  <div key={i} className="ap-line ap-line-agent">
                    <span className="ap-line-from" style={{color: agent.color}}>{agent.name}</span>
                    {t.text}
                  </div>
                );
              })}
            </div>
            <div className="ap-foot">
              <span className="mono" style={{fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-3)"}}>
                Gemini Live · single runtime · 7 prompt overlays
              </span>
            </div>
          </div>
        </div>

        <div className="agent-grid">
          {AGENTS.map(a => (
            <div key={a.id} className={`agent-card ${activeId === a.id ? "is-active" : ""}`} style={{['--ac']: a.color}}>
              <div className="agent-card-head">
                <span className="agent-card-glyph">{a.glyph}</span>
                <span className="agent-card-name">{a.name}</span>
              </div>
              <div className="agent-card-role">{a.role}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .agents-section { position: relative; overflow: hidden; }

        .agent-stage {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          align-items: stretch;
          margin-bottom: 56px;
        }
        @media (min-width: 960px) {
          .agent-stage { grid-template-columns: 1.1fr 1fr; gap: 48px; }
        }

        .agent-orbit {
          position: relative;
          aspect-ratio: 1;
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
        }
        .orbit-svg {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          color: var(--border-strong);
        }
        .route-line {
          stroke-dashoffset: 0;
          animation: dashFlow 1.6s linear infinite, fadeRoute 2.4s ease-out forwards;
        }
        @keyframes dashFlow { to { stroke-dashoffset: -10; } }
        @keyframes fadeRoute {
          0%, 60% { opacity: 1; }
          100% { opacity: 0; }
        }

        .agent-node {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          transition: transform 0.4s cubic-bezier(.2,.8,.2,1);
          z-index: 2;
        }
        .agent-dot {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--text-3);
          transition: all 0.4s cubic-bezier(.2,.8,.2,1);
          box-shadow: 0 8px 24px -8px rgba(0,0,0,0.4);
        }
        .agent-orch .agent-dot {
          width: 80px; height: 80px; font-size: 28px;
          background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 20%, var(--surface)), var(--surface));
          border-color: color-mix(in oklab, var(--brand-hi) 40%, var(--border));
          color: var(--accent-hi);
        }
        .agent-node.active .agent-dot {
          background: var(--ac);
          color: #02181C;
          border-color: var(--ac);
          box-shadow: 0 0 0 6px color-mix(in oklab, var(--ac) 18%, transparent), 0 12px 28px -6px color-mix(in oklab, var(--ac) 60%, transparent);
          transform: scale(1.1);
        }
        .agent-node.active .agent-name {
          color: var(--ac);
        }
        .agent-name {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-3);
          white-space: nowrap;
          transition: color 0.3s;
        }

        .agent-panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          display: flex; flex-direction: column;
          min-height: 320px;
        }
        .ap-head { padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 14px; }
        .ap-transcript { flex: 1; display: flex; flex-direction: column; gap: 10px; min-height: 200px; }
        .ap-line {
          font-size: 14px; line-height: 1.4;
          padding: 10px 12px;
          border-radius: var(--r-sm);
          animation: turnIn 0.3s ease-out;
          max-width: 92%;
        }
        @keyframes turnIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .ap-line-caller {
          background: var(--surface-2);
          align-self: flex-end;
          color: var(--text-2);
        }
        .ap-line-agent {
          background: color-mix(in oklab, var(--brand) 8%, var(--surface-2));
          border: 1px solid var(--border);
        }
        .ap-line-from {
          display: block;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .ap-foot {
          padding-top: 14px;
          border-top: 1px solid var(--border);
          margin-top: 14px;
        }

        .agent-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .agent-card {
          padding: 18px;
          border-radius: var(--r-md);
          background: var(--surface);
          border: 1px solid var(--border);
          transition: all 0.3s;
        }
        .agent-card.is-active {
          border-color: var(--ac);
          background: color-mix(in oklab, var(--ac) 6%, var(--surface));
          transform: translateY(-2px);
        }
        .agent-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .agent-card-glyph {
          width: 28px; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: color-mix(in oklab, var(--ac) 15%, transparent);
          color: var(--ac);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
        }
        .agent-card-name {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 15px;
        }
        .agent-card-role {
          font-size: 13px;
          color: var(--text-2);
          line-height: 1.45;
        }
      `}</style>
    </section>
  );
}

window.AgentSystem = AgentSystem;
