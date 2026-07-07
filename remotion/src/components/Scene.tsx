import React from 'react';
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Orb } from './Orb';
import { theme } from '../theme';

/** Dark premium backdrop shared by every scene: teal-black vignette + a slow
 *  drifting glow + a faint dot grid, so nothing is ever a flat still. */
export const Bg: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const gx = 30 + 8 * Math.sin(t * 0.5);
  const gy = 20 + 6 * Math.cos(t * 0.4);
  return (
    <AbsoluteFill style={{ background: theme.bgDeep, fontFamily: theme.font, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(120% 120% at ${gx}% ${gy}%, #0c2a2c 0%, #06141a 55%, #03100f 100%)` }} />
      {/* dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(45,207,207,0.10) 1.4px, transparent 1.4px)',
          backgroundSize: '46px 46px',
          opacity: 0.5,
          maskImage: 'radial-gradient(80% 80% at 50% 45%, #000 0%, transparent 90%)',
          WebkitMaskImage: 'radial-gradient(80% 80% at 50% 45%, #000 0%, transparent 90%)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

/** Timed scene wrapper. `audio` = a VO file in public/vo/ (without extension),
 *  played from the scene's start. */
export const Scene: React.FC<{ from: number; dur: number; audio?: string; children: React.ReactNode }> = ({ from, dur, audio, children }) => (
  <Sequence from={from} durationInFrames={dur}>
    {audio && <Audio src={staticFile(`vo/${audio}.mp3`)} />}
    {children}
  </Sequence>
);

/** Eyebrow label (uppercase, teal, letter-spaced) — the reference's section tags. */
export const Eyebrow: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const a = interpolate(frame - delay, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: a, color: theme.aqua, fontSize: 26, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 22 }}>
      {text}
    </div>
  );
};

/** Full-frame headline beat on the dark backdrop. `sub` (or `eyebrow`) renders
 *  as the uppercase teal eyebrow ABOVE the headline; the headline words rise in.
 *  `bg` is accepted but ignored (every scene is dark now). `withOrb` shows the
 *  mascot beside the text. */
export const BigText: React.FC<{
  text: string;
  sub?: string;
  eyebrow?: string;
  bg?: string; // ignored — kept for call-site compatibility
  size?: number;
  color?: string;
  withOrb?: boolean;
}> = ({ text, sub, eyebrow, size = 92, color, withOrb }) => {
  const frame = useCurrentFrame();
  const label = eyebrow ?? sub;
  const headline = interpolate(frame, [6, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: withOrb ? 70 : 0, maxWidth: 1560 }}>
          {withOrb && <Orb size={250} />}
          <div style={{ textAlign: withOrb ? 'left' : 'center' }}>
            {label && <Eyebrow text={label} />}
            <div
              style={{
                fontSize: size,
                fontWeight: 900,
                lineHeight: 1.06,
                letterSpacing: '-0.02em',
                color: color ?? theme.text,
                opacity: headline,
                transform: `translateY(${interpolate(headline, [0, 1], [28, 0])}px)`,
              }}
            >
              {text}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Bg>
  );
};

/** Missed-call hook: dark, a pulsing coral ring + a dimmed phone, ring counter. */
export const RingingHook: React.FC<{ caption?: string }> = ({ caption = 'ring… ring… ring…' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = (frame % Math.round(fps)) / fps; // 0..1 each second
  const ringScale = 1 + pulse * 0.5;
  const ringOp = 0.6 * (1 - pulse);
  const rings = Math.floor(frame / fps) + 1;
  return (
    <Bg>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${theme.coral}`, opacity: ringOp, transform: `scale(${ringScale})` }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${theme.coral}`, opacity: ringOp * 0.6, transform: `scale(${ringScale + 0.25})` }} />
          <div style={{ fontSize: 96 }}>📞</div>
        </div>
        <div style={{ color: theme.coral, fontSize: 52, fontWeight: 800, marginTop: 46 }}>{caption}</div>
        <div style={{ color: theme.textFaint, fontSize: 28, marginTop: 12 }}>{rings} missed {rings === 1 ? 'call' : 'calls'}</div>
      </AbsoluteFill>
    </Bg>
  );
};

/** Center content on the dark backdrop. */
export const Stage: React.FC<{ children: React.ReactNode; scale?: number }> = ({ children, scale = 1 }) => (
  <Bg>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${scale})` }}>{children}</div>
    </AbsoluteFill>
  </Bg>
);
