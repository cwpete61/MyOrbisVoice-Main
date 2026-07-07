import { Audio, Sequence, staticFile } from 'remotion';
import { callAudioPrefix } from '../data/calls';

/** Plays the per-turn call voiceover clips (public/vo/<prefix>-NN.mp3, where the
 *  prefix is derived from the call `variant` — call-<lang> for rentals,
 *  sale-<lang> for the sales hero) in sync with the PhoneCallSim bubbles: clip i
 *  starts at the cumulative sum of the same `durs` the sim uses for its bubble
 *  layout. Orby lines are nova, caller lines echo (baked into the clips). */
export const CallVoiceover: React.FC<{ variant: string; durs: number[] }> = ({ variant, durs }) => {
  const prefix = callAudioPrefix(variant);
  const starts: number[] = [];
  durs.reduce((acc, d, i) => {
    starts[i] = acc;
    return acc + d;
  }, 0);
  return (
    <>
      {durs.map((_, i) => (
        <Sequence key={i} from={starts[i]!} name={`${prefix}-${i}`}>
          <Audio src={staticFile(`vo/${prefix}-${String(i).padStart(2, '0')}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
};
