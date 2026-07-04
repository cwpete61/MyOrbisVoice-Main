import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// ── MyOrbisResults 16:9 brand / hero video ─────────────────────────────────
// Content sourced from myorbisresults.com (Problem / System / Partners pages):
// the six revenue leaks, the four connected pillars, the compounding loop, and
// the consultation CTA. 30fps. Default 930 frames (31s) — set on registration.
//
// Scenes (frames @30fps):
//   S1 Hook            0–150   (5s)
//   S2 Six leaks     150–360   (7s)
//   S3 Planning gap  360–480   (4s)
//   S4 Four pillars  480–690   (7s)
//   S5 Compounding   690–810   (4s)
//   S6 CTA           810–930   (4s)

// Leak colour system (matches the site).
const LEAKS = [
  { name: 'Dead Money',        color: '#FF8C42' },
  { name: 'Invisible Online',  color: '#FFD23F' },
  { name: 'Cold Leads',        color: '#3FE3E3' },
  { name: 'No Sales Process',  color: '#5BC8FF' },
  { name: 'Wasted Marketing',  color: '#9B7BFF' },
  { name: 'Owner Drowning',    color: '#E85D9A' },
]

const PILLARS = [
  { tag: 'MyOrbisLocal',  title: 'Get Found',      color: '#FFD23F' },
  { tag: 'MyOrbisWeb',    title: 'Convert Demand', color: '#5BC8FF' },
  { tag: 'MyOrbisVoice',  title: 'Answer & Book',  color: '#3FE3E3' },
  { tag: 'Staff Training',title: 'Make It Stick',  color: '#9B7BFF' },
]

const EASE = Easing.bezier(0.16, 1, 0.3, 1)

// ── Shared animated orbital backdrop ───────────────────────────────────────
export const OrbitalBg: React.FC<{ dim?: number }> = ({ dim = 1 }) => {
  const frame = useCurrentFrame()
  const rot = (frame * 0.08) % 360
  return (
    <AbsoluteFill style={BRAND_BG}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: 0.55 * dim }}>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ transform: `rotate(${rot}deg)` }}>
          <g fill="none" stroke={TEAL_BRIGHT} strokeWidth={1.4}>
            <ellipse cx={1340} cy={500} rx={820} ry={300} opacity={0.30} />
            <ellipse cx={1340} cy={500} rx={620} ry={220} opacity={0.45} />
            <ellipse cx={1340} cy={500} rx={420} ry={150} opacity={0.55} />
          </g>
          <g fill={TEAL_BRIGHT}>
            <circle cx={1760} cy={500} r={5} opacity={0.8} />
            <circle cx={920}  cy={500} r={4} opacity={0.6} />
            <circle cx={1340} cy={200} r={3} opacity={0.5} />
          </g>
        </svg>
      </AbsoluteFill>
      {/* left-side darken for text legibility */}
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, #06141Aee 0%, #06141A99 45%, transparent 80%)' }} />
    </AbsoluteFill>
  )
}

const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = TEAL_BRIGHT }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: INTER, fontWeight: 800, fontSize: 24, letterSpacing: 6, color, textTransform: 'uppercase', marginBottom: 26 }}>
    <span style={{ width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 18px ${color}` }} />
    {children}
  </div>
)

// Frame is LOCAL (0-based) inside a <Sequence>; the Sequence bounds mounting,
// so we only handle the fade in/out here against the local frame.
const SceneWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}

// ── S1 Hook ─────────────────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - 6, fps, config: { damping: 16, mass: 0.7 }, durationInFrames: 30 })
  const sub = interpolate(frame, [26, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 150, paddingRight: 760 }}>
      <Eyebrow>MyOrbisResults</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, lineHeight: 1.03, letterSpacing: -2.5, color: WHITE, textShadow: '0 8px 30px #000a', transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px)`, opacity: pop }}>
        Your business is leaking revenue in <span style={{ color: TEAL_BRIGHT }}>six places at once.</span>
      </div>
      <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 34, color: MUTED, marginTop: 30, opacity: sub, transform: `translateY(${interpolate(sub, [0, 1], [16, 0])}px)` }}>
        And you can&rsquo;t see most of them.
      </div>
    </AbsoluteFill>
  )
}

// ── S2 Six leaks (leaky bucket motif) ────────────────────────────────────────
const Bucket: React.FC = () => {
  const frame = useCurrentFrame()
  // drip animation: each drop falls on a staggered loop
  const drop = (i: number) => {
    const t = (frame + i * 9) % 40
    return { y: interpolate(t, [0, 40], [0, 70]), o: interpolate(t, [0, 6, 34, 40], [0, 1, 1, 0]) }
  }
  const streams = [
    { d: 'M150 150 C110 175 95 205 92 240', x: 92,  c: LEAKS[0].color },
    { d: 'M165 185 C140 215 130 245 128 272', x: 128, c: LEAKS[1].color },
    { d: 'M205 210 C205 240 205 262 205 286', x: 205, c: LEAKS[2].color },
    { d: 'M250 200 C275 230 285 255 288 280', x: 288, c: LEAKS[3].color },
    { d: 'M270 165 C300 192 315 218 320 250', x: 320, c: LEAKS[4].color },
    { d: 'M285 135 C320 160 338 188 345 222', x: 345, c: LEAKS[5].color },
  ]
  return (
    <svg width={520} height={460} viewBox="0 0 420 360">
      <defs>
        <linearGradient id="mw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TEAL_BRIGHT} /><stop offset="1" stopColor={TEAL} /></linearGradient>
        <linearGradient id="mp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a3338" /><stop offset="1" stopColor="#171d20" /></linearGradient>
      </defs>
      <path d="M120 70 L300 70 L280 250 L140 250 Z" fill="url(#mp)" stroke="#3a474d" strokeWidth={2} />
      <ellipse cx={210} cy={70} rx={90} ry={16} fill="#202829" stroke="#3a474d" strokeWidth={2} />
      <ellipse cx={210} cy={70} rx={78} ry={11} fill="url(#mw)" opacity={0.9} />
      <g strokeWidth={3} fill="none" opacity={0.92}>
        {streams.map((s, i) => <path key={i} d={s.d} stroke={s.c} />)}
      </g>
      {streams.map((s, i) => {
        const dr = drop(i)
        return <circle key={i} cx={s.x} cy={250 + dr.y} r={5} fill={s.c} opacity={dr.o} />
      })}
    </svg>
  )
}

const SixLeaks: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ flexDirection: 'row', alignItems: 'center', padding: '0 130px', gap: 70 }}>
      <div style={{ flexShrink: 0 }}><Bucket /></div>
      <div style={{ flex: 1 }}>
        <Eyebrow>The Real Problem</Eyebrow>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 60, lineHeight: 1.05, letterSpacing: -1.5, color: WHITE, marginBottom: 34 }}>
          One bucket. Six holes.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
          {LEAKS.map((l, i) => {
            const t = interpolate(frame, [20 + i * 12, 44 + i * 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
            return (
              <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: t, transform: `translateX(${interpolate(t, [0, 1], [-30, 0])}px)` }}>
                <span style={{ width: 18, height: 18, borderRadius: 6, background: `${l.color}33`, border: `2px solid ${l.color}`, flexShrink: 0 }} />
                <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 32, color: WHITE }}>{l.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── S3 Planning gap ───────────────────────────────────────────────────────
const PlanningGap: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 15, mass: 0.7 }, durationInFrames: 26 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 220px' }}>
      <Eyebrow color={AMBER()}>The Planning Gap</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 82, lineHeight: 1.06, letterSpacing: -2, color: WHITE, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})` }}>
        Patching one hole at a time is <span style={{ color: TEAL_BRIGHT }}>planning to keep leaking.</span>
      </div>
    </AbsoluteFill>
  )
}
function AMBER() { return '#FFB347' }

// ── S4 Four pillars ──────────────────────────────────────────────────────
const Pillars: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 120px' }}>
      <Eyebrow>The System</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 64, letterSpacing: -1.5, color: WHITE, marginBottom: 50, textAlign: 'center' }}>
        One system. Every leak <span style={{ color: TEAL_BRIGHT }}>sealed.</span>
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {PILLARS.map((p, i) => {
          const s = spring({ frame: frame - 16 - i * 8, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 26 })
          return (
            <div key={p.tag} style={{
              width: 340, padding: '40px 30px', borderRadius: 22,
              background: `${p.color}14`, border: `2px solid ${p.color}66`,
              transform: `translateY(${interpolate(s, [0, 1], [60, 0])}px)`, opacity: s,
            }}>
              <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 20, letterSpacing: 2, color: p.color, marginBottom: 14, textTransform: 'uppercase' }}>{p.tag}</div>
              <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 40, color: WHITE }}>{p.title}</div>
            </div>
          )
        })}
      </div>
      <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 26, color: MUTED, marginTop: 46, letterSpacing: 1, opacity: interpolate(frame, [60, 84], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        Get found &nbsp;→&nbsp; convert &nbsp;→&nbsp; answer &amp; book &nbsp;→&nbsp; make it stick
      </div>
    </AbsoluteFill>
  )
}

// ── S5 Compounding loop ──────────────────────────────────────────────────
const NODES = [
  { label: 'Get Found',  cx: 960, cy: 270, color: '#FFD23F' },
  { label: 'Convert',    cx: 1230, cy: 540, color: '#5BC8FF' },
  { label: 'Answer & Book', cx: 960, cy: 810, color: '#3FE3E3' },
  { label: 'Customer Data', cx: 690, cy: 540, color: '#9B7BFF' },
]
const Compounding: React.FC = () => {
  const frame = useCurrentFrame()
  const pulse = 1 + 0.04 * Math.sin(frame * 0.18)
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 64 }}>
        <Eyebrow>Why Connected Wins</Eyebrow>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: WHITE, textAlign: 'center' }}>
          Revenue that <span style={{ color: TEAL_BRIGHT }}>compounds.</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ transform: `translateY(150px) scale(${0.82 * pulse})` }}>
          <g fill="none" stroke={TEAL} strokeWidth={3} opacity={0.7}>
            <path d="M1030 320 A360 360 0 0 1 1180 480" />
            <path d="M1180 600 A360 360 0 0 1 1030 760" />
            <path d="M890 760 A360 360 0 0 1 740 600" />
            <path d="M740 480 A360 360 0 0 1 890 320" />
          </g>
          {NODES.map((n, i) => {
            const s = interpolate(frame, [10 + i * 8, 34 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
            return (
              <g key={n.label} opacity={s}>
                <circle cx={n.cx} cy={n.cy} r={92} fill="#0c1a20" stroke={n.color} strokeWidth={2.5} />
                <text x={n.cx} y={n.cy + 8} textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight={700} fontSize={28} fill={n.color}>{n.label}</text>
              </g>
            )
          })}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ── S6 CTA ────────────────────────────────────────────────────────────────
const Cta: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 }, durationInFrames: 26 })
  const pill = interpolate(frame, [22, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, letterSpacing: -2.5, color: WHITE, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.88, 1])})`, marginBottom: 44 }}>
        Stop patching. <span style={{ color: TEAL_BRIGHT }}>Start compounding.</span>
      </div>
      <div style={{ opacity: pill, transform: `translateY(${interpolate(pill, [0, 1], [20, 0])}px)`, padding: '24px 56px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33`, marginBottom: 30 }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 44, color: WHITE }}>Book a free Trifecta Consultation</span>
      </div>
      <div style={{ opacity: pill, fontFamily: INTER, fontWeight: 700, fontSize: 36, color: TEAL_BRIGHT, letterSpacing: 1 }}>myorbisresults.com</div>
    </AbsoluteFill>
  )
}

export const MorHero: React.FC = () => {
  return (
    <AbsoluteFill style={BRAND_BG}>
      <OrbitalBg />
      <Sequence from={0}   durationInFrames={150}><SceneWrap dur={150}><Hook /></SceneWrap></Sequence>
      <Sequence from={150} durationInFrames={210}><SceneWrap dur={210}><SixLeaks /></SceneWrap></Sequence>
      <Sequence from={360} durationInFrames={120}><SceneWrap dur={120}><PlanningGap /></SceneWrap></Sequence>
      <Sequence from={480} durationInFrames={210}><SceneWrap dur={210}><Pillars /></SceneWrap></Sequence>
      <Sequence from={690} durationInFrames={120}><SceneWrap dur={120}><Compounding /></SceneWrap></Sequence>
      <Sequence from={810} durationInFrames={120}><SceneWrap dur={120}><Cta /></SceneWrap></Sequence>
    </AbsoluteFill>
  )
}

// Re-export pieces + data for the marketing-kit stills + explainer.
export { SixLeaks, Pillars, Cta, Eyebrow, Bucket, LEAKS, PILLARS, EASE }
