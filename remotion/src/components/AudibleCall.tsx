import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { callDurs, CALL_LEAD_IN } from '../data/calls';
import { theme } from '../theme';
import { CallVoiceover } from './CallVoiceover';
import { PhoneCallSim } from './PhoneCallSim';
import { Stage } from './Scene';

/** Scene CONTENTS for an audible phone-call beat: an optional narrator lead-in,
 *  then the voiced conversation (bubbles + per-turn VO in sync), plus an
 *  optional caption. `maxTurns` trims to a snippet for short pieces. Wrap this in
 *  a <Scene from dur={callSceneDur(...)}> in the composition. */
export const AudibleCall: React.FC<{
  variant: string; // rent-en | rent-es | sale-en | sale-es — drives sim + audio + durs
  narrator?: string; // public/vo/<narrator>.mp3
  showApp?: boolean;
  maxTurns?: number;
  scale?: number;
  caption?: string;
  leadIn?: number;
}> = ({ variant, narrator, showApp = true, maxTurns, scale = 0.82, caption, leadIn = CALL_LEAD_IN }) => {
  const durs = callDurs(variant, maxTurns);
  return (
    <>
      {narrator && <Audio src={staticFile(`vo/${narrator}.mp3`)} />}
      <Sequence from={leadIn}>
        <Stage scale={scale}>
          <PhoneCallSim variant={variant} turnDurs={durs} showApp={showApp} />
        </Stage>
        {caption && (
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 }}>
            <div style={{ fontFamily: theme.font, fontSize: 34, fontWeight: 800, color: theme.tealDeep, letterSpacing: 1 }}>{caption}</div>
          </AbsoluteFill>
        )}
        <CallVoiceover variant={variant} durs={durs} />
      </Sequence>
    </>
  );
};
