# MyOrbisAgents — Remotion video suite

Programmatic video for the MyOrbisAgents explainer + marketing suite. Standalone
project (not part of the pnpm workspace). Scripts live in
[`../docs/myorbisagents-video-scripts.md`](../docs/myorbisagents-video-scripts.md)
(English masters + Spanish masters).

## Run

```bash
cd remotion
npm install
npm run studio          # opens Remotion Studio — preview/scrub every composition
npm run typecheck       # tsc --noEmit
npm run render Explainer out/explainer.mp4
```

## Compositions (English + Spanish)

| id | format | length | piece |
|---|---|---|---|
| `Explainer` / `Explainer-ES` | 1920×1080 | ~100s | Full explainer |
| `FounderStory` / `-ES` | 1920×1080 | ~75s | Personal-experience story |
| `TwoMinute` / `-ES` | 1920×1080 | ~120s | 2-minute piece |
| `HomepageHero` / `-ES` | 1920×1080 | ~35s | Homepage hero (muted-first) |
| `Ad-MissedCall` / `-ES` | 1080×1920 | 18s | Ad A — missed call = lost commission |
| `Ad-Latino` / `-ES` | 1080×1920 | 20s | Ad B — Latino wedge (Spanish sim) |
| `Ad-Speed` / `-ES` | 1080×1920 | 22s | Ad C — booked while you worked |
| `Ad-Brief` / `-ES` | 1080×1920 | 20s | Ad D — Showing Brief |

## Structure

- `src/theme.ts` — palette + brand constants (tagline, phone, CTA).
- `src/data/calls.ts` — the phone-call sim scripts (`rent-en`, `rent-es`) + app steps.
- `src/components/` — `PhoneCallSim` (hero: call + live app panel), `AppCockpit`,
  `KpiCounter`, `RealityGap`, `SpanishBadge`, `CTACard`, `Caption`, `Scene`/`BigText`.
- `src/compositions/` — one file per film; `Root.tsx` registers all (EN + ES).

## Still to add before final render

1. **Voiceover** — drop VO tracks in `src/audio/` and add `<Audio>` per scene
   (currently text/caption-carried; muted cuts already work).
2. **Music bed** — one `<Audio>` on each composition root, ducked under the sims.
3. **Real assets** — swap the emoji/orb placeholders for the Orby logo; the
   `AppCockpit` can be replaced with real app screenshots.
4. **Source the stat (¹)** — Latino net-homeownership-growth citation before any
   investor-facing cut ships (see the scripts doc).
