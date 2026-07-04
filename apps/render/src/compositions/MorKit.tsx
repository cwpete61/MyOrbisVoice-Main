import React from 'react'
import { AbsoluteFill } from 'remotion'
import { SORA, INTER, TEAL, TEAL_BRIGHT, WHITE, MUTED } from './_theme'
import { OrbitalBg, Eyebrow, LEAKS, PILLARS } from './MorHero'

// ── MyOrbisResults marketing-kit STILLS (16:9, 1920×1080) ──────────────────
// Static, settled-state boards pulled from the hero video scenes. Render as
// single-frame stills for slide decks, social, partner pitch material.

export const MorKitLeaks: React.FC = () => (
  <AbsoluteFill>
    <OrbitalBg dim={0.7} />
    <AbsoluteFill style={{ justifyContent: 'center', padding: '0 140px' }}>
      <Eyebrow>The Real Problem</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 92, lineHeight: 1.04, letterSpacing: -2.5, color: WHITE, marginBottom: 48 }}>
        You don&rsquo;t have one problem.<br /><span style={{ color: TEAL_BRIGHT }}>You have a bucket with six holes.</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '22px 40px', maxWidth: 1500 }}>
        {LEAKS.map((l) => (
          <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ width: 22, height: 22, borderRadius: 7, background: `${l.color}33`, border: `2px solid ${l.color}`, flexShrink: 0 }} />
            <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 36, color: WHITE }}>{l.name}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
)

export const MorKitSystem: React.FC = () => (
  <AbsoluteFill>
    <OrbitalBg dim={0.7} />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 110px' }}>
      <Eyebrow>The System</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 76, letterSpacing: -2, color: WHITE, marginBottom: 54, textAlign: 'center' }}>
        One system. Every leak <span style={{ color: TEAL_BRIGHT }}>sealed.</span>
      </div>
      <div style={{ display: 'flex', gap: 28 }}>
        {PILLARS.map((p) => (
          <div key={p.tag} style={{ width: 360, padding: '44px 32px', borderRadius: 22, background: `${p.color}14`, border: `2px solid ${p.color}66` }}>
            <div style={{ fontFamily: INTER, fontWeight: 800, fontSize: 21, letterSpacing: 2, color: p.color, marginBottom: 16, textTransform: 'uppercase' }}>{p.tag}</div>
            <div style={{ fontFamily: SORA, fontWeight: 700, fontSize: 42, color: WHITE }}>{p.title}</div>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: INTER, fontWeight: 600, fontSize: 28, color: MUTED, marginTop: 50, letterSpacing: 1 }}>
        Get found &nbsp;→&nbsp; convert &nbsp;→&nbsp; answer &amp; book &nbsp;→&nbsp; make it stick
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
)

export const MorKitCta: React.FC = () => (
  <AbsoluteFill>
    <OrbitalBg dim={0.85} />
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: '0 160px' }}>
      <Eyebrow>Start Here</Eyebrow>
      <div style={{ fontFamily: SORA, fontWeight: 800, fontSize: 104, letterSpacing: -3, color: WHITE, textAlign: 'center', marginBottom: 44 }}>
        Stop patching.<br /><span style={{ color: TEAL_BRIGHT }}>Start compounding.</span>
      </div>
      <div style={{ padding: '26px 60px', borderRadius: 999, border: `2.5px solid ${TEAL_BRIGHT}`, background: `${TEAL}33`, marginBottom: 32 }}>
        <span style={{ fontFamily: SORA, fontWeight: 800, fontSize: 48, color: WHITE }}>Book a free Trifecta Consultation</span>
      </div>
      <div style={{ fontFamily: INTER, fontWeight: 700, fontSize: 40, color: TEAL_BRIGHT, letterSpacing: 1 }}>myorbisresults.com</div>
    </AbsoluteFill>
  </AbsoluteFill>
)
