'use client'

import { useState, useRef, useEffect } from 'react'
import { apiFetch, useApi } from '@/hooks/useApi'
import { FEMALE_AVATARS, MALE_AVATARS, AvatarDisplay, getAvatar } from '@/components/avatars/AvatarLibrary'
import { useT } from '@/lib/i18n/I18nProvider'

// ── Constants ─────────────────────────────────────────────────────────────────

const VOICES: Array<{ id: string; gender: 'female' | 'male' | 'neutral'; label: string }> = [
  { id: 'Zephyr',  gender: 'female',  label: 'Zephyr'  },
  { id: 'Despina', gender: 'female',  label: 'Despina' },
  { id: 'Aoede',   gender: 'female',  label: 'Aoede'   },
  { id: 'Charon',  gender: 'male',    label: 'Charon'  },
  { id: 'Fenrir',  gender: 'male',    label: 'Fenrir'  },
  { id: 'Puck',    gender: 'male',    label: 'Puck'    },
  { id: 'Sulafat', gender: 'neutral', label: 'Sulafat' },
]

const CHANNEL_TABS: Array<{ id: string; labelKey: string; icon: string }> = [
  { id: 'WIDGET',   labelKey: 'tenantAgentStudio.channels.widget',   icon: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-6v2m0 0v2m0-2h2m-2 0H6' },
  { id: 'INBOUND',  labelKey: 'tenantAgentStudio.channels.inbound',  icon: 'M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm4 10h.01M6 5h4M6 7h4M6 9h2' },
  { id: 'OUTBOUND', labelKey: 'tenantAgentStudio.channels.outbound', icon: 'M15 3l-4 4M3 13l4-4M11 7l2 2-6 6-2-2zm-3 7l-3 2 1-3' },
]

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'https://gateway.myorbisvoice.com'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelConfig {
  id: string
  channelType: string
  isEnabled: boolean
  configJson: Record<string, unknown> | null
}

type SessionState = 'idle' | 'connecting' | 'active' | 'ended' | 'error'

// ── Voice card ────────────────────────────────────────────────────────────────

function VoiceCard({ voice, selected, onClick }: { voice: typeof VOICES[0]; selected: boolean; onClick: () => void }) {
  const t = useT()
  const genderColor = voice.gender === 'female'
    ? { bg: 'oklch(20% 0.06 310)', border: selected ? 'oklch(65% 0.18 310)' : 'oklch(35% 0.10 310)', text: 'oklch(80% 0.14 310)' }
    : voice.gender === 'male'
    ? { bg: 'oklch(20% 0.06 220)', border: selected ? 'oklch(65% 0.18 220)' : 'oklch(35% 0.10 220)', text: 'oklch(80% 0.14 220)' }
    : { bg: 'oklch(20% 0.06 175)', border: selected ? 'oklch(65% 0.18 175)' : 'oklch(35% 0.10 175)', text: 'oklch(80% 0.14 175)' }

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl px-4 py-3 transition-all"
      style={{
        background: genderColor.bg,
        border: `1.5px solid ${genderColor.border}`,
        outline: selected ? `2px solid ${genderColor.border}` : 'none',
        outlineOffset: 2,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{voice.label}</p>
        {selected && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill={genderColor.border}/>
            <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <p className="text-xs mt-0.5" style={{ color: genderColor.text }}>{t(`tenantAgentStudio.voiceDesc.${voice.id}`)}</p>
      <span className="text-xs mt-1.5 inline-block px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }}>
        {t(`tenantAgentStudio.gender.${voice.gender}`)}
      </span>
    </button>
  )
}

// ── Audio helpers (mirrors widget JS pipeline) ────────────────────────────────

function float32ToPCM16(float32: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i] ?? 0))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buf
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i] ?? 0)
  return btoa(binary)
}

// ── Live test panel ───────────────────────────────────────────────────────────

function LiveTestPanel({
  channelType,
  voiceName,
  avatarId,
  onSessionEnd,
}: {
  channelType: string
  voiceName: string | null
  avatarId: string | null
  onSessionEnd: () => void
}) {
  const t = useT()
  const [state, setState] = useState<SessionState>('idle')
  const [micState, setMicState] = useState<'off' | 'on'>('off')
  const [statusText, setStatusText] = useState(() => t('tenantAgentStudio.testPanel.statusInitial'))
  const [error, setError] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  // Audio capture refs
  const mediaStreamRef  = useRef<MediaStream | null>(null)
  const audioCtxRef     = useRef<AudioContext | null>(null)
  const processorRef    = useRef<ScriptProcessorNode | null>(null)

  // Audio playback refs (same batching approach as widget JS)
  const playCtxRef    = useRef<AudioContext | null>(null)
  const playHeadRef   = useRef(0)
  const pcmQueueRef   = useRef<Uint8Array[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clean up everything on unmount
  useEffect(() => {
    return () => {
      stopMic()
      wsRef.current?.close()
      resetPlayback()
      playCtxRef.current?.close()
    }
  }, [])

  // ── Playback ────────────────────────────────────────────────────────────────

  function enqueueAudio(base64: string) {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    pcmQueueRef.current.push(bytes)
    if (!flushTimerRef.current) {
      flushTimerRef.current = setInterval(flushAudio, 20)
    }
  }

  function flushAudio() {
    if (pcmQueueRef.current.length === 0) return
    try {
      const SR = 24000
      if (!playCtxRef.current || playCtxRef.current.state === 'closed') {
        playCtxRef.current = new AudioContext({ sampleRate: SR })
        playHeadRef.current = 0
      }
      if (playCtxRef.current.state === 'suspended') playCtxRef.current.resume()

      const totalBytes = pcmQueueRef.current.reduce((s, b) => s + b.length, 0)
      const combined = new Uint8Array(totalBytes)
      let offset = 0
      for (const chunk of pcmQueueRef.current) { combined.set(chunk, offset); offset += chunk.length }
      pcmQueueRef.current = []

      const numSamples = combined.length / 2
      const audioBuf = playCtxRef.current.createBuffer(1, numSamples, SR)
      const channel = audioBuf.getChannelData(0)
      const dv = new DataView(combined.buffer)
      for (let i = 0; i < numSamples; i++) channel[i] = dv.getInt16(i * 2, true) / 32768

      const startAt = Math.max(playCtxRef.current.currentTime + 0.04, playHeadRef.current)
      const src = playCtxRef.current.createBufferSource()
      src.buffer = audioBuf
      src.connect(playCtxRef.current.destination)
      src.start(startAt)
      playHeadRef.current = startAt + audioBuf.duration
    } catch (e) {
      console.error('[studio] audio flush error', e)
    }
  }

  function resetPlayback() {
    if (flushTimerRef.current) { clearInterval(flushTimerRef.current); flushTimerRef.current = null }
    pcmQueueRef.current = []
    playHeadRef.current = 0
  }

  // ── Mic capture ─────────────────────────────────────────────────────────────

  async function startMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
      const ctx = new AudioContext({ sampleRate: 16000 })
      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(512, 1, 1)

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const float32 = e.inputBuffer.getChannelData(0)
        const pcm16 = float32ToPCM16(float32)
        const b64 = bufferToBase64(pcm16)
        wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }))
      }

      source.connect(processor)
      processor.connect(ctx.destination)

      mediaStreamRef.current = stream
      audioCtxRef.current = ctx
      processorRef.current = processor
      setMicState('on')
      setStatusText(t('tenantAgentStudio.testPanel.listening'))
    } catch {
      setError(t('tenantAgentStudio.testPanel.errorMicDenied'))
    }
  }

  function stopMic() {
    processorRef.current?.disconnect()
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    processorRef.current = null
    mediaStreamRef.current = null
    audioCtxRef.current = null
    setMicState('off')
    // Signal explicit end-of-turn — Gemini responds immediately instead of waiting for VAD silence
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'mic_stop' }))
    }
  }

  function toggleMic() {
    if (micState === 'on') {
      stopMic()
      setStatusText(t('tenantAgentStudio.testPanel.processing'))
    } else {
      startMic()
    }
  }

  // ── Session lifecycle ───────────────────────────────────────────────────────

  async function startSession() {
    setState('connecting')
    setError('')
    setStatusText(t('tenantAgentStudio.testPanel.connecting'))
    try {
      const res = await apiFetch<{ sessionToken: string; sessionId: string }>('/api/widget/draft-session', {
        method: 'POST',
        body: JSON.stringify({ voiceName, avatarId, channelType }),
      })

      const ws = new WebSocket(`${GATEWAY_URL}/ws/widget?token=${res.sessionToken}`)
      wsRef.current = ws

      ws.onerror = () => {
        setState('error')
        setError(t('tenantAgentStudio.testPanel.errorConnection'))
      }

      ws.onclose = () => {
        stopMic()
        resetPlayback()
        if (state !== 'error') {
          setState('ended')
          setStatusText(t('tenantAgentStudio.testPanel.sessionEnded'))
          onSessionEnd()
        }
      }

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as Record<string, unknown>

          if (msg.type === 'ready') {
            setState('active')
            setStatusText(t('tenantAgentStudio.testPanel.greetingThenMic'))
          }

          if (msg.type === 'audio' && typeof msg.data === 'string') {
            enqueueAudio(msg.data)
          }

          if (msg.type === 'turn_complete') {
            resetPlayback()
            setStatusText(t('tenantAgentStudio.testPanel.yourTurn'))
          }

          if (msg.type === 'error') {
            setError(String(msg.message ?? t('tenantAgentStudio.testPanel.errorSessionGeneric')))
          }

          if (msg.type === 'ended') {
            setState('ended')
            setStatusText(t('tenantAgentStudio.testPanel.sessionEnded'))
          }
        } catch { /* non-JSON */ }
      }
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : t('tenantAgentStudio.testPanel.errorStartFailed'))
    }
  }

  function endSession() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }))
    }
    stopMic()
    wsRef.current?.close()
    wsRef.current = null
    setState('ended')
    setStatusText(t('tenantAgentStudio.testPanel.sessionEnded'))
    onSessionEnd()
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-raised)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <AvatarDisplay avatarId={channelType === 'WIDGET' ? avatarId : null} size={40} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {channelType === 'WIDGET'
                ? (getAvatar(avatarId ?? '')?.label ?? t('tenantAgentStudio.testPanel.agentFallback'))
                : t('tenantAgentStudio.testPanel.voiceAgent')}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {voiceName
                ? t('tenantAgentStudio.testPanel.voiceLine', { voice: voiceName })
                : t('tenantAgentStudio.testPanel.noVoiceSelected')}
            </p>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={state === 'active'
            ? { background: 'oklch(25% 0.12 145)', color: 'oklch(75% 0.16 145)' }
            : state === 'connecting'
            ? { background: 'oklch(25% 0.10 80)', color: 'oklch(75% 0.14 80)' }
            : state === 'ended'
            ? { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
            : { background: 'var(--surface-overlay)', color: 'var(--text-tertiary)' }
          }>
          {state === 'idle'
            ? t('tenantAgentStudio.testPanel.stateReady')
            : state === 'connecting'
            ? t('tenantAgentStudio.testPanel.stateConnecting')
            : state === 'active'
            ? t('tenantAgentStudio.testPanel.stateLive')
            : state === 'ended'
            ? t('tenantAgentStudio.testPanel.stateEnded')
            : t('tenantAgentStudio.testPanel.stateError')}
        </span>
      </div>

      {/* Status bar */}
      {(state === 'active' || state === 'connecting') && (
        <div className="px-5 py-2 text-xs text-center" style={{ background: 'oklch(18% 0.06 193)', color: 'oklch(72% 0.14 193)' }}>
          {statusText}
        </div>
      )}

      {/* Audio-only indicator area */}
      <div className="px-5 py-8 flex flex-col items-center justify-center gap-3">
        {state === 'idle' && (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentStudio.testPanel.idleHint')}</p>
          </>
        )}
        {state === 'connecting' && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'oklch(65% 0.16 193)', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        {state === 'active' && micState === 'off' && (
          <div className="flex gap-1 items-end h-8">
            {[3,5,8,5,3,6,4,7,5,3].map((h, i) => (
              <div key={i} className="w-1 rounded-full" style={{ height: h * 3, background: 'oklch(55% 0.16 193)', opacity: 0.6 }} />
            ))}
          </div>
        )}
        {state === 'active' && micState === 'on' && (
          <div className="flex gap-1 items-end h-8">
            {[3,6,9,12,8,11,6,9,4,7].map((h, i) => (
              <div key={i} className="w-1 rounded-full animate-pulse" style={{ height: h * 2.5, background: 'oklch(65% 0.20 25)', animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
        )}
        {state === 'ended' && (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('tenantAgentStudio.testPanel.sessionEnded')}</p>
        )}
      </div>

      {/* Controls */}
      <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {error && <p className="text-xs flex-1" style={{ color: 'oklch(65% 0.20 25)' }}>{error}</p>}
        {!error && <div className="flex-1" />}

        {/* Idle / ended / error → Start button */}
        {(state === 'idle' || state === 'ended' || state === 'error') && (
          <button
            onClick={startSession}
            disabled={!voiceName}
            className="btn-primary text-sm flex items-center gap-2"
            style={!voiceName ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l9 5-9 5V3z"/></svg>
            {state === 'ended' ? t('tenantAgentStudio.actions.testAgain') : t('tenantAgentStudio.actions.startTest')}
          </button>
        )}

        {/* Connecting spinner */}
        {state === 'connecting' && (
          <button disabled className="btn-secondary text-sm opacity-50">{t('tenantAgentStudio.actions.connecting')}</button>
        )}

        {/* Active → Mic toggle + End */}
        {state === 'active' && (
          <>
            <button
              onClick={toggleMic}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={micState === 'on'
                ? { background: 'oklch(40% 0.20 25)', color: 'white', border: '1.5px solid oklch(55% 0.20 25)' }
                : { background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.10 193)', border: '1.5px solid oklch(45% 0.14 193)' }
              }
            >
              {micState === 'on' ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  {t('tenantAgentStudio.actions.stopMic')}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  </svg>
                  {t('tenantAgentStudio.actions.speak')}
                </>
              )}
            </button>
            <button onClick={endSession} className="text-sm px-4 py-2 rounded-lg"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              {t('tenantAgentStudio.actions.end')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Widget tab ────────────────────────────────────────────────────────────────

function WidgetTab({ channel, onSaved }: { channel: ChannelConfig | undefined; onSaved: () => void }) {
  const t = useT()
  const savedVoice = (channel?.configJson?.['voiceName'] as string | undefined) ?? null
  const savedAvatar = (channel?.configJson?.['avatarId'] as string | undefined) ?? null

  const [selectedVoice, setSelectedVoice] = useState<string | null>(savedVoice)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(savedAvatar ?? 'f1')
  const [avatarGenderFilter, setAvatarGenderFilter] = useState<'female' | 'male'>('female')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [, setSessionEnded] = useState(false)

  const hasChanges = selectedVoice !== savedVoice || selectedAvatar !== savedAvatar

  async function save() {
    setSaving(true)
    try {
      const existing = channel?.configJson ?? {}
      await apiFetch('/api/channels/WIDGET', {
        method: 'PATCH',
        body: JSON.stringify({ configJson: { ...existing, voiceName: selectedVoice, avatarId: selectedAvatar } }),
      })
      setToast(t('tenantAgentStudio.widget.savedToast'))
      setTimeout(() => setToast(''), 3500)
      onSaved()
    } catch (err) {
      setToast(err instanceof Error ? err.message : t('tenantAgentStudio.errors.saveFailed'))
    } finally { setSaving(false) }
  }

  const filteredAvatars = avatarGenderFilter === 'female' ? FEMALE_AVATARS : MALE_AVATARS

  return (
    <div className="space-y-6">
      {toast && <div className="alert-success">{toast}</div>}

      {/* Avatar picker */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentStudio.widget.avatarTitle')}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentStudio.widget.avatarDesc')}</p>
          </div>
          {/* Gender filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {(['female', 'male'] as const).map(g => (
              <button key={g} onClick={() => setAvatarGenderFilter(g)}
                className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
                style={avatarGenderFilter === g
                  ? { background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.10 193)' }
                  : { background: 'var(--surface-overlay)', color: 'var(--text-secondary)' }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {filteredAvatars.map(avatar => {
            const Comp = avatar.component
            return (
              <button key={avatar.id} onClick={() => setSelectedAvatar(avatar.id)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
                style={{
                  background: selectedAvatar === avatar.id ? 'oklch(22% 0.08 193)' : 'var(--surface-overlay)',
                  border: `1.5px solid ${selectedAvatar === avatar.id ? 'oklch(55% 0.16 193)' : 'transparent'}`,
                }}>
                <Comp size={52} selected={selectedAvatar === avatar.id} />
                <span className="text-xs" style={{ color: selectedAvatar === avatar.id ? 'oklch(80% 0.14 193)' : 'var(--text-tertiary)' }}>
                  {avatar.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Voice picker */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentStudio.widget.voiceTitle')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('tenantAgentStudio.widget.voiceDesc')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {VOICES.map(v => (
            <VoiceCard key={v.id} voice={v} selected={selectedVoice === v.id} onClick={() => setSelectedVoice(v.id)} />
          ))}
        </div>
      </div>

      {/* Live test */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentStudio.widget.livePreview')}</p>
        <LiveTestPanel
          channelType="WIDGET"
          voiceName={selectedVoice}
          avatarId={selectedAvatar}
          onSessionEnd={() => setSessionEnded(true)}
        />
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {hasChanges ? 'You have unsaved changes' : savedVoice ? `Active: ${savedVoice}` : 'Not yet configured'}
        </p>
        <button
          onClick={save}
          disabled={saving || !selectedVoice || !selectedAvatar}
          className="btn-primary text-sm"
          style={(!selectedVoice || !selectedAvatar) ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          {saving ? 'Saving…' : 'Save widget config'}
        </button>
      </div>
    </div>
  )
}

// ── Voice-only tab (Inbound / Outbound) ───────────────────────────────────────

function VoiceOnlyTab({ channelType, channel, onSaved }: { channelType: string; channel: ChannelConfig | undefined; onSaved: () => void }) {
  const t = useT()
  const savedVoice = (channel?.configJson?.['voiceName'] as string | undefined) ?? null
  const [selectedVoice, setSelectedVoice] = useState<string | null>(savedVoice)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  async function save() {
    setSaving(true)
    try {
      const existing = channel?.configJson ?? {}
      await apiFetch(`/api/channels/${channelType}`, {
        method: 'PATCH',
        body: JSON.stringify({ configJson: { ...existing, voiceName: selectedVoice } }),
      })
      setToast('Voice saved')
      setTimeout(() => setToast(''), 3500)
      onSaved()
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const label = channelType === 'INBOUND' ? 'Inbound Receptionist' : 'Outbound Caller'

  return (
    <div className="space-y-6">
      {toast && <div className="alert-success">{toast}</div>}

      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label} Voice</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Select the voice your {label.toLowerCase()} speaks with on calls
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {VOICES.map(v => (
            <VoiceCard key={v.id} voice={v} selected={selectedVoice === v.id} onClick={() => setSelectedVoice(v.id)} />
          ))}
        </div>
      </div>

      {/* Live test */}
      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentStudio.voiceOnly.liveTest')}</p>
        <LiveTestPanel
          channelType={channelType}
          voiceName={selectedVoice}
          avatarId={null}
          onSessionEnd={() => {}}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {savedVoice ? `Current: ${savedVoice}` : 'No voice selected yet'}
        </p>
        <button
          onClick={save}
          disabled={saving || !selectedVoice}
          className="btn-primary text-sm"
          style={!selectedVoice ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
        >
          {saving ? 'Saving…' : 'Save voice'}
        </button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AgentStudioPage() {
  const t = useT()
  const { data: channels, loading, reload } = useApi<ChannelConfig[]>('/api/channels')
  const [activeTab, setActiveTab] = useState<'WIDGET' | 'INBOUND' | 'OUTBOUND'>('WIDGET')

  const getChannel = (type: string) => channels?.find(c => c.channelType === type)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{t('tenantAgentStudio.title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('tenantAgentStudio.subtitle')}
        </p>
      </div>

      {/* Channel tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
        {CHANNEL_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { background: 'oklch(28% 0.10 193)', color: 'oklch(88% 0.10 193)' }
              : { color: 'var(--text-secondary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-48 rounded-xl" style={{ background: 'var(--surface-raised)' }} />
          <div className="h-32 rounded-xl" style={{ background: 'var(--surface-raised)' }} />
        </div>
      ) : (
        <>
          {activeTab === 'WIDGET' && (
            <WidgetTab channel={getChannel('WIDGET')} onSaved={reload} />
          )}
          {activeTab === 'INBOUND' && (
            <VoiceOnlyTab channelType="INBOUND" channel={getChannel('INBOUND')} onSaved={reload} />
          )}
          {activeTab === 'OUTBOUND' && (
            <VoiceOnlyTab channelType="OUTBOUND" channel={getChannel('OUTBOUND')} onSaved={reload} />
          )}
        </>
      )}
    </div>
  )
}
