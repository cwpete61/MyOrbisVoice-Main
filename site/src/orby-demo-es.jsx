/* global React */
// Interactive Orby Live Demo
// - Click "Talk To Orby NOW!" → fake call starts
// - Animated waveform reacts to speaking state
// - Transcript streams in word-by-word, alternating Orby/Caller
// - Specialist routing badge changes mid-call
// - Outcome card appears at end

const { useState, useEffect, useRef, useMemo } = React;

const ORBY_SCRIPT = [
  { who: "orby", role: "Secretario", text: "Allentown Family Dental, habla Orby. ¿Cómo te puedo ayudar?" },
  { who: "caller", text: "Hola, me ha estado matando la muela todo el fin de semana. ¿Puedes meterme hoy?" },
  { who: "orby", role: "Citas", text: "Lamento que estés con dolor. Déjame revisar el calendario del Dr. Patel para hoy. Veo un espacio a las 2:15 PM. ¿Te funciona?" },
  { who: "caller", text: "Sí, 2:15 me funciona. Soy Maria Sanchez." },
  { who: "orby", role: "Citas", text: "Listo, Maria. Veo que estuviste en febrero para una limpieza. ¿Mismo seguro, Aetna?" },
  { who: "caller", text: "Sí, el mismo." },
  { who: "orby", role: "Citas", text: "Agendado. Te acabo de mandar la confirmación por SMS y correo. Te vemos a las 2:15. Que te mejores, Maria." }
];

const ROLE_COLORS = {
  Secretario:   "#7C9CFF",
  Citas:        "#3FE3E3",
  Ventas:       "#FFB341",
  "Servicio al cliente": "#FF7C7C",
  Marketing:    "#C77CFF",
  Asistente:    "#9AE6B4",
  Orchestrator: "#3FE3E3",
};

function Waveform({ active, intensity = 1 }) {
  const bars = 28;
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          style={{
            animationDuration: `${0.6 + (i % 5) * 0.12}s`,
            animationDelay: `${(i * 0.04) % 1}s`,
            opacity: active ? 1 : 0.25,
            transform: active ? undefined : "scaleY(0.15)",
            background: `linear-gradient(180deg, var(--accent-hi), var(--accent))`,
            ['--peak']: `${0.4 + (i % 7) / 10 * intensity}`,
          }}
        />
      ))}
    </div>
  );
}

function OrbyOrb({ state }) {
  // state: idle | ringing | listening | speaking | done
  return (
    <div className={`orb orb-${state}`}>
      <div className="orb-core" />
      <div className="orb-ring r1" />
      <div className="orb-ring r2" />
      <div className="orb-ring r3" />
    </div>
  );
}

function OrbyDemo() {
  const [state, setState] = useState("idle"); // idle | ringing | active | done
  const [turns, setTurns] = useState([]); // {who, role, text, partial?}
  const [currentRole, setCurrentRole] = useState("Secretario");
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);
  const stepIdxRef = useRef(0);
  const cancelRef = useRef(false);

  function reset() {
    cancelRef.current = true;
    clearInterval(timerRef.current);
    setTurns([]);
    setDuration(0);
    setCurrentRole("Secretario");
    setState("idle");
    stepIdxRef.current = 0;
  }

  async function start() {
    if (state !== "idle" && state !== "done") return;
    cancelRef.current = false;
    setTurns([]);
    setDuration(0);
    setState("ringing");
    await sleep(1200);
    if (cancelRef.current) return;
    setState("active");
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    for (let i = 0; i < ORBY_SCRIPT.length; i++) {
      if (cancelRef.current) return;
      const turn = ORBY_SCRIPT[i];
      if (turn.role) setCurrentRole(turn.role);
      // push empty turn, then stream words
      setTurns(t => [...t, { ...turn, partial: "" }]);
      const words = turn.text.split(" ");
      let acc = "";
      for (let w = 0; w < words.length; w++) {
        if (cancelRef.current) return;
        acc += (w ? " " : "") + words[w];
        setTurns(t => {
          const copy = [...t];
          copy[copy.length - 1] = { ...copy[copy.length - 1], partial: acc };
          return copy;
        });
        await sleep(40 + Math.random() * 80);
      }
      await sleep(turn.who === "orby" ? 500 : 300);
    }

    clearInterval(timerRef.current);
    setState("done");
  }

  useEffect(() => () => {
    cancelRef.current = true;
    clearInterval(timerRef.current);
  }, []);

  const currentSpeaker = turns.length ? turns[turns.length - 1].who : null;
  const orbState = state === "ringing" ? "ringing"
    : state === "active" ? (currentSpeaker === "orby" ? "speaking" : "listening")
    : state === "done" ? "done"
    : "idle";

  const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="orby-demo">
      <div className="orby-demo-head">
        <div className="orby-meta">
          <div className="status-dot" />
          <span className="mono" style={{fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-2)"}}>
            { state === "idle" ? "Orby en espera"
            : state === "ringing" ? "Llamada entrante · timbrando"
            : state === "active" ? `En vivo · ${fmtTime(duration)}`
            : `Llamada terminada · ${fmtTime(duration)}` }
          </span>
        </div>
        <div className="orby-caller">
          <span className="mono" style={{fontSize: 12, color: "var(--text-3)"}}>+1 (610) 555‑0144 · Allentown, PA</span>
        </div>
      </div>

      <div className="orby-stage">
        <div className="orby-orb-wrap">
          <OrbyOrb state={orbState} />
          <Waveform active={state === "active"} intensity={currentSpeaker === "orby" ? 1.2 : 0.7} />
        </div>

        {(state === "active" || state === "done") && (
          <div className="orby-role-pill" style={{['--pill']: ROLE_COLORS[currentRole]}}>
            <span className="dot" />
            <span className="mono">Agente {currentRole}</span>
          </div>
        )}
      </div>

      <div className="orby-transcript">
        {state === "idle" && (
          <div className="orby-empty">
            <div className="mono" style={{color: "var(--text-3)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase"}}>
              Sin llamada en progreso
            </div>
            <p style={{color: "var(--text-2)", margin: "8px 0 0", fontSize: 14}}>
              Toca el botón de abajo. Una conversación real de Orby se va a reproducir — el mismo motor que oirán tus clientes.
            </p>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`turn turn-${t.who}`}>
            <div className="turn-label mono">{t.who === "orby" ? `Orby · ${t.role}` : "Cliente"}</div>
            <div className="turn-text">{t.partial}{t.partial !== t.text && <span className="caret" />}</div>
          </div>
        ))}
        {state === "done" && (
          <div className="outcome-card fade-in">
            <div className="outcome-row">
              <div className="outcome-tag">BOOKED</div>
              <div className="mono outcome-time">{fmtTime(duration)} · 7 turnos</div>
            </div>
            <div className="outcome-grid">
              <div>
                <div className="outcome-k">Cliente</div>
                <div className="outcome-v">Maria Sanchez (recurrente)</div>
              </div>
              <div>
                <div className="outcome-k">Cita</div>
                <div className="outcome-v">Hoy · 2:15 PM · Dr. Patel</div>
              </div>
              <div>
                <div className="outcome-k">Auto-despachado</div>
                <div className="outcome-v">Confirmación SMS · Confirmación correo · Recordatorio 1h armado</div>
              </div>
              <div>
                <div className="outcome-k">CRM actualizado</div>
                <div className="outcome-v">Historial de visitas · Seguro: Aetna</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="orby-controls">
        {state === "idle" && (
          <button className="btn btn-cta btn-cta-big" onClick={start} id="talk-to-orby-cta">
            <span className="mic-glyph">🎙</span>
            ¡Habla con Orby AHORA!
          </button>
        )}
        {(state === "ringing" || state === "active") && (
          <button className="btn btn-ghost" onClick={reset}>
            <span style={{color: "#ff7c7c"}}>●</span> Terminar llamada
          </button>
        )}
        {state === "done" && (
          <div style={{display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center"}}>
            <button className="btn btn-cta" onClick={() => { reset(); setTimeout(start, 50); }}>
              ▶ Repetir
            </button>
            <button className="btn btn-ghost" onClick={reset}>Probar otro escenario →</button>
          </div>
        )}
      </div>

      <style>{`
        .orby-demo {
          background: linear-gradient(180deg,
            color-mix(in oklab, var(--brand) 6%, var(--surface)),
            var(--surface) 50%);
          border: 1px solid color-mix(in oklab, var(--brand) 22%, var(--border));
          border-radius: var(--r-xl);
          padding: 28px;
          position: relative;
          overflow: hidden;
          box-shadow:
            0 30px 80px -30px color-mix(in oklab, var(--brand) 60%, transparent),
            0 0 0 1px color-mix(in oklab, var(--brand-hi) 12%, transparent),
            inset 0 1px 0 color-mix(in oklab, var(--brand-hi) 12%, transparent);
        }
        .orby-demo::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: conic-gradient(from 0deg,
            transparent 0deg,
            color-mix(in oklab, var(--brand-hi) 40%, transparent) 30deg,
            transparent 60deg,
            transparent 180deg,
            color-mix(in oklab, var(--brand) 40%, transparent) 240deg,
            transparent 280deg);
          animation: rot 12s linear infinite;
          opacity: 0.5;
          z-index: -1;
          filter: blur(20px);
        }
        @keyframes rot { to { transform: rotate(360deg); } }

        .orby-demo-head {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 18px; border-bottom: 1px solid var(--border);
          gap: 16px; flex-wrap: wrap;
        }
        .orby-meta { display: flex; align-items: center; gap: 10px; }
        .orby-stage {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 18px;
          padding: 32px 0 18px;
          position: relative;
        }
        .orby-orb-wrap {
          display: flex; align-items: center; gap: 24px;
          width: 100%; justify-content: center;
        }
        .orby-role-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px;
          border-radius: var(--r-pill);
          background: color-mix(in oklab, var(--pill) 12%, var(--surface-2));
          border: 1px solid color-mix(in oklab, var(--pill) 35%, transparent);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--pill);
          transition: all 0.4s ease;
        }
        .orby-role-pill .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--pill);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--pill) 30%, transparent);
        }

        /* Orb */
        .orb {
          position: relative;
          width: 88px; height: 88px;
          flex-shrink: 0;
        }
        .orb-core {
          position: absolute; inset: 18px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, var(--brand-hi), var(--brand) 55%, var(--brand-800) 100%);
          box-shadow:
            inset 0 0 20px color-mix(in oklab, white 25%, transparent),
            0 0 40px color-mix(in oklab, var(--brand) 80%, transparent);
        }
        .orb-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 1px solid color-mix(in oklab, var(--brand-hi) 50%, transparent);
          opacity: 0;
        }
        .orb-speaking .orb-core { animation: corePulse 1.1s ease-in-out infinite; }
        .orb-listening .orb-core { animation: corePulse 1.8s ease-in-out infinite; filter: hue-rotate(-10deg) brightness(0.85); }
        .orb-ringing .orb-core { animation: corePulse 0.5s ease-in-out infinite; }
        .orb-speaking .orb-ring, .orb-ringing .orb-ring {
          animation: ringOut 1.6s ease-out infinite;
        }
        .orb-speaking .r2, .orb-ringing .r2 { animation-delay: 0.5s; }
        .orb-speaking .r3, .orb-ringing .r3 { animation-delay: 1s; }
        @keyframes corePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
        @keyframes ringOut {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2); opacity: 0; }
        }

        /* Waveform */
        .waveform {
          display: flex; align-items: center; gap: 3px;
          height: 60px;
          flex: 1;
          max-width: 360px;
        }
        .waveform span {
          flex: 1;
          height: 100%;
          border-radius: 4px;
          transform-origin: center;
          animation: wave 0.8s ease-in-out infinite alternate;
          opacity: 0.4;
          transition: opacity 0.3s, transform 0.3s;
        }
        @keyframes wave {
          0% { transform: scaleY(0.15); }
          100% { transform: scaleY(var(--peak, 0.8)); }
        }

        /* Transcript */
        .orby-transcript {
          min-height: 240px;
          max-height: 320px;
          overflow-y: auto;
          padding: 20px 4px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          scrollbar-width: thin;
          scrollbar-color: var(--border-strong) transparent;
        }
        .orby-transcript::-webkit-scrollbar { width: 6px; }
        .orby-transcript::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }

        .orby-empty {
          margin: auto;
          text-align: center;
          max-width: 360px;
          padding: 20px;
        }

        .turn {
          padding: 12px 16px;
          border-radius: var(--r-md);
          max-width: 88%;
          animation: turnIn 0.3s ease-out;
        }
        @keyframes turnIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .turn-orby {
          align-self: flex-start;
          background: color-mix(in oklab, var(--brand) 12%, var(--surface-2));
          border: 1px solid color-mix(in oklab, var(--brand) 25%, transparent);
        }
        .turn-caller {
          align-self: flex-end;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .turn-label {
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-3);
          margin-bottom: 4px;
        }
        .turn-orby .turn-label { color: var(--accent-hi); }
        .turn-text { font-size: 15px; line-height: 1.5; color: var(--text); }
        .caret {
          display: inline-block; width: 8px; height: 16px;
          background: var(--accent-hi); margin-left: 4px;
          vertical-align: -2px;
          animation: blink 0.7s steps(1) infinite;
        }
        @keyframes blink { 50% { opacity: 0; } }

        /* Outcome */
        .outcome-card {
          margin-top: 8px;
          padding: 20px;
          border-radius: var(--r-md);
          background: color-mix(in oklab, var(--brand) 8%, var(--surface-2));
          border: 1px solid color-mix(in oklab, var(--brand) 30%, var(--border));
        }
        .fade-in { animation: turnIn 0.5s ease-out; }
        .outcome-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .outcome-tag {
          display: inline-block;
          padding: 4px 10px;
          border-radius: var(--r-xs);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.16em;
          background: var(--brand);
          color: #02181C;
          font-weight: 700;
        }
        .outcome-time { font-size: 11px; color: var(--text-3); letter-spacing: 0.1em; }
        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px 24px;
        }
        @media (max-width: 520px) { .outcome-grid { grid-template-columns: 1fr; } }
        .outcome-k {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--text-3);
          margin-bottom: 3px;
        }
        .outcome-v { font-size: 14px; color: var(--text); line-height: 1.4; }

        .orby-controls {
          padding-top: 18px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: center;
        }
        .mic-glyph { font-size: 22px; line-height: 1; }
      `}</style>
    </div>
  );
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

window.OrbyDemo = OrbyDemo;
window.Waveform = Waveform;
