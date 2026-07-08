import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Orb } from '../components/Orb';
import { brand, theme } from '../theme';

// Email-marketing GIF: a coral "leaking commission" $ counter. Built for email:
//  - STATIC gradient bg (no animated grid) so the GIF palette stays tiny.
//  - Frames 0-14 show the FINAL number, so frame 1 is a complete poster —
//    Outlook (Windows) freezes GIFs on frame 1 and still gets the full message.
//  - Then it re-counts 0 -> total and holds, looping cleanly.
type Lang = 'en' | 'es';
const TOTAL = 18400; // matches the LeadEvalReport leak figure (brand-consistent)

const COPY = {
  en: { eyebrow: 'WHAT A MISSED CALL REALLY COSTS', sub: 'leaking every year — one missed call at a time', tag: 'Orby catches. You close.' },
  es: { eyebrow: 'LO QUE CUESTA UNA LLAMADA PERDIDA', sub: 'que pierdes cada año — una llamada a la vez', tag: 'Orby atiende. Tú cierras.' },
};

export const GifMoneyCounter: React.FC<{ lang?: Lang }> = ({ lang = 'en' }) => {
  const frame = useCurrentFrame();
  const c = COPY[lang];
  // Frame-1 poster: hold the full number for the first 14 frames.
  const p = interpolate(frame - 15, [0, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const eased = 1 - Math.pow(1 - p, 3);
  const value = frame < 15 ? TOTAL : Math.round(TOTAL * eased);
  const shown = value.toLocaleString('en-US');
  const pop = interpolate(frame - 15, [36, 44], [1.05, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: theme.bgGrad, fontFamily: theme.font, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: theme.muted, letterSpacing: 2.5, marginBottom: 34 }}>{c.eyebrow}</div>
        <div style={{ fontSize: 210, fontWeight: 900, color: theme.coral, lineHeight: 1, letterSpacing: '-0.03em', textShadow: `0 0 70px ${theme.coral}55`, transform: `scale(${frame < 15 ? 1 : pop})` }}>
          ${shown}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: theme.textDim, marginTop: 30, maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>{c.sub}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 46 }}>
          <Orb size={70} />
          <div style={{ fontSize: 40, fontWeight: 900, color: theme.text }}>{c.tag}</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: theme.aqua }}>· {brand.site}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
