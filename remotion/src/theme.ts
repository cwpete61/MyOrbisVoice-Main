// Dark premium theme matched to the reference explainer
// (myorbisagents.com/assets/orby-explainer-full-en.mp4): deep teal-black canvas,
// glowing teal orb mascot, eyebrow labels, bold teal/coral numbers.
export const theme = {
  teal: '#19b5b5', // brand teal (a touch brighter to pop on dark)
  tealDeep: '#0b8f95',
  aqua: '#2ccfcf',
  coral: '#ff6b6b', // the "<5 min / lost" alert accent
  gradHot: 'linear-gradient(105deg, #12a3a3 0%, #19b5b5 45%, #34d6d6 100%)',
  gradMix: 'linear-gradient(115deg, #0b8f95 0%, #19b5b5 50%, #2ccfcf 100%)',

  // Dark canvas + surfaces
  bg: '#06141a', // canvas-0
  bgDeep: '#03100f',
  // Radial vignette glow used as the scene backdrop (teal bloom top-left).
  bgGrad: 'radial-gradient(120% 120% at 30% 20%, #0c2a2c 0%, #06141a 55%, #03100f 100%)',
  panel: '#0b2226', // dark card
  panelBorder: 'rgba(45, 207, 207, 0.16)',

  text: '#eaf7f5', // near-white
  textDim: '#a7c4c4', // muted light
  textFaint: '#5f8080',

  amber: '#ff6b6b', // reuse coral for the "lost" beats on dark
  amberBg: '#1a1012',
  white: '#ffffff',
  line: 'rgba(255,255,255,0.08)',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',

  // Back-compat aliases so existing composition call sites keep working on dark:
  // headlines that said `theme.ink` now render light; `theme.muted` stays dim.
  ink: '#eaf7f5',
  muted: '#a7c4c4',
  bgDark: '#06141a',
} as const;

export const brand = {
  name: 'MyOrbisAgents',
  agent: 'Orby',
  tagline: 'Orby catches. You close.',
  taglineEs: 'Orby atiende. Tú cierras.',
  phone: '(929) 640-3810',
  site: 'myorbisagents.com',
  ctaEn: "Don't take my word — try Orby yourself.",
  ctaEs: 'No me creas a mí — pruébalo tú mismo.',
} as const;
