import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/** The Orby mascot: a glowing teal orb with a soft bloom, a concentric ring,
 *  and two eyes. Breathes (pulse) + the eyes blink occasionally. This is the
 *  brand mark used across every piece (matches the reference explainer). */
export const Orb: React.FC<{ size?: number; talking?: boolean }> = ({ size = 240, talking = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = 1 + 0.03 * Math.sin((frame / fps) * Math.PI * 1.1);
  const glow = 0.55 + 0.2 * Math.sin((frame / fps) * Math.PI * 1.1);
  // blink every ~2.6s for 4 frames
  const blinkPhase = frame % Math.round(fps * 2.6);
  const blinking = blinkPhase < 3;
  const eyeH = blinking ? 0.16 : 1;
  // subtle talk bob when in a call
  const bob = talking ? Math.sin((frame / fps) * Math.PI * 6) * 0.06 : 0;

  const eye = size * 0.1;
  return (
    <div style={{ position: 'relative', width: size, height: size, transform: `scale(${breathe})` }}>
      {/* outer bloom */}
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.35,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(45,207,207,${glow}) 0%, rgba(25,181,181,0.18) 40%, transparent 70%)`,
          filter: 'blur(6px)',
        }}
      />
      {/* concentric ring */}
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.12,
          borderRadius: '50%',
          border: `2px solid rgba(45,207,207,0.35)`,
        }}
      />
      {/* orb body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%, #7ff0f0 0%, #2ccfcf 30%, #19b5b5 62%, #0b8f95 100%)`,
          boxShadow: `0 0 ${size * 0.4}px rgba(45,207,207,0.5), inset 0 0 ${size * 0.2}px rgba(255,255,255,0.25)`,
        }}
      />
      {/* eyes */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: size * 0.11, transform: `translateY(${size * (0.02 + bob)}px)` }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            style={{
              width: eye,
              height: eye * eyeH,
              borderRadius: '50%',
              background: '#06141a',
              boxShadow: `0 0 ${size * 0.02}px rgba(0,0,0,0.4)`,
              transition: 'none',
            }}
          />
        ))}
      </div>
      {/* highlight glint */}
      <div style={{ position: 'absolute', top: size * 0.16, left: size * 0.2, width: size * 0.14, height: size * 0.14, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', filter: 'blur(2px)' }} />
      {/* intro-only ripple */}
      {(() => {
        const r = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });
        if (r >= 1) return null;
        return <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid rgba(45,207,207,${0.5 * (1 - r)})`, transform: `scale(${1 + r * 0.7})` }} />;
      })()}
    </div>
  );
};
