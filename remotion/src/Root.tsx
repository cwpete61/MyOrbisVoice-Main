import { Composition } from 'remotion';
import { AdBrief, AdLatino, AdMissedCall, AdSpeed } from './compositions/Ads';
import { Explainer } from './compositions/Explainer';
import { FounderStory } from './compositions/FounderStory';
import { HomepageHero } from './compositions/HomepageHero';
import { TwoMinute } from './compositions/TwoMinute';

const FPS = 30;
const W = 1920;
const H = 1080;
const VW = 1080; // vertical (9:16) ad width
const VH = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── 16:9 films ─────────────────────────────────────────── */}
      <Composition id="Explainer" component={Explainer} durationInFrames={3000} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} />
      <Composition id="Explainer-ES" component={Explainer} durationInFrames={3000} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} />

      <Composition id="FounderStory" component={FounderStory} durationInFrames={2250} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} />
      <Composition id="FounderStory-ES" component={FounderStory} durationInFrames={2250} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} />

      <Composition id="TwoMinute" component={TwoMinute} durationInFrames={3600} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} />
      <Composition id="TwoMinute-ES" component={TwoMinute} durationInFrames={3600} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} />

      <Composition id="HomepageHero" component={HomepageHero} durationInFrames={1050} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} />
      <Composition id="HomepageHero-ES" component={HomepageHero} durationInFrames={1050} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} />

      {/* ── 9:16 ads ───────────────────────────────────────────── */}
      <Composition id="Ad-MissedCall" component={AdMissedCall} durationInFrames={540} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} />
      <Composition id="Ad-MissedCall-ES" component={AdMissedCall} durationInFrames={540} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} />

      <Composition id="Ad-Latino" component={AdLatino} durationInFrames={600} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} />
      <Composition id="Ad-Latino-ES" component={AdLatino} durationInFrames={600} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} />

      <Composition id="Ad-Speed" component={AdSpeed} durationInFrames={660} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} />
      <Composition id="Ad-Speed-ES" component={AdSpeed} durationInFrames={660} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} />

      <Composition id="Ad-Brief" component={AdBrief} durationInFrames={600} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} />
      <Composition id="Ad-Brief-ES" component={AdBrief} durationInFrames={600} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} />
    </>
  );
};
