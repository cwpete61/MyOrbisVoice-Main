// Composition registry — Remotion bundles whatever is registered here. Add
// new templates by importing them and adding a <Composition> entry. Every
// composition the render service can produce must be listed in this Root.

import './index.css'
import React from 'react'
import { Composition } from 'remotion'
import { SocialStatic } from './compositions/SocialStatic'
import { SocialImagery } from './compositions/SocialImagery'
import { SocialReel } from './compositions/SocialReel'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Static branded card — IG square */}
      <Composition id="Social-Static"  component={SocialStatic}  durationInFrames={1}   fps={30} width={1080} height={1080} />
      {/* Photographic AI background + typography overlay — IG portrait 4:5 */}
      <Composition id="Social-Imagery" component={SocialImagery} durationInFrames={1}   fps={30} width={1080} height={1350}
        defaultProps={{ bgUrl: '' }} />
      {/* Animated short reel — 9:16, 12 seconds */}
      <Composition id="Social-Reel"    component={SocialReel}    durationInFrames={360} fps={30} width={1080} height={1920} />
    </>
  )
}
