import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// IG 4:5 (1080×1350). 3 numbered value pillars in a vertical stack. Great
// for "what you get" lists, three-pillar product descriptions, trifecta-
// style breakdowns. Default props = trifecta intro.
export const ValuePillars: React.FC<{
  kicker?: string
  title?:  string
  pillars?: { label: string; body: string }[]
  cta?:    string
}> = ({
  kicker = 'ONE GROWTH SYSTEM',
  title  = 'Three engines.',
  pillars = [
    { label: 'CAPTURE', body: 'AI voice agents answer every call 24/7, book the appointment, never lose a lead.' },
    { label: 'RANK',    body: 'Climb into the Google Map Pack so nearby customers see you first.' },
    { label: 'CONVERT', body: 'A site wired to your profile and phone — built to turn clicks into calls.' },
  ],
  cta = 'myorbisvoice.com',
}) => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 15%, ${TEAL}29 0%, transparent 50%)` }} />

      <AbsoluteFill style={{ padding: '70px 60px 60px', flexDirection: 'column' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 22, letterSpacing: 6, color: TEAL_BRIGHT, marginBottom: 14, textTransform: 'uppercase' }}>{kicker}</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, lineHeight: 0.95, color: WHITE, letterSpacing: -3, marginBottom: 42 }}>{title}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
          {pillars.slice(0, 3).map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 22, padding: '20px 22px', borderRadius: 16, background: `${TEAL}14`, border: `1.5px solid ${TEAL_BRIGHT}55` }}>
              <div style={{ flexShrink: 0, width: 54, height: 54, borderRadius: 14, background: TEAL_BRIGHT, color: '#04181F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SORA, fontWeight: 800, fontSize: 30 }}>{i + 1}</div>
              <div>
                <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 20, letterSpacing: 4, color: TEAL_BRIGHT, marginBottom: 6 }}>{p.label}</div>
                <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 24, lineHeight: 1.35, color: WHITE }}>{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 26, color: WHITE, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
