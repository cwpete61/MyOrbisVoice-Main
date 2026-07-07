// Shared brand theme for every composition. Change once, propagates everywhere.
export const theme = {
  teal: '#1a9898',
  tealDeep: '#0f6d6d',
  ink: '#111318',
  bg: '#f6f4ef', // warm off-white
  bgDark: '#0d1512',
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
