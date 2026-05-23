import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { loadFont as loadSora } from '@remotion/google-fonts/Sora'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'

const { fontFamily: SORA } = loadSora()
const { fontFamily: INTER } = loadInter()

const TEAL = '#15A8A8'
const TEAL_BRIGHT = '#3FE3E3'
const GREEN = '#36E07A'
const WHITE = '#F4FAFB'
const MUTED = '#9DB6BD'
const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))

// Sample 3 — animated 9:16 Reel (1080x1920, ~12s = 360 frames). Trifecta hook.
// Scene timing:
//  0  – 75   "Most local businesses are invisible." (2.5s)
//  75 – 165  "3 things you're losing." (3s) — three pulse rows
//  165 – 285 Triangle convergence + "One growth system." (4s)
//  285 – 360 CTA "myorbisvoice.com" (2.5s)

const Background: React.FC = () => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const t = frame / durationInFrames
  const gx = 50 + Math.sin(t * Math.PI * 3) * 18
  const gy = 45 + Math.cos(t * Math.PI * 2) * 16
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(160deg, #06161B 0%, #04181F 55%, #031318 100%)' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${gx}% ${gy}%, ${TEAL}33 0%, transparent 42%)` }} />
      <AbsoluteFill style={{ opacity: 0.06, backgroundImage: `linear-gradient(${TEAL_BRIGHT} 1px, transparent 1px), linear-gradient(90deg, ${TEAL_BRIGHT} 1px, transparent 1px)`, backgroundSize: '70px 70px' }} />
    </AbsoluteFill>
  )
}

const SceneWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [dur - 10, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}

const SceneHook: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 24 })
  const scale = interpolate(pop, [0, 1], [0.85, 1])
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 30, letterSpacing: 6, color: TEAL_BRIGHT, marginBottom: 30, opacity: pop }}>
        LOCAL BUSINESS REALITY
      </div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 120, lineHeight: 1.02, color: WHITE, textAlign: 'center', letterSpacing: -2, transform: `scale(${scale})`, textShadow: '0 8px 30px #000a' }}>
        Most local businesses
      </div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 152, lineHeight: 1.02, color: TEAL_BRIGHT, textAlign: 'center', letterSpacing: -3, marginTop: 18, transform: `scale(${scale})`, textShadow: `0 0 50px ${TEAL}aa` }}>
        are invisible.
      </div>
    </AbsoluteFill>
  )
}

const SceneLoss: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rows = [
    { label: 'OUTSIDE THE MAP PACK', line: '$ → competitors', delay: 0 },
    { label: 'WEAK WEBSITE',          line: '0 leads',         delay: 20 },
    { label: 'MISSED CALLS',          line: 'Business gone',   delay: 40 },
  ]
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 80px' }}>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 92, color: WHITE, textAlign: 'center', marginBottom: 50, letterSpacing: -1.5 }}>
        3 things you&apos;re losing.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, width: '100%' }}>
        {rows.map((r, i) => {
          const p = spring({ frame: frame - r.delay, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 22 })
          const x = interpolate(p, [0, 1], [-60, 0])
          return (
            <div key={i} style={{
              opacity: p, transform: `translateX(${x}px)`,
              padding: '24px 30px', borderRadius: 16, background: `${TEAL}1a`, border: `1.5px solid ${TEAL_BRIGHT}66`,
              display: 'flex', alignItems: 'center', gap: 22,
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: '50%', background: TEAL_BRIGHT, color: '#04181F',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: SORA, fontWeight: 800, fontSize: 28,
              }}>{i + 1}</div>
              <div>
                <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 20, letterSpacing: 3, color: TEAL_BRIGHT }}>{r.label}</div>
                <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 38, color: WHITE, marginTop: 4 }}>{r.line}</div>
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const SceneTri: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const conv = spring({ frame, fps, config: { damping: 16, mass: 0.9 }, durationInFrames: 40 })
  const cx = 540, cy = 620, R = 260
  const verts = [
    { x: cx, y: cy - R },
    { x: cx - R * 0.92, y: cy + R * 0.6 },
    { x: cx + R * 0.92, y: cy + R * 0.6 },
  ]
  const start = [{ x: cx, y: -200 }, { x: -300, y: cy + 600 }, { x: cx * 2 + 300, y: cy + 600 }]
  const labels = ['VOICE', 'LOCAL', 'WEB']
  const nodes = verts.map((v, i) => ({
    x: interpolate(conv, [0, 1], [start[i].x, v.x]),
    y: interpolate(conv, [0, 1], [start[i].y, v.y]),
  }))
  const lineOp = interpolate(frame, [40, 58], [0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const core = interpolate(frame, [55, 80, 110], [0, 1.2, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  const titleR = spring({ frame: frame - 80, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 24 })
  return (
    <AbsoluteFill>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <line x1={nodes[0].x} y1={nodes[0].y} x2={nodes[1].x} y2={nodes[1].y} stroke={TEAL_BRIGHT} strokeWidth={3} opacity={lineOp} />
        <line x1={nodes[1].x} y1={nodes[1].y} x2={nodes[2].x} y2={nodes[2].y} stroke={TEAL_BRIGHT} strokeWidth={3} opacity={lineOp} />
        <line x1={nodes[2].x} y1={nodes[2].y} x2={nodes[0].x} y2={nodes[0].y} stroke={TEAL_BRIGHT} strokeWidth={3} opacity={lineOp} />
        <circle cx={cx} cy={cy + R * 0.15} r={36 * core} fill={TEAL_BRIGHT} opacity={0.95}
          style={{ filter: `drop-shadow(0 0 40px ${TEAL_BRIGHT})` }} />
      </svg>
      {nodes.map((n, i) => (
        <div key={i} style={{ position: 'absolute', left: n.x, top: n.y, transform: 'translate(-50%,-50%)', opacity: conv, textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: WHITE, boxShadow: `0 0 28px ${TEAL_BRIGHT}`, margin: '0 auto' }} />
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 26, color: WHITE, marginTop: 14, letterSpacing: 4 }}>{labels[i]}</div>
        </div>
      ))}
      <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 170 }}>
        <div style={{ opacity: titleR, transform: `translateY(${(1 - titleR) * 20}px)` }}>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 26, letterSpacing: 6, color: TEAL_BRIGHT, textAlign: 'center', marginBottom: 14 }}>THREE ENGINES</div>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 100, color: WHITE, letterSpacing: -2.5, textAlign: 'center', lineHeight: 1 }}>One growth</div>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 100, color: TEAL_BRIGHT, letterSpacing: -2.5, textAlign: 'center', lineHeight: 1, textShadow: `0 0 50px ${TEAL}aa` }}>system.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 }, durationInFrames: 22 })
  const pulse = 1 + Math.sin(frame * 0.18) * 0.05
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 60px' }}>
      <div style={{ position: 'relative', width: 240, height: 240, marginBottom: 60, transform: `scale(${pulse})` }}>
        {[2.1, 1.6, 1.0].map((r, i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, margin: 'auto', width: 240 * r * 0.5, height: 240 * r * 0.5,
            borderRadius: '50%', border: `2px solid ${TEAL_BRIGHT}`, opacity: 0.18 + i * 0.14,
            left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          }} />
        ))}
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${pop})`,
          width: 100, height: 100, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${TEAL_BRIGHT}, ${TEAL})`,
          boxShadow: `0 0 60px ${TEAL_BRIGHT}, 0 0 140px ${TEAL}aa`,
        }} />
      </div>
      <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 28, letterSpacing: 6, color: TEAL_BRIGHT, marginBottom: 18, opacity: pop }}>I&apos;M ORBY</div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 110, color: WHITE, letterSpacing: -2.5, marginBottom: 38, textAlign: 'center', lineHeight: 0.98, transform: `scale(${interpolate(pop, [0, 1], [0.85, 1])})` }}>
        Let&apos;s talk.
      </div>
      <div style={{ padding: '20px 40px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33` }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 42, color: WHITE }}>myorbisvoice.com</span>
      </div>
    </AbsoluteFill>
  )
}

export const SocialReel: React.FC = () => {
  // total = 75 + 90 + 120 + 75 = 360 frames @ 30fps = 12.0s
  const HOOK = 75, LOSS = 90, TRI = 120, CTA = 75
  let at = 0
  const seq = (dur: number) => { const from = at; at += dur; return { from, durationInFrames: dur } }
  const s1 = seq(HOOK), s2 = seq(LOSS), s3 = seq(TRI), s4 = seq(CTA)
  return (
    <AbsoluteFill>
      <Background />
      <Sequence {...s1}><SceneWrap dur={HOOK}><SceneHook /></SceneWrap></Sequence>
      <Sequence {...s2}><SceneWrap dur={LOSS}><SceneLoss /></SceneWrap></Sequence>
      <Sequence {...s3}><SceneWrap dur={TRI}><SceneTri /></SceneWrap></Sequence>
      <Sequence {...s4}><SceneWrap dur={CTA}><SceneCTA /></SceneWrap></Sequence>
    </AbsoluteFill>
  )
}
