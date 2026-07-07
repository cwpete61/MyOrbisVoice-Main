import { Audio, Sequence, staticFile } from 'remotion';

/** Plays the per-turn call voiceover clips (public/vo/call-<lang>-NN.mp3) in
 *  sync with the PhoneCallSim bubbles: clip i starts at the cumulative sum of
 *  the same `durs` the sim uses for its bubble layout. Orby lines are nova,
 *  caller lines echo (baked into the clips). Used only in the audible Explainer
 *  call. */
export const CallVoiceover: React.FC<{ lang: 'en' | 'es'; durs: number[] }> = ({ lang, durs }) => {
  const starts: number[] = [];
  durs.reduce((acc, d, i) => {
    starts[i] = acc;
    return acc + d;
  }, 0);
  return (
    <>
      {durs.map((_, i) => (
        <Sequence key={i} from={starts[i]!} name={`call-${lang}-${i}`}>
          <Audio src={staticFile(`vo/call-${lang}-${String(i).padStart(2, '0')}.mp3`)} />
        </Sequence>
      ))}
    </>
  );
};
