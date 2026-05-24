import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// IG 4:5 (1080×1350). Testimonial / customer-quote layout. Large open-quote
// glyph, italicized body, author + role attribution at the bottom.
export const QuoteCard: React.FC<{
  quote?:   string
  author?:  string
  role?:    string
  cta?:     string
}> = ({
  quote  = '"We stopped losing after-hours customers the week we turned Orby on. The phone literally answers itself."',
  author = 'Maria S.',
  role   = 'Owner · Bright Smile Dental',
  cta    = 'myorbisvoice.com',
}) => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 30%, ${TEAL_BRIGHT}1a 0%, transparent 50%)` }} />

      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 200, color: TEAL_BRIGHT, lineHeight: 0.6, opacity: 0.4 }}>“</div>
        <div style={{ fontFamily: SORA, fontWeight: 600, fontStyle: 'italic', fontSize: 56, lineHeight: 1.22, color: WHITE, textAlign: 'center', letterSpacing: -1, marginTop: -40, marginBottom: 50, maxWidth: 880 }}>{quote}</div>
        <div style={{ width: 80, height: 3, borderRadius: 2, background: TEAL_BRIGHT, marginBottom: 30 }} />
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 32, color: WHITE }}>{author}</div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 22, color: MUTED, marginTop: 6 }}>{role}</div>
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 22, color: MUTED, letterSpacing: 1 }}>{cta}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
