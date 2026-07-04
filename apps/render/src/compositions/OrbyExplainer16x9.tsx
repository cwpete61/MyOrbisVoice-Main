import React from 'react'
import { AbsoluteFill, Sequence, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'
import { SORA, INTER } from './_theme'

// ── Orby Explainer 16:9 — overlay graphics on the provided 5:05 presenter video ──
// Base: public/source/orby-explainer.mp4 (talking head, #8C8C8C studio gray, its
// own audio). Per topic window the presenter slides LEFT/RIGHT (alternating) and
// timed technical graphics fill the opposite half. Background matches the video
// gray so the slide is seamless. Timeline from the Whisper transcript.

const FPS = 30
const BG = '#8C8C8C'           // sampled from the source video bg
const INK = '#0E1B22'
const TEAL = '#0E6E6E'
const TEALB = '#11A3A3'
const CARD = 'rgba(247,250,251,0.94)'
const SHIFT = 480
const EASE = Easing.bezier(0.16, 1, 0.3, 1)

const LK = { dead: '#C2541F', invis: '#C79200', cold: '#1B8FA8', noproc: '#2E78C4', waste: '#6E55C9', owner: '#C23F75' }

const f = (sec: number) => Math.round(sec * FPS)
const rise = (frame: number, at: number, d = 24) => ({
  opacity: interpolate(frame, [at, at + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
  transform: `translateY(${interpolate(frame, [at, at + 20], [d, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })}px)`,
})

// ── small graphic building blocks (styled for gray bg) ──
const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = TEAL }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: INTER, fontWeight: 800, fontSize: 20, letterSpacing: 4, color, textTransform: 'uppercase', marginBottom: 18 }}>
    <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />{children}
  </div>
)

const Statement: React.FC<{ eyebrow?: string; title: React.ReactNode; sub?: string; color?: string }> = ({ eyebrow, title, sub, color }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      {eyebrow && <div style={rise(frame, 2)}><Eyebrow color={color}>{eyebrow}</Eyebrow></div>}
      <div style={{ ...rise(frame, 8), fontFamily: SORA, fontWeight: 800, fontSize: 64, lineHeight: 1.07, letterSpacing: -1.5, color: INK }}>{title}</div>
      {sub && <div style={{ ...rise(frame, 24), fontFamily: INTER, fontWeight: 500, fontSize: 28, lineHeight: 1.5, color: '#2C3B43', marginTop: 22 }}>{sub}</div>}
    </div>
  )
}

const LeakCard: React.FC<{ num: string; name: string; color: string; line: string }> = ({ num, name, color, line }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div style={{ ...rise(frame, 2), fontFamily: SORA, fontWeight: 800, fontSize: 150, lineHeight: 1, color }}>{num}</div>
      <div style={{ width: 90, height: 7, borderRadius: 8, background: color, margin: '6px 0 22px', ...rise(frame, 10) }} />
      <div style={{ ...rise(frame, 14), fontFamily: SORA, fontWeight: 800, fontSize: 60, letterSpacing: -1, color: INK, marginBottom: 18 }}>{name}</div>
      <div style={{ ...rise(frame, 26), fontFamily: INTER, fontWeight: 500, fontSize: 30, lineHeight: 1.5, color: '#28363D' }}>{line}</div>
    </div>
  )
}

const PillarCard: React.FC<{ tag: string; title: string; bullets: string[]; color: string; live?: boolean }> = ({ tag, title, bullets, color, live }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div style={{ ...rise(frame, 2), display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: INTER, fontWeight: 800, fontSize: 20, letterSpacing: 3, color, textTransform: 'uppercase', marginBottom: 14 }}>
        {tag}{live && <span style={{ fontSize: 14, color: '#fff', background: color, borderRadius: 999, padding: '3px 10px', letterSpacing: 1 }}>LIVE</span>}
      </div>
      <div style={{ ...rise(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 60, letterSpacing: -1.5, color: INK, marginBottom: 24 }}>{title}</div>
      {bullets.map((b, i) => (
        <div key={b} style={{ ...rise(frame, 24 + i * 7), display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: `1px solid ${INK}22` }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: 26, color: INK }}>{b}</span>
        </div>
      ))}
    </div>
  )
}

const Chips: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {items.map((c, i) => (
        <span key={c} style={{ opacity: interpolate(frame, [4 + i * 4, 20 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }), fontFamily: SORA, fontWeight: 700, fontSize: 28, color: INK, padding: '10px 22px', borderRadius: 999, background: CARD, border: `1.5px solid ${TEAL}55` }}>{c}</span>
      ))}
    </div>
  )
}

const TriMini: React.FC = () => {
  const frame = useCurrentFrame()
  const N = [{ s: 'Local', cx: 420, cy: 120, c: LK.invis }, { s: 'Voice', cx: 250, cy: 420, c: TEALB }, { s: 'Web', cx: 590, cy: 420, c: LK.noproc }]
  const E: [number, number][] = [[0, 1], [1, 2], [2, 0]]
  return (
    <svg width={820} height={620} viewBox="0 0 840 600">
      <ellipse cx={420} cy={310} rx={360} ry={250} fill="none" stroke={TEAL} strokeWidth={2} strokeDasharray="9 11" opacity={interpolate(frame, [4, 24], [0, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      <text x={420} y={580} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={800} fontSize={18} letterSpacing={4} fill={TEAL} opacity={interpolate(frame, [10, 30], [0, 0.9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>STAFF TRAINING · A TEAM BEHIND IT</text>
      {E.map((e, i) => { const a = N[e[0]], b = N[e[1]]; return <line key={i} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={a.c} strokeWidth={2.5} opacity={interpolate(frame, [18 + i * 5, 38 + i * 5], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} /> })}
      {E.map((e, i) => { const a = N[e[0]], b = N[e[1]]; const p = 48; const t = (((frame - 40) + i * 16) % p + p) % p / p; return <circle key={i} cx={a.cx + (b.cx - a.cx) * t} cy={a.cy + (b.cy - a.cy) * t} r={8} fill={a.c} opacity={frame > 42 ? 0.95 : 0} /> })}
      {N.map((n, i) => { const s = interpolate(frame, [8 + i * 7, 30 + i * 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }); return (<g key={n.s} opacity={s}><circle cx={n.cx} cy={n.cy} r={84} fill={CARD} stroke={n.c} strokeWidth={3} /><text x={n.cx} y={n.cy - 6} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={600} fontSize={14} fill="#5A6B72">MyOrbis</text><text x={n.cx} y={n.cy + 26} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight={800} fontSize={32} fill={n.c}>{n.s}</text></g>) })}
    </svg>
  )
}

const BucketMini: React.FC = () => {
  const frame = useCurrentFrame()
  const cols = [LK.dead, LK.invis, LK.cold, LK.noproc, LK.waste, LK.owner]
  return (
    <svg width={520} height={460} viewBox="0 0 420 360">
      <path d="M120 70 L300 70 L280 250 L140 250 Z" fill={CARD} stroke={INK} strokeWidth={2} />
      <ellipse cx={210} cy={70} rx={90} ry={15} fill="#E3EBED" stroke={INK} strokeWidth={2} />
      {[['M150 150 C110 175 95 205 92 240', 92], ['M165 185 C140 215 130 245 128 272', 128], ['M205 210 C205 240 205 262 205 286', 205], ['M250 200 C275 230 285 255 288 280', 288], ['M270 165 C300 192 315 218 320 250', 320], ['M285 135 C320 160 338 188 345 222', 345]].map((d, i) => {
        const t = (frame + i * 8) % 40
        return <g key={i}><path d={d[0] as string} fill="none" stroke={cols[i]} strokeWidth={3} opacity={0.9} /><circle cx={d[1] as number} cy={250 + interpolate(t, [0, 40], [0, 70])} r={5} fill={cols[i]} opacity={interpolate(t, [0, 6, 34, 40], [0, 1, 1, 0])} /></g>
      })}
    </svg>
  )
}

const LoopMini: React.FC = () => {
  const frame = useCurrentFrame()
  const N = [{ l: 'Get Found', cx: 410, cy: 110, c: LK.invis }, { l: 'Convert', cx: 620, cy: 320, c: LK.noproc }, { l: 'Answer & Book', cx: 410, cy: 530, c: TEALB }, { l: 'Better Data', cx: 200, cy: 320, c: LK.waste }]
  return (
    <svg width={820} height={640} viewBox="0 0 820 640">
      <g fill="none" stroke={TEAL} strokeWidth={3} opacity={0.65}>
        <path d="M470 150 A300 300 0 0 1 580 260" /><path d="M580 380 A300 300 0 0 1 470 490" /><path d="M350 490 A300 300 0 0 1 240 380" /><path d="M240 260 A300 300 0 0 1 350 150" />
      </g>
      {N.map((n, i) => { const s = interpolate(frame, [8 + i * 8, 30 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }); return (<g key={n.l} opacity={s}><circle cx={n.cx} cy={n.cy} r={82} fill={CARD} stroke={n.c} strokeWidth={3} /><text x={n.cx} y={n.cy + 6} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight={700} fontSize={22} fill={n.c}>{n.l}</text></g>) })}
    </svg>
  )
}

const ListGraphic: React.FC<{ title: React.ReactNode; items: string[]; eyebrow?: string }> = ({ title, items, eyebrow }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      {eyebrow && <div style={rise(frame, 2)}><Eyebrow>{eyebrow}</Eyebrow></div>}
      <div style={{ ...rise(frame, 8), fontFamily: SORA, fontWeight: 800, fontSize: 54, letterSpacing: -1.5, color: INK, marginBottom: 24 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px' }}>
        {items.map((b, i) => (
          <div key={b} style={{ ...rise(frame, 20 + i * 5), display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: TEALB, fontWeight: 800, fontSize: 24 }}>✓</span>
            <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: 26, color: INK }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── timeline: window start (sec), presenter side, graphic ──
type Win = { t: number; side: 'L' | 'R'; g: React.ReactNode }
const WINS: Win[] = [
  { t: 0,     side: 'R', g: <Statement eyebrow="The Real Problem" title={<>Not a marketing problem. <span style={{ color: TEAL }}>A revenue leak problem.</span></>} sub="Six leaks running at once — draining calls, bookings, reviews, repeat customers, and your focus." /> },
  { t: 15.9,  side: 'L', g: <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}><BucketMini /><Statement title={<>A bucket with <span style={{ color: TEAL }}>six holes.</span></>} sub="Each drains a little. Together they bleed your business dry." /></div> },
  { t: 23.4,  side: 'R', g: <LeakCard num="01" name="Dead Money" color={LK.dead} line="Every lead you collected and never followed up — money spent that produced nothing." /> },
  { t: 34.2,  side: 'L', g: <LeakCard num="02" name="Invisible Online" color={LK.invis} line="When buyers search and you're not visible where they decide, the call goes somewhere else." /> },
  { t: 49.7,  side: 'R', g: <LeakCard num="03" name="Cold Leads" color={LK.cold} line="Voicemail or a slow callback — they book the competitor who answered first. Speed to lead wins." /> },
  { t: 61.3,  side: 'L', g: <LeakCard num="04" name="No Sales Process" color={LK.noproc} line="Calls handled differently every time. Without a repeatable process, close rates stay random." /> },
  { t: 73.5,  side: 'R', g: <LeakCard num="05" name="Wasted Marketing" color={LK.waste} line="You pay for ads, SEO, social — then follow-up breaks. Your spend converts less than it should." /> },
  { t: 90.0,  side: 'L', g: <LeakCard num="06" name="Owner Drowning" color={LK.owner} line="Phones, quotes, reviews, texts, late-night fixes — busywork pulls you off sales and leadership." /> },
  { t: 103.9, side: 'R', g: <Statement eyebrow="Why Patching Fails" title={<>Fix one leak — the bucket <span style={{ color: TEAL }}>still drains.</span></>} sub="A chatbot doesn't fix visibility. SEO doesn't answer the phone. Software alone isn't a growth plan." /> },
  { t: 118.0, side: 'L', g: <Statement eyebrow="MyOrbisResults" title={<>Build the plan. Grow the business. <span style={{ color: TEAL }}>Human support.</span></>} sub="We don't hand you software and disappear. We install the system around your business and stay close." /> },
  { t: 139.7, side: 'R', g: <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><TriMini /></div> },
  { t: 147.0, side: 'L', g: <PillarCard tag="MyOrbisLocal" title="Get Found" color={LK.invis} bullets={['GBP + competitor + review audit', 'Categories, keywords, ranking gaps', 'Local signals that win the search']} /> },
  { t: 160.4, side: 'R', g: <PillarCard tag="MyOrbisWeb" title="Convert Demand" color={LK.noproc} bullets={['Mirrors your business profile', 'Clear call / book / request actions', 'Web + local run from one plan']} /> },
  { t: 176.2, side: 'L', g: <PillarCard tag="MyOrbisVoice" title="Answer & Book" color={TEALB} live bullets={['Phone, website, booking page', 'Qualifies + books your real calendar', 'Follow-up by phone, email, text', 'English or Spanish, fast']} /> },
  { t: 201.1, side: 'R', g: <PillarCard tag="Staff Training" title="Make It Stick" color={LK.waste} bullets={['Handoff + follow-up discipline', 'Sales process + daily workflow', 'System runs inside your business']} /> },
  { t: 212.6, side: 'L', g: <ListGraphic eyebrow="The Difference" title={<>Real people <span style={{ color: TEAL }}>behind the system.</span></>} items={['Weekly meetings', 'Growth reports', 'Local visibility reviews', 'Website updates', 'Agent improvements', 'Expansion planning']} /> },
  { t: 240.9, side: 'R', g: <Statement eyebrow="The MyOrbisResults Difference" title={<>Capture demand. Grow the business. <span style={{ color: TEAL }}>Keep it moving.</span></>} /> },
  { t: 246.8, side: 'L', g: <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><LoopMini /></div> },
  { t: 266.9, side: 'R', g: <Statement eyebrow="Why Connected Wins" title={<>Three products. One OS. <span style={{ color: TEAL }}>A team behind it.</span></>} sub="A competitor with one piece can't catch a business running the full system with a team helping it grow." /> },
  { t: 277.5, side: 'L', g: <div><div style={{ marginBottom: 22 }}><Statement title={<>Any business the <span style={{ color: TEAL }}>phone runs.</span></>} /></div><Chips items={['Dental', 'Legal', 'HVAC', 'Plumbing', 'Electrical', 'Fitness', 'Beauty', 'Medical', 'Home services']} /></div> },
  { t: 292.4, side: 'R', g: <Statement eyebrow="Start Here" title={<>Stop patching. <span style={{ color: TEAL }}>Start compounding.</span></>} sub="Book a free Trifecta Consultation at myorbisresults.com." /> },
]

const TOTAL = f(304.77)

// Presenter video: full-frame, slides L/R per window (smoothed at boundaries).
const Presenter: React.FC = () => {
  const frame = useCurrentFrame()
  const xFor = (s: 'L' | 'R') => (s === 'R' ? SHIFT : -SHIFT)
  // find current window
  let idx = 0
  for (let i = 0; i < WINS.length; i++) if (frame >= f(WINS[i].t)) idx = i
  const start = f(WINS[idx].t)
  const cur = xFor(WINS[idx].side)
  const prev = idx > 0 ? xFor(WINS[idx - 1].side) : cur
  const x = interpolate(frame, [start, start + 20], [prev, cur], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return <OffthreadVideo src={staticFile('source/orby-explainer.mp4')} style={{ width: 1920, height: 1080, transform: `translateX(${x}px)` }} />
}

export const OrbyExplainer16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Presenter />
      {WINS.map((w, i) => {
        const start = f(w.t)
        const end = i < WINS.length - 1 ? f(WINS[i + 1].t) : TOTAL
        const dur = end - start
        // graphics on the side OPPOSITE the presenter
        const onLeft = w.side === 'R'
        return (
          <Sequence key={i} from={start} durationInFrames={dur} layout="none">
            <GraphicHolder dur={dur} onLeft={onLeft}>{w.g}</GraphicHolder>
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

const GraphicHolder: React.FC<{ dur: number; onLeft: boolean; children: React.ReactNode }> = ({ dur, onLeft, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [dur - 16, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: onLeft ? 0 : undefined, right: onLeft ? undefined : 0, width: 980, padding: '0 80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>
    </AbsoluteFill>
  )
}
