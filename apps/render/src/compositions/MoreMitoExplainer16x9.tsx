// MoreMito × Orby — homepage explainer (16:9), built from the pitch-page
// content, narrated in Orby's real voice (Aoede) from public/audio. Frame-driven
// motion only (interpolate/spring) per Remotion rules. Scenes scale to the
// narration length so EN (~30s) and ES (~36s) both stay in sync.
import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, Easing, Audio, staticFile } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, TEAL_DEEP, GREEN, WHITE, MUTED, BG_TOP, BG_BOT } from './_theme'

// Per-language total frames (measured from the rendered narration mp3s).
export const MOREMITO_FRAMES_EN = 914
export const MOREMITO_FRAMES_ES = 1085
export const MOREMITO_FRAMES = MOREMITO_FRAMES_EN // default

const EASE = Easing.bezier(0.16, 1, 0.3, 1)
const up = (frame: number, start: number, dur = 16, dist = 26) => {
  const p = interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE })
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` }
}
// Fade in at scene start, fade out near scene end (outStart derived from dur).
const sceneFade = (frame: number, dur: number, din = 14, dout = 16) =>
  interpolate(frame, [0, din, dur - dout, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

type Lang = 'en' | 'es'
const T = {
  en: {
    hook1: 'A missed call is a', hook2: 'lost customer.', hookSub: 'Orby answers every one — 24/7.',
    whatEyebrow: 'Meet Orby', whatTitle: 'One assistant. Every job you can’t get to.',
    chips: ['Answers 24/7', 'Explains your products', 'Captures the lead', 'Hands off to Stephanie', 'Books the follow-up'],
    statsEyebrow: 'Why it works',
    stats: [['24/7', 'Never a missed call'], ['<3s', 'Answers instantly'], ['EN/ES', 'Bilingual by default']],
    featEyebrow: 'Everything Orby does',
    feats: ['Captures & verifies every lead', 'Answers product & affiliate questions', 'Sends emails on the spot', 'Warm-transfers to a person', 'Books appointments', 'Remembers every conversation'],
    ctaTitle: 'Talk to Orby now.', ctaSub: 'MoreMito × Orby', tagline: '“Life Is Precious”',
  },
  es: {
    hook1: 'Una llamada perdida es un', hook2: 'cliente perdido.', hookSub: 'Orby contesta cada una — 24/7.',
    whatEyebrow: 'Conoce a Orby', whatTitle: 'Una asistente. Todo lo que no alcanzas a hacer.',
    chips: ['Contesta 24/7', 'Explica tus productos', 'Captura el lead', 'Te conecta con Stephanie', 'Agenda el seguimiento'],
    statsEyebrow: 'Por qué funciona',
    stats: [['24/7', 'Nunca una llamada perdida'], ['<3s', 'Contesta al instante'], ['EN/ES', 'Bilingüe por defecto']],
    featEyebrow: 'Todo lo que hace Orby',
    feats: ['Captura y verifica cada lead', 'Responde dudas de productos y afiliados', 'Envía correos al momento', 'Transfiere a una persona', 'Agenda citas', 'Recuerda cada conversación'],
    ctaTitle: 'Habla con Orby ahora.', ctaSub: 'MoreMito × Orby', tagline: '“Life Is Precious”',
  },
} as const

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const g1 = interpolate(frame % 300, [0, 150, 300], [0.35, 0.6, 0.35])
  const g2 = interpolate(frame % 360, [0, 180, 360], [0.5, 0.28, 0.5])
  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${BG_TOP} 0%, #04181F 58%, ${BG_BOT} 100%)` }}>
      <div style={{ position: 'absolute', top: '-18%', left: '-10%', width: 900, height: 900, borderRadius: '50%', background: TEAL, filter: 'blur(180px)', opacity: g1 * 0.5 }} />
      <div style={{ position: 'absolute', bottom: '-22%', right: '-12%', width: 820, height: 820, borderRadius: '50%', background: GREEN, filter: 'blur(190px)', opacity: g2 * 0.22 }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(rgba(63,227,227,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(63,227,227,0.05) 1px, transparent 1px)`, backgroundSize: '64px 64px', maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)' }} />
    </AbsoluteFill>
  )
}

const Orb: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame()
  const pulse = interpolate(frame % 60, [0, 30, 60], [1, 1.05, 1])
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${TEAL_BRIGHT}, ${TEAL} 55%, ${TEAL_DEEP})`, boxShadow: `0 0 ${size * 0.5}px ${TEAL}66`, transform: `scale(${pulse})`, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: size * 0.16, borderRadius: '50%', border: `2px solid ${WHITE}`, opacity: 0.85 }} />
    </div>
  )
}

const Wordmark: React.FC<{ frame: number; start: number }> = ({ frame, start }) => (
  <div style={{ ...up(frame, start), display: 'flex', alignItems: 'center', gap: 16, fontFamily: SORA, fontWeight: 800, fontSize: 40, color: WHITE }}>
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `radial-gradient(circle at 30% 30%, ${GREEN}, #2f8f3a)` }} />
    MoreMito <span style={{ color: MUTED, fontWeight: 500, margin: '0 2px' }}>×</span>
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, ${TEAL_BRIGHT}, ${TEAL_DEEP})` }} /> Orby
  </div>
)

const Eyebrow: React.FC<{ children: React.ReactNode; frame: number; start: number; color?: string }> = ({ children, frame, start, color = TEAL_BRIGHT }) => (
  <div style={{ ...up(frame, start), fontFamily: INTER, fontSize: 26, fontWeight: 700, letterSpacing: 6, textTransform: 'uppercase', color, marginBottom: 24 }}>{children}</div>
)

const Hook: React.FC<{ t: (typeof T)['en']; dur: number }> = ({ t, dur }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur), justifyContent: 'center', alignItems: 'center', padding: 120, textAlign: 'center' }}>
      <Wordmark frame={frame} start={2} />
      <div style={{ ...up(frame, 20), fontFamily: SORA, fontWeight: 800, fontSize: 104, lineHeight: 1.04, color: WHITE, marginTop: 44 }}>{t.hook1}</div>
      <div style={{ ...up(frame, 44), fontFamily: SORA, fontWeight: 800, fontSize: 104, lineHeight: 1.04, background: `linear-gradient(100deg, ${TEAL_BRIGHT}, ${GREEN})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{t.hook2}</div>
      <div style={{ ...up(frame, 84), fontFamily: INTER, fontSize: 36, color: MUTED, marginTop: 32 }}>{t.hookSub}</div>
    </AbsoluteFill>
  )
}

const What: React.FC<{ t: (typeof T)['en']; dur: number }> = ({ t, dur }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur), justifyContent: 'center', alignItems: 'center', padding: 120, textAlign: 'center' }}>
      <Eyebrow frame={frame} start={4} color={GREEN}>{t.whatEyebrow}</Eyebrow>
      <div style={{ ...up(frame, 12), fontFamily: SORA, fontWeight: 800, fontSize: 76, lineHeight: 1.08, color: WHITE, maxWidth: 1500, marginBottom: 48 }}>{t.whatTitle}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, justifyContent: 'center', maxWidth: 1500 }}>
        {t.chips.map((c, i) => (
          <div key={c} style={{ ...up(frame, 40 + i * 12), fontFamily: INTER, fontSize: 34, fontWeight: 600, color: WHITE, padding: '18px 30px', borderRadius: 999, background: 'rgba(19,32,52,.7)', border: `1px solid ${TEAL}55` }}>{c}</div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

const Stats: React.FC<{ t: (typeof T)['en']; dur: number }> = ({ t, dur }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur), justifyContent: 'center', alignItems: 'center', padding: 100 }}>
      <Eyebrow frame={frame} start={4}>{t.statsEyebrow}</Eyebrow>
      <div style={{ display: 'flex', gap: 40, marginTop: 10 }}>
        {t.stats.map((s, i) => (
          <div key={s[0]} style={{ ...up(frame, 16 + i * 14), width: 420, padding: '48px 24px', borderRadius: 24, background: 'rgba(19,32,52,.6)', border: `1px solid ${TEAL}44`, textAlign: 'center' }}>
            <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 96, background: `linear-gradient(120deg, ${TEAL_BRIGHT}, ${GREEN})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{s[0]}</div>
            <div style={{ fontFamily: INTER, fontSize: 30, color: MUTED, marginTop: 12 }}>{s[1]}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

const Feats: React.FC<{ t: (typeof T)['en']; dur: number }> = ({ t, dur }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur), justifyContent: 'center', alignItems: 'center', padding: 120 }}>
      <Eyebrow frame={frame} start={4} color={GREEN}>{t.featEyebrow}</Eyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, maxWidth: 1500 }}>
        {t.feats.map((f, i) => (
          <div key={f} style={{ ...up(frame, 16 + i * 10), display: 'flex', alignItems: 'center', gap: 18, fontFamily: INTER, fontSize: 34, fontWeight: 600, color: WHITE, padding: '22px 28px', borderRadius: 16, background: 'rgba(19,32,52,.6)', border: `1px solid ${TEAL}33` }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flex: '0 0 auto', background: `linear-gradient(140deg, ${TEAL_BRIGHT}, ${TEAL})`, display: 'grid', placeItems: 'center', color: '#032220', fontWeight: 800, fontSize: 20 }}>✓</div>
            {f}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

const Cta: React.FC<{ t: (typeof T)['en']; dur: number }> = ({ t, dur }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ opacity: sceneFade(frame, dur, 14, 20), justifyContent: 'center', alignItems: 'center', padding: 120, textAlign: 'center' }}>
      <div style={{ ...up(frame, 6) }}><Orb size={180} /></div>
      <div style={{ ...up(frame, 26), fontFamily: SORA, fontWeight: 800, fontSize: 92, color: WHITE, marginTop: 40 }}>{t.ctaTitle}</div>
      <div style={{ ...up(frame, 48), fontFamily: INTER, fontSize: 38, color: MUTED, marginTop: 18 }}>{t.ctaSub}</div>
      <div style={{ ...up(frame, 66), fontFamily: SORA, fontWeight: 700, fontSize: 30, color: GREEN, marginTop: 30 }}>{t.tagline}</div>
    </AbsoluteFill>
  )
}

export const MoreMitoExplainer16x9: React.FC<{ lang?: Lang; frames?: number }> = ({ lang = 'en', frames = MOREMITO_FRAMES }) => {
  const t = T[lang]
  // Base scene weights (sum 900). Scale to the actual narration length so the
  // scenes stay aligned to the voiceover in both EN and ES.
  const base = [180, 240, 180, 180, 120]
  const scale = frames / 900
  const dur = base.map(b => Math.round(b * scale))
  // Force the total to exactly `frames` by absorbing rounding into the last scene.
  const sum4 = dur[0] + dur[1] + dur[2] + dur[3]
  dur[4] = frames - sum4
  const from = [0, dur[0], dur[0] + dur[1], dur[0] + dur[1] + dur[2], sum4]
  const scenes = [Hook, What, Stats, Feats, Cta]
  return (
    <AbsoluteFill>
      <Backdrop />
      {scenes.map((S, i) => (
        <Sequence key={i} from={from[i]} durationInFrames={dur[i]}><S t={t} dur={dur[i]} /></Sequence>
      ))}
      <Audio src={staticFile(`audio/narr-moremito-${lang}.mp3`)} />
    </AbsoluteFill>
  )
}
