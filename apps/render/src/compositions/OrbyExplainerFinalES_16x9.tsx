import React from 'react'
import { AbsoluteFill, Audio, Sequence, OffthreadVideo, staticFile, useCurrentFrame, interpolate, Easing } from 'remotion'
import { SORA, INTER } from './_theme'

// ── Orby Explainer FINAL 16:9 — overlay graphics on the 6:00 v2 presenter video ──
// Base: public/source/orby-explainer-final-es.mp4 (talking head on #FCFCFC near-white).
// Presenter shifts L/R alternating per topic window; technical graphics on the
// opposite side, timed from the 148-segment Whisper transcript.

const FPS = 30
const BG = '#FCFCFC'
const INK = '#0E1B22'
const SUB = '#3B4A52'
const TEAL = '#0E6E6E'
const TEALB = '#11A3A3'
const CARD = '#EEF2F5'
const BORDER = '#D7DDE2'
const SHIFT = 480
const EASE = Easing.bezier(0.16, 1, 0.3, 1)

const LK = { dead: '#C2541F', invis: '#B27A00', cold: '#1B8FA8', noproc: '#2E78C4', web: '#6E55C9', owner: '#C23F75' }

const f = (s: number) => Math.round(s * FPS)
const rise = (frame: number, at: number, d = 24) => ({
  opacity: interpolate(frame, [at, at + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }),
  transform: `translateY(${interpolate(frame, [at, at + 20], [d, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })}px)`,
})

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
      <div style={{ ...rise(frame, 8), fontFamily: SORA, fontWeight: 800, fontSize: 62, lineHeight: 1.08, letterSpacing: -1.5, color: INK }}>{title}</div>
      {sub && <div style={{ ...rise(frame, 24), fontFamily: INTER, fontWeight: 500, fontSize: 26, lineHeight: 1.5, color: SUB, marginTop: 22 }}>{sub}</div>}
    </div>
  )
}

const Stat: React.FC<{ big: string; unit?: string; line: React.ReactNode; source: string; color?: string }> = ({ big, unit, line, source, color = TEAL }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div style={{ ...rise(frame, 2), display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 200, lineHeight: 0.95, letterSpacing: -6, color }}>{big}</span>
        {unit && <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 70, color }}>{unit}</span>}
      </div>
      <div style={{ width: 110, height: 7, background: color, borderRadius: 8, margin: '10px 0 22px', ...rise(frame, 14) }} />
      <div style={{ ...rise(frame, 18), fontFamily: SORA, fontWeight: 700, fontSize: 36, lineHeight: 1.25, color: INK, marginBottom: 18 }}>{line}</div>
      <div style={{ ...rise(frame, 30), display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: INTER, fontWeight: 600, fontSize: 18, letterSpacing: 2.5, color: SUB, textTransform: 'uppercase' }}>
        <span style={{ width: 24, height: 1.5, background: SUB }} />SOURCE · {source}
      </div>
    </div>
  )
}

// ── animated charts for statistics windows ──
const StatFooter: React.FC<{ line: React.ReactNode; source: string; delay?: number }> = ({ line, source, delay = 18 }) => {
  const frame = useCurrentFrame()
  return (
    <>
      <div style={{ ...rise(frame, delay), fontFamily: SORA, fontWeight: 700, fontSize: 32, lineHeight: 1.25, color: INK, marginTop: 18, marginBottom: 14 }}>{line}</div>
      <div style={{ ...rise(frame, delay + 8), display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: INTER, fontWeight: 600, fontSize: 16, letterSpacing: 2.5, color: SUB, textTransform: 'uppercase' }}>
        <span style={{ width: 22, height: 1.5, background: SUB }} />SOURCE · {source}
      </div>
    </>
  )
}

// donut sweep — used for single-percent stats
const StatDonut: React.FC<{ pct: number; color: string; line: React.ReactNode; source: string }> = ({ pct, color, line, source }) => {
  const frame = useCurrentFrame()
  const r = 138
  const C = 2 * Math.PI * r
  const t = interpolate(frame, [4, 44], [0, pct / 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  const shown = Math.round(t * 100)
  return (
    <div>
      <svg width={360} height={360} viewBox="0 0 360 360" style={{ display: 'block' }}>
        <circle cx={180} cy={180} r={r} fill="none" stroke={BORDER} strokeWidth={36} />
        <circle cx={180} cy={180} r={r} fill="none" stroke={color} strokeWidth={36} strokeLinecap="round" strokeDasharray={`${C * t} ${C * (1 - t)}`} transform="rotate(-90 180 180)" />
        <text x={180} y={172} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight={800} fontSize={104} letterSpacing={-3} fill={color}>{shown}%</text>
        <text x={180} y={210} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={700} fontSize={16} letterSpacing={3} fill={SUB}>OF {pct === 28 ? 'CALLS' : 'TOTAL'}</text>
      </svg>
      <StatFooter line={line} source={source} />
    </div>
  )
}

// horizontal stacked bar — two segments, A grows then B fills
const StatStack: React.FC<{ pctA: number; labelA: string; colorA: string; labelB: string; line: React.ReactNode; source: string }> = ({ pctA, labelA, colorA, labelB, line, source }) => {
  const frame = useCurrentFrame()
  const W = 720, H = 110
  const wA = interpolate(frame, [4, 44], [0, (pctA / 100) * W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  const wB = interpolate(frame, [20, 56], [0, ((100 - pctA) / 100) * W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  const shown = Math.round(interpolate(frame, [4, 44], [0, pctA], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }))
  return (
    <div>
      <div style={{ ...rise(frame, 0), fontFamily: SORA, fontWeight: 800, fontSize: 130, color: colorA, letterSpacing: -4, lineHeight: 1, marginBottom: 14 }}>{shown}%</div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <rect x={0} y={20} width={W} height={H - 40} rx={6} fill={CARD} stroke={BORDER} strokeWidth={1} />
        <rect x={0} y={20} width={wA} height={H - 40} rx={6} fill={colorA} />
        <rect x={(pctA / 100) * W} y={20} width={wB} height={H - 40} rx={6} fill={BORDER} />
        {frame > 30 && <text x={Math.min(wA - 12, (pctA / 100) * W - 12)} y={H / 2 + 8} textAnchor="end" fontFamily="Inter,sans-serif" fontWeight={800} fontSize={20} fill="#fff" letterSpacing={2}>{labelA.toUpperCase()}</text>}
        {frame > 46 && <text x={(pctA / 100) * W + 12} y={H / 2 + 8} fontFamily="Inter,sans-serif" fontWeight={800} fontSize={20} fill={SUB} letterSpacing={2}>{labelB.toUpperCase()}</text>}
      </svg>
      <StatFooter line={line} source={source} />
    </div>
  )
}

// 3-stage funnel — Search 100 → Visit 76 → Purchase 28
const StatFunnel: React.FC<{ stages: { label: string; pct: number; color: string }[]; line: React.ReactNode; source: string }> = ({ stages, line, source }) => {
  const frame = useCurrentFrame()
  const W = 720, H = 80
  return (
    <div>
      {stages.map((s, i) => {
        const start = 4 + i * 14
        const w = interpolate(frame, [start, start + 36], [0, (s.pct / 100) * W], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
        const num = Math.round(interpolate(frame, [start, start + 36], [0, s.pct], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }))
        return (
          <div key={s.label} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: INTER, fontWeight: 700, fontSize: 16, letterSpacing: 2, color: SUB, textTransform: 'uppercase' }}>
              <span>{s.label}</span><span style={{ color: s.color, fontFamily: SORA, fontSize: 26, fontWeight: 800, letterSpacing: 0 }}>{num}%</span>
            </div>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
              <rect x={0} y={10} width={W} height={H - 20} rx={6} fill={CARD} stroke={BORDER} strokeWidth={1} />
              <rect x={0} y={10} width={w} height={H - 20} rx={6} fill={s.color} />
            </svg>
          </div>
        )
      })}
      <StatFooter line={line} source={source} delay={42} />
    </div>
  )
}

// 3-pack stack — 10 search-result rows; top 3 highlighted, "42% of clicks"
const Stat3Pack: React.FC<{ pct: number; line: React.ReactNode; source: string }> = ({ pct, line, source }) => {
  const frame = useCurrentFrame()
  const rows = Array.from({ length: 7 }, (_, i) => i)
  const shown = Math.round(interpolate(frame, [4, 44], [0, pct], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
      <div>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 14, letterSpacing: 3, color: SUB, marginBottom: 8 }}>GOOGLE LOCAL RESULTS</div>
        <div style={{ width: 320, padding: 14, borderRadius: 10, background: CARD, border: `1.5px solid ${BORDER}` }}>
          {rows.map((i) => {
            const inPack = i < 3
            const op = interpolate(frame, [4 + i * 3, 18 + i * 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
            return (
              <div key={i} style={{ opacity: op, height: 26, marginBottom: 6, borderRadius: 5, background: inPack ? TEAL : '#FFFFFF', border: inPack ? 'none' : `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', padding: '0 10px', boxShadow: inPack ? `0 2px 6px ${TEAL}33` : 'none' }}>
                <span style={{ width: 14, height: 6, background: inPack ? '#fff' : BORDER, borderRadius: 2, marginRight: 8 }} />
                <span style={{ width: 70 + (i % 3) * 30, height: 6, background: inPack ? '#ffffffcc' : BORDER, borderRadius: 2 }} />
              </div>
            )
          })}
        </div>
      </div>
      <div>
        <div style={{ ...rise(frame, 12), fontFamily: SORA, fontWeight: 800, fontSize: 140, color: TEAL, letterSpacing: -4, lineHeight: 1 }}>{shown}%</div>
        <div style={{ ...rise(frame, 24), fontFamily: SORA, fontWeight: 700, fontSize: 24, color: INK, marginTop: 8, marginBottom: 22 }}>of clicks land in the top 3</div>
        <StatFooter line={line} source={source} delay={32} />
      </div>
    </div>
  )
}

// exponential decay line — 5min → 30min, 100× drop
const StatDecay: React.FC<{ line: React.ReactNode; source: string }> = ({ line, source }) => {
  const frame = useCurrentFrame()
  const W = 720, H = 380, padL = 60, padB = 50, padT = 30, padR = 30
  const innerW = W - padL - padR, innerH = H - padT - padB
  const pts = [{ x: 5, y: 100 }, { x: 10, y: 50 }, { x: 15, y: 18 }, { x: 20, y: 8 }, { x: 25, y: 3 }, { x: 30, y: 1 }]
  // build path: x in 5..30 minutes mapped to inner width
  const xMap = (x: number) => padL + ((x - 5) / 25) * innerW
  const yMap = (y: number) => padT + (1 - Math.log10(y + 1) / Math.log10(101)) * innerH
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xMap(p.x).toFixed(1)} ${yMap(p.y).toFixed(1)}`).join(' ')
  const totalLen = 900
  const draw = interpolate(frame, [8, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return (
    <div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[1, 10, 50, 100].map((y) => (
          <g key={y}>
            <line x1={padL} x2={W - padR} y1={yMap(y)} y2={yMap(y)} stroke={BORDER} strokeWidth={1} strokeDasharray="3 5" />
            <text x={padL - 8} y={yMap(y) + 5} textAnchor="end" fontFamily="Inter,sans-serif" fontSize={13} fontWeight={600} fill={SUB}>{y}×</text>
          </g>
        ))}
        {[5, 10, 15, 20, 25, 30].map((x) => (
          <text key={x} x={xMap(x)} y={H - padB + 22} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={13} fontWeight={600} fill={SUB}>{x} min</text>
        ))}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={INK} strokeWidth={1.5} />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={INK} strokeWidth={1.5} />
        <path d={path} fill="none" stroke={LK.owner} strokeWidth={4} strokeLinecap="round" strokeDasharray={totalLen} strokeDashoffset={totalLen * (1 - draw)} />
        {frame > 60 && (<><circle cx={xMap(5)} cy={yMap(100)} r={9} fill={LK.owner} /><circle cx={xMap(30)} cy={yMap(1)} r={9} fill={LK.owner} /></>)}
        {frame > 70 && (<>
          <text x={xMap(5) + 14} y={yMap(100) - 6} fontFamily="Sora,sans-serif" fontWeight={800} fontSize={22} fill={LK.owner}>5 min → high</text>
          <text x={xMap(30) - 8} y={yMap(1) - 12} textAnchor="end" fontFamily="Sora,sans-serif" fontWeight={800} fontSize={22} fill={LK.owner}>30 min → 1/100</text>
        </>)}
      </svg>
      <div style={{ ...rise(frame, 50), fontFamily: SORA, fontWeight: 800, fontSize: 32, color: LK.owner, marginTop: 8 }}>100× drop in contact odds</div>
      <StatFooter line={line} source={source} delay={56} />
    </div>
  )
}

// load-time vs abandon-rate area chart with 3s threshold marker
const StatLoadAbandon: React.FC<{ line: React.ReactNode; source: string }> = ({ line, source }) => {
  const frame = useCurrentFrame()
  const W = 720, H = 380, padL = 60, padB = 50, padT = 30, padR = 30
  const innerW = W - padL - padR, innerH = H - padT - padB
  const pts = [{ x: 1, y: 9 }, { x: 2, y: 24 }, { x: 3, y: 53 }, { x: 4, y: 65 }, { x: 5, y: 75 }, { x: 6, y: 83 }, { x: 7, y: 88 }, { x: 8, y: 92 }, { x: 9, y: 95 }, { x: 10, y: 97 }]
  const xMap = (x: number) => padL + ((x - 1) / 9) * innerW
  const yMap = (y: number) => padT + (1 - y / 100) * innerH
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xMap(p.x).toFixed(1)} ${yMap(p.y).toFixed(1)}`).join(' ')
  const area = `${path} L ${xMap(10)} ${yMap(0)} L ${xMap(1)} ${yMap(0)} Z`
  const totalLen = 900
  const draw = interpolate(frame, [8, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  const fill = interpolate(frame, [24, 72], [0, 0.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return (
    <div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, 25, 50, 75, 100].map((y) => (
          <g key={y}>
            <line x1={padL} x2={W - padR} y1={yMap(y)} y2={yMap(y)} stroke={BORDER} strokeWidth={1} strokeDasharray="3 5" />
            <text x={padL - 8} y={yMap(y) + 5} textAnchor="end" fontFamily="Inter,sans-serif" fontSize={13} fontWeight={600} fill={SUB}>{y}%</text>
          </g>
        ))}
        {[1, 2, 3, 4, 5, 6, 8, 10].map((x) => (
          <text key={x} x={xMap(x)} y={H - padB + 22} textAnchor="middle" fontFamily="Inter,sans-serif" fontSize={13} fontWeight={600} fill={SUB}>{x}s</text>
        ))}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={INK} strokeWidth={1.5} />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={INK} strokeWidth={1.5} />
        <path d={area} fill={LK.web} opacity={fill} />
        <path d={path} fill="none" stroke={LK.web} strokeWidth={4} strokeLinecap="round" strokeDasharray={totalLen} strokeDashoffset={totalLen * (1 - draw)} />
        {frame > 48 && (<>
          <line x1={xMap(3)} x2={xMap(3)} y1={padT} y2={H - padB} stroke={LK.web} strokeWidth={2} strokeDasharray="6 6" />
          <circle cx={xMap(3)} cy={yMap(53)} r={10} fill={LK.web} />
          <text x={xMap(3) + 14} y={yMap(53) - 8} fontFamily="Sora,sans-serif" fontWeight={800} fontSize={26} fill={LK.web}>53% gone by 3s</text>
        </>)}
        <text x={W - padR} y={H - padB + 40} textAnchor="end" fontFamily="Inter,sans-serif" fontWeight={700} fontSize={14} letterSpacing={2.5} fill={SUB}>PAGE LOAD TIME →</text>
      </svg>
      <StatFooter line={line} source={source} delay={56} />
    </div>
  )
}

const LeakCard: React.FC<{ num: string; name: string; color: string; line: string }> = ({ num, name, color, line }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div style={{ ...rise(frame, 2), display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: INTER, fontWeight: 800, fontSize: 18, letterSpacing: 4, color, textTransform: 'uppercase', marginBottom: 8 }}>LEAK · {num}</div>
      <div style={{ ...rise(frame, 8), fontFamily: SORA, fontWeight: 800, fontSize: 130, lineHeight: 1, color }}>{num}</div>
      <div style={{ width: 90, height: 7, borderRadius: 8, background: color, margin: '8px 0 20px', ...rise(frame, 14) }} />
      <div style={{ ...rise(frame, 16), fontFamily: SORA, fontWeight: 800, fontSize: 54, letterSpacing: -1, color: INK, marginBottom: 16 }}>{name}</div>
      <div style={{ ...rise(frame, 26), fontFamily: INTER, fontWeight: 500, fontSize: 26, lineHeight: 1.5, color: SUB }}>{line}</div>
    </div>
  )
}

const PillarCard: React.FC<{ tag: string; title: string; bullets: string[]; color: string; live?: boolean }> = ({ tag, title, bullets, color, live }) => {
  const frame = useCurrentFrame()
  return (
    <div>
      <div style={{ ...rise(frame, 2), display: 'inline-flex', alignItems: 'center', gap: 12, fontFamily: INTER, fontWeight: 800, fontSize: 20, letterSpacing: 3, color, textTransform: 'uppercase', marginBottom: 12 }}>
        {tag}{live && <span style={{ fontSize: 14, color: '#fff', background: color, borderRadius: 999, padding: '3px 10px', letterSpacing: 1.5 }}>LIVE</span>}
      </div>
      <div style={{ ...rise(frame, 10), fontFamily: SORA, fontWeight: 800, fontSize: 56, letterSpacing: -1.5, color: INK, marginBottom: 22 }}>{title}</div>
      {bullets.map((b, i) => (
        <div key={b} style={{ ...rise(frame, 22 + i * 6), display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: 23, color: INK }}>{b}</span>
        </div>
      ))}
    </div>
  )
}

const Chips: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {items.map((c, i) => (
        <span key={c} style={{ opacity: interpolate(frame, [4 + i * 4, 20 + i * 4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }), fontFamily: SORA, fontWeight: 700, fontSize: 24, color: INK, padding: '9px 18px', borderRadius: 999, background: CARD, border: `1.5px solid ${TEAL}55` }}>{c}</span>
      ))}
    </div>
  )
}

const TwoCol: React.FC<{ items: string[] }> = ({ items }) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
      {items.map((b, i) => (
        <div key={b} style={{ ...rise(frame, 16 + i * 4), display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: TEALB, fontWeight: 800, fontSize: 22 }}>✓</span>
          <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: 22, color: INK }}>{b}</span>
        </div>
      ))}
    </div>
  )
}

const BucketMini: React.FC = () => {
  const frame = useCurrentFrame()
  const cols = [LK.dead, LK.invis, LK.cold, LK.noproc, LK.web, LK.owner]
  return (
    <svg width={520} height={440} viewBox="0 0 420 360">
      <path d="M120 70 L300 70 L280 250 L140 250 Z" fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={210} cy={70} rx={90} ry={15} fill="#F0F4F6" stroke={INK} strokeWidth={2.5} />
      {[['M150 150 C110 175 95 205 92 240', 92], ['M165 185 C140 215 130 245 128 272', 128], ['M205 210 C205 240 205 262 205 286', 205], ['M250 200 C275 230 285 255 288 280', 288], ['M270 165 C300 192 315 218 320 250', 320], ['M285 135 C320 160 338 188 345 222', 345]].map((d, i) => {
        const t = (frame + i * 8) % 40
        return <g key={i}><path d={d[0] as string} fill="none" stroke={cols[i]} strokeWidth={3} opacity={0.9} /><circle cx={d[1] as number} cy={250 + interpolate(t, [0, 40], [0, 70])} r={5} fill={cols[i]} opacity={interpolate(t, [0, 6, 34, 40], [0, 1, 1, 0])} /></g>
      })}
    </svg>
  )
}

const TriMini: React.FC = () => {
  const frame = useCurrentFrame()
  const N = [{ s: 'Local', cx: 420, cy: 120, c: LK.invis }, { s: 'Voice', cx: 250, cy: 420, c: TEALB }, { s: 'Web', cx: 590, cy: 420, c: LK.web }]
  const E: [number, number][] = [[0, 1], [1, 2], [2, 0]]
  return (
    <svg width={820} height={620} viewBox="0 0 840 600">
      <ellipse cx={420} cy={310} rx={360} ry={250} fill="none" stroke={TEAL} strokeWidth={2} strokeDasharray="9 11" opacity={interpolate(frame, [4, 24], [0, 0.55], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
      <text x={420} y={580} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={800} fontSize={18} letterSpacing={4} fill={TEAL} opacity={interpolate(frame, [10, 30], [0, 0.9], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>STAFF TRAINING · TEAM BEHIND IT</text>
      {E.map((e, i) => { const a = N[e[0]], b = N[e[1]]; return <line key={i} x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={a.c} strokeWidth={2.5} opacity={interpolate(frame, [18 + i * 5, 38 + i * 5], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} /> })}
      {E.map((e, i) => { const a = N[e[0]], b = N[e[1]]; const p = 48; const t = (((frame - 40) + i * 16) % p + p) % p / p; return <circle key={i} cx={a.cx + (b.cx - a.cx) * t} cy={a.cy + (b.cy - a.cy) * t} r={8} fill={a.c} opacity={frame > 42 ? 0.95 : 0} /> })}
      {N.map((n, i) => { const s = interpolate(frame, [8 + i * 7, 30 + i * 7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }); return (<g key={n.s} opacity={s}><circle cx={n.cx} cy={n.cy} r={84} fill="#FFFFFF" stroke={n.c} strokeWidth={3} /><text x={n.cx} y={n.cy - 6} textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={600} fontSize={14} fill={SUB}>MyOrbis</text><text x={n.cx} y={n.cy + 26} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight={800} fontSize={32} fill={n.c}>{n.s}</text></g>) })}
    </svg>
  )
}

const LoopMini: React.FC = () => {
  const frame = useCurrentFrame()
  const N = [{ l: 'Get Found', cx: 410, cy: 110, c: LK.invis }, { l: 'Convert', cx: 620, cy: 320, c: LK.web }, { l: 'Answer & Book', cx: 410, cy: 530, c: TEALB }, { l: 'Better Data', cx: 200, cy: 320, c: LK.noproc }]
  return (
    <svg width={820} height={640} viewBox="0 0 820 640">
      <g fill="none" stroke={TEAL} strokeWidth={3} opacity={0.55}>
        <path d="M470 150 A300 300 0 0 1 580 260" /><path d="M580 380 A300 300 0 0 1 470 490" /><path d="M350 490 A300 300 0 0 1 240 380" /><path d="M240 260 A300 300 0 0 1 350 150" />
      </g>
      {N.map((n, i) => { const s = interpolate(frame, [8 + i * 8, 30 + i * 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }); return (<g key={n.l} opacity={s}><circle cx={n.cx} cy={n.cy} r={82} fill="#FFFFFF" stroke={n.c} strokeWidth={3} /><text x={n.cx} y={n.cy + 6} textAnchor="middle" fontFamily="Sora,sans-serif" fontWeight={700} fontSize={22} fill={n.c}>{n.l}</text></g>) })}
    </svg>
  )
}

type Win = { t: number; side: 'L' | 'R'; g: React.ReactNode }
const WINS: Win[] = [
  { t: 0,     side: 'R', g: <Statement eyebrow="El Problema Real" title={<>No es un problema de marketing. <span style={{ color: TEAL }}>Es una fuga de ingresos.</span></>} sub="Llamadas perdidas. Poca visibilidad en Google. Seguimiento lento. Sitio que no convierte. Sin proceso de ventas. Un dueño cargando demasiado solo." /> },
  { t: 29.2,  side: 'L', g: <StatDonut pct={28} color={LK.cold} line={<>de las llamadas comerciales <span style={{ color: LK.cold }}>no son contestadas.</span></>} source="CallRail" /> },
  { t: 36.3,  side: 'R', g: <StatStack pctA={78} labelA="abandonó" colorA={LK.dead} labelB="se quedó" line={<>de los consumidores <span style={{ color: LK.dead }}>abandona</span> un negocio después de una llamada sin respuesta.</>} source="Encuesta CallRail" /> },
  { t: 48.2,  side: 'L', g: <StatFunnel stages={[{ label: 'Buscó cerca', pct: 100, color: TEAL }, { label: 'Visitó un negocio', pct: 76, color: LK.invis }, { label: 'Realizó una compra', pct: 28, color: LK.dead }]} line={<>de las búsquedas locales en celular <span style={{ color: LK.invis }}>visitan un negocio en menos de un día.</span></>} source="Google · Think with Google" /> },
  { t: 64.5,  side: 'R', g: <Stat3Pack pct={42} line={<>de las búsquedas locales hacen clic dentro del <span style={{ color: TEAL }}>Google 3-Pack.</span></>} source="Local Pack Visibility Research" /> },
  { t: 76.6,  side: 'L', g: <StatDecay line={<><span style={{ color: LK.owner }}>5 min vs 30 min</span> — las probabilidades de contactar un prospecto caen 100×.</>} source="Estudio MIT de Respuesta a Prospectos" /> },
  { t: 93.7,  side: 'R', g: <StatLoadAbandon line={<>de las visitas móviles abandonan un sitio más lento de <span style={{ color: LK.web }}>3 segundos.</span></>} source="Google · Velocidad Móvil" /> },
  { t: 108.5, side: 'L', g: <Statement eyebrow="El Problema Real" title={<>El problema no es más prospectos. Es <span style={{ color: TEAL }}>conservar</span> la demanda que ya pagaste por crear.</>} sub="Captura. Convierte. Conserva." /> },
  { t: 124.0, side: 'R', g: <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}><BucketMini /><Statement title={<>Un balde con <span style={{ color: TEAL }}>seis agujeros.</span></>} sub="Cada uno drena un poco. Juntos desangran tu negocio." /></div> },
  { t: 133.8, side: 'L', g: <LeakCard num="01" name="Dinero Muerto" color={LK.dead} line="Cada prospecto que captaste y nunca recibió seguimiento es dinero ya gastado que no produjo nada. No dijeron que no. Simplemente nunca volvieron a saber de ti." /> },
  { t: 152.5, side: 'R', g: <LeakCard num="02" name="Invisible en Línea" color={LK.invis} line="Sin presencia en el Map Pack. Reseñas débiles, categorías mal configuradas, contenido local pobre — un buen negocio parece ausente justo cuando el comprador decide." /> },
  { t: 178.1, side: 'L', g: <LeakCard num="03" name="Llamadas Perdidas" color={LK.cold} line="Un cliente listo para comprar cae en el buzón de voz. Cuando devuelves la llamada, ya reservó con el competidor que sí contestó primero." /> },
  { t: 195.8, side: 'R', g: <LeakCard num="04" name="Sin Captura y Conversión" color={LK.noproc} line="Llamadas, formularios, anuncios, referencias, redes, Google — los prospectos llegan de todos lados, ninguno entra en un proceso claro. A algunos les devuelven la llamada. Otros se pierden." /> },
  { t: 224.6, side: 'L', g: <LeakCard num="05" name="Sitio Web Pobre" color={LK.web} line="Carga lenta. Botón de llamada escondido. Camino de reserva débil. El visitante se va antes de que tu negocio tenga una oportunidad real." /> },
  { t: 253.8, side: 'R', g: <LeakCard num="06" name="Dueño Atrapado" color={LK.owner} line="Teléfonos, cotizaciones, reseñas, mensajes, arreglos del sitio, personal, crecimiento — todo sobre ti. Demasiadas partes móviles. Así terminan enterrados los dueños." /> },
  { t: 294.5, side: 'L', g: <Statement eyebrow="Hasta Ahora" title={<>Sin la alianza correcta, salir de ese ciclo puede sentirse <span style={{ color: TEAL }}>imposible.</span></>} /> },
  { t: 300.8, side: 'R', g: <Statement eyebrow="MyOrbisResults" title={<>Construye el plan. Haz crecer el negocio. <span style={{ color: TEAL }}>Brinda apoyo humano.</span></>} sub="No es un lema. Así es como operamos." /> },
  { t: 316.5, side: 'L', g: <TwoCol items={['Construimos el plan de crecimiento contigo', 'Instalamos el sistema en tu negocio', 'Entrenamos a tu equipo', 'Revisamos los números', 'Nos mantenemos cerca para ayudarte a ejecutarlo', 'Personas reales, no solo software']} /> },
  { t: 344.4, side: 'R', g: <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><TriMini /></div> },
  { t: 353.2, side: 'L', g: <PillarCard tag="MyOrbisLocal · Encuéntrate" title="Compradores listos para llamar" color={LK.invis} bullets={['Auditoría de perfil + competidores + reseñas', 'Categorías, palabras clave, brechas de ranking', 'Contenido local + señales de posicionamiento', 'Para cuando los compradores están listos']} /> },
  { t: 375.3, side: 'R', g: <PillarCard tag="MyOrbisWeb · Convierte" title="Convierte la demanda en acción" color={LK.web} bullets={['Refleja tu perfil de Google', 'Acciones claras: llamar / reservar / contactar', 'Mismo plan de crecimiento que Local', 'Sitio + presencia sincronizados']} /> },
  { t: 398.4, side: 'L', g: <PillarCard tag="MyOrbisVoice · Contesta y Agenda" title="Captura cada prospecto serio" color={TEALB} live bullets={['Teléfono, sitio web o página de reservas', 'Califica · responde · agenda en tu calendario', 'Seguimiento por llamada, correo, texto', 'Inglés o español · rápido']} /> },
  { t: 440.6, side: 'R', g: <PillarCard tag="Capacitación · Para Que Funcione" title="El sistema vive dentro del negocio" color={LK.noproc} bullets={['Disciplina de traspaso + seguimiento', 'Proceso de ventas + flujo diario', 'No solo alrededor del negocio', 'Dentro de él — cada día']} /> },
  { t: 460.3, side: 'L', g: <div><div style={{ marginBottom: 18 }}><Statement eyebrow="La Verdadera Diferencia" title={<>Personas reales <span style={{ color: TEAL }}>detrás del sistema.</span></>} /></div><TwoCol items={['Reuniones semanales', 'Reportes de crecimiento', 'Próximos pasos claros', 'Revisiones de visibilidad local', 'Actualizaciones del sitio web', 'Mejoras del agente de voz', 'Estrategia de reseñas', 'Estrategia de seguimiento', 'Planificación de expansión']} /></div> },
  { t: 503.6, side: 'R', g: <Statement eyebrow="Cómo Funciona el Ciclo" title={<>Captura la demanda. Convierte. <span style={{ color: TEAL }}>Compón.</span></>} sub="Cada llamada genera mejores datos. Mejores datos afinan cada próximo movimiento." /> },
  { t: 505.9, side: 'L', g: <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><LoopMini /></div> },
  { t: 538.2, side: 'R', g: <Statement eyebrow="Por Qué Conectado Gana" title={<>Tres productos. Un sistema. <span style={{ color: TEAL }}>Un equipo humano detrás.</span></>} sub="Un competidor con solo una pieza no puede alcanzar a un negocio que ejecuta el sistema completo con un equipo ayudándolo a crecer." /> },
  { t: 557.7, side: 'L', g: <div><div style={{ marginBottom: 22 }}><Statement title={<>Cualquier negocio donde el <span style={{ color: TEAL }}>teléfono impulsa los ingresos.</span></>} /></div><Chips items={['Dental', 'Legal', 'HVAC', 'Plomería', 'Electricidad', 'Fitness', 'Belleza', 'Médico', 'Servicios para el hogar', 'Servicios profesionales']} /></div> },
  { t: 581.7, side: 'R', g: <Statement eyebrow="Empieza Aquí" title={<>Deja de tapar agujeros. <span style={{ color: TEAL }}>Empieza a componer crecimiento.</span></>} sub="Construye el plan. Haz crecer el negocio. Recibe apoyo humano." /> },
  { t: 607.6, side: 'L', g: <Statement eyebrow="Es Tu Turno" title={<>La pelota está en <span style={{ color: TEAL }}>tu cancha.</span></>} sub="Reserva una consulta Trifecta gratuita en MyOrbisResults.com. Recibe el reporte. Tú decides si este sistema es para tu negocio." /> },
]

const TOTAL = f(621.5)

const Presenter: React.FC = () => {
  const frame = useCurrentFrame()
  const xFor = (s: 'L' | 'R') => (s === 'R' ? SHIFT : -SHIFT)
  let idx = 0
  for (let i = 0; i < WINS.length; i++) if (frame >= f(WINS[i].t)) idx = i
  const start = f(WINS[idx].t)
  const cur = xFor(WINS[idx].side)
  const prev = idx > 0 ? xFor(WINS[idx - 1].side) : cur
  const x = interpolate(frame, [start, start + 20], [prev, cur], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return <OffthreadVideo src={staticFile('source/orby-explainer-final-es.mp4')} style={{ width: 1920, height: 1080, transform: `translateX(${x}px)` }} />
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

export const OrbyExplainerFinalES_16x9: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <Audio src={staticFile('music/glass-slide.mp3')} volume={0.228} loop />
      <Presenter />
      {WINS.map((w, i) => {
        const start = f(w.t)
        const end = i < WINS.length - 1 ? f(WINS[i + 1].t) : TOTAL
        const dur = end - start
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

export const ORBY_FINAL_ES_FRAMES = TOTAL
