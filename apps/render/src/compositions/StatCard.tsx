import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// IG 1:1 (1080×1080). Big-number stat with a kicker on top and supporting
// context below. Useful for "5 missed calls = $1,050/day", "85% never call
// back", etc.
export const StatCard: React.FC<{
  kicker?: string
  stat?:   string
  unit?:   string
  body?:   string
  cta?:    string
}> = ({
  kicker = 'THE DAILY MATH',
  stat   = '$1,050',
  unit   = '/day',
  body   = '5 missed calls × $210 average customer value. Every day Orby isn\'t answering, that money walks to a competitor.',
  cta    = 'myorbisvoice.com',
}) => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 30%, ${TEAL}29 0%, transparent 50%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 70% 80%, ${TEAL_BRIGHT}14 0%, transparent 45%)` }} />
      <AbsoluteFill style={{ opacity: 0.05, backgroundImage: `linear-gradient(${TEAL_BRIGHT} 1px, transparent 1px), linear-gradient(90deg, ${TEAL_BRIGHT} 1px, transparent 1px)`, backgroundSize: '70px 70px' }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 7, color: TEAL_BRIGHT, marginBottom: 30, textTransform: 'uppercase', textAlign: 'center' }}>{kicker}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 40 }}>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 220, lineHeight: 0.95, color: WHITE, letterSpacing: -6, textShadow: `0 0 60px ${TEAL}77` }}>{stat}</div>
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 60, color: MUTED, letterSpacing: -1 }}>{unit}</div>
        </div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 28, lineHeight: 1.45, color: MUTED, textAlign: 'center', maxWidth: 800 }}>{body}</div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 28, color: WHITE, letterSpacing: 1 }}>MyOrbisVoice</div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 20, color: MUTED, marginTop: 4 }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
