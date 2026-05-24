import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL_BRIGHT, TEAL, RED, WHITE, MUTED, BRAND_BG } from './_theme'

// IG 1:1 (1080×1080). Two-column "you" vs "them" comparison. Left column is
// the loss state (gray + red accents); right column is the win state (white
// + teal). Powerful for "voicemail vs Orby", "DIY vs done-for-you", etc.
export const ComparisonCard: React.FC<{
  title?:    string
  leftHeading?:  string
  leftItems?:    string[]
  rightHeading?: string
  rightItems?:   string[]
  cta?:      string
}> = ({
  title        = 'Phone hits voicemail vs.',
  leftHeading  = 'WITHOUT ORBY',
  leftItems    = ['Caller hangs up', 'Books your competitor', 'You find out tomorrow', 'Revenue silently leaks'],
  rightHeading = 'WITH ORBY',
  rightItems   = ['Real-time AI greeting', 'Books on YOUR calendar', 'You get the transcript', 'Every call captured 24/7'],
  cta          = 'myorbisvoice.com',
}) => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 75% 70%, ${TEAL}29 0%, transparent 50%)` }} />

      <AbsoluteFill style={{ flexDirection: 'column', justifyContent: 'center', padding: '60px' }}>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 60, color: WHITE, textAlign: 'center', lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 50 }}>{title}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          {/* LEFT — loss state */}
          <div style={{ padding: '28px 24px', borderRadius: 18, background: `${RED}10`, border: `1.5px solid ${RED}55` }}>
            <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 22, letterSpacing: 4, color: RED, marginBottom: 20 }}>{leftHeading}</div>
            {leftItems.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: SORA, fontWeight: 800, color: RED, fontSize: 22, lineHeight: 1, marginTop: 4 }}>✕</span>
                <span style={{ fontFamily: INTER, fontWeight: 500, fontSize: 22, lineHeight: 1.35, color: MUTED }}>{s}</span>
              </div>
            ))}
          </div>
          {/* RIGHT — win state */}
          <div style={{ padding: '28px 24px', borderRadius: 18, background: `${TEAL}1a`, border: `1.5px solid ${TEAL_BRIGHT}77` }}>
            <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 22, letterSpacing: 4, color: TEAL_BRIGHT, marginBottom: 20 }}>{rightHeading}</div>
            {rightItems.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <span style={{ fontFamily: SORA, fontWeight: 800, color: TEAL_BRIGHT, fontSize: 22, lineHeight: 1, marginTop: 4 }}>✓</span>
                <span style={{ fontFamily: INTER, fontWeight: 600, fontSize: 22, lineHeight: 1.35, color: WHITE }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 36 }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 22, color: WHITE, letterSpacing: 1 }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
