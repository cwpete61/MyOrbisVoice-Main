import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// IG 1:1 (1080×1080). Provocative typography-only hook. Designed to STOP
// the scroll on social feeds. Headline does the work; everything else is
// supporting.
export const HookCard: React.FC<{
  kicker?:  string
  hook?:    string
  sub?:     string
  cta?:     string
  accent?:  string  // hex; the question-mark / accent text color
}> = ({
  kicker = 'GOOGLE BUSINESS PROFILE',
  hook   = 'Are you invisible to AI?',
  sub    = 'Google now feeds your GBP straight into the AI for mobile search. Weak profile = invisible.',
  cta    = 'Free audit · myorbisvoice.com',
  accent = TEAL_BRIGHT,
}) => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${TEAL}33 0%, transparent 55%)` }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 7, color: accent, marginBottom: 40, textAlign: 'center', textTransform: 'uppercase' }}>{kicker}</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 124, lineHeight: 1.02, color: WHITE, letterSpacing: -3, textAlign: 'center', textShadow: '0 8px 40px #000a' }}>{hook}</div>
        <div style={{ width: 100, height: 5, borderRadius: 3, background: accent, margin: '40px 0' }} />
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 30, lineHeight: 1.4, color: MUTED, textAlign: 'center', maxWidth: 780 }}>{sub}</div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 70 }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 24, color: WHITE, letterSpacing: 1 }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
