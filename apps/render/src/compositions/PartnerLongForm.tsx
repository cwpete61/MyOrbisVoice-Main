import React from 'react'
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED, BRAND_BG } from './_theme'

// 16:9 (1920×1080) long-form intro/outro template. The middle "content"
// section is a placeholder — partner/admin will overlay this video with
// their own webcam recording, screen capture, or B-roll in post. The
// template provides the on-brand intro card, lower-third name tag, and
// outro CTA card. Total length = durationInFrames at the composition
// registration (default ~600 frames @ 30fps = 20s = intro 5s + content 12s
// + outro 3s; resize the composition's durationInFrames for any target).

const SceneWrap: React.FC<{ start: number; dur: number; children: React.ReactNode }> = ({ start, dur, children }) => {
  const frame = useCurrentFrame()
  const op = Math.min(
    interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    interpolate(frame, [start + dur - 14, start + dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
  )
  if (frame < start || frame > start + dur) return null
  return <AbsoluteFill style={{ opacity: op }}>{children}</AbsoluteFill>
}

const IntroCard: React.FC<{ topic: string; hookLine: string; presenter?: string }> = ({ topic, hookLine, presenter }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 }, durationInFrames: 28 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 200px' }}>
      <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 28, letterSpacing: 7, color: TEAL_BRIGHT, marginBottom: 30, textTransform: 'uppercase' }}>{topic}</div>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 116, lineHeight: 1.04, color: WHITE, textAlign: 'center', letterSpacing: -2.5, transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`, textShadow: '0 8px 30px #000a', marginBottom: 40 }}>{hookLine}</div>
      {presenter && (
        <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 26, color: MUTED, letterSpacing: 1 }}>with {presenter}</div>
      )}
    </AbsoluteFill>
  )
}

const ContentPlaceholder: React.FC<{ topic: string }> = ({ topic }) => {
  // Solid backdrop + lower-third bar. Admin overlays this in post (or the
  // generator drops in B-roll behind it once that pipeline exists).
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: '#04181F' }} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 32, color: MUTED, opacity: 0.4 }}>[ content recording goes here ]</div>
      </AbsoluteFill>
      {/* Lower third */}
      <div style={{ position: 'absolute', left: 80, bottom: 80, padding: '20px 28px', borderRadius: 12, background: `${TEAL}33`, border: `1.5px solid ${TEAL_BRIGHT}77`, backdropFilter: 'blur(8px)' }}>
        <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 16, letterSpacing: 4, color: TEAL_BRIGHT, marginBottom: 4 }}>MYORBISVOICE</div>
        <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 26, color: WHITE }}>{topic}</div>
      </div>
    </AbsoluteFill>
  )
}

const OutroCard: React.FC<{ ctaHeadline: string; ctaUrl: string }> = ({ ctaHeadline, ctaUrl }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame, fps, config: { damping: 13, mass: 0.7 }, durationInFrames: 24 })
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 120, color: WHITE, letterSpacing: -2.5, textAlign: 'center', transform: `scale(${interpolate(pop, [0, 1], [0.88, 1])})`, marginBottom: 38 }}>{ctaHeadline}</div>
      <div style={{ padding: '20px 44px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33` }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 48, color: WHITE }}>{ctaUrl}</span>
      </div>
    </AbsoluteFill>
  )
}

export const PartnerLongForm: React.FC<{
  topic?:       string
  hookLine?:    string
  presenter?:   string
  ctaHeadline?: string
  ctaUrl?:      string
  introFrames?: number
  outroFrames?: number
}> = ({
  topic       = 'GBP AUDIT WALKTHROUGH',
  hookLine    = 'Most local business profiles are silently broken.',
  presenter   = '',
  ctaHeadline = "Let's audit yours.",
  ctaUrl      = 'myorbisvoice.com',
  introFrames = 150,  // 5s
  outroFrames = 90,   // 3s
}) => {
  const { durationInFrames } = useVideoConfig()
  const contentStart  = introFrames
  const contentFrames = Math.max(60, durationInFrames - introFrames - outroFrames)
  const outroStart    = contentStart + contentFrames
  return (
    <AbsoluteFill style={BRAND_BG}>
      <SceneWrap start={0}              dur={introFrames}  ><IntroCard topic={topic} hookLine={hookLine} presenter={presenter} /></SceneWrap>
      <SceneWrap start={contentStart}   dur={contentFrames}><ContentPlaceholder topic={topic} /></SceneWrap>
      <SceneWrap start={outroStart}     dur={outroFrames}  ><OutroCard ctaHeadline={ctaHeadline} ctaUrl={ctaUrl} /></SceneWrap>
    </AbsoluteFill>
  )
}
