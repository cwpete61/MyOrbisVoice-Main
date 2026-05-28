/* global React, OrbyDemo */
const { useState, useEffect } = React;

function Hero({ variant }) {
  return (
    <section className="hero" data-screen-label="01 Hero">
      <div className="bg-aurora" />
      <div className="bg-grid" />

      <div className="container hero-inner">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span className="status-dot" />
            <span className="eyebrow">Orby · AI agent · live in 60 seconds</span>
          </div>

          <h1 className="h-display hero-h1">
            Don't believe <br />
            <span className="hero-h1-line2">what we say that <span className="hero-h1-accent">Orby</span> can do…</span>
          </h1>

          <p className="hero-sub">
            While you're reading this, a competitor just booked the customer who couldn't reach you.
            <strong>Orby is the only AI that answers in under a second, books on your real calendar, and chases the follow-up across SMS, email, and WhatsApp — from one platform, in English or Spanish.</strong>
            Everyone else sells you a piece. We're the only ones who close the loop.
          </p>

          <div className="hero-cta-row">
            <a href="#orby-demo" className="btn btn-cta btn-cta-big">
              <span className="mic-glyph">🎙</span> Talk To Orby NOW!
            </a>
            <a href="https://app.myorbisvoice.com/signup" className="btn btn-signup btn-cta-big">
              Signup NOW! →
            </a>
            <a href="#how" className="btn btn-ghost">See how it works ↓</a>
          </div>

          <div className="hero-trust">
            <div className="trust-stat">
              <div className="trust-n">40%</div>
              <div className="trust-l">of inbound calls<br/>go unanswered industry-wide</div>
            </div>
            <div className="trust-divider" />
            <div className="trust-stat">
              <div className="trust-n">$1,491</div>
              <div className="trust-l">monthly cost of the<br/>4–6 tools we replace</div>
            </div>
            <div className="trust-divider" />
            <div className="trust-stat">
              <div className="trust-n">7</div>
              <div className="trust-l">specialist agents,<br/>one voice, zero handoffs</div>
            </div>
          </div>
        </div>

        <div className="hero-stage" id="orby-demo">
          {variant === "split" ? <HeroSplit /> : <OrbyDemo />}
          <FloatingCard className="float-1" delay="0s">
            <div className="float-card-tag">BOOKED</div>
            <div className="float-card-body">
              <div className="float-card-name">Maria S. — Toothache</div>
              <div className="float-card-meta mono">Today · 2:15 PM</div>
            </div>
          </FloatingCard>
          <FloatingCard className="float-2" delay="1.2s">
            <div className="float-card-tag" style={{background: "#FF7C7C"}}>RECOVERED</div>
            <div className="float-card-body">
              <div className="float-card-name">James K. → outbound in 4 min</div>
              <div className="float-card-meta mono">SMS + Voice fallback</div>
            </div>
          </FloatingCard>
          <FloatingCard className="float-3" delay="2.4s">
            <div className="float-card-tag" style={{background: "#7C9CFF"}}>SMS DISPATCHED</div>
            <div className="float-card-body">
              <div className="float-card-name">17 reminders · 1h before</div>
              <div className="float-card-meta mono">Tomorrow's schedule</div>
            </div>
          </FloatingCard>
        </div>
      </div>

      <LogoStrip />

      <style>{`
        .hero {
          padding: 48px 0 80px;
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 1080px) {
          .hero { padding: 64px 0 120px; }
        }
        .hero-inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr;
          gap: 56px;
          align-items: center;
        }
        @media (min-width: 1080px) {
          .hero-inner { grid-template-columns: 1.05fr 1fr; gap: 48px; }
        }

        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 6px 14px;
          border-radius: var(--r-pill);
          background: color-mix(in oklab, var(--brand) 10%, var(--surface));
          border: 1px solid color-mix(in oklab, var(--brand) 25%, var(--border));
          margin-bottom: 28px;
        }

        .hero-h1 {
          font-size: 96px;
          margin: 0;
          text-wrap: balance;
          line-height: 0.93;
          padding-bottom: 0.08em;
        }
        .hero-h1-line2 {
          color: var(--text);
          line-height: 0.93;
        }
        .hero-h1-accent {
          background: linear-gradient(120deg, var(--accent-hi), var(--accent) 60%, var(--brand-200));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          position: relative;
          z-index: 2;
          display: inline-block;
          padding-bottom: 0.18em;
          margin-bottom: -0.18em;
          margin-right: 0;
          line-height: 0.83;
        }
        .hero-sub {
          font-size: clamp(17px, 1.5vw, 21px);
          color: var(--text-2);
          line-height: 1.55;
          max-width: 560px;
          margin: 24px 0 36px;
          text-wrap: pretty;
        }
        .hero-sub strong { color: var(--text); font-weight: 600; }

        .hero-cta-row {
          display: flex; gap: 14px; flex-wrap: wrap;
          align-items: center;
          margin-bottom: 48px;
        }

        .hero-trust {
          display: flex;
          align-items: stretch;
          gap: 20px;
          padding-top: 32px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .trust-stat { min-width: 110px; }
        .trust-n {
          font-family: var(--font-display);
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--accent-hi);
          line-height: 1;
        }
        .trust-l {
          font-size: 12px;
          color: var(--text-3);
          line-height: 1.45;
          margin-top: 6px;
        }
        .trust-divider { width: 1px; background: var(--border); }

        /* Stage / floating cards */
        .hero-stage { position: relative; }
        .float-card {
          position: absolute;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: var(--r-md);
          padding: 12px 14px;
          box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
          min-width: 200px;
          z-index: 2;
          animation: floatIn 0.8s cubic-bezier(.2,.8,.2,1) backwards, hover 6s ease-in-out infinite;
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes hover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .float-1 { top: -8px; right: -16px; }
        .float-2 { top: 38%; left: -36px; }
        .float-3 { bottom: -28px; left: -16px; }
        @media (max-width: 1080px) {
          .float-1, .float-2, .float-3 { display: none; }
        }
        .float-card-tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--r-xs);
          background: var(--brand);
          color: #02181C;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .float-card-name { font-size: 13px; font-weight: 600; }
        .float-card-meta { font-size: 11px; color: var(--text-3); margin-top: 2px; }
      `}</style>
    </section>
  );
}

function FloatingCard({ className, delay, children }) {
  return (
    <div className={`float-card ${className || ""}`} style={{ animationDelay: delay }}>
      {children}
    </div>
  );
}

function HeroSplit() {
  const [phase, setPhase] = useState(0); // 0 ringing, 1 answered, 2 booked
  useEffect(() => {
    const seq = [
      [0, 1500], [1, 3500], [2, 5500]
    ];
    const timers = seq.map(([p, t]) => setTimeout(() => setPhase(p), t));
    const loop = setInterval(() => {
      setPhase(0);
      setTimeout(() => setPhase(1), 1500);
      setTimeout(() => setPhase(2), 3500);
    }, 7000);
    return () => { timers.forEach(clearTimeout); clearInterval(loop); };
  }, []);

  return (
    <div className="hero-split">
      <div className="hs-side hs-before">
        <div className="hs-label mono">Before Orby</div>
        <div className={`phone-card ${phase === 0 ? "ringing" : "missed"}`}>
          <div className="phone-screen">
            <div className="phone-time">11:47 PM</div>
            <div className="phone-status">{phase === 0 ? "Incoming call…" : "Missed Call · 3rd this week"}</div>
            <div className="phone-name">+1 (610) 555‑0144</div>
            <div className="phone-glyph">{phase === 0 ? "📞" : "📵"}</div>
            <div className="phone-vm">Voicemail not set up</div>
          </div>
        </div>
        <div className="hs-loss">
          <span className="hs-loss-n">$340</span>
          <span className="hs-loss-l">avg lost per missed call</span>
        </div>
      </div>

      <div className="hs-divider"><span>→</span></div>

      <div className="hs-side hs-after">
        <div className="hs-label mono" style={{color: "var(--accent-hi)"}}>With Orby</div>
        <div className="orby-card">
          <div className="orby-card-head">
            <div className="brand-dot" style={{width: 32, height: 32}} />
            <div>
              <div style={{fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15}}>Orby</div>
              <div className="mono" style={{fontSize: 10, color: "var(--text-3)", letterSpacing: "0.12em", textTransform: "uppercase"}}>{phase >= 1 ? "Active · Appointment agent" : "Standing by"}</div>
            </div>
          </div>
          <div className="orby-card-body">
            {phase === 0 && <Line>Ring detected — picking up on second ring…</Line>}
            {phase >= 1 && (
              <>
                <Line who="orby">"Allentown Family Dental, this is Orby."</Line>
                <Line who="caller">"My tooth is killing me, can I get in?"</Line>
                <Line who="orby">"Today at 2:15. Booked. Confirmation sent."</Line>
              </>
            )}
          </div>
          {phase >= 2 && (
            <div className="orby-card-result">
              <span className="tag-booked">✓ BOOKED</span>
              <span className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>22s · Maria S. · 2:15 PM</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .hero-split {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 18px;
          padding: 28px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          align-items: stretch;
          min-height: 480px;
        }
        @media (max-width: 720px) {
          .hero-split { grid-template-columns: 1fr; }
          .hs-divider { display: none; }
        }
        .hs-side { display: flex; flex-direction: column; gap: 14px; }
        .hs-label {
          font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--text-3);
        }
        .phone-card {
          flex: 1;
          background: #0a1518;
          border-radius: var(--r-lg);
          padding: 24px;
          border: 1px solid var(--n800);
          position: relative;
          transition: all 0.6s;
        }
        .phone-card.ringing {
          animation: ring 0.8s ease-in-out infinite;
          border-color: color-mix(in oklab, #FF7C7C 50%, var(--border));
        }
        @keyframes ring {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(-2deg); }
          75% { transform: rotate(2deg); }
        }
        .phone-screen {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 18px 0;
        }
        .phone-time { font-size: 12px; color: var(--text-3); margin-bottom: 16px; }
        .phone-status { font-size: 13px; color: #FF7C7C; font-weight: 600; }
        .phone-name { font-family: var(--font-display); font-size: 22px; font-weight: 700; }
        .phone-glyph { font-size: 64px; margin: 16px 0; }
        .phone-vm { font-size: 11px; color: var(--text-3); }
        .hs-loss {
          background: color-mix(in oklab, #FF7C7C 8%, var(--surface-2));
          border: 1px solid color-mix(in oklab, #FF7C7C 25%, var(--border));
          border-radius: var(--r-md);
          padding: 12px;
          display: flex; flex-direction: column; align-items: center;
        }
        .hs-loss-n { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: #FF7C7C; }
        .hs-loss-l { font-size: 11px; color: var(--text-3); }

        .hs-divider {
          display: flex; align-items: center; justify-content: center;
          color: var(--accent-hi); font-size: 24px; font-family: var(--font-display); font-weight: 800;
        }

        .orby-card {
          flex: 1;
          background: linear-gradient(160deg, color-mix(in oklab, var(--brand) 12%, var(--surface-2)), var(--surface-2));
          border: 1px solid color-mix(in oklab, var(--brand) 30%, var(--border));
          border-radius: var(--r-lg);
          padding: 20px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .orby-card-head { display: flex; align-items: center; gap: 12px; }
        .orby-card-body { display: flex; flex-direction: column; gap: 10px; }
        .orby-card-result {
          margin-top: auto;
          display: flex; justify-content: space-between; align-items: center;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .tag-booked {
          padding: 4px 10px; border-radius: var(--r-xs);
          background: var(--brand); color: #02181C;
          font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.14em; font-weight: 700;
        }
      `}</style>
    </div>
  );
}

function Line({ who, children }) {
  return (
    <div className={`hs-line hs-line-${who || "sys"}`}>
      {who && <span className="hs-line-tag">{who === "orby" ? "Orby" : "Caller"}</span>}
      {children}
      <style>{`
        .hs-line { font-size: 13px; line-height: 1.5; padding: 8px 12px; border-radius: var(--r-sm); }
        .hs-line-orby { background: color-mix(in oklab, var(--brand) 18%, transparent); color: var(--text); }
        .hs-line-caller { background: var(--surface); color: var(--text-2); align-self: flex-end; }
        .hs-line-sys { color: var(--text-3); font-style: italic; font-size: 12px; }
        .hs-line-tag { display: block; font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-3); margin-bottom: 3px; }
      `}</style>
    </div>
  );
}

function LogoStrip() {
  // Brand marks self-hosted at /assets/img/integrations/<slug>.svg, sourced
  // from simple-icons (CC0) and pre-tinted to brand teal at build time.
  // For brands simple-icons doesn't ship (Twilio, OpenAI, Bunny CDN, Reoon
  // — either omitted by simple-icons or not in their catalog), render a
  // letter-mark monogram so the chip still has a visual anchor.
  const items = [
    { name: "Google Calendar", slug: "googlecalendar" },
    { name: "Gmail",           slug: "gmail" },
    { name: "Stripe Connect",  slug: "stripe" },
    { name: "Twilio",          letter: "T" },
    { name: "Gemini Live",     slug: "googlegemini" },
    { name: "OpenAI",          letter: "O" },
    { name: "WhatsApp",        slug: "whatsapp" },
    { name: "WordPress",       slug: "wordpress" },
    { name: "Bunny CDN",       letter: "B" },
    { name: "Reoon",           letter: "R" },
  ];
  return (
    <div className="container" style={{marginTop: 80}}>
      <div className="logo-strip-label mono">
        <span className="eyebrow">Live integrations · doing real work today</span>
      </div>
      <div className="marquee" style={{marginTop: 18}}>
        <div className="marquee-track">
          {[...items, ...items].map((item, i) => (
            <div key={i} className="logo-chip">
              {item.slug
                ? <img className="logo-mark" src={`assets/img/integrations/${item.slug}.svg`} alt="" aria-hidden="true" />
                : <span className="logo-letter">{item.letter}</span>}
              <span>{item.name}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        .logo-strip-label { text-align: center; opacity: 0.8; }
        .logo-chip {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 17px;
          color: var(--text-2);
          opacity: 0.75;
          white-space: nowrap;
        }
        .logo-mark {
          width: 22px; height: 22px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .logo-letter {
          width: 22px; height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: color-mix(in oklab, var(--brand) 18%, transparent);
          border: 1px solid color-mix(in oklab, var(--brand) 40%, transparent);
          color: var(--brand-hi);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 12px;
          line-height: 1;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}

window.Hero = Hero;
window.HeroSplit = HeroSplit;
