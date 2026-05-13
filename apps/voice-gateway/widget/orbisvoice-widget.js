;(function (global) {
  'use strict'

  const API_BASE  = 'https://api.myorbisvoice.com'
  const GW_BASE   = 'wss://gateway.myorbisvoice.com'
  const STYLES_ID = 'ov-widget-styles'

  // Auto-close the panel + end the session after this many ms of conversational
  // silence (no agent audio chunks AND no user transcript deltas). Walked-away
  // visitors stop holding a Gemini Live session open indefinitely. Tick interval
  // is the cadence we re-check; tighter = faster reaction, looser = lower CPU.
  const IDLE_TIMEOUT_MS  = 30_000
  const IDLE_TICK_MS     = 5_000

  // Standard DTMF (Dual-Tone Multi-Frequency) — what your phone keypad
  // actually generates when you press a digit. Used by _playDialIntro to
  // simulate dialing a phone number before the WebSocket session begins.
  // Frequencies in Hz: [low, high] per ITU-T Recommendation Q.23.
  const DTMF_FREQS = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '0': [941, 1336],
  }

  // ─── Inject CSS ──────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return
    const s = document.createElement('style')
    s.id = STYLES_ID
    s.textContent = `
      #ov-widget-btn {
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        width: 60px; height: 60px; border-radius: 50%;
        background: #1a9898; border: none; cursor: pointer;
        box-shadow: 0 4px 20px rgba(26,152,152,.5);
        display: flex; align-items: center; justify-content: center;
        transition: transform .15s, box-shadow .15s;
      }
      #ov-widget-btn:hover { transform: scale(1.07); box-shadow: 0 6px 28px rgba(26,152,152,.6); }
      #ov-widget-btn svg { width: 26px; height: 26px; }

      #ov-widget-panel {
        position: fixed; bottom: 96px; right: 24px; z-index: 9999;
        width: 340px; background: #0e1c1c;
        border: 1px solid rgba(26,152,152,.2); border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0,0,0,.6);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        display: none; flex-direction: column; overflow: hidden;
      }
      #ov-widget-panel.ov-open { display: flex; }

      .ov-header {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 16px; background: #061818;
        border-bottom: 1px solid rgba(26,152,152,.15);
      }
      .ov-header-icon {
        width: 34px; height: 34px; border-radius: 10px;
        background: #1a9898; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .ov-header-icon svg { width: 18px; height: 18px; }
      .ov-header-text { flex: 1; }
      .ov-header-title { font-size: .9rem; font-weight: 700; color: #e8fafa; }
      .ov-header-sub { font-size: .75rem; color: #3d9898; margin-top: 1px; }
      .ov-close-btn {
        background: none; border: none; cursor: pointer;
        color: #3d9898; padding: 4px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        transition: color .12s;
      }
      .ov-close-btn:hover { color: #e8fafa; }

      .ov-body { padding: 20px 16px; flex: 1; }
      .ov-status { font-size: .82rem; color: #7aaaa8; text-align: center; margin-bottom: 16px; min-height: 18px; }

      .ov-controls { display: flex; }
      .ov-end-btn {
        flex: 1; padding: 12px 14px; border-radius: 10px;
        background: #c0392b; border: none;
        color: #fff; font-size: .9rem; font-weight: 700; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        transition: background .12s;
      }
      .ov-end-btn:hover { background: #e74c3c; }
      .ov-end-btn:disabled { opacity: .4; cursor: not-allowed; }
      /* Hang-up icon styling — receiver flipped 135° for the universal "end call" look */
      .ov-end-btn svg { width: 16px; height: 16px; transform: rotate(135deg); }

      .ov-rec-notice {
        font-size: .7rem; color: #3d6666; text-align: center;
        padding: 8px 16px 0; line-height: 1.3;
      }
      .ov-rec-notice::before {
        content: "●"; color: #c0392b; margin-right: 6px; font-size: .9rem;
        animation: ov-pulse 1.8s ease-in-out infinite;
      }

      .ov-footer {
        padding: 10px 16px; border-top: 1px solid rgba(26,152,152,.1);
        font-size: .72rem; color: #3d6666; text-align: center;
      }
      .ov-footer a { color: #1a9898; text-decoration: none; }

      @keyframes ov-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      .ov-pulsing { animation: ov-pulse 1.2s ease-in-out infinite; }

      @media (max-width: 480px) {
        #ov-widget-btn { bottom: 16px; right: 16px; width: 56px; height: 56px; }
        #ov-widget-btn svg { width: 24px; height: 24px; }
        #ov-widget-panel {
          bottom: 84px; right: 12px; left: 12px;
          width: auto; max-width: none;
          max-height: calc(100vh - 100px);
        }
        .ov-header { padding: 12px 14px; }
        .ov-body { padding: 16px 14px; }
        .ov-end-btn { padding: 16px 14px; font-size: 1rem; }
      }

      @media (max-width: 480px) and (orientation: landscape) {
        #ov-widget-panel { max-height: calc(100vh - 72px); bottom: 72px; }
      }
    `
    document.head.appendChild(s)
  }

  // ─── Widget class ─────────────────────────────────────────────────────────────
  class OrbisVoiceWidget {
    constructor(config) {
      this.publicKey    = config.publicKey
      this.partnerSlug  = config.partnerSlug || null  // optional — set when loaded on /p/<slug>/ pages
      this.businessName = config.businessName || 'AI Assistant'
      this.ws           = null
      this.connecting   = false  // covers the dial-intro window before ws exists, so X/Stop and a second click are both safe
      this.geminiReady  = false
      this.recording    = false
      this.mediaStream  = null
      this.audioCtx     = null
      this.processor    = null

      // Audio playback — chunks are batched every 60 ms then scheduled end-to-end
      this._playCtx   = null
      this._playHead  = 0
      this._pcmQueue  = []    // Uint8Array chunks waiting to be flushed
      this._flushTimer = null

      // Dial-intro state — held so X/Stop during the intro stops the oscillators immediately
      this._dialCtx     = null
      this._dialAborted = false

      // Idle-timeout state — last time we observed agent audio or user speech.
      // The check timer is armed on session 'ready' and disarmed in _endNow.
      this._lastActivityAt = 0
      this._idleTimer      = null

      // Recording capture — accumulate both halves of the conversation in the
      // browser, time-stamped, then mux to a stereo WAV at session end and
      // upload to the API which hands off to Bunny CDN. Visitor mic is 16k
      // PCM mono (already converted in _startRecording); agent audio is 24k
      // PCM mono (already decoded in _playAudio). We upsample visitor to 24k
      // at mux time so both channels share one rate.
      this._recVisitor    = []   // [{ at: ms-since-start, pcm: Int16Array }]
      this._recAgent      = []   // [{ at: ms-since-start, pcm: Int16Array }]
      this._recStartedAt  = 0    // performance.now() epoch
      this._recUploading  = false

      injectStyles()
      this._buildDOM()
      this._bindEvents()
    }

    _buildDOM() {
      // Floating button — phone handset (Lucide-style). On click the widget
      // plays a short dial-tone + ring intro to mimic placing a real phone
      // call, then connects to the voice agent.
      this.btn = document.createElement('button')
      this.btn.id = 'ov-widget-btn'
      this.btn.setAttribute('aria-label', 'Call voice assistant')
      this.btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#061818" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>`
      document.body.appendChild(this.btn)

      // Panel
      this.panel = document.createElement('div')
      this.panel.id = 'ov-widget-panel'
      this.panel.innerHTML = `
        <div class="ov-header">
          <div class="ov-header-icon">
            <svg viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="3.5" fill="#061818"/>
              <circle cx="9" cy="9" r="7.5" stroke="#061818" stroke-opacity=".45" stroke-width="2"/>
            </svg>
          </div>
          <div class="ov-header-text">
            <div class="ov-header-title">${this.businessName}</div>
            <div class="ov-header-sub">AI Voice Assistant</div>
          </div>
          <button class="ov-close-btn" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="ov-body">
          <div class="ov-status" id="ov-status">Connecting…</div>
          <div class="ov-controls">
            <!-- Single control: End call (hang-up). The mic auto-starts on
                 session-ready, so there's no Speak button to click — same
                 mental model as a phone call. -->
            <button class="ov-end-btn" id="ov-end-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              End call
            </button>
          </div>
        </div>
        <div class="ov-rec-notice">Calls are recorded for quality.</div>
        <div class="ov-footer">Powered by <a href="https://myorbisvoice.com" target="_blank">MyOrbisVoice</a></div>
      `
      document.body.appendChild(this.panel)

      this.statusEl = document.getElementById('ov-status')
      this.endBtn   = document.getElementById('ov-end-btn')
    }

    _bindEvents() {
      this.btn.addEventListener('click', () => this._open())
      // X (close button in header) — disconnect Orby IMMEDIATELY and close the panel.
      this.panel.querySelector('.ov-close-btn').addEventListener('click', () => {
        this._endNow()
        this._close()
      })
      // End call — the only in-panel control. Disconnects Orby immediately,
      // then auto-closes the panel via the 'ended' message handler.
      this.endBtn.addEventListener('click', () => this._endNow())
    }

    async _open() {
      this.panel.classList.add('ov-open')
      // Guard against a second click during the ~6 s dial intro (before this.ws exists).
      if (this.ws || this.connecting) return
      this.connecting = true
      this._dialAborted = false
      // Fresh session — reset any state left over from a prior ended call.
      this.endBtn.disabled = false
      // Play a short dial-tone + ring intro to mimic placing a real phone call,
      // then connect. Browsers require a user gesture to start AudioContext,
      // which this click satisfies.
      try {
        await this._playDialIntro()
      } catch (e) {
        console.warn('[OrbisVoice] dial intro skipped:', e)
      }
      // If the user clicked X/Stop during the intro, _endNow() already ran and
      // cleared this.connecting — don't open a doomed WS in that case.
      if (this._dialAborted) {
        this.connecting = false
        return
      }
      this._connect()
    }

    _close() {
      this.panel.classList.remove('ov-open')
    }

    /** Disconnect Orby immediately — used by the End-call button and the X.
     *  Closes the WS without waiting for the server roundtrip; the gateway
     *  interprets ws.close as session-end and runs finalize (transcript +
     *  summary + persist). */
    _endNow() {
      // Abort an in-progress dial intro: setting the flag exits the loop,
      // closing the dial ctx immediately kills any sounding oscillators.
      this._dialAborted = true
      if (this._dialCtx) {
        try { this._dialCtx.close() } catch {}
        this._dialCtx = null
      }
      if (this.recording) this._stopRecording()
      // Hard stop: close the playback AudioContext so already-scheduled
      // AudioBufferSourceNodes (Orby's in-flight sentence) stop immediately.
      this._stopPlaybackHard()
      this._disarmIdleTimer()
      if (this.ws) {
        try { this.ws.send(JSON.stringify({ type: 'end' })) } catch {}
        try { this.ws.close() } catch {}
        this.ws = null
      }
      this.connecting = false
      this.geminiReady = false
      this.endBtn.disabled = true
      this._setStatus('Session ended.')
    }

    // ─── Idle auto-close ──────────────────────────────────────────────────
    // Once the session is 'ready', we mark activity whenever Orby speaks
    // (agent audio chunk arrives) OR the visitor speaks (user transcript
    // delta arrives — Gemini sends one whenever it detects speech, much
    // more reliable than counting raw mic frames). If neither happens for
    // IDLE_TIMEOUT_MS, we end the call + close the panel back to the icon.

    _armIdleTimer() {
      this._lastActivityAt = Date.now()
      if (this._idleTimer) return
      this._idleTimer = setInterval(() => {
        if (!this._lastActivityAt) return
        if (Date.now() - this._lastActivityAt < IDLE_TIMEOUT_MS) return
        // Idle threshold crossed — close the session gracefully. Show a brief
        // explanation on the status line so a visitor who happens to be
        // looking knows why the panel collapsed.
        this._setStatus('Closed (no activity).')
        this._endNow()
        setTimeout(() => this._close(), 1500)
      }, IDLE_TICK_MS)
    }

    _disarmIdleTimer() {
      if (this._idleTimer) {
        clearInterval(this._idleTimer)
        this._idleTimer = null
      }
      this._lastActivityAt = 0
    }

    _markActivity() {
      this._lastActivityAt = Date.now()
    }

    async _connect() {
      this._setStatus('Connecting…', true)
      try {
        const sessionBody = { publicKey: this.publicKey }
        if (this.partnerSlug) sessionBody.partnerSlug = this.partnerSlug
        const res = await fetch(`${API_BASE}/api/public/widget/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionBody),
        })
        if (!res.ok) throw new Error('Failed to start session')
        const { data } = await res.json()
        // Keep the session token around for the recording upload — same token
        // the WS just authenticated with, used by the API to verify the
        // visitor actually owned this conversation.
        this._sessionToken = data.sessionToken

        this.ws = new WebSocket(`${GW_BASE}/ws/widget?token=${data.sessionToken}`)
        this.ws.addEventListener('message', (e) => this._onMessage(JSON.parse(e.data)))
        this.ws.addEventListener('close',   () => this._onDisconnect())
        this.ws.addEventListener('error',   () => this._setStatus('Connection error.'))
        this.connecting = false
      } catch (err) {
        this.connecting = false
        this._setStatus('Could not connect. Please try again.')
        console.error('[OrbisVoice]', err)
      }
    }

    _onMessage(msg) {
      if (msg.type === 'ready') {
        this.geminiReady = true
        this._setStatus('Listening…', true)
        // Auto-start the microphone the moment the session is ready. The agent
        // is already primed by the gateway to speak first (see session.ts onReady),
        // so the visitor hears Orby greet them and can reply immediately —
        // identical mental model to a phone call (no "Speak" button to click).
        this._startRecording().catch(() => { /* permission error handled inside */ })
        this._armIdleTimer()
        // Anchor the recording timeline to the moment the session is live.
        // Capture-side timestamps (visitor frames + agent chunks) are stored
        // as ms-since-this-mark so the WAV mux can place them in a single
        // timeline. Cleared in _resetRecording at the end of the call.
        this._recStartedAt = performance.now()
        this._recVisitor   = []
        this._recAgent     = []
      }

      if (msg.type === 'audio') {
        this._markActivity()
        this._playAudio(msg.data)
      }

      // transcript messages — UI ignores the text, but a user-role transcript
      // delta is the cleanest signal that the visitor is actively speaking.
      // (We can't use raw mic audio frames because the browser sends them every
      // 256 ms regardless of whether the visitor is silent or making sound —
      // they would block the idle-timer from ever firing.)
      if (msg.type === 'transcript' && msg.role === 'user') {
        this._markActivity()
      }

      if (msg.type === 'turn_complete') {
        this._resetPlayback()
        // No status change — we stay in "Listening…" so the visitor can speak again.
      }

      if (msg.type === 'ended') {
        if (this.recording) this._stopRecording()
        this._stopPlaybackHard()
        this._disarmIdleTimer()
        if (this.ws) { try { this.ws.close() } catch {} this.ws = null }
        this.connecting = false
        // Upload the call recording before showing the "Thank you" screen,
        // so the visitor sees a "Saving recording…" status while the WAV is
        // on the wire. msg.conversationId is set by the gateway only after
        // persistConversation finishes, so we know the FK target exists.
        const finishUp = () => {
          this._setStatus('Session ended. Thank you!')
          setTimeout(() => this._close(), 2500)
        }
        if (msg.conversationId) {
          this._uploadRecording(msg.conversationId).finally(finishUp)
        } else {
          finishUp()
        }
      }

      if (msg.type === 'error') {
        this._setStatus(msg.message)
      }
    }

    _onDisconnect() {
      if (this.recording) this._stopRecording()
      this._stopPlaybackHard()
      this._disarmIdleTimer()
      this._setStatus('Disconnected.')
      this.ws = null
      this.connecting = false
    }

    async _startRecording() {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
        this.audioCtx    = new AudioContext({ sampleRate: 16000 })
        const source     = this.audioCtx.createMediaStreamSource(this.mediaStream)
        this.processor   = this.audioCtx.createScriptProcessor(4096, 1, 1)

        this.processor.onaudioprocess = (e) => {
          if (!this.ws || !this.recording) return
          const float32 = e.inputBuffer.getChannelData(0)
          const pcm16   = this._float32ToPCM16(float32)
          const b64     = this._bufferToBase64(pcm16)
          this.ws.send(JSON.stringify({ type: 'audio', data: b64 }))
          // Stash a typed view of the same PCM for the call recording. We
          // store Int16Array (not the raw ArrayBuffer) so the mux step can
          // index without re-wrapping.
          if (this._recStartedAt) {
            this._recVisitor.push({
              at:  performance.now() - this._recStartedAt,
              pcm: new Int16Array(pcm16),
            })
          }
        }

        source.connect(this.processor)
        this.processor.connect(this.audioCtx.destination)
        this.recording = true
        this._setStatus('Listening…', true)
      } catch {
        this._setStatus('Microphone access denied.')
      }
    }

    _stopRecording() {
      this.recording = false
      this.processor?.disconnect()
      this.mediaStream?.getTracks().forEach(t => t.stop())
      this.audioCtx?.close()
      this.processor = this.mediaStream = this.audioCtx = null
      // No UI label change — the End-call button is always visible and the
      // status text ("Session ended." / "Disconnected." / etc.) carries the
      // mic-stopped signal on its own.
    }

    // ─── Dial-tone + ring intro (mimics placing a phone call) ──────────────
    //
    // Plays 10 random DTMF digit tones (~120 ms each, 80 ms gap) followed by
    // 2 US-style ring cadences (440 Hz + 480 Hz, ~1.5 s on / 700 ms off).
    // Total ~6 seconds of "I'm calling someone" theater before the live
    // WebSocket session begins, so the visitor's mental model matches what's
    // actually happening: it's a phone call to the agent.

    async _playDialIntro() {
      // Open the AudioContext on the click that triggered this — required for
      // unmuted playback in all modern browsers.
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      this._dialCtx = ctx
      if (ctx.state === 'suspended') { try { await ctx.resume() } catch {} }

      this._setStatus('Dialing…', true)
      for (let i = 0; i < 10; i++) {
        if (this._dialAborted) return
        const digit = Math.floor(Math.random() * 10).toString()
        await this._playDualTone(ctx, DTMF_FREQS[digit][0], DTMF_FREQS[digit][1], 0.12, 0.18)
        if (this._dialAborted) return
        await this._silence(80)
      }

      if (this._dialAborted) return
      await this._silence(300)
      this._setStatus('Ringing…', true)
      for (let i = 0; i < 2; i++) {
        if (this._dialAborted) return
        await this._playDualTone(ctx, 440, 480, 1.5, 0.22)
        if (i < 1) await this._silence(700)
      }

      try { ctx.close() } catch {}
      this._dialCtx = null
      this._setStatus('Connecting…', true)
    }

    /** Play two sine-wave frequencies simultaneously (DTMF or ring). Returns
     *  a promise that resolves when the tone is done. Short attack + release
     *  envelopes avoid the audible click of a hard-edged start/stop. */
    _playDualTone(ctx, freq1, freq2, durationSec, gain) {
      return new Promise((resolve) => {
        const now = ctx.currentTime
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const g = ctx.createGain()
        osc1.type = osc2.type = 'sine'
        osc1.frequency.value = freq1
        osc2.frequency.value = freq2
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(gain, now + 0.005)
        g.gain.setValueAtTime(gain, now + durationSec - 0.005)
        g.gain.linearRampToValueAtTime(0, now + durationSec)
        osc1.connect(g); osc2.connect(g); g.connect(ctx.destination)
        osc1.start(now); osc2.start(now)
        osc1.stop(now + durationSec); osc2.stop(now + durationSec)
        setTimeout(resolve, durationSec * 1000)
      })
    }

    _silence(ms) {
      return new Promise((r) => setTimeout(r, ms))
    }

    _playAudio(base64) {
      // Decode incoming base64 PCM16 bytes and queue them
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      this._pcmQueue.push(bytes)

      // Stash an Int16 view of the same chunk in the call-recording buffer.
      // Agent stream is 24kHz mono PCM — used as-is in the WAV mux.
      if (this._recStartedAt) {
        const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
        this._recAgent.push({
          at:  performance.now() - this._recStartedAt,
          pcm: new Int16Array(samples),  // copy so the playback path can mutate freely
        })
      }

      // Start the flush timer if it isn't running
      if (!this._flushTimer) {
        this._flushTimer = setInterval(() => this._flushAudio(), 60)
      }
    }

    _flushAudio() {
      if (this._pcmQueue.length === 0) return

      try {
        const SR = 24000
        if (!this._playCtx || this._playCtx.state === 'closed') {
          this._playCtx  = new AudioContext({ sampleRate: SR })
          this._playHead = 0
        }
        if (this._playCtx.state === 'suspended') this._playCtx.resume()

        // Concatenate all queued chunks into one buffer
        const totalBytes = this._pcmQueue.reduce((s, b) => s + b.length, 0)
        const combined   = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of this._pcmQueue) { combined.set(chunk, offset); offset += chunk.length }
        this._pcmQueue = []

        // Build AudioBuffer from raw PCM16 LE mono
        const numSamples = combined.length / 2
        const audioBuf   = this._playCtx.createBuffer(1, numSamples, SR)
        const channel    = audioBuf.getChannelData(0)
        const view       = new DataView(combined.buffer)
        for (let i = 0; i < numSamples; i++) {
          channel[i] = view.getInt16(i * 2, true) / 32768
        }

        // Schedule immediately after the last block, with a small lookahead to avoid underruns
        const startAt = Math.max(this._playCtx.currentTime + 0.04, this._playHead)
        const src     = this._playCtx.createBufferSource()
        src.buffer    = audioBuf
        src.connect(this._playCtx.destination)
        src.start(startAt)
        this._playHead = startAt + audioBuf.duration
      } catch (e) {
        console.error('[OrbisVoice] audio flush error', e)
      }
    }

    _resetPlayback() {
      clearInterval(this._flushTimer)
      this._flushTimer = null
      this._pcmQueue   = []
      this._playHead   = 0
    }

    /** Hard stop for end-of-call: closes the playback AudioContext so
     *  AudioBufferSourceNodes already scheduled into the future stop firing.
     *  Clearing _pcmQueue alone (the soft _resetPlayback) does NOT stop audio
     *  that has already been .start()'d — only context.close() does. */
    _stopPlaybackHard() {
      this._resetPlayback()
      if (this._playCtx) {
        try { this._playCtx.close() } catch {}
        this._playCtx = null
      }
    }

    _setStatus(text, pulsing = false) {
      this.statusEl.textContent = text
      this.statusEl.classList.toggle('ov-pulsing', pulsing)
    }

    // ─── Call recording mux + upload ──────────────────────────────────────
    //
    // Builds a stereo 24kHz WAV from the two captured streams. Left channel
    // is the visitor (upsampled from 16kHz by linear interpolation); right
    // channel is the agent (native 24kHz). Both chunks are time-placed using
    // their performance.now() offsets so a 3-second pause in the conversation
    // appears as 3 seconds of silence in the recording, not a jump-cut.
    //
    // Output: a Blob('audio/wav') ready for POST to the upload endpoint.

    _buildRecordingBlob() {
      const RATE = 24000  // shared output sample rate
      const v = this._recVisitor
      const a = this._recAgent
      if (v.length === 0 && a.length === 0) return null

      // Total duration in ms — last chunk's `at` plus its own duration.
      const lastVisitorEnd = v.length === 0 ? 0
        : v[v.length - 1].at + (v[v.length - 1].pcm.length / 16000) * 1000
      const lastAgentEnd   = a.length === 0 ? 0
        : a[a.length - 1].at + (a[a.length - 1].pcm.length / 24000) * 1000
      const totalMs = Math.max(lastVisitorEnd, lastAgentEnd)
      if (totalMs <= 0) return null

      const totalSamples = Math.ceil((totalMs / 1000) * RATE)
      const left  = new Int16Array(totalSamples)
      const right = new Int16Array(totalSamples)

      // Place visitor chunks (16k → 24k linear upsample). Ratio is 1.5x so
      // every 2 visitor samples produce 3 output samples — fine for voice
      // intelligibility, far cheaper than a polyphase resampler.
      for (const chunk of v) {
        const startSample = Math.floor((chunk.at / 1000) * RATE)
        const src         = chunk.pcm
        const outLen      = Math.floor(src.length * (RATE / 16000))
        for (let i = 0; i < outLen; i++) {
          const srcPos = i * (16000 / RATE)
          const lo     = Math.floor(srcPos)
          const hi     = Math.min(lo + 1, src.length - 1)
          const frac   = srcPos - lo
          const sample = src[lo] * (1 - frac) + src[hi] * frac
          const idx    = startSample + i
          if (idx < totalSamples) left[idx] = sample | 0
        }
      }

      // Place agent chunks (native 24k).
      for (const chunk of a) {
        const startSample = Math.floor((chunk.at / 1000) * RATE)
        const src         = chunk.pcm
        for (let i = 0; i < src.length; i++) {
          const idx = startSample + i
          if (idx < totalSamples) right[idx] = src[i]
        }
      }

      return this._encodeWavStereo(left, right, RATE)
    }

    /** Encode two Int16Array channels as a 16-bit PCM stereo WAV blob. */
    _encodeWavStereo(left, right, sampleRate) {
      const frames    = left.length  // assumed equal to right.length
      const dataBytes = frames * 2 /* ch */ * 2 /* bytes/sample */
      const buf       = new ArrayBuffer(44 + dataBytes)
      const dv        = new DataView(buf)
      let p = 0
      function writeStr(s) { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)) }
      function writeU32(n) { dv.setUint32(p, n, true); p += 4 }
      function writeU16(n) { dv.setUint16(p, n, true); p += 2 }
      // RIFF header
      writeStr('RIFF'); writeU32(36 + dataBytes); writeStr('WAVE')
      // fmt chunk
      writeStr('fmt '); writeU32(16)
      writeU16(1)                       // PCM
      writeU16(2)                       // channels
      writeU32(sampleRate)
      writeU32(sampleRate * 2 * 2)      // byte rate
      writeU16(4)                       // block align (channels * bytes/sample)
      writeU16(16)                      // bits per sample
      // data chunk
      writeStr('data'); writeU32(dataBytes)
      for (let i = 0; i < frames; i++) {
        dv.setInt16(p, left[i],  true); p += 2
        dv.setInt16(p, right[i], true); p += 2
      }
      return new Blob([buf], { type: 'audio/wav' })
    }

    /** Best-effort upload. Sets recUploading + a "Saving recording…" status
     *  while in flight. Non-fatal: if the upload fails (network blip, browser
     *  closing) the call still ends normally; the recording is just lost. */
    async _uploadRecording(conversationId) {
      if (this._recUploading) return
      if (!conversationId) return
      const blob = this._buildRecordingBlob()
      if (!blob || blob.size < 100) return  // nothing useful captured

      this._recUploading = true
      this._setStatus('Saving recording…', true)
      try {
        const form = new FormData()
        form.append('conversationId', conversationId)
        form.append('sessionToken',   this._sessionToken ?? '')
        form.append('audio', blob, `widget-${conversationId}.wav`)
        const res = await fetch(`${API_BASE}/api/public/widget/upload-recording`, {
          method: 'POST',
          body:   form,
        })
        if (!res.ok) {
          console.warn('[OrbisVoice] recording upload non-OK:', res.status)
        }
      } catch (err) {
        console.warn('[OrbisVoice] recording upload failed:', err)
      } finally {
        this._recUploading = false
        this._recVisitor   = []
        this._recAgent     = []
        this._recStartedAt = 0
      }
    }

    _float32ToPCM16(float32) {
      const buf = new ArrayBuffer(float32.length * 2)
      const view = new DataView(buf)
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]))
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      }
      return buf
    }

    _bufferToBase64(buffer) {
      const bytes = new Uint8Array(buffer)
      let binary  = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary)
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  // Singleton — one widget per page. If the script loads twice (CMS double-include,
  // SPA route change re-running init, etc.) the second call returns the existing
  // instance instead of spawning a parallel widget that could talk over the first.
  let _instance = null
  global.OrbisVoice = {
    init(config) {
      if (!config?.publicKey) {
        console.error('[OrbisVoice] publicKey is required')
        return
      }
      if (_instance) return _instance
      _instance = new OrbisVoiceWidget(config)
      return _instance
    },
  }
})(window)
