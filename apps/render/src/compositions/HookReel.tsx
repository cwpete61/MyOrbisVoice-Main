import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// 9:16 (1080×1920), 15 seconds = 450 frames @ 30fps. 3-beat short-form
// reel: hook → agitate → CTA. Designed for TikTok / Reels / Shorts. All
// copy is prop-driven so the AI generator can fill any topic.

const SceneWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [dur - 10, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}

const Hook: React.FC<{ kicker: string; line: string; accent: string }> = ({ kicker, line, accent }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 22 })
  const scale = interpolate(pop, [0, 1], [0.85, 1])
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: accent, marginBottom: 30, opacity: pop }}>{kicker}</div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 140, lineHeight: 1.02, color: WHITE, textAlign: 'center', letterSpacing: -3, transform: `scale(${scale})`, textShadow: '0 8px 30px #000a' }}>{line}</div>
    </AbsoluteFill>
  )
}

const Agitate: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: '100%' }}>
        {items.slice(0, 4).map((s, i) => {
          const p = spring({ frame: frame - i * 18, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 22 })
          const x = interpolate(p, [0, 1], [-60, 0])
          return (
            <div key={i} style={{ opacity: p, transform: `translateX(${x}px)`, padding: '22px 28px', borderRadius: 16, background: `${TEAL}1a`, border: `1.5px solid ${TEAL_BRIGHT}66`, display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: TEAL_BRIGHT, color: '#04181F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SORA, fontWeight: 800, fontSize: 26 }}>{i + 1}</div>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 38, color: WHITE, lineHeight: 1.15 }}>{s}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const CTA: React.FC<{ headline: string; sub: string; cta: string }> = ({ headline, sub, cta }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 }, durationInFrames: 24 })
  const pulse = 1 + Math.sin(frame * 0.18) * 0.04
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 50, transform: `scale(${pulse})` }}>
        {[2.1, 1.6, 1.0].map((r, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, margin: 'auto', width: 200 * r * 0.5, height: 200 * r * 0.5,
            borderRadius: '50%', border: `2px solid ${TEAL_BRIGHT}`, opacity: 0.18 + i * 0.14,
            left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          }} />
        ))}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${pop})`,
          width: 90, height: 90, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${TEAL_BRIGHT}, ${TEAL})`,
          boxShadow: `0 0 50px ${TEAL_BRIGHT}, 0 0 120px ${TEAL}aa`,
        }} />
      </div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, color: WHITE, letterSpacing: -2.5, textAlign: 'center', marginBottom: 18, lineHeight: 0.98 }}>{headline}</div>
      <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 30, color: MUTED, textAlign: 'center', marginBottom: 38, maxWidth: 800 }}>{sub}</div>
      <div style={{ padding: '18px 36px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33` }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 38, color: WHITE }}>{cta}</span>
      </div>
    </AbsoluteFill>
  )
}

export const HookReel: React.FC<{
  kicker?:    string
  hook?:      string
  agitate?:   string[]
  ctaHeadline?: string
  ctaSub?:    string
  ctaUrl?:    string
}> = ({
  kicker      = 'LOCAL BUSINESS REALITY',
  hook        = 'Most businesses are invisible.',
  agitate     = ['Outside the Map Pack', 'Weak website pulls 0 leads', 'Missed calls = walked customers'],
  ctaHeadline = "Let's fix it.",
  ctaSub      = 'Free GBP audit, no obligation.',
  ctaUrl      = 'myorbisvoice.com',
}) => {
  const HOOK = 105, AGI = 195, CTA_LEN = 150  // 3.5s · 6.5s · 5s = 15s total
  let at = 0; const seq = (d: number) => { const f = at; at += d; return { from: f, durationInFrames: d } }
  const s1 = seq(HOOK), s2 = seq(AGI), s3 = seq(CTA_LEN)
  return (
    <AbsoluteFill style={BRAND_BG}>
      <Sequence {...s1}><SceneWrap dur={HOOK}><Hook kicker={kicker} line={hook} accent={TEAL_BRIGHT} /></SceneWrap></Sequence>
      <Sequence {...s2}><SceneWrap dur={AGI} ><Agitate items={agitate} /></SceneWrap></Sequence>
      <Sequence {...s3}><SceneWrap dur={CTA_LEN}><CTA headline={ctaHeadline} sub={ctaSub} cta={ctaUrl} /></SceneWrap></Sequence>
    </AbsoluteFill>
  )
}
