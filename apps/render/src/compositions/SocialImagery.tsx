import React from 'react'
import { AbsoluteFill, Img } from 'remotion'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: SORA } = loadSora()
const { fontFamily: INTER } = loadInter()

const TEAL = '#15A8A8'
const TEAL_BRIGHT = '#3FE3E3'
const WHITE = '#F4FAFB'
const MUTED = '#9DB6BD'

// IG 4:5 — AI photographic background + typography overlay. The background
// image URL is passed as a prop so the render service can use any AI-generated
// (or partner-supplied) image without bundling.
export const SocialImagery: React.FC<{ bgUrl?: string; kicker?: string; title?: string; sub?: string; cta?: string }> = ({
  bgUrl = '',
  kicker = 'WHEN THE PHONE RINGS',
  title  = 'Orby answers.',
  sub    = "AI voice agents that book the appointment 24/7 — even when you can't.",
  cta    = 'myorbisvoice.com',
}) => {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {bgUrl
        ? <Img src={bgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <AbsoluteFill style={{ background: 'linear-gradient(160deg, #07171C 0%, #041B22 100%)' }} />}
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.15) 35%, rgba(3,12,18,0.78) 70%, rgba(3,12,18,0.95) 100%)' }} />
      <div style={{ position: 'absolute', top: 36, right: 36, padding: '8px 14px', borderRadius: 999, background: 'rgba(6,20,26,0.55)', border: `1px solid ${TEAL_BRIGHT}55`, backdropFilter: 'blur(8px)' }}>
        <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 18, color: WHITE, letterSpacing: 0.5 }}>MyOrbisVoice</span>
      </div>
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'flex-start', padding: '0 60px 70px' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 22, letterSpacing: 6, color: TEAL_BRIGHT, marginBottom: 14, textTransform: 'uppercase' }}>{kicker}</div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 132, lineHeight: 0.95, color: WHITE, letterSpacing: -3, marginBottom: 22, textShadow: '0 12px 50px rgba(0,0,0,0.75)' }}>{title}</div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 32, lineHeight: 1.3, color: MUTED, maxWidth: 760, marginBottom: 32 }}>{sub}</div>
        <div style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: TEAL, border: `2px solid ${TEAL_BRIGHT}`, boxShadow: `0 14px 40px ${TEAL}55` }}>
          <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 26, color: '#fff', letterSpacing: 0.5 }}>{cta}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
