/* global React, ReactDOM,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakToggle, TweakColor, TweakSelect,
   Hero, AgentSystem,
   ProblemSection, ChannelsSection, DNASection, IntegrationsSection,
   CRMCampaignsSection, ReplaceSection, ComparisonSection, KnowledgeSection, AppsSection, ChangelogSection,
   FAQSection, FinalCTA, SiteFooter
*/
const { useEffect, useState } = React;

// Read persisted theme (user-toggle wins over TWEAK_DEFAULTS); fall back to dark.
function readStoredTheme() {
  try {
    const v = localStorage.getItem("orby-theme");
    if (v === "light" || v === "dark") return v;
  } catch (e) {}
  return null;
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "hero_variant": "demo",
  "theme": "dark",
  "accent": "#15A8A8",
  "show_floats": true
}/*EDITMODE-END*/;

const ACCENT_PRESETS = {
  "#15A8A8": "#3FE3E3", // brand teal (default)
  "#5B7CFF": "#9EB2FF", // electric blue
  "#FF6B5B": "#FFB098", // sunset coral
  "#9D6BFF": "#C9A8FF", // violet
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // User-facing theme toggle (TopNav). Stored separately from TweaksPanel so
  // the visitor preference persists across reloads and wins over the tweak.
  const [theme, setTheme] = useState(() => readStoredTheme() || t.theme);

  // Apply theme + accent to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    const accent = t.accent || "#15A8A8";
    const accentHi = ACCENT_PRESETS[accent] || "#3FE3E3";
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-hi", accentHi);
    root.style.setProperty("--brand", accent);
    root.style.setProperty("--brand-hi", accentHi);
  }, [theme, t.accent]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("orby-theme", next); } catch (e) {}
      return next;
    });
  };

  // Any link pointing to #orby-demo (teal CTAs in nav/hero/finalCTA) should
  // scroll to the demo widget AND auto-trigger the conversation by clicking
  // the widget's start button. Single global listener — covers every CTA.
  useEffect(() => {
    function handleClick(e) {
      const a = e.target.closest && e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href.endsWith("#orby-demo")) return;
      e.preventDefault();
      const target = document.getElementById("orby-demo");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      // Wait for scroll + render, then click the widget's start button.
      const tryStart = (attempts = 0) => {
        const btn = document.getElementById("talk-to-orby-cta");
        if (btn) {
          btn.click();
        } else if (attempts < 20) {
          setTimeout(() => tryStart(attempts + 1), 100);
        }
      };
      setTimeout(() => tryStart(0), 600);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <>
      <TopNav theme={theme} onToggleTheme={toggleTheme} />
      <main>
        <Hero variant={t.hero_variant} />
        <ProblemSection />
        <AgentSystem />
        <ChannelsSection />
        <DNASection />
        <IntegrationsSection />
        <CRMCampaignsSection />
        <ReplaceSection />
        <ComparisonSection />
        <KnowledgeSection />
        <AppsSection />
        <ChangelogSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <SiteFooter />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Hero">
          <TweakRadio
            label="Variant"
            value={t.hero_variant}
            onChange={v => setTweak("hero_variant", v)}
            options={[
              { value: "demo",  label: "Live Demo" },
              { value: "split", label: "Split" },
            ]}
          />
        </TweakSection>

        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={t.theme}
            onChange={v => setTweak("theme", v)}
            options={[
              { value: "dark",  label: "Dark" },
              { value: "light", label: "Light" },
            ]}
          />
          <TweakColor
            label="Accent"
            value={t.accent}
            onChange={v => setTweak("accent", v)}
            options={Object.keys(ACCENT_PRESETS)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function TopNav({ theme, onToggleTheme }) {
  const isDark = theme === "dark";
  return (
    <nav className="nav">
      <div className="container nav-inner">
        <a href="/" className="brand-mark">
          <img src="/assets/img/orbisvoice-logo-64.png" alt="" width="32" height="32" style={{borderRadius: 6, display: "block"}} />
          <span>MyOrbisVoice</span>
        </a>
        <div className="nav-links">
          <a href="/">Home</a>
          <a href="/solutions.html">Solutions</a>
          <a href="/how-it-works.html">How It Works</a>
          <a href="/pricing.html">Pricing</a>
        </div>
        <div className="nav-cta">
          <a
            href="/es/"
            hrefLang="es"
            aria-label="Cambiar a español"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px",
              borderRadius: 999,
              background: "var(--brand)",
              color: "#04151A",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: "0.02em",
              boxShadow: "inset 0 0 0 1px color-mix(in oklab, white 25%, transparent)",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-hi)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--brand)"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            ES
          </a>
          <a href="https://app.myorbisvoice.com/login" className="btn btn-ghost" style={{padding: "9px 16px", fontSize: 14}}>Sign In</a>
          <a href="https://app.myorbisvoice.com/signup" className="btn btn-signup" style={{padding: "10px 18px", fontSize: 14}}>Signup NOW!</a>
          <a href="#orby-demo" className="btn btn-primary" style={{padding: "10px 18px", fontSize: 14}}>Talk to Orby</a>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            className="theme-toggle"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: 999,
              border: "1px solid var(--border-strong)",
              background: "color-mix(in oklab, var(--surface) 60%, transparent)",
              backdropFilter: "blur(8px)",
              color: "var(--text)",
              cursor: "pointer",
              transition: "border-color 0.15s ease, color 0.15s ease",
              marginLeft: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent-hi)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text)"; }}
          >
            {isDark ? (
              // Sun icon (currently dark → click goes to light)
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              // Moon icon (currently light → click goes to dark)
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
