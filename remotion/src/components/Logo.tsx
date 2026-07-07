import { loadFont } from '@remotion/google-fonts/Sora';
import { theme } from '../theme';

const { fontFamily } = loadFont();

/** The real MyOrbisAgents wordmark, reproduced from myorbisagents.com CSS:
 *  a teal-gradient orb (with a white highlight + glow ring) followed by
 *  MYORBIS (ink) + AGENTS (teal gradient), in Sora 900. `size` scales it. */
export const Logo: React.FC<{ size?: number; onDark?: boolean }> = ({ size = 1, onDark = false }) => {
  const orb = 46 * size;
  const fontSize = 40 * size;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 * size, fontFamily }}>
      {/* orb */}
      <div
        style={{
          width: orb,
          height: orb,
          borderRadius: '50%',
          background: onDark ? 'linear-gradient(105deg, #7ff0f0 0%, #eafffb 100%)' : theme.gradHot,
          boxShadow: `0 0 0 ${7 * size}px ${onDark ? 'rgba(255,255,255,0.22)' : 'color-mix(in srgb, ' + theme.teal + ' 18%, transparent)'}`,
          position: 'relative',
          flex: 'none',
        }}
      >
        <div
          style={{
            content: '""',
            position: 'absolute',
            top: 10 * size,
            right: 10 * size,
            width: 12 * size,
            height: 12 * size,
            borderRadius: '50%',
            background: '#fff',
            opacity: 0.9,
          }}
        />
      </div>
      {/* wordmark */}
      <div style={{ fontWeight: 900, letterSpacing: '-0.03em', fontSize, lineHeight: 1 }}>
        <span style={{ color: onDark ? theme.white : theme.ink }}>MYORBIS</span>
        <span
          style={{
            // On a teal background the dark teal gradient vanishes — use a light
            // aqua→white gradient so AGENTS reads; on light bg keep the brand gradient.
            background: onDark ? 'linear-gradient(115deg, #eafffb 0%, #8ff2f2 100%)' : theme.gradMix,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          AGENTS
        </span>
      </div>
    </div>
  );
};
