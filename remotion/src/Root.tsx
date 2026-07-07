import { Composition } from 'remotion';
import { AdBrief, AdLatino, AdMissedCall, AdSpeed, adDurations } from './compositions/Ads';
import { Explainer, explainerDuration } from './compositions/Explainer';
import { FounderStory, founderDuration } from './compositions/FounderStory';
import { HomepageHero, homepageDuration } from './compositions/HomepageHero';
import { TwoMinute, twoMinuteDuration } from './compositions/TwoMinute';

type Lang = 'en' | 'es';
const FPS = 30;
const W = 1920;
const H = 1080;
const VW = 1080;
const VH = 1920;
const L = (p: { lang?: Lang }) => (p.lang ?? 'en');

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Durations auto-computed from each film's VO-fit scenes (no dead air). */}
      {/* ── 16:9 films ─────────────────────────────────────────── */}
      <Composition id="Explainer" component={Explainer} durationInFrames={4758} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: explainerDuration(L(props)) })} />
      <Composition id="Explainer-ES" component={Explainer} durationInFrames={3531} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: explainerDuration(L(props)) })} />

      <Composition id="FounderStory" component={FounderStory} durationInFrames={1648} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: founderDuration(L(props)) })} />
      <Composition id="FounderStory-ES" component={FounderStory} durationInFrames={1710} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: founderDuration(L(props)) })} />

      <Composition id="TwoMinute" component={TwoMinute} durationInFrames={2316} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: twoMinuteDuration(L(props)) })} />
      <Composition id="TwoMinute-ES" component={TwoMinute} durationInFrames={2316} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: twoMinuteDuration(L(props)) })} />

      <Composition id="HomepageHero" component={HomepageHero} durationInFrames={850} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: homepageDuration(L(props)) })} />
      <Composition id="HomepageHero-ES" component={HomepageHero} durationInFrames={882} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: homepageDuration(L(props)) })} />

      {/* ── 9:16 ads ───────────────────────────────────────────── */}
      <Composition id="Ad-MissedCall" component={AdMissedCall} durationInFrames={423} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.missed(L(props)) })} />
      <Composition id="Ad-MissedCall-ES" component={AdMissedCall} durationInFrames={423} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.missed(L(props)) })} />

      <Composition id="Ad-Latino" component={AdLatino} durationInFrames={742} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.latino(L(props)) })} />
      <Composition id="Ad-Latino-ES" component={AdLatino} durationInFrames={742} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.latino(L(props)) })} />

      <Composition id="Ad-Speed" component={AdSpeed} durationInFrames={640} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.speed(L(props)) })} />
      <Composition id="Ad-Speed-ES" component={AdSpeed} durationInFrames={672} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.speed(L(props)) })} />

      <Composition id="Ad-Brief" component={AdBrief} durationInFrames={468} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.brief(L(props)) })} />
      <Composition id="Ad-Brief-ES" component={AdBrief} durationInFrames={468} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.brief(L(props)) })} />
    </>
  );
};
