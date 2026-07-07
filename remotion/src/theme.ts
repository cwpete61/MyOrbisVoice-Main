// Shared brand theme for every composition. Change once, propagates everywhere.
// Brand colors pulled from the real MyOrbisAgents site (myorbisagents.com/assets/styles.css).
export const theme = {
  teal: '#15a8a8', // --brand
  tealDeep: '#0b8f95',
  aqua: '#2ccfcf', // aqua highlight
  gradHot: 'linear-gradient(105deg, #12a3a3 0%, #15a8a8 45%, #34d6d6 100%)', // orb fill
  gradMix: 'linear-gradient(115deg, #0b8f95 0%, #15a8a8 50%, #2ccfcf 100%)', // wordmark / highlights
  ink: '#06141a', // brand canvas-0
  bg: '#f6f4ef', // warm off-white
  bgDark: '#06141a',
  amber: '#c2410c', // the "lost / missed" alert color
  amberBg: '#fff7ed',
  white: '#ffffff',
  muted: '#6b7280',
  line: '#e6e2da',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
} as const;

// Brand constants used across pieces (English universals — never localized).
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
