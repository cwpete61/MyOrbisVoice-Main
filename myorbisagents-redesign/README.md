# MyOrbisAgents — website redesign

A bold, conversion-first static redesign of **myorbisagents.com** (the "Orby"
AI inside sales agent for real estate — a product of MyOrbisResults).

> **Note:** This is a standalone static site for a *different* product than the
> MyOrbisVoice codebase this folder lives beside. It has no dependency on the
> MyOrbisVoice app and is intentionally isolated in its own directory. Nothing
> here imports MyOrbisVoice/MyOrbisLocal branding or copy.

## Pages
- `index.html` — Home
- `how-it-works.html` — How it works
- `benefits.html` — Benefits
- `pricing.html` — Pricing (real Stripe checkout links + FAQ)
- `book.html` — Book a call (lead form)
- `es/…` — full Spanish mirror of all five (Latin American Spanish, informal *tú*)
- `assets/styles.css`, `assets/app.js` — shared design system + interactions

## Features
- Bold conversion-first design: high-contrast hero, coral→indigo gradient system,
  animated "Orby on a call" chat card, stat band with count-up, sticky nav.
- Dark / light theme toggle (remembers choice), mobile menu, scroll-reveal.
- Bilingual with EN/ES toggle on every page + `hreflang` alternates.
- Preserves all real content, phone/demo line, agent-login and Stripe links.

## Preview
Open `index.html` in a browser, or serve locally:

```bash
cd myorbisagents-redesign
python3 -m http.server 8080
# visit http://localhost:8080
```

## To deploy to the live site
These are drop-in static files. If you want the same trailing-slash URL scheme
as the current site (`/how-it-works/` instead of `/how-it-works.html`), move each
page into its own folder as `index.html` (e.g. `how-it-works/index.html`) and drop
the `.html` from internal links. Legal pages currently link out to the existing
live `myorbisagents.com/legal/*` URLs.
