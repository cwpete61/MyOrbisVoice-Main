'use client'

/**
 * MyOrbisWebinar — the player, and the engagement instrumentation that rides on it.
 *
 * This component exists because of one bug: the watch page used to be a play button
 * over nothing, running `setInterval(() => emit('WATCHED'), 30s)`. That timer did not
 * know whether anything was playing — so it counted a paused video, a backgrounded tab,
 * and a video that had ended. Every EngagementScore, every hot/warm/cold bucket, and
 * the hero rule's "engaged" test were computed from that number.
 *
 * Here the beat is driven by the provider's own play/pause state, so WATCHED means
 * watched:
 *
 *   - starts on PLAY, stops on PAUSE / END / unmount
 *   - a hidden tab suspends the beat and resumes it on return IF the video is genuinely
 *     still playing (backgrounded video keeps running; the viewer is not watching it)
 *   - the final partial beat is flushed on pause/end, so a 40s watch scores 40s, not 30
 *
 * SECURITY: `videoRef` is a provider-native id validated server-side against
 * /^[A-Za-z0-9_-]{11}$/ (YouTube) or /^[0-9]{6,12}$/ (Vimeo) — see
 * api/services/webinar/video.ts. The embed URL is built from the constant templates
 * below. No tenant-supplied URL ever reaches this iframe's src.
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export type VideoProvider = 'YOUTUBE' | 'VIMEO'

/** Beat cadence. 30s, matching the server's watchSeconds increment.
 *  Cost is quadratic in beats (each appends a row AND recomputes the person's score by
 *  re-reading their whole event list): a 45-min watch is 90 rows / ~4k reads at 30s vs
 *  270 / ~36k at 10s. Not 60s+ — short viewers are the cold leads we still want scored. */
const HEARTBEAT_SECONDS = 30

/** Ids are charset-validated server-side; encode anyway — defence in depth is free. */
function embedSrc(provider: VideoProvider, ref: string): string {
  const id = encodeURIComponent(ref)
  return provider === 'YOUTUBE'
    // enablejsapi=1 is what lets the IFrame API report play/pause at all — without it
    // there is no engagement signal. origin pins postMessage to us. The -nocookie host
    // keeps YouTube ad cookies off the tenant's page: their prospect, their brand,
    // their compliance surface.
    ? `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`
    // dnt=1 = Vimeo's do-not-track, same reasoning.
    : `https://player.vimeo.com/video/${id}?dnt=1&title=0&byline=0&portrait=0`
}

/** Load a script once, shared across mounts. */
const loaded = new Map<string, Promise<void>>()
function loadScript(src: string): Promise<void> {
  const hit = loaded.get(src)
  if (hit) return hit
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
  loaded.set(src, p)
  return p
}

// Minimal shapes for the two provider SDKs — we use a sliver of each and don't want
// their typings as dependencies.
interface YTPlayer { destroy(): void }
interface VimeoPlayer {
  on(event: string, cb: () => void): void
  destroy(): Promise<void>
}
declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayer
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
    }
    onYouTubeIframeAPIReady?: () => void
    Vimeo?: { Player: new (el: HTMLElement, opts?: unknown) => VimeoPlayer }
  }
}

/** The YouTube API signals readiness through ONE global callback, so concurrent players
 *  must share a promise rather than each clobbering the hook. */
let ytReady: Promise<void> | null = null
function loadYouTubeApi(): Promise<void> {
  if (ytReady) return ytReady
  ytReady = new Promise<void>((resolve) => {
    if (window.YT?.Player) { resolve(); return }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve() }
    void loadScript('https://www.youtube.com/iframe_api')
  })
  return ytReady
}

export interface VideoPlayerProps {
  provider: VideoProvider
  videoRef: string
  /** Fired once, on first play. */
  onFirstPlay?: () => void
  /** Real watched seconds. Only ever called for time actually played. */
  onWatched: (seconds: number) => void
}

export function VideoPlayer({ provider, videoRef: refId, onFirstPlay, onWatched }: VideoPlayerProps) {
  const frame = useRef<HTMLIFrameElement | null>(null)
  const [failed, setFailed] = useState(false)

  // Refs, not state: the SDK callbacks close over these once, and re-rendering the
  // iframe on every heartbeat would restart the video.
  const beat = useRef<ReturnType<typeof setInterval> | null>(null)
  const runFrom = useRef<number | null>(null) // wall-clock ms the current run started
  const isPlaying = useRef(false)             // provider-reported, survives tab hiding
  const firstPlay = useRef(false)
  const cb = useRef(onWatched); cb.current = onWatched
  const firstCb = useRef(onFirstPlay); firstCb.current = onFirstPlay

  /** Stop beating and emit whatever is left since the last whole beat.
   *  Without the flush, pausing at 40s reports one 30s beat and silently drops 10s. */
  const suspend = useCallback(() => {
    if (beat.current) { clearInterval(beat.current); beat.current = null }
    if (runFrom.current !== null) {
      const partial = Math.round((Date.now() - runFrom.current) / 1000)
      runFrom.current = null
      if (partial > 0) cb.current(partial)
    }
  }, [])

  const resume = useCallback(() => {
    if (beat.current) return // already beating; a repeat PLAY is a no-op
    runFrom.current = Date.now()
    beat.current = setInterval(() => {
      runFrom.current = Date.now() // reset the partial window for the next beat
      cb.current(HEARTBEAT_SECONDS)
    }, HEARTBEAT_SECONDS * 1000)
  }, [])

  const onPlay = useCallback(() => {
    isPlaying.current = true
    if (!firstPlay.current) { firstPlay.current = true; firstCb.current?.() }
    if (!document.hidden) resume()
  }, [resume])

  const onStop = useCallback(() => { isPlaying.current = false; suspend() }, [suspend])

  // A backgrounded tab keeps playing — but nobody is watching it, so it must not score.
  // Resume only if the provider still reports playing when they come back.
  useEffect(() => {
    function onVis() {
      if (document.hidden) suspend()
      else if (isPlaying.current) resume()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [suspend, resume])

  useEffect(() => {
    let disposed = false
    let yt: YTPlayer | null = null
    let vimeo: VimeoPlayer | null = null

    async function mount() {
      const el = frame.current
      if (!el) return
      try {
        if (provider === 'YOUTUBE') {
          await loadYouTubeApi()
          if (disposed || !window.YT) return
          const S = window.YT.PlayerState
          // Attaches to the existing iframe (it already carries enablejsapi=1).
          yt = new window.YT.Player(el, {
            events: {
              onStateChange: (e: { data: number }) => {
                if (e.data === S.PLAYING) onPlay()
                else if (e.data === S.PAUSED || e.data === S.ENDED) onStop()
              },
              onError: () => setFailed(true),
            },
          })
        } else {
          await loadScript('https://player.vimeo.com/api/player.js')
          if (disposed || !window.Vimeo) return
          vimeo = new window.Vimeo.Player(el)
          vimeo.on('play', onPlay)
          vimeo.on('pause', onStop)
          vimeo.on('ended', onStop)
        }
      } catch {
        setFailed(true) // SDK blocked (adblock/CSP/offline) — the iframe itself still plays.
      }
    }
    void mount()

    return () => {
      disposed = true
      suspend() // flush the final partial beat before tearing down
      try { yt?.destroy() } catch { /* iframe already gone */ }
      void vimeo?.destroy().catch(() => { /* iframe already gone */ })
    }
  }, [provider, refId, onPlay, onStop, suspend])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ aspectRatio: '16/9', borderRadius: 12, overflow: 'hidden', background: '#06231f' }}>
        {/* src is built from constant templates + a charset-validated id — never a
            tenant-supplied string. */}
        <iframe
          ref={frame}
          src={embedSrc(provider, refId)}
          title="Webinar"
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {failed && (
        // The video still plays — only our measurement is gone. Say so rather than
        // pretend, and never fall back to a blind timer: a wrong number is worse than a
        // missing one when it decides who gets an automated phone call.
        <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9aa3a3' }}>
          Playback tracking unavailable — the video plays, engagement won&apos;t be scored.
        </p>
      )}
    </div>
  )
}
