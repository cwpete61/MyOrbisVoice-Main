import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { theme } from '../theme';

export interface FilmScene {
  /** Scene length in frames. Size to the VO (audio) length so there's no
   *  trailing dead air. */
  dur: number;
  /** VO clip in public/vo/ (without extension), played from the scene start. */
  audio?: string;
  node: React.ReactNode;
}

/** Total composition length for a scene list with crossfades: sum of scene
 *  durations minus the overlap consumed by each transition. */
export const filmDuration = (scenes: FilmScene[], transitionFrames = 16): number =>
  scenes.reduce((s, sc) => s + sc.dur, 0) - transitionFrames * Math.max(0, scenes.length - 1);

/** Renders scenes back-to-back with a fade crossfade between each. Each scene is
 *  sized to its own VO, so nothing lingers silent. */
export const Film: React.FC<{ scenes: FilmScene[]; transitionFrames?: number }> = ({ scenes, transitionFrames = 16 }) => {
  const timing = linearTiming({ durationInFrames: transitionFrames });
  return (
    <AbsoluteFill style={{ background: theme.bgDeep }}>
      <TransitionSeries>
        {scenes.flatMap((s, i) => {
          const seq = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.dur}>
              {s.audio ? <Audio src={staticFile(`vo/${s.audio}.mp3`)} /> : null}
              {s.node}
            </TransitionSeries.Sequence>
          );
          if (i === scenes.length - 1) return [seq];
          return [seq, <TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={timing} />];
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
