// Shared brand tokens for every composition. Keeps the palette + type
// hierarchy locked across the template library so a partner can never get
// an off-brand asset out of the generator.

import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

// Load ONLY the weights + subset the template library uses. Without options,
// loadFont() pulls every weight × every subset (100+ font fetches) — which
// hammered the network on each Studio playback and could crash the preview.
// Weights in use across compositions: 500 / 600 / 700 / 800, Latin only.
const FONT_OPTS = { weights: ['500', '600', '700', '800'], subsets: ['latin'], ignoreTooManyRequestsWarning: true } as const
const { fontFamily: _SORA } = loadSora('normal', FONT_OPTS)
const { fontFamily: _INTER } = loadInter('normal', FONT_OPTS)
export const SORA = _SORA
export const INTER = _INTER

export const TEAL        = '#15A8A8'
export const TEAL_BRIGHT = '#3FE3E3'
export const TEAL_DEEP   = '#0F7575'
export const GREEN       = '#36E07A'
export const RED         = '#FF5C5C'
export const AMBER       = '#FFB347'
export const WHITE       = '#F4FAFB'
export const MUTED       = '#9DB6BD'
export const BG_TOP      = '#06141A'
export const BG_BOT      = '#031318'

// Standard dark gradient + grid + corner glows. Shared backdrop for every
// typography-led composition.
export const BRAND_BG = {
  background: `linear-gradient(160deg, ${BG_TOP} 0%, #04181F 60%, ${BG_BOT} 100%)`,
}
