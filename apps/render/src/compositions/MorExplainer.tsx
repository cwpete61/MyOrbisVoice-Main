import React from 'react'
import { AbsoluteFill, Sequence, Audio, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED } from './_theme'
import { OrbitalBg, Eyebrow, Bucket, LEAKS, PILLARS, EASE } from './MorHero'

// ── MyOrbisResults animated explainer — responsive 16:9 AND 9:16 ────────────
// One component, two ratios. Scenes read useVideoConfig(): in portrait, row
// layouts stack to columns, fonts/paddings shrink, and the Trifecta triangle
// uses portrait node coords. Content from myorbisresults.com (Problem / System
// pages): six leaks (+cost), three products + Staff Training, the Trifecta
// loop, the revenue funnel, industries, and the consultation CTA.

const usePortrait = () => { const { width, height } = useVideoConfig(); return height > width }

const LEAK_DETAIL: Array<{ desc: string; cost: string }> = [
  { desc: 'Every lead you ever collected and never followed up with is money already spent that produced nothing. They didn’t say no — they just never heard from you again.', cost: 'Cost: revenue you already paid to acquire, sitting idle.' },
  { desc: 'If you’re not in the Google Map Pack top three for “[your service] near me,” buyers never see you. Thin reviews and a neglected profile keep you off the page where the decision happens.', cost: 'Cost: the customers who chose a competitor they could find.' },
  { desc: 'A ready-to-buy caller hits voicemail or waits hours for a callback. By then they’ve called the next name on the list and booked. Speed-to-lead isn’t a nicety — it’s who wins the job.', cost: 'Cost: hot demand handed to whoever answered first.' },
  { desc: 'Calls get winged. One staffer books everyone, another books no one. Without a repeatable process and trained handoffs, close rates stay low and inconsistent.', cost: 'Cost: deals lost on the phone you already paid to ring.' },
  { desc: 'You pay for ads and referrals, the leads come in, and then… nothing. No nurture, no follow-up sequence, no second touch. The spend converts a fraction of what it should.', cost: 'Cost: most of your ad budget, quietly.' },
  { desc: 'You’re answering phones, chasing quotes, and posting reviews at 11pm instead of running the business. The busywork crowds out the two things that grow revenue: selling and serving.', cost: 'Cost: your time, and the growth it could have bought.' },
]

const PILLAR_DETAIL: Array<{ desc: string; bullets: string[]; live?: boolean }> = [
  { desc: 'Your customers open Google or Maps and type “[service] near me.” If you’re not in the top three, you don’t exist for that search. MyOrbisLocal moves you into the pack — and keeps you there.', bullets: ['Google Business Profile optimization', 'Competitor + category audit', 'Review & reputation signals', 'Service + location content plan', 'Rank tracking'] },
  { desc: 'Visibility sends traffic; the site has to turn it into calls and bookings. MyOrbisWeb builds a local site that mirrors your Google profile so Google trusts the alignment and visitors find a clear path to act.', bullets: ['GBP-mirrored structure', 'Service + location pages', 'Schema + NAP alignment', 'Booking + call CTAs', 'Stays in sync as your profile changes'] },
  { desc: 'Rankings and a converting site are wasted if the call goes to voicemail. MyOrbisVoice answers in under a second — phone, widget, booking page — qualifies, books on your real calendar, and follows up.', bullets: ['AI voice: inbound, outbound, widget, booking', 'Books on your real calendar', 'CRM that grows from calls', 'Email + SMS follow-up campaigns', 'Bilingual EN / ES'], live: true },
  { desc: 'Technology doesn’t fix a broken customer journey on its own. We train your team on the process the system runs on — so it runs inside your business, not just around it.', bullets: ['Lead intake + call standards', 'Missed-call recovery', 'CRM + tagging discipline', 'Sales handoff + objection handling', 'Review + referral process'] },
]

const INDUSTRIES = ['Dental', 'Legal', 'HVAC', 'Plumbing', 'Fitness', 'Med spas', 'Salons', 'Roofing', 'Electrical', 'Home services', 'Multi-location brands']

const ChapterWrap: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [dur - 18, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}

const rise = (frame: number, at: number, dist = 26) => ({
  opacity: interpolate(frame, [at, at + 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
  transform: `translateY(${interpolate(frame, [at, at + 22], [dist, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })}px)`,
})

// ── Ch1 Hook ──
const Hook: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const P = usePortrait()
  const pop = spring({ frame: frame - 6, fps, config: { damping: 16, mass: 0.7 }, durationInFrames: 32 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: P ? '0 70px' : '0 720px 0 150px', textAlign: P ? 'center' : 'left' }}>
      <div style={{ display: 'flex', justifyContent: P ? 'center' : 'flex-start' }}><Eyebrow>MyOrbisResults</Eyebrow></div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 64 : 92, lineHeight: 1.05, letterSpacing: -2, color: WHITE, opacity: pop, transform: `translateY(${interpolate(pop, [0, 1], [40, 0])}px)` }}>
        Your business is leaking revenue in <span style={{ color: TEAL_BRIGHT }}>six places at once.</span>
      </div>
      <div style={{ ...rise(frame, 28), fontFamily: INTER, fontWeight: 500, fontSize: P ? 28 : 32, color: MUTED, marginTop: 26, maxWidth: P ? '100%' : 900 }}>
        A new tool plugs one hole. The other five keep draining. Here’s each one — and the one system that seals them all.
      </div>
    </AbsoluteFill>
  )
}

// ── Ch2 Problem intro (bucket) ──
const ProblemIntro: React.FC = () => {
  const frame = useCurrentFrame(); const P = usePortrait()
  return (
    <AbsoluteFill style={{ flexDirection: P ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: P ? 30 : 90, padding: P ? '0 70px' : '0 130px', textAlign: P ? 'center' : 'left' }}>
      <div style={{ transform: `scale(${interpolate(frame, [0, 26], [P ? 0.7 : 0.85, P ? 0.82 : 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })})`, opacity: interpolate(frame, [0, 22], [0, 1], { extrapolateRight: 'clamp' }) }}><Bucket /></div>
      <div style={{ maxWidth: P ? '100%' : 760 }}>
        <div style={{ display: 'flex', justifyContent: P ? 'center' : 'flex-start' }}><Eyebrow>The Real Problem</Eyebrow></div>
        <div style={{ ...rise(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: P ? 52 : 72, lineHeight: 1.06, letterSpacing: -2, color: WHITE }}>
          You don’t have one problem. You have a bucket with <span style={{ color: TEAL_BRIGHT }}>six holes.</span>
        </div>
        <div style={{ ...rise(frame, 34), fontFamily: INTER, fontWeight: 500, fontSize: P ? 26 : 30, color: MUTED, marginTop: 22 }}>
          Each hole drains a little. Together they bleed your business dry.
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Ch3 per-leak deep dive ──
const LeakScene: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame(); const P = usePortrait()
  const leak = LEAKS[i]; const detail = LEAK_DETAIL[i]
  const num = String(i + 1).padStart(2, '0')
  return (
    <AbsoluteFill style={{ flexDirection: P ? 'column' : 'row', padding: P ? '0 70px' : '0 140px', alignItems: 'center', justifyContent: 'center', gap: P ? 16 : 80, textAlign: P ? 'center' : 'left' }}>
      <div style={{ flexShrink: 0, width: P ? 'auto' : 360, display: 'flex', flexDirection: 'column', alignItems: P ? 'center' : 'flex-start' }}>
        <div style={{ ...rise(frame, 4), fontFamily: SORA, fontWeight: 800, fontSize: P ? 120 : 200, lineHeight: 1, color: leak.color, opacity: interpolate(frame, [4, 26], [0, 0.9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }) }}>{num}</div>
        <div style={{ width: 96, height: 8, borderRadius: 8, background: leak.color, marginTop: 10, ...rise(frame, 14) }} />
      </div>
      <div style={{ flex: P ? undefined : 1, maxWidth: P ? '100%' : 1080 }}>
        <div style={{ ...rise(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: P ? 52 : 84, letterSpacing: -2, color: WHITE, marginBottom: P ? 18 : 26 }}>{leak.name}</div>
        <div style={{ ...rise(frame, 24), fontFamily: INTER, fontWeight: 500, fontSize: P ? 28 : 36, lineHeight: 1.5, color: MUTED }}>{detail.desc}</div>
        <div style={{ ...rise(frame, 44), fontFamily: SORA, fontWeight: 700, fontSize: P ? 22 : 28, color: leak.color, marginTop: P ? 26 : 34 }}>{detail.cost}</div>
      </div>
    </AbsoluteFill>
  )
}

// ── Ch4 planning gap ──
const PlanningGap: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const P = usePortrait()
  const pop = spring({ frame, fps, config: { damping: 15, mass: 0.7 }, durationInFrames: 28 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: P ? '0 70px' : '0 220px' }}>
      <Eyebrow color="#FFB347">Why Patching Fails</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 54 : 80, lineHeight: 1.08, letterSpacing: -2, color: WHITE, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.92, 1])})` }}>
        Fix one hole, the bucket still drains.
      </div>
      <div style={{ ...rise(frame, 30), fontFamily: INTER, fontWeight: 500, fontSize: P ? 27 : 32, color: MUTED, marginTop: 30, textAlign: 'center', maxWidth: P ? '100%' : 1200 }}>
        A chatbot doesn’t fix invisibility. SEO doesn’t answer the phone. Only a connected system seals all six at once.
      </div>
    </AbsoluteFill>
  )
}

// ── Ch5 system intro ──
const SystemIntro: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const P = usePortrait()
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.7 }, durationInFrames: 28 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: P ? '0 70px' : '0 200px' }}>
      <Eyebrow>The System</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 58 : 92, letterSpacing: -2.5, color: WHITE, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})` }}>
        One system. Every leak <span style={{ color: TEAL_BRIGHT }}>sealed.</span> Revenue that compounds.
      </div>
      <div style={{ ...rise(frame, 30), fontFamily: INTER, fontWeight: 500, fontSize: P ? 27 : 32, color: MUTED, marginTop: 28, textAlign: 'center', maxWidth: P ? '100%' : 1100 }}>
        Three products — Local, Web, Voice — that feed each other, plus Staff Training to make it stick.
      </div>
    </AbsoluteFill>
  )
}

// ── Ch6 per-pillar deep dive ──
const PillarScene: React.FC<{ i: number }> = ({ i }) => {
  const frame = useCurrentFrame(); const P = usePortrait()
  const p = PILLARS[i]; const d = PILLAR_DETAIL[i]
  return (
    <AbsoluteFill style={{ flexDirection: P ? 'column' : 'row', padding: P ? '0 70px' : '0 140px', alignItems: 'center', justifyContent: 'center', gap: P ? 26 : 80, textAlign: P ? 'center' : 'left' }}>
      <div style={{ flex: P ? undefined : 1, maxWidth: P ? '100%' : 980 }}>
        <div style={{ ...rise(frame, 4), display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: INTER, fontWeight: 800, fontSize: P ? 20 : 24, letterSpacing: 4, color: p.color, textTransform: 'uppercase', marginBottom: 16 }}>
          <span style={{ fontFamily: SORA, fontSize: P ? 26 : 30 }}>{String(i + 1).padStart(2, '0')}</span> {p.tag}
          {d.live && <span style={{ fontFamily: INTER, fontSize: 15, letterSpacing: 1, color: '#06141A', background: TEAL_BRIGHT, borderRadius: 999, padding: '4px 12px' }}>LIVE TODAY</span>}
        </div>
        <div style={{ ...rise(frame, 12), fontFamily: SORA, fontWeight: 800, fontSize: P ? 52 : 80, letterSpacing: -2, color: WHITE, marginBottom: 22 }}>{p.title}</div>
        <div style={{ ...rise(frame, 24), fontFamily: INTER, fontWeight: 500, fontSize: P ? 26 : 32, lineHeight: 1.5, color: MUTED, maxWidth: P ? '100%' : 900 }}>{d.desc}</div>
      </div>
      <div style={{ flexShrink: 0, width: P ? '100%' : 560, textAlign: 'left' }}>
        {d.bullets.map((b, k) => (
          <div key={b} style={{ ...rise(frame, 40 + k * 8), display: 'flex', alignItems: 'center', gap: 16, padding: P ? '12px 0' : '16px 0', borderBottom: `1px solid ${p.color}33` }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: p.color, flexShrink: 0 }} />
            <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: P ? 24 : 28, color: WHITE }}>{b}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

// ── Ch7 Trifecta — three products working together ──
const TRI_L = [
  { short: 'Local', cx: 960, cy: 250, color: '#FFD23F' },
  { short: 'Voice', cx: 690, cy: 640, color: '#3FE3E3' },
  { short: 'Web', cx: 1230, cy: 640, color: '#5BC8FF' },
]
const TRI_P = [
  { short: 'Local', cx: 540, cy: 760, color: '#FFD23F' },
  { short: 'Voice', cx: 330, cy: 1200, color: '#3FE3E3' },
  { short: 'Web', cx: 750, cy: 1200, color: '#5BC8FF' },
]
const EDGES: Array<[number, number]> = [[0, 1], [1, 2], [2, 0]]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const Trifecta: React.FC = () => {
  const frame = useCurrentFrame(); const P = usePortrait()
  const TRI = P ? TRI_P : TRI_L
  const vb = P ? '0 0 1080 1920' : '0 0 1920 1080'
  const sw = P ? 1080 : 1920, sh = P ? 1920 : 1080
  const ring = P ? { cx: 540, cy: 980, rx: 340, ry: 380, ly: 1378 } : { cx: 960, cy: 445, rx: 530, ry: 318, ly: 752 }
  const tf = P ? 'none' : 'translateY(150px)'
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: P ? 110 : 54, padding: P ? '110px 60px 0' : '54px 0 0' }}>
        <Eyebrow>The Trifecta</Eyebrow>
        <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 54 : 62, letterSpacing: -1.5, color: WHITE, textAlign: 'center' }}>Three products. <span style={{ color: TEAL_BRIGHT }}>One loop.</span></div>
        <div style={{ ...rise(frame, 18), fontFamily: INTER, fontWeight: 500, fontSize: P ? 24 : 26, color: MUTED, marginTop: 14, textAlign: 'center' }}>Each feeds the next — and Staff Training makes it stick.</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <svg width={sw} height={sh} viewBox={vb} style={{ transform: tf }}>
          <ellipse cx={ring.cx} cy={ring.cy} rx={ring.rx} ry={ring.ry} fill="none" stroke={TEAL} strokeWidth={2} strokeDasharray="10 12"
            opacity={interpolate(frame, [6, 30], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
          <text x={ring.cx} y={ring.ly} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={800} fontSize={20} letterSpacing={4} fill={TEAL}
            opacity={interpolate(frame, [12, 34], [0, 0.85], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>STAFF TRAINING · MAKES IT STICK</text>
          {EDGES.map((e, i) => {
            const a = TRI[e[0]], b = TRI[e[1]]
            const op = interpolate(frame, [22 + i * 6, 44 + i * 6], [0, 0.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return <line key={i} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={a.color} strokeWidth={2.5} strokeLinecap="round" opacity={op} />
          })}
          {EDGES.map((e, i) => {
            const a = TRI[e[0]], b = TRI[e[1]]
            const period = 48
            const t = (((frame - 44) + i * 16) % period + period) % period / period
            const vis = frame > 46 ? 0.95 : 0
            return <circle key={i} cx={lerp(a.cx, b.cx, t)} cy={lerp(a.cy, b.cy, t)} r={9} fill={a.color} opacity={vis} />
          })}
          {TRI.map((n, i) => {
            const s = interpolate(frame, [10 + i * 8, 34 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
            return (
              <g key={n.short} opacity={s}>
                <circle cx={n.cx} cy={n.cy} r={92} fill="#0c1a20" stroke={n.color} strokeWidth={3} />
                <text x={n.cx} y={n.cy - 8} textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={600} fontSize={15} fill={MUTED}>MyOrbis</text>
                <text x={n.cx} y={n.cy + 26} textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight={800} fontSize={36} fill={n.color}>{n.short}</text>
              </g>
            )
          })}
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// ── Ch8 funnel ──
const FUNNEL = [
  { label: 'Getting Leads', color: '#FFD23F', top: [40, 380], bot: [72, 348] },
  { label: 'Appointments', color: '#3FE3E3', top: [72, 348], bot: [108, 312] },
  { label: 'Closing Deals', color: '#5BC8FF', top: [108, 312], bot: [144, 276] },
  { label: 'Customer Referrals', color: '#9B7BFF', top: [144, 276], bot: [180, 240] },
]
const Funnel: React.FC = () => {
  const frame = useCurrentFrame(); const P = usePortrait()
  return (
    <AbsoluteFill style={{ flexDirection: P ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', padding: P ? '0 70px' : '0 150px', gap: P ? 30 : 90, textAlign: P ? 'center' : 'left' }}>
      <div style={{ flexShrink: 0 }}>
        <svg width={P ? 440 : 520} height={P ? 423 : 500} viewBox="0 0 420 400">
          <defs><linearGradient id="ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={TEAL_BRIGHT} /><stop offset="1" stopColor={TEAL} /></linearGradient></defs>
          {FUNNEL.map((f, i) => {
            const y0 = 24 + i * 68, y1 = y0 + 60
            const op = interpolate(frame, [10 + i * 10, 30 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
            return (
              <g key={f.label} opacity={op}>
                <path d={`M${f.top[0]} ${y0} L${f.top[1]} ${y0} L${f.bot[1]} ${y1} L${f.bot[0]} ${y1} Z`} fill={f.color} fillOpacity={0.14} stroke={f.color} strokeWidth={1.5} />
                <text x={210} y={y0 + 38} textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight={700} fontSize={20} fill={f.color}>{f.label}</text>
              </g>
            )
          })}
          <rect x={120} y={316} width={180} height={48} rx={24} fill="url(#ev)" opacity={interpolate(frame, [54, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
          <text x={210} y={346} textAnchor="middle" fontFamily="Sora, sans-serif" fontWeight={800} fontSize={20} fill="#06141A" opacity={interpolate(frame, [54, 74], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>Repeat Revenue</text>
        </svg>
      </div>
      <div style={{ flex: P ? undefined : 1, maxWidth: P ? '100%' : 880 }}>
        <div style={{ display: 'flex', justifyContent: P ? 'center' : 'flex-start' }}><Eyebrow>What It Produces</Eyebrow></div>
        <div style={{ ...rise(frame, 8), fontFamily: SORA, fontWeight: 800, fontSize: P ? 46 : 64, letterSpacing: -1.5, color: WHITE, marginBottom: 22 }}>From first search to <span style={{ color: TEAL_BRIGHT }}>repeat revenue.</span></div>
        <div style={{ ...rise(frame, 26), fontFamily: INTER, fontWeight: 500, fontSize: P ? 26 : 32, lineHeight: 1.5, color: MUTED }}>Every stage hands off to the next — so the funnel keeps refilling itself instead of drying up the moment you stop hustling.</div>
      </div>
    </AbsoluteFill>
  )
}

// ── Ch9 industries ──
const Industries: React.FC = () => {
  const frame = useCurrentFrame(); const P = usePortrait()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: P ? '0 50px' : '0 160px' }}>
      <Eyebrow>Built For</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 48 : 72, letterSpacing: -2, color: WHITE, textAlign: 'center', marginBottom: 44 }}>The businesses the phone <span style={{ color: TEAL_BRIGHT }}>actually runs.</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: P ? 14 : 18, justifyContent: 'center', maxWidth: P ? '100%' : 1400 }}>
        {INDUSTRIES.map((c, i) => {
          const op = interpolate(frame, [10 + i * 5, 28 + i * 5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
          return <span key={c} style={{ opacity: op, fontFamily: SORA, fontWeight: 600, fontSize: P ? 24 : 32, color: WHITE, padding: P ? '11px 20px' : '14px 28px', borderRadius: 999, border: `1.5px solid ${TEAL}66`, background: `${TEAL}1a` }}>{c}</span>
        })}
      </div>
    </AbsoluteFill>
  )
}

// ── CTA ──
const Cta: React.FC = () => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const P = usePortrait()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 }, durationInFrames: 26 })
  const pill = interpolate(frame, [22, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: P ? '0 60px' : '0' }}>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 60 : 100, letterSpacing: -2.5, color: WHITE, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.88, 1])})`, marginBottom: 40 }}>
        Stop patching. <span style={{ color: TEAL_BRIGHT }}>Start compounding.</span>
      </div>
      <div style={{ opacity: pill, transform: `translateY(${interpolate(pill, [0, 1], [20, 0])}px)`, padding: P ? '20px 36px' : '26px 60px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33`, marginBottom: 28, textAlign: 'center' }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: P ? 32 : 48, color: WHITE }}>Book a free Trifecta Consultation</span>
      </div>
      <div style={{ opacity: pill, fontFamily: INTER, fontWeight: 700, fontSize: P ? 28 : 40, color: TEAL_BRIGHT, letterSpacing: 1 }}>myorbisresults.com</div>
    </AbsoluteFill>
  )
}

const LEAD_IN = 12
const LEAD_OUT = 36

// Picture-in-picture talking presenter (happyhorse-1.0-i2v, audio-driven).
// Muted — the narration track already plays the same audio. Bottom-right card.
const PresenterPiP: React.FC<{ clip: string; dur: number }> = ({ clip, dur }) => {
  const P = usePortrait()
  const w = P ? 300 : 340
  return (
    <Sequence from={LEAD_IN} durationInFrames={dur} layout="none">
      <div style={{ position: 'absolute', right: P ? 44 : 64, bottom: P ? 150 : 64, width: w, height: Math.round(w * 1.5), borderRadius: 22, overflow: 'hidden', border: `2px solid ${TEAL_BRIGHT}88`, boxShadow: '0 14px 44px #000b', background: '#0c1a20' }}>
        <OffthreadVideo src={staticFile(clip)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </Sequence>
  )
}

// Each scene carries its own narration file (Orby/Aoede) + measured length in
// frames @30fps. Audio is loudness-normalized + 1.1× original speed. Audio
// filename is explicit so removing a scene never misaligns clips.
const CHAPTERS: Array<{ node: React.ReactNode; frames: number; audio: string }> = [
  { node: <Hook />,            frames: 367, audio: '01.wav' },
  { node: <ProblemIntro />,    frames: 237, audio: '02.wav' },
  { node: <LeakScene i={0} />, frames: 306, audio: '03.wav' },
  { node: <LeakScene i={1} />, frames: 347, audio: '04.wav' },
  { node: <LeakScene i={2} />, frames: 337, audio: '05.wav' },
  { node: <LeakScene i={3} />, frames: 304, audio: '06.wav' },
  { node: <LeakScene i={4} />, frames: 326, audio: '07.wav' },
  { node: <LeakScene i={5} />, frames: 351, audio: '08.wav' },
  { node: <PlanningGap />,     frames: 365, audio: '09.wav' },
  { node: <SystemIntro />,     frames: 339, audio: '10.wav' },
  { node: <PillarScene i={0} />, frames: 274, audio: '11.wav' },
  { node: <PillarScene i={1} />, frames: 274, audio: '12.wav' },
  { node: <PillarScene i={2} />, frames: 446, audio: '13.wav' },
  { node: <PillarScene i={3} />, frames: 227, audio: '14.wav' },
  { node: <Trifecta />,        frames: 509, audio: '15.wav' },
  { node: <Funnel />,          frames: 271, audio: '16.wav' },
  { node: <Industries />,      frames: 291, audio: '17.wav' },
  { node: <Cta />,             frames: 259, audio: '19.wav' },
]

export const MOR_EXPLAINER_FRAMES = CHAPTERS.reduce((a, c) => a + c.frames + LEAD_IN + LEAD_OUT, 0)

export const MorExplainer: React.FC = () => {
  let from = 0
  return (
    <AbsoluteFill style={{ backgroundColor: '#06141A' }}>
      {/* Background music bed — 21% volume (~85% under Orby's voice), looped to cover the full runtime. */}
      <Audio src={staticFile('music/glass-slide.mp3')} volume={0.21} loop />
      <OrbitalBg dim={0.85} />
      {CHAPTERS.map((c, k) => {
        const dur = c.frames + LEAD_IN + LEAD_OUT
        const start = from
        from += dur
        return (
          <Sequence key={k} from={start} durationInFrames={dur}>
            <ChapterWrap dur={dur}>{c.node}</ChapterWrap>
            <PresenterPiP clip={`broll/presenter-${c.audio.replace('.wav', '')}.mp4`} dur={c.frames} />
            <Sequence from={LEAD_IN} durationInFrames={c.frames} layout="none">
              <Audio src={staticFile(`narration/${c.audio}`)} />
            </Sequence>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
