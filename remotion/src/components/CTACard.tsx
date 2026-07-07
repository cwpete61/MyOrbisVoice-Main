import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, theme } from '../theme';

/** The identical closing card on every piece: tagline + "try Orby yourself" +
 *  number + site. Language-aware. */
export const CTACard: React.FC<{ lang?: 'en' | 'es' }> = ({ lang = 'en' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16 } });
  const tagline = lang === 'es' ? brand.taglineEs : brand.tagline;
  const cta = lang === 'es' ? brand.ctaEs : brand.ctaEn;
  const callLine = lang === 'es' ? 'Llama al' : 'Call';
  const orLine = lang === 'es' ? 'o habla con Orby en' : 'or talk to Orby at';

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${theme.tealDeep} 0%, ${theme.teal} 100%)`,
        color: theme.white,
        fontFamily: theme.font,
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 80,
      }}
    >
      <div style={{ transform: `translateY(${interpolate(rise, [0, 1], [40, 0])}px)`, opacity: rise }}>
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -1, marginBottom: 28 }}>{tagline}</div>
        <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.95, marginBottom: 48 }}>{cta}</div>
        <div
          style={{
            display: 'inline-block',
            background: theme.white,
            color: theme.tealDeep,
            fontSize: 56,
            fontWeight: 800,
            padding: '20px 44px',
            borderRadius: 20,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {callLine} {brand.phone}
        </div>
        <div style={{ fontSize: 34, marginTop: 30, opacity: 0.9 }}>
          {orLine} <strong>{brand.site}</strong>
        </div>
      </div>
    </AbsoluteFill>
  );
};
