// Shared brand tokens for every composition. Keeps the palette + type
// hierarchy locked across the template library so a partner can never get
// an off-brand asset out of the generator.

import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: _SORA } = loadSora()
const { fontFamily: _INTER } = loadInter()
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
