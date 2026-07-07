import { interpolate, useCurrentFrame } from 'remotion';
import { Stage } from './Scene';
import { theme } from '../theme';

const STEPS = {
  en: ['Connect your number', 'Set your rules', 'Go live'],
  es: ['Conecta tu número', 'Define tus reglas', 'Listo, en vivo'],
};
const NOTE = { en: 'About ten minutes. No code.', es: 'Unos diez minutos. Sin código.' };

/** Three numbered setup steps that reveal in sequence — the "is it hard?"
 *  objection answer. */
export const SetupSteps: React.FC<{ lang?: 'en' | 'es'; eyebrow?: string }> = ({ lang = 'en', eyebrow }) => {
  const frame = useCurrentFrame();
  const steps = STEPS[lang];
  return (
    <Stage>
      <div style={{ fontFamily: theme.font, textAlign: 'center' }}>
        {eyebrow && <div style={{ fontSize: 34, fontWeight: 800, color: theme.muted, letterSpacing: 2, marginBottom: 44 }}>{eyebrow}</div>}
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', alignItems: 'stretch' }}>
          {steps.map((s, i) => {
            const ap = interpolate(frame, [8 + i * 26, 26 + i * 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <div
                key={i}
                style={{
                  width: 420,
                  background: theme.panel,
                  border: `1px solid ${theme.panelBorder}`,
                  borderRadius: 28,
                  padding: '48px 36px',
                  opacity: ap,
                  transform: `translateY(${interpolate(ap, [0, 1], [40, 0])}px) scale(${interpolate(ap, [0, 1], [0.94, 1])})`,
                }}
              >
                <div
                  style={{
                    width: 92,
                    height: 92,
                    margin: '0 auto 28px',
                    borderRadius: 999,
                    background: theme.gradHot,
                    color: '#04231f',
                    fontSize: 52,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(45,207,207,0.4)',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 46, fontWeight: 800, color: theme.text, lineHeight: 1.1 }}>{s}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700, color: theme.aqua, marginTop: 52 }}>{NOTE[lang]}</div>
      </div>
    </Stage>
  );
};
