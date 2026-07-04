// MyOrbisAgents — SHORT homepage explainer (~33s, 16:9).
// Beats synced to Orby's (Aoede) narration in public/audio/narr-short-en.mp3:
//   Hook (0-7s) → What (7-15s) → Proof/sample call (15-24s) → Offer+CTA (24-33s)
// Motion is frame-driven (interpolate/spring) per Remotion rules — no CSS anims.
import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, staticFile, Easing, Audio } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, TEAL_DEEP, GREEN, WHITE, MUTED, BG_TOP, BG_BOT } from './_theme'

export const ORBY_AGENTS_SHORT_FRAMES = 990 // 33s @ 30fps

const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const up = (frame: number, start: number, dur = 16, dist = 26) => {
  const p = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` }
}
const fade = (frame: number, inStart: number, outStart: number, dur = 14) =>
  interpolate(frame, [inStart, inStart + dur, outStart, outStart + dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

// ---------- shared backdrop ----------
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const g1 = interpolate(frame % 300, [0, 150, 300], [0.35, 0.6, 0.35])
  const g2 = interpolate(frame % 360, [0, 180, 360], [0.5, 0.28, 0.5])
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG_TOP} 0%, #04181F 58%, ${BG_BOT} 100%)` }}>
      <div style={{ position: 'absolute', top: '-18%', left: '-10%', width: 900, height: 900, borderRadius: '50%', background: TEAL, filter: 'blur(180px)', opacity: g1 * 0.5 }} />
      <div style={{ position: 'absolute', bottom: '-22%', right: '-12%', width: 820, height: 820, borderRadius: '50%', background: TEAL_BRIGHT, filter: 'blur(190px)', opacity: g2 * 0.28 }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${'rgba(63,227,227,0.05)'} 1px, transparent 1px), linear-gradient(90deg, ${'rgba(63,227,227,0.05)'} 1px, transparent 1px)`, backgroundSize: '64px 64px', maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)' }} />
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

// ---------- Scene 1: HOOK ----------
const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 190)
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: 'center', alignItems: 'center', padding: 120, textAlign: 'center' }}>
      <Eyebrow frame={frame} start={4}>Real estate</Eyebrow>
      <div style={{ ...up(frame, 12), fontFamily: SORA, fontWeight: 800, fontSize: 96, lineHeight: 1.05, color: WHITE, maxWidth: 1500 }}>
        A missed call isn't a missed lead.
      </div>
      <div style={{ ...up(frame, 60), fontFamily: SORA, fontWeight: 800, fontSize: 96, lineHeight: 1.05, marginTop: 10, background: `linear-gradient(100deg, ${TEAL_BRIGHT}, ${TEAL})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        It's a missed commission.
      </div>
      <div style={{ ...up(frame, 108), fontFamily: INTER, fontSize: 34, color: MUTED, marginTop: 34 }}>Buyers work with whoever answers first.</div>
    </AbsoluteFill>
  )
}

// ---------- Scene 2: WHAT ----------
const chips = ['📞 Calls', '💬 Texts', '🌐 Web leads', '📅 Calendar']
const What: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 220)
  return (
    <AbsoluteFill style={{ opacity: o, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90, padding: 130 }}>
      <div style={{ ...up(frame, 6) }}><Orb size={360} /></div>
      <div style={{ maxWidth: 820 }}>
        <Eyebrow frame={frame} start={10}>Meet Orby</Eyebrow>
        <div style={{ ...up(frame, 16), fontFamily: SORA, fontWeight: 800, fontSize: 72, lineHeight: 1.08, color: WHITE }}>Your AI inside sales agent.</div>
        <div style={{ ...up(frame, 44), fontFamily: INTER, fontSize: 33, color: MUTED, marginTop: 22, lineHeight: 1.5 }}>Answers every call, text, and web lead the second it comes in — <b style={{ color: WHITE }}>24/7</b>, in <b style={{ color: WHITE }}>English &amp; Spanish</b>.</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 34 }}>
          {chips.map((c, i) => (
            <div key={c} style={{ ...up(frame, 70 + i * 8), fontFamily: INTER, fontSize: 26, fontWeight: 600, color: WHITE, background: 'rgba(63,227,227,0.10)', border: `1px solid ${TEAL}55`, borderRadius: 100, padding: '12px 22px' }}>{c}</div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ---------- Scene 3: PROOF (sample call) ----------
const bubbles = [
  { who: 'in', t: 'How are the schools nearby? And is there a hospital close by?' },
  { who: 'out', t: 'It’s in the Riverside district — closest elementary is half a mile. Nearest hospital, Mercy General, about ten minutes.' },
  { who: 'in', t: 'Perfect. Can I see it Saturday?' },
  { who: 'out', t: 'Booked ✅ Saturday at 10 — I’ve added it to your calendar and texted a confirmation.' },
]
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
const Proof: React.FC = () => {
  const frame = useCurrentFrame()
  const o = fade(frame, 0, 250)
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120 }}>
      <Eyebrow frame={frame} start={4}>Knows your listings &amp; the neighborhood</Eyebrow>
      <div style={{ ...up(frame, 10), width: 1180, background: 'rgba(8,25,29,0.72)', border: `1px solid ${TEAL}44`, borderRadius: 28, padding: 34, boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <Orb size={64} />
          <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 28, color: WHITE }}>Orby</div>
          <div style={{ fontFamily: INTER, fontSize: 20, color: GREEN, marginLeft: 4 }}>● on a call</div>
          <div style={{ marginLeft: 'auto' }}><Wave /></div>
        </div>
        {bubbles.map((b, i) => {
          const s = 24 + i * 34
          const st = up(frame, s, 14)
          const mine = b.who === 'out'
          return (
            <div key={i} style={{ ...st, display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
              <div style={{ maxWidth: 780, fontFamily: INTER, fontSize: 30, lineHeight: 1.4, color: mine ? '#04181F' : WHITE, background: mine ? `linear-gradient(120deg, ${TEAL_BRIGHT}, ${TEAL})` : 'rgba(255,255,255,0.06)', border: mine ? 'none' : `1px solid ${TEAL}33`, borderRadius: 20, padding: '18px 24px', fontWeight: mine ? 600 : 400 }}>{b.t}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ---------- Scene 4: OFFER + CTA ----------
const Offer: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const s = spring({ frame: frame - 8, fps, config: { damping: 200 } })
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center', padding: 120, textAlign: 'center' }}>
      <div style={{ transform: `scale(${0.94 + s * 0.06})` }}>
        <Eyebrow frame={frame} start={4}>Founding offer</Eyebrow>
        <div style={{ ...up(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 84, color: WHITE, lineHeight: 1.06 }}>
          <span style={{ color: TEAL_BRIGHT }}>$250</span> setup · <span style={{ color: TEAL_BRIGHT }}>50% off</span> year one
        </div>
        <div style={{ ...up(frame, 40), display: 'flex', gap: 18, justifyContent: 'center', marginTop: 44 }}>
          <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 34, color: '#04181F', background: `linear-gradient(120deg, ${TEAL_BRIGHT}, ${TEAL})`, borderRadius: 100, padding: '20px 40px' }}>Book a call</div>
          <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 34, color: WHITE, border: `1px solid ${TEAL}66`, borderRadius: 100, padding: '20px 40px' }}>📞 +1 (470) 517-3441</div>
        </div>
        <div style={{ ...up(frame, 70), fontFamily: SORA, fontWeight: 800, fontSize: 46, color: WHITE, marginTop: 52, letterSpacing: 0.5 }}>MyOrbis<span style={{ color: TEAL_BRIGHT }}>Agents</span>.com</div>
      </div>
    </AbsoluteFill>
  )
}

export const OrbyAgentsShort: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily: INTER, backgroundColor: BG_BOT }}>
      <Backdrop />
      <Audio src={staticFile('audio/narr-short-en.mp3')} />
      <Sequence durationInFrames={205}><Hook /></Sequence>
      <Sequence from={205} durationInFrames={245}><What /></Sequence>
      <Sequence from={450} durationInFrames={265}><Proof /></Sequence>
      <Sequence from={715} durationInFrames={275}><Offer /></Sequence>
    </AbsoluteFill>
  )
}
