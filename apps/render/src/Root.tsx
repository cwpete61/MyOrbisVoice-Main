// Composition registry — Remotion bundles whatever is registered here. Add
// new templates by importing them and adding a <Composition> entry. Every
// composition the render service can produce must be listed in this Root.

import './index.css'
import React from 'react'
import { Composition } from 'remotion'
import { SocialStatic } from './compositions/SocialStatic'
import { SocialImagery } from './compositions/SocialImagery'
import { SocialReel } from './compositions/SocialReel'
import { StatCard } from './compositions/StatCard'
import { HookCard } from './compositions/HookCard'
import { QuoteCard } from './compositions/QuoteCard'
import { ComparisonCard } from './compositions/ComparisonCard'
import { ValuePillars } from './compositions/ValuePillars'
import { HookReel } from './compositions/HookReel'
import { PartnerLongForm } from './compositions/PartnerLongForm'
import { MorHero } from './compositions/MorHero'
import { MorKitLeaks, MorKitSystem, MorKitCta } from './compositions/MorKit'
import { MorExplainer, MOR_EXPLAINER_FRAMES } from './compositions/MorExplainer'
import { OrbyExplainer16x9 } from './compositions/OrbyExplainer16x9'
import { OrbyExplainerFinal16x9, ORBY_FINAL_FRAMES } from './compositions/OrbyExplainerFinal16x9'
import { OrbyExplainerFinal01_16x9, ORBY_FINAL_01_FRAMES } from './compositions/OrbyExplainerFinal01_16x9'
import { OrbyExplainerFinalES_16x9, ORBY_FINAL_ES_FRAMES } from './compositions/OrbyExplainerFinalES_16x9'
import { OrbyAgentsShort, ORBY_AGENTS_SHORT_FRAMES } from './compositions/OrbyAgentsShort'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── Stills ─────────────────────────────────────────────────────── */}
      <Composition id="Social-Static"     component={SocialStatic}    durationInFrames={1}   fps={30} width={1080} height={1080} />
      <Composition id="Social-Imagery"    component={SocialImagery}   durationInFrames={1}   fps={30} width={1080} height={1350} defaultProps={{ bgUrl: '' }} />
      <Composition id="Stat-Card"         component={StatCard}        durationInFrames={1}   fps={30} width={1080} height={1080} />
      <Composition id="Hook-Card"         component={HookCard}        durationInFrames={1}   fps={30} width={1080} height={1080} />
      <Composition id="Quote-Card"        component={QuoteCard}       durationInFrames={1}   fps={30} width={1080} height={1350} />
      <Composition id="Comparison-Card"   component={ComparisonCard}  durationInFrames={1}   fps={30} width={1080} height={1080} />
      <Composition id="Value-Pillars"     component={ValuePillars}    durationInFrames={1}   fps={30} width={1080} height={1350} />
      {/* ── Video ──────────────────────────────────────────────────────── */}
      <Composition id="Social-Reel"       component={SocialReel}      durationInFrames={360} fps={30} width={1080} height={1920} />
      <Composition id="Hook-Reel"         component={HookReel}        durationInFrames={450} fps={30} width={1080} height={1920} />
      <Composition id="Partner-LongForm"  component={PartnerLongForm} durationInFrames={600} fps={30} width={1920} height={1080} />
      {/* ── MyOrbisResults 16:9 hero video + marketing-kit stills ────────── */}
      <Composition id="Mor-Hero"          component={MorHero}         durationInFrames={930} fps={30} width={1920} height={1080} />
      <Composition id="Mor-Kit-Leaks"     component={MorKitLeaks}     durationInFrames={1}   fps={30} width={1920} height={1080} />
      <Composition id="Mor-Kit-System"    component={MorKitSystem}    durationInFrames={1}   fps={30} width={1920} height={1080} />
      <Composition id="Mor-Kit-CTA"       component={MorKitCta}       durationInFrames={1}   fps={30} width={1920} height={1080} />
      {/* 5-minute explainer (300s @30fps) */}
      <Composition id="Mor-Explainer"     component={MorExplainer}    durationInFrames={MOR_EXPLAINER_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="Mor-Explainer-9x16" component={MorExplainer}   durationInFrames={MOR_EXPLAINER_FRAMES} fps={30} width={1080} height={1920} />
      {/* Graphics overlay on the provided 5:05 presenter video */}
      <Composition id="Orby-Explainer-16x9" component={OrbyExplainer16x9} durationInFrames={9143} fps={30} width={1920} height={1080} />
      <Composition id="Orby-Explainer-Final-16x9" component={OrbyExplainerFinal16x9} durationInFrames={ORBY_FINAL_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="Orby-Explainer-Final-01-16x9" component={OrbyExplainerFinal01_16x9} durationInFrames={ORBY_FINAL_01_FRAMES} fps={30} width={1920} height={1080} />
      <Composition id="Orby-Explainer-Final-ES-16x9" component={OrbyExplainerFinalES_16x9} durationInFrames={ORBY_FINAL_ES_FRAMES} fps={30} width={1920} height={1080} />
      {/* ── MyOrbisAgents explainers (teal RE-ISA brand, Aoede narration) ─── */}
      <Composition id="Orby-Agents-Short-16x9" component={OrbyAgentsShort} durationInFrames={ORBY_AGENTS_SHORT_FRAMES} fps={30} width={1920} height={1080} />
    </>
  )
}
