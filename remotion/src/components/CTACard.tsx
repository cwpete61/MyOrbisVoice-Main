import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, theme } from '../theme';
import { Bg } from './Scene';
import { Logo } from './Logo';
import { Orb } from './Orb';

/** The brand close, on the dark canvas: Orb + wordmark, tagline, "try Orby
 *  yourself", and the demo number as a glowing pill. */
export const CTACard: React.FC<{ lang?: 'en' | 'es' }> = ({ lang = 'en' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 16 } });
  const tagline = lang === 'es' ? brand.taglineEs : brand.tagline;
  const cta = lang === 'es' ? brand.ctaEs : brand.ctaEn;
  const callLine = lang === 'es' ? 'Llama al' : 'Call';
  const orLine = lang === 'es' ? 'o habla con Orby en' : 'or talk to Orby at';
  const pill = spring({ frame: frame - 10, fps, config: { damping: 14 } });

  return (
    <Bg>
      <AbsoluteWrap>
        <div style={{ textAlign: 'center', transform: `translateY(${interpolate(rise, [0, 1], [40, 0])}px)`, opacity: rise }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}><Orb size={150} /></div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}><Logo onDark size={1.5} /></div>
          <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: '-0.02em', color: theme.text, marginBottom: 22 }}>{tagline}</div>
          <div style={{ fontSize: 38, fontWeight: 600, color: theme.textDim, marginBottom: 44 }}>{cta}</div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              background: theme.gradHot,
              color: '#04231f',
              fontSize: 54,
              fontWeight: 900,
              padding: '20px 46px',
              borderRadius: 999,
              boxShadow: `0 0 60px rgba(45,207,207,0.5)`,
              transform: `scale(${0.9 + 0.1 * pill})`,
            }}
          >
            📞 {callLine} {brand.phone}
          </div>
          <div style={{ fontSize: 32, marginTop: 28, color: theme.textDim }}>
            {orLine} <strong style={{ color: theme.aqua }}>{brand.site}</strong>
          </div>
        </div>
      </AbsoluteWrap>
    </Bg>
  );
};

// tiny local helper to center within Bg without re-importing AbsoluteFill everywhere
const AbsoluteWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>{children}</div>
);
