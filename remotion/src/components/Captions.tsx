import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

/** Bottom caption bar — carries the story when muted (autoplay) and subtitles
 *  the phone-call sims. */
export const Caption: React.FC<{ text: string; emphasis?: boolean }> = ({ text, emphasis }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 90,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: appear,
        transform: `translateY(${interpolate(appear, [0, 1], [16, 0])}px)`,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          textAlign: 'center',
          fontFamily: theme.font,
          fontWeight: emphasis ? 800 : 600,
          fontSize: emphasis ? 62 : 44,
          lineHeight: 1.15,
          color: theme.white,
          background: 'rgba(13,21,18,0.72)',
          padding: '18px 34px',
          borderRadius: 18,
          backdropFilter: 'blur(4px)',
        }}
      >
        {text}
      </div>
    </div>
  );
};
