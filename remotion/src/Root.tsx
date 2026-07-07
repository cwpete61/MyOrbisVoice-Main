import { Composition } from 'remotion';
import { AdBilingual, AdNeverMiss, AdReady, AdSpeed, AdTimeBack, adDurations } from './compositions/Ads';
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
      <Composition id="Ad-NeverMiss" component={AdNeverMiss} durationInFrames={655} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.neverMiss(L(props)) })} />
      <Composition id="Ad-NeverMiss-ES" component={AdNeverMiss} durationInFrames={720} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.neverMiss(L(props)) })} />

      <Composition id="Ad-Speed" component={AdSpeed} durationInFrames={860} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.speed(L(props)) })} />
      <Composition id="Ad-Speed-ES" component={AdSpeed} durationInFrames={880} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.speed(L(props)) })} />

      <Composition id="Ad-Ready" component={AdReady} durationInFrames={700} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.ready(L(props)) })} />
      <Composition id="Ad-Ready-ES" component={AdReady} durationInFrames={745} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.ready(L(props)) })} />

      <Composition id="Ad-Bilingual" component={AdBilingual} durationInFrames={780} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.bilingual(L(props)) })} />
      <Composition id="Ad-Bilingual-ES" component={AdBilingual} durationInFrames={780} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.bilingual(L(props)) })} />

      <Composition id="Ad-TimeBack" component={AdTimeBack} durationInFrames={690} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.timeBack(L(props)) })} />
      <Composition id="Ad-TimeBack-ES" component={AdTimeBack} durationInFrames={750} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: adDurations.timeBack(L(props)) })} />
    </>
  );
};
