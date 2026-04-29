;(function (global) {
  'use strict'

  const API_BASE  = 'https://api.myorbisvoice.com'
  const GW_BASE   = 'wss://gateway.myorbisvoice.com'
  const STYLES_ID = 'ov-widget-styles'

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

      .ov-transcript {
        max-height: 180px; overflow-y: auto;
        display: flex; flex-direction: column; gap: 8px;
        margin-bottom: 16px;
      }
      .ov-bubble {
        padding: 8px 12px; border-radius: 10px; font-size: .82rem; line-height: 1.4; max-width: 85%;
      }
      .ov-bubble.user { background: rgba(26,152,152,.15); color: #e8fafa; align-self: flex-end; border-radius: 10px 10px 3px 10px; }
      .ov-bubble.assistant { background: #0b1515; color: #c8eeee; align-self: flex-start; border: 1px solid rgba(26,152,152,.15); border-radius: 10px 10px 10px 3px; }

      .ov-controls { display: flex; gap: 8px; }
      .ov-mic-btn {
        flex: 1; padding: 10px; border-radius: 10px;
        background: #1a9898; border: none; cursor: pointer;
        color: #061818; font-size: .85rem; font-weight: 700;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        transition: background .12s;
      }
      .ov-mic-btn:hover { background: #2aabab; }
      .ov-mic-btn:disabled { opacity: .4; cursor: not-allowed; }
      .ov-mic-btn.recording { background: #c0392b; color: #fff; }
      .ov-mic-btn.recording:hover { background: #e74c3c; }
      .ov-end-btn {
        padding: 10px 14px; border-radius: 10px;
        background: transparent; border: 1px solid rgba(26,152,152,.3);
        color: #7aaaa8; font-size: .82rem; cursor: pointer;
        transition: background .12s, color .12s;
      }
      .ov-end-btn:hover { background: rgba(26,152,152,.1); color: #e8fafa; }

      .ov-footer {
        padding: 10px 16px; border-top: 1px solid rgba(26,152,152,.1);
        font-size: .72rem; color: #3d6666; text-align: center;
      }
      .ov-footer a { color: #1a9898; text-decoration: none; }

      @keyframes ov-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      .ov-pulsing { animation: ov-pulse 1.2s ease-in-out infinite; }
    `
    document.head.appendChild(s)
  }

  // ─── Widget class ─────────────────────────────────────────────────────────────
  class OrbisVoiceWidget {
    constructor(config) {
      this.publicKey    = config.publicKey
      this.businessName = config.businessName || 'AI Assistant'
      this.ws           = null
      this.geminiReady  = false
      this.recording    = false
      this.mediaStream  = null
      this.audioCtx     = null
      this.processor    = null
      this.transcript   = []

      // Audio playback — chunks are batched every 60 ms then scheduled end-to-end
      this._playCtx   = null
      this._playHead  = 0
      this._pcmQueue  = []    // Uint8Array chunks waiting to be flushed
      this._flushTimer = null

      injectStyles()
      this._buildDOM()
      this._bindEvents()
    }

    _buildDOM() {
      // Floating button
      this.btn = document.createElement('button')
      this.btn.id = 'ov-widget-btn'
      this.btn.setAttribute('aria-label', 'Open voice assistant')
      this.btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#061818" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
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
          <div class="ov-status" id="ov-status">Press the button to start talking</div>
          <div class="ov-transcript" id="ov-transcript"></div>
          <div class="ov-controls">
            <button class="ov-mic-btn" id="ov-mic-btn" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              </svg>
              Connecting…
            </button>
            <button class="ov-end-btn" id="ov-end-btn">End</button>
          </div>
        </div>
        <div class="ov-footer">Powered by <a href="https://myorbisvoice.com" target="_blank">MyOrbisVoice</a></div>
      `
      document.body.appendChild(this.panel)

      this.statusEl     = document.getElementById('ov-status')
      this.transcriptEl = document.getElementById('ov-transcript')
      this.micBtn       = document.getElementById('ov-mic-btn')
      this.endBtn       = document.getElementById('ov-end-btn')
    }

    _bindEvents() {
      this.btn.addEventListener('click', () => this._open())
      this.panel.querySelector('.ov-close-btn').addEventListener('click', () => this._close())
      this.micBtn.addEventListener('click', () => this._toggleMic())
      this.endBtn.addEventListener('click', () => this._endSession())
    }

    _open() {
      this.panel.classList.add('ov-open')
      if (!this.ws) this._connect()
    }

    _close() {
      this.panel.classList.remove('ov-open')
    }

    async _connect() {
      this._setStatus('Connecting…', true)
      try {
        const res = await fetch(`${API_BASE}/api/public/widget/session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicKey: this.publicKey }),
        })
        if (!res.ok) throw new Error('Failed to start session')
        const { data } = await res.json()

        this.ws = new WebSocket(`${GW_BASE}/ws/widget?token=${data.sessionToken}`)
        this.ws.addEventListener('message', (e) => this._onMessage(JSON.parse(e.data)))
        this.ws.addEventListener('close',   () => this._onDisconnect())
        this.ws.addEventListener('error',   () => this._setStatus('Connection error.'))
      } catch (err) {
        this._setStatus('Could not connect. Please try again.')
        console.error('[OrbisVoice]', err)
      }
    }

    _onMessage(msg) {
      if (msg.type === 'ready') {
        this.geminiReady = true
        this._setStatus('Ready — press the mic to speak')
        this.micBtn.disabled = false
        this.micBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          </svg>
          Speak`
      }

      if (msg.type === 'audio') {
        this._playAudio(msg.data)
      }

      if (msg.type === 'transcript') {
        this._addBubble(msg.role, msg.text)
      }

      if (msg.type === 'turn_complete') {
        this._resetPlayback()
        this._setStatus('Your turn — press to speak')
      }

      if (msg.type === 'ended') {
        this._setStatus('Session ended. Thank you!')
        this.micBtn.disabled = true
        this.ws = null
      }

      if (msg.type === 'error') {
        this._setStatus(msg.message)
      }
    }

    _onDisconnect() {
      if (this.recording) this._stopRecording()
      this._resetPlayback()
      this._setStatus('Disconnected.')
      this.micBtn.disabled = true
      this.ws = null
    }

    async _toggleMic() {
      if (this.recording) {
        this._stopRecording()
      } else {
        await this._startRecording()
      }
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
        }

        source.connect(this.processor)
        this.processor.connect(this.audioCtx.destination)
        this.recording = true
        this.micBtn.textContent = '⏹ Stop'
        this.micBtn.classList.add('recording')
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
      this.micBtn.classList.remove('recording')
      this.micBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        </svg>
        Speak`
      this._setStatus('Processing…', true)
    }

    _endSession() {
      if (this.ws) {
        this.ws.send(JSON.stringify({ type: 'end' }))
        if (this.recording) this._stopRecording()
      } else {
        this._close()
      }
    }

    _playAudio(base64) {
      // Decode incoming base64 PCM16 bytes and queue them
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      this._pcmQueue.push(bytes)

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

    _addBubble(role, text) {
      const div = document.createElement('div')
      div.className = `ov-bubble ${role}`
      div.textContent = text
      this.transcriptEl.appendChild(div)
      this.transcriptEl.scrollTop = this.transcriptEl.scrollHeight
    }

    _setStatus(text, pulsing = false) {
      this.statusEl.textContent = text
      this.statusEl.classList.toggle('ov-pulsing', pulsing)
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
  global.OrbisVoice = {
    init(config) {
      if (!config?.publicKey) {
        console.error('[OrbisVoice] publicKey is required')
        return
      }
      return new OrbisVoiceWidget(config)
    },
  }
})(window)
