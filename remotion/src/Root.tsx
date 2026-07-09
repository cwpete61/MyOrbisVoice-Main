import { Composition } from 'remotion';
import { AdBilingual, AdNeverMiss, AdReady, AdSpeed, AdTimeBack, adDurations } from './compositions/Ads';
import { CutBilingual, CutNeverMiss, CutReady, CutSpeed, CutTimeBack, cutDurations } from './compositions/Cutdowns';
import { Explainer, explainerDuration } from './compositions/Explainer';
import { FounderStory, founderDuration } from './compositions/FounderStory';
import { GifMoneyCounter } from './compositions/GifMoneyCounter';
import { HomepageHero, homepageDuration } from './compositions/HomepageHero';
import { LeadEval, leadEvalDuration } from './compositions/LeadEval';
import { Objections, objectionDuration } from './compositions/Objections';
import { PartnerPitch, partnerDuration } from './compositions/PartnerPitch';
import { TwoMinute, twoMinuteDuration } from './compositions/TwoMinute';
import { WhatIfShowing, WhatIfSpanish, WhatIfSlept, whatIfDurations } from './compositions/WhatIf';

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

      <Composition id="PartnerPitch" component={PartnerPitch} durationInFrames={1010} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: partnerDuration(L(props)) })} />
      <Composition id="PartnerPitch-ES" component={PartnerPitch} durationInFrames={1120} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: partnerDuration(L(props)) })} />

      <Composition id="LeadEval" component={LeadEval} durationInFrames={790} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: leadEvalDuration(L(props)) })} />
      <Composition id="LeadEval-ES" component={LeadEval} durationInFrames={900} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: leadEvalDuration(L(props)) })} />

      <Composition id="Objections" component={Objections} durationInFrames={1210} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: objectionDuration(L(props)) })} />
      <Composition id="Objections-ES" component={Objections} durationInFrames={1240} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: objectionDuration(L(props)) })} />

      {/* ── "What if…" USP videos (dream → gap → live call → CTA) ── */}
      <Composition id="WhatIf-Showing" component={WhatIfShowing} durationInFrames={1100} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.showing(L(props)) })} />
      <Composition id="WhatIf-Showing-ES" component={WhatIfShowing} durationInFrames={1160} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.showing(L(props)) })} />

      <Composition id="WhatIf-Spanish" component={WhatIfSpanish} durationInFrames={1180} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.spanish(L(props)) })} />
      <Composition id="WhatIf-Spanish-ES" component={WhatIfSpanish} durationInFrames={1180} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.spanish(L(props)) })} />

      <Composition id="WhatIf-Slept" component={WhatIfSlept} durationInFrames={1040} fps={FPS} width={W} height={H} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.slept(L(props)) })} />
      <Composition id="WhatIf-Slept-ES" component={WhatIfSlept} durationInFrames={1100} fps={FPS} width={W} height={H} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: whatIfDurations.slept(L(props)) })} />

      {/* ── Email-marketing GIF source (landscape, 3s loop) ─────── */}
      <Composition id="GifMoneyCounter" component={GifMoneyCounter} durationInFrames={90} fps={FPS} width={1200} height={675} defaultProps={{ lang: 'en' as const }} />
      <Composition id="GifMoneyCounter-ES" component={GifMoneyCounter} durationInFrames={90} fps={FPS} width={1200} height={675} defaultProps={{ lang: 'es' as const }} />
      <Composition id="GifMoneyCounter-Sq" component={GifMoneyCounter} durationInFrames={90} fps={FPS} width={1080} height={1080} defaultProps={{ lang: 'en' as const }} />
      <Composition id="GifMoneyCounter-Sq-ES" component={GifMoneyCounter} durationInFrames={90} fps={FPS} width={1080} height={1080} defaultProps={{ lang: 'es' as const }} />

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

      {/* ── 9:16 6-second hook cutdowns (scroll-stoppers) ────────── */}
      <Composition id="Cut-NeverMiss" component={CutNeverMiss} durationInFrames={173} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.neverMiss(L(props)) })} />
      <Composition id="Cut-NeverMiss-ES" component={CutNeverMiss} durationInFrames={186} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.neverMiss(L(props)) })} />

      <Composition id="Cut-Speed" component={CutSpeed} durationInFrames={147} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.speed(L(props)) })} />
      <Composition id="Cut-Speed-ES" component={CutSpeed} durationInFrames={164} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.speed(L(props)) })} />

      <Composition id="Cut-Ready" component={CutReady} durationInFrames={162} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.ready(L(props)) })} />
      <Composition id="Cut-Ready-ES" component={CutReady} durationInFrames={140} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.ready(L(props)) })} />

      <Composition id="Cut-Bilingual" component={CutBilingual} durationInFrames={153} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.bilingual(L(props)) })} />
      <Composition id="Cut-Bilingual-ES" component={CutBilingual} durationInFrames={176} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.bilingual(L(props)) })} />

      <Composition id="Cut-TimeBack" component={CutTimeBack} durationInFrames={160} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'en' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.timeBack(L(props)) })} />
      <Composition id="Cut-TimeBack-ES" component={CutTimeBack} durationInFrames={163} fps={FPS} width={VW} height={VH} defaultProps={{ lang: 'es' as const }} calculateMetadata={({ props }) => ({ durationInFrames: cutDurations.timeBack(L(props)) })} />
    </>
  );
};
