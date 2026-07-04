// MyOrbisAgents — MARKETING explainer (~71s, 16:9). Aoede narration in
// public/audio/narr-marketing-en.mp3. Beats: pain → what → who → why →
// the call (schools/hospitals) → offer → CTA. Frame-driven motion only.
import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Easing, Audio } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, TEAL_DEEP, GREEN, RED, WHITE, MUTED, BG_TOP, BG_BOT } from './_theme'

export const ORBY_AGENTS_MKT_FRAMES = 2130 // 71s @ 30fps

const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const up = (frame: number, start: number, dur = 16, dist = 26) => {
  const p = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` }
}
const fade = (frame: number, inS: number, outS: number, dur = 14) =>
  interpolate(frame, [inS, inS + dur, outS, outS + dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const g1 = interpolate(frame % 300, [0, 150, 300], [0.35, 0.6, 0.35])
  const g2 = interpolate(frame % 360, [0, 180, 360], [0.5, 0.28, 0.5])
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG_TOP} 0%, #04181F 58%, ${BG_BOT} 100%)` }}>
      <div style={{ position: 'absolute', top: '-18%', left: '-10%', width: 900, height: 900, borderRadius: '50%', background: TEAL, filter: 'blur(180px)', opacity: g1 * 0.5 }} />
      <div style={{ position: 'absolute', bottom: '-22%', right: '-12%', width: 820, height: 820, borderRadius: '50%', background: TEAL_BRIGHT, filter: 'blur(190px)', opacity: g2 * 0.28 }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(rgba(63,227,227,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(63,227,227,0.05) 1px, transparent 1px)`, backgroundSize: '64px 64px', maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)' }} />
    </AbsoluteFill>
  )
}
const Orb: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame()
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.05, 1])
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${TEAL_BRIGHT}, ${TEAL_DEEP})`, boxShadow: `0 0 ${size * 0.5}px ${TEAL}66`, display: 'grid', placeItems: 'center', transform: `scale(${pulse})`, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: size * 0.18, borderRadius: '50%', border: `2px solid ${WHITE}`, opacity: 0.85, display: 'flex', gap: size * 0.06, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: size * 0.07, height: size * 0.07, borderRadius: '50%', background: WHITE }} />
        <div style={{ width: size * 0.07, height: size * 0.07, borderRadius: '50%', background: WHITE }} />
      </div>
    </div>
  )
}
const Eyebrow: React.FC<{ children: React.ReactNode; frame: number; start: number; color?: string }> = ({ children, frame, start, color = TEAL_BRIGHT }) => (
  <div style={{ ...up(frame, start), fontFamily: INTER, fontSize: 28, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color, marginBottom: 26 }}>{children}</div>
)
const Wave: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', height: 40 }}>
      {Array.from({ length: 34 }).map((_, i) => {
        const h = 8 + Math.abs(Math.sin((frame + i * 7) * 0.25)) * 32
        return <div key={i} style={{ width: 5, height: h, borderRadius: 4, background: TEAL_BRIGHT, opacity: 0.85 }} />
      })}
    </div>
  )
}

// 1. HOOK / PAIN
const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 390)
  const lines = [
    { t: 'The first agent to answer wins the deal.', c: WHITE, s: 12 },
    { t: "But you can't pick up mid-showing, driving, or asleep.", c: MUTED, s: 120 },
    { t: 'Every missed call is a commission — gone.', c: RED, s: 240 },
  ]
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: 'center', alignItems: 'center', padding: 130, textAlign: 'center' }}>
      <Eyebrow frame={frame} start={4}>Real estate</Eyebrow>
      {lines.map((l, i) => (
        <div key={i} style={{ ...up(frame, l.s, 18), fontFamily: SORA, fontWeight: 800, fontSize: i === 2 ? 88 : 70, lineHeight: 1.1, color: l.c, maxWidth: 1500, marginTop: i ? 24 : 0 }}>{l.t}</div>
      ))}
    </AbsoluteFill>
  )
}
// 2. WHAT
const chips = ['📞 Calls', '💬 Texts', '🌐 Web leads', '📅 Calendar']
const What: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 270)
  return (
    <AbsoluteFill style={{ opacity: o, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90, padding: 130 }}>
      <div style={{ ...up(frame, 6) }}><Orb size={360} /></div>
      <div style={{ maxWidth: 840 }}>
        <Eyebrow frame={frame} start={10}>Meet Orby</Eyebrow>
        <div style={{ ...up(frame, 16), fontFamily: SORA, fontWeight: 800, fontSize: 70, lineHeight: 1.08, color: WHITE }}>Your AI inside sales agent.</div>
        <div style={{ ...up(frame, 44), fontFamily: INTER, fontSize: 33, color: MUTED, marginTop: 22, lineHeight: 1.5 }}>Answers every call, text, and web lead the moment it arrives — <b style={{ color: WHITE }}>day, night, weekends</b>, in <b style={{ color: WHITE }}>English &amp; Spanish</b>.</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 34 }}>
          {chips.map((c, i) => (<div key={c} style={{ ...up(frame, 70 + i * 8), fontFamily: INTER, fontSize: 26, fontWeight: 600, color: WHITE, background: 'rgba(63,227,227,0.10)', border: `1px solid ${TEAL}55`, borderRadius: 100, padding: '12px 22px' }}>{c}</div>))}
        </div>
      </div>
    </AbsoluteFill>
  )
}
// 3. WHO
const personas = [
  { i: '🏃', h: 'Agents on the move', p: "Can't answer at a showing or behind the wheel. Orby can." },
  { i: '🌙', h: 'After-hours leads', p: 'Most buyers reach out nights & weekends. Orby covers them.' },
  { i: '🌎', h: 'Bilingual markets', p: 'Serve English & Spanish buyers — no second phone.' },
]
const Who: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 210)
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120 }}>
      <Eyebrow frame={frame} start={4}>Built for you</Eyebrow>
      <div style={{ ...up(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 64, color: WHITE, marginBottom: 44, textAlign: 'center' }}>For the agent too busy to chase every lead.</div>
      <div style={{ display: 'flex', gap: 26 }}>
        {personas.map((p, i) => (
          <div key={i} style={{ ...up(frame, 26 + i * 12), width: 440, background: 'rgba(8,25,29,0.6)', border: `1px solid ${TEAL}33`, borderRadius: 24, padding: '34px 30px' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>{p.i}</div>
            <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 34, color: WHITE, marginBottom: 12 }}>{p.h}</div>
            <div style={{ fontFamily: INTER, fontSize: 27, color: MUTED, lineHeight: 1.45 }}>{p.p}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}
// 4. WHY (stats)
const CountUp: React.FC<{ to: number; suffix?: string; start: number }> = ({ to, suffix = '', start }) => {
  const frame = useCurrentFrame()
  const p = interpolate(frame, [start, start + 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return <>{Math.round(to * p)}{suffix}</>
}
const Why: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 260)
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120, textAlign: 'center' }}>
      <Eyebrow frame={frame} start={4}>Why it matters</Eyebrow>
      <div style={{ ...up(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 60, color: WHITE, maxWidth: 1300, marginBottom: 56 }}>Buyers go with the first agent who responds.</div>
      <div style={{ display: 'flex', gap: 90 }}>
        <div style={{ ...up(frame, 30) }}>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 150, background: `linear-gradient(120deg, ${TEAL_BRIGHT}, ${TEAL})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', lineHeight: 1 }}><CountUp to={78} suffix="%" start={34} /></div>
          <div style={{ fontFamily: INTER, fontSize: 28, color: MUTED, maxWidth: 420 }}>work with the first agent who responds</div>
        </div>
        <div style={{ ...up(frame, 46), borderLeft: `1px solid ${TEAL}33`, paddingLeft: 90 }}>
          <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 150, color: RED, lineHeight: 1 }}>&lt;5<span style={{ fontSize: 60 }}> min</span></div>
          <div style={{ fontFamily: INTER, fontSize: 28, color: MUTED, maxWidth: 420 }}>before a lead goes cold — miss it and it's gone</div>
        </div>
      </div>
    </AbsoluteFill>
  )
}
// 5. THE CALL
const bubbles = [
  { who: 'in', t: 'Hi — is the Maple Ave house still available?' },
  { who: 'out', t: 'It is! 3-bed, listed at $415K. What would you like to know?' },
  { who: 'in', t: 'The schools nearby — and is there a hospital close?' },
  { who: 'out', t: 'Riverside district, elementary half a mile. Mercy General is about ten minutes.' },
  { who: 'in', t: 'Perfect. Can I see it Saturday?' },
  { who: 'out', t: 'Booked ✅ Saturday 10am — on your calendar, confirmation texted.' },
]
const TheCall: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 440)
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 90 }}>
      <Eyebrow frame={frame} start={4}>Knows your listings &amp; the neighborhood</Eyebrow>
      <div style={{ ...up(frame, 10), width: 1240, background: 'rgba(8,25,29,0.72)', border: `1px solid ${TEAL}44`, borderRadius: 28, padding: '30px 34px', boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <Orb size={60} /><div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 28, color: WHITE }}>Orby</div>
          <div style={{ fontFamily: INTER, fontSize: 20, color: GREEN }}>● on a call</div>
          <div style={{ marginLeft: 'auto' }}><Wave /></div>
        </div>
        {bubbles.map((b, i) => {
          const st = up(frame, 26 + i * 30, 12)
          const mine = b.who === 'out'
          return (
            <div key={i} style={{ ...st, display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 13 }}>
              <div style={{ maxWidth: 800, fontFamily: INTER, fontSize: 28, lineHeight: 1.38, color: mine ? '#04181F' : WHITE, background: mine ? `linear-gradient(120deg, ${TEAL_BRIGHT}, ${TEAL})` : 'rgba(255,255,255,0.06)', border: mine ? 'none' : `1px solid ${TEAL}33`, borderRadius: 18, padding: '15px 22px', fontWeight: mine ? 600 : 400 }}>{b.t}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}
// 6. OFFER
const Offer: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 200)
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120, textAlign: 'center' }}>
      <Eyebrow frame={frame} start={4}>Founding offer — live now</Eyebrow>
      <div style={{ ...up(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 90, color: WHITE, lineHeight: 1.06 }}><span style={{ color: TEAL_BRIGHT }}>$250</span> setup · <span style={{ color: TEAL_BRIGHT }}>50% off</span> year one</div>
      <div style={{ ...up(frame, 36), fontFamily: INTER, fontSize: 34, color: MUTED, marginTop: 26 }}>We set up and launch Orby for you. Hear her first — call the demo line.</div>
      <div style={{ ...up(frame, 60), fontFamily: SORA, fontWeight: 800, fontSize: 56, color: WHITE, marginTop: 40 }}>📞 +1 (470) 517-3441</div>
    </AbsoluteFill>
  )
}
// 7. CTA
const Cta: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const s = spring({ frame: frame - 6, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120, textAlign: 'center' }}>
      <div style={{ transform: `scale(${0.94 + s * 0.06})` }}>
        <Orb size={130} />
        <div style={{ ...up(frame, 12), fontFamily: SORA, fontWeight: 800, fontSize: 72, color: WHITE, marginTop: 36 }}>Stop losing commissions to voicemail.</div>
        <div style={{ ...up(frame, 40), fontFamily: INTER, fontWeight: 800, fontSize: 40, color: '#04181F', background: `linear-gradient(120deg, ${TEAL_BRIGHT}, ${TEAL})`, borderRadius: 100, padding: '22px 46px', display: 'inline-block', marginTop: 36 }}>Book a call</div>
        <div style={{ ...up(frame, 60), fontFamily: SORA, fontWeight: 800, fontSize: 50, color: WHITE, marginTop: 30 }}>MyOrbis<span style={{ color: TEAL_BRIGHT }}>Agents</span>.com</div>
      </div>
    </AbsoluteFill>
  )
}

export const OrbyAgentsMarketing: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: INTER, backgroundColor: BG_BOT }}>
    <Backdrop />
    <Audio src={staticFile('audio/narr-marketing-en.mp3')} />
    <Sequence durationInFrames={410}><Hook /></Sequence>
    <Sequence from={410} durationInFrames={290}><What /></Sequence>
    <Sequence from={700} durationInFrames={320}><Who /></Sequence>
    <Sequence from={1020} durationInFrames={300}><Why /></Sequence>
    <Sequence from={1320} durationInFrames={470}><TheCall /></Sequence>
    <Sequence from={1790} durationInFrames={230}><Offer /></Sequence>
    <Sequence from={2020} durationInFrames={110}><Cta /></Sequence>
  </AbsoluteFill>
)
