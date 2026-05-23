import React from 'react'
import { AbsoluteFill } from 'remotion'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: SORA } = loadSora()
const { fontFamily: INTER } = loadInter()

const TEAL = '#15A8A8'
const TEAL_BRIGHT = '#3FE3E3'
const WHITE = '#F4FAFB'
const MUTED = '#9DB6BD'

// Sample 1 — static IG 1:1 (1080x1080), typography-led trifecta intro.
export const SocialStatic: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #06141A 0%, #04181F 60%, #031318 100%)' }}>
      {/* glow */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 30% 25%, ${TEAL}33 0%, transparent 45%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 75% 80%, ${TEAL_BRIGHT}1a 0%, transparent 40%)` }} />
      {/* faint grid */}
      <AbsoluteFill style={{ opacity: 0.05, backgroundImage: `linear-gradient(${TEAL_BRIGHT} 1px, transparent 1px), linear-gradient(90deg, ${TEAL_BRIGHT} 1px, transparent 1px)`, backgroundSize: '64px 64px' }} />
      {/* content */}
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 7, color: TEAL_BRIGHT, marginBottom: 30, textTransform: 'uppercase' }}>
          One Growth System
        </div>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 132, lineHeight: 0.98, color: WHITE, textAlign: 'center', letterSpacing: -3, marginBottom: 22, textShadow: '0 8px 40px #0009' }}>
          Three engines.
        </div>
        <div style={{ width: 110, height: 5, borderRadius: 3, background: TEAL_BRIGHT, marginBottom: 30 }} />
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 56, lineHeight: 1.1, color: WHITE, textAlign: 'center', marginBottom: 60, letterSpacing: -0.5 }}>
          Capture. Rank. Convert.
        </div>
        {/* three dots */}
        <div style={{ display: 'flex', gap: 26, marginBottom: 50 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 22, height: 22, borderRadius: '50%',
              background: TEAL_BRIGHT,
              boxShadow: `0 0 24px ${TEAL_BRIGHT}, 0 0 50px ${TEAL}aa`,
            }} />
          ))}
        </div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 30, color: MUTED, textAlign: 'center', maxWidth: 760 }}>
          AI voice agents · Local search rank · A site that converts.
        </div>
      </AbsoluteFill>
      {/* wordmark */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60 }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 30, color: WHITE, letterSpacing: 1 }}>
          MyOrbisVoice
        </div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 22, color: MUTED, marginTop: 6 }}>
          myorbisvoice.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
