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
    </>
  )
}
