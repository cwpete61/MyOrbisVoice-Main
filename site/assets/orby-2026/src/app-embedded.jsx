/* global React, ReactDOM,
   Hero, AgentSystem,
   ProblemSection, ChannelsSection, DNASection, IntegrationsSection,
   CRMCampaignsSection, ReplaceSection, KnowledgeSection, ChangelogSection,
   FAQSection, FinalCTA
*/

// Embedded variant of the prototype's app.jsx — same component tree, with
// the prototype's TopNav, SiteFooter, and TweaksPanel REMOVED. The legacy
// site/index.html shell provides our existing nav + footer + Family strip
// around this React mount, per user direction "header and footer connection
// from current site; everything else verbatim from prototype."
const { useEffect } = React;

function AppEmbedded() {
  // Lock theme + accent to the prototype defaults. No designer toggles in prod.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "dark");
    root.style.setProperty("--accent",    "#15A8A8");
    root.style.setProperty("--accent-hi", "#3FE3E3");
    root.style.setProperty("--brand",     "#15A8A8");
    root.style.setProperty("--brand-hi",  "#3FE3E3");
  }, []);

  return (
    <main>
      <Hero variant="demo" />
      <ProblemSection />
      <AgentSystem />
      <ChannelsSection />
      <DNASection />
      <IntegrationsSection />
      <CRMCampaignsSection />
      <ReplaceSection />
      <KnowledgeSection />
      <ChangelogSection />
      <FAQSection />
      <FinalCTA />
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("orby-2026-root")).render(<AppEmbedded />);
