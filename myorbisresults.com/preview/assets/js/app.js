// MyOrbisVoice Preview — main app logic
// Drives industry picker, screen navigation, mock data render, in-app switcher.
// All data is hardcoded JSON in /data/<vertical>.json. No real network calls.

(function () {
  'use strict';

  const STORAGE_KEY = 'myorbis-preview-industry';
  const LANG_STORAGE_KEY = 'myorbis-preview-lang';
  const THEME_STORAGE_KEY = 'myorbis-preview-theme';

  // ─── i18n dictionary ──────────────────────────────────────────
  const I18N = {
    en: {
      'onboard.title': 'Pick your industry to see your version.',
      'onboard.lead': 'No signup. No commitment. Sample data, real screens. You can switch industries any time.',
      'onboard.foot': 'All data shown is sample data. No real customer information.<br/>Built on proprietary Orbis voice technology.',
      'industry.dental': 'Dental',
      'industry.legal': 'Legal',
      'industry.home-services': 'Home services',
      'industry.beauty': 'Beauty & salon',
      'industry.fitness': 'Fitness',
      'industry.medical': 'Medical',
      'industry.coaching': 'Coaching',
      'industry.real-estate': 'Real estate',
      'home.biz-tag-default': 'Today',
      'home.biz-tag-prefix': 'Today',
      'kpi.calls': 'Calls answered',
      'kpi.calls-delta': '100% capture today',
      'kpi.bookings': 'Bookings',
      'kpi.noshows': 'No-shows',
      'kpi.noshows-delta': '−15 pts vs Q1',
      'kpi.reviews': 'Reviews',
      'kpi.reviews-delta': 'pending response',
      'home.live-now': 'Live right now',
      'home.loading': 'Loading…',
      'home.recent-calls': 'Recent calls',
      'home.see-all': 'See all →',
      'calls.title': 'All calls',
      'calls.sub': "Today's call activity. Tap any call to see the transcript and listen back.",
      'calendar.title': 'Calendar',
      'calendar.sub': "Today's bookings. The voice agent puts these here automatically.",
      'detail.back': '← Back',
      'detail.play': 'Play call',
      'detail.pause': 'Pause',
      'detail.tap-play': 'Tap play to hear the conversation',
      'detail.playing': 'Playing…',
      'detail.playback-complete': 'Playback complete',
      'detail.paused': 'Paused.',
      'detail.no-audio': 'No audio for this call',
      'detail.no-support': 'Audio playback not supported in this browser',
      'detail.transcript': 'Transcript',
      'detail.summary': 'Summary',
      'detail.transcript-empty': 'Transcript not captured for this call. The agent logs short FAQ and after-hours interactions without a full transcript.',
      'detail.note': "Audio playback uses your browser's built-in voices. In the live product, you hear the actual recorded call.",
      'settings.title': 'Settings',
      'settings.sub': 'This is a demo. Settings here are decorative — they show what configuration looks like in the real product.',
      'settings.voice-profile': 'Voice profile',
      'settings.voice-profile-detail': 'Current: <strong>Warm Female</strong> — friendly, hospitality-tuned. The actual product offers 7 Orbis voice profiles.',
      'settings.brand-tier': 'Brand voice tier',
      'settings.brand-tier-detail': 'Current: <strong>Balanced (default)</strong> — modern direct-response, emotional but credible.',
      'settings.coverage': 'Coverage',
      'settings.coverage-detail': '<strong>24 / 7</strong>, English and Latin American Spanish. Inbound phone + website widget + SMS + email triage.',
      'nav.home': 'Home',
      'nav.calls': 'Calls',
      'nav.calendar': 'Calendar',
      'nav.settings': 'Settings',
      'picker.title': 'Switch industry',
      'picker.lead': 'Pick a different industry to see how MyOrbisVoice looks for that business type.',
      'agent.role': 'Agent',
      'caller.role': 'Caller',
    },
    es: {
      'onboard.title': 'Elige tu industria para ver tu versión.',
      'onboard.lead': 'Sin registro. Sin compromiso. Datos de muestra, pantallas reales. Puedes cambiar de industria cuando quieras.',
      'onboard.foot': 'Todos los datos mostrados son de muestra. Sin información real de clientes.<br/>Construido sobre tecnología de voz Orbis propietaria.',
      'industry.dental': 'Dental',
      'industry.legal': 'Legal',
      'industry.home-services': 'Servicios del hogar',
      'industry.beauty': 'Belleza y salón',
      'industry.fitness': 'Fitness',
      'industry.medical': 'Médico',
      'industry.coaching': 'Coaching',
      'industry.real-estate': 'Bienes raíces',
      'home.biz-tag-default': 'Hoy',
      'home.biz-tag-prefix': 'Hoy',
      'kpi.calls': 'Llamadas atendidas',
      'kpi.calls-delta': '100% capturadas hoy',
      'kpi.bookings': 'Reservas',
      'kpi.noshows': 'No-shows',
      'kpi.noshows-delta': '−15 pts vs Q1',
      'kpi.reviews': 'Reseñas',
      'kpi.reviews-delta': 'pendiente de respuesta',
      'home.live-now': 'En vivo ahora',
      'home.loading': 'Cargando…',
      'home.recent-calls': 'Llamadas recientes',
      'home.see-all': 'Ver todas →',
      'calls.title': 'Todas las llamadas',
      'calls.sub': 'Actividad de llamadas de hoy. Toca cualquier llamada para ver la transcripción y escucharla.',
      'calendar.title': 'Calendario',
      'calendar.sub': 'Reservas de hoy. El agente de voz las pone aquí automáticamente.',
      'detail.back': '← Atrás',
      'detail.play': 'Reproducir llamada',
      'detail.pause': 'Pausar',
      'detail.tap-play': 'Toca reproducir para escuchar la conversación',
      'detail.playing': 'Reproduciendo…',
      'detail.playback-complete': 'Reproducción completa',
      'detail.paused': 'Pausado.',
      'detail.no-audio': 'No hay audio para esta llamada',
      'detail.no-support': 'Reproducción de audio no soportada en este navegador',
      'detail.transcript': 'Transcripción',
      'detail.summary': 'Resumen',
      'detail.transcript-empty': 'No se capturó la transcripción de esta llamada. El agente registra interacciones cortas de FAQ y fuera de horario sin transcripción completa.',
      'detail.note': 'La reproducción usa las voces integradas de tu navegador. En el producto real, escuchas la grabación verdadera de la llamada.',
      'settings.title': 'Ajustes',
      'settings.sub': 'Esto es un demo. Los ajustes aquí son decorativos — muestran cómo se ve la configuración en el producto real.',
      'settings.voice-profile': 'Perfil de voz',
      'settings.voice-profile-detail': 'Actual: <strong>Femenina cálida</strong> — amistosa, ajustada para hospitalidad. El producto real ofrece 7 perfiles de voz Orbis.',
      'settings.brand-tier': 'Nivel de voz de marca',
      'settings.brand-tier-detail': 'Actual: <strong>Balanceado (default)</strong> — respuesta directa moderna, emocional pero creíble.',
      'settings.coverage': 'Cobertura',
      'settings.coverage-detail': '<strong>24 / 7</strong>, inglés y español latinoamericano. Llamadas entrantes + widget del sitio + SMS + triage de correo.',
      'nav.home': 'Inicio',
      'nav.calls': 'Llamadas',
      'nav.calendar': 'Calendario',
      'nav.settings': 'Ajustes',
      'picker.title': 'Cambiar industria',
      'picker.lead': 'Elige otra industria para ver cómo se ve MyOrbisVoice para ese tipo de negocio.',
      'agent.role': 'Agente',
      'caller.role': 'Llamante',
    },
  };

  function detectLocale() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('lang');
    if (fromUrl === 'en' || fromUrl === 'es') return fromUrl;
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
    const nav = (navigator.language || 'en').toLowerCase();
    return nav.startsWith('es') ? 'es' : 'en';
  }

  let currentLang = detectLocale();

  function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en[key]) || key;
  }

  function applyI18n() {
    document.documentElement.setAttribute('lang', currentLang);
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      el.innerHTML = t(key);
    });
    const langCurrent = document.getElementById('lang-current');
    if (langCurrent) langCurrent.textContent = currentLang.toUpperCase();
  }

  function toggleLanguage() {
    currentLang = currentLang === 'es' ? 'en' : 'es';
    localStorage.setItem(LANG_STORAGE_KEY, currentLang);
    applyI18n();
    // Re-render the home screen so KPI deltas + biz tag pick up the new lang
    if (currentData) renderApp(document.documentElement.dataset.industry || 'dental', currentData);
  }

  // ─── Theme (light / dark) ─────────────────────────────────────
  function detectTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  let currentTheme = document.documentElement.getAttribute('data-theme') || detectTheme();

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    applyTheme();
  }

  const INDUSTRIES = {
    'dental':         { icon: '🦷', name: 'Dental',          biz: 'Bright Smile Dental' },
    'legal':          { icon: '⚖️',  name: 'Legal',           biz: 'Garner Family Law' },
    'home-services':  { icon: '🔧', name: 'Home services',   biz: 'Valley HVAC' },
    'beauty':         { icon: '✂️',  name: 'Beauty & salon',  biz: 'Queen Umoja Studio' },
    'fitness':        { icon: '🏋️', name: 'Fitness',         biz: 'Iron Peak Athletic' },
    'medical':        { icon: '⚕️',  name: 'Medical',         biz: 'Allentown Family Care' },
    'coaching':       { icon: '🎓', name: 'Coaching',        biz: 'Mason Cohen Consulting' },
    'real-estate':    { icon: '🔑', name: 'Real estate',     biz: 'Cohen + Reyes Realty' },
  };

  // Module state
  let currentData = null;
  let currentCall = null;
  let previousScreen = 'home';

  // DOM refs
  const $onboard = document.getElementById('onboard');
  const $topbar = document.getElementById('topbar');
  const $screens = document.getElementById('screens');
  const $bottomnav = document.getElementById('bottomnav');
  const $modal = document.getElementById('picker-modal');
  const $industrySwitch = document.getElementById('industry-switch');
  const $industryCurrentIcon = document.getElementById('industry-current-icon');
  const $industryCurrentName = document.getElementById('industry-current-name');
  const $pickerGrid = document.getElementById('picker-grid');

  // ─── Wire onboarding card grid clicks ───────────────────────
  document.querySelectorAll('#onboard .industry-card').forEach((card) => {
    card.addEventListener('click', () => {
      const ind = card.dataset.industry;
      selectIndustry(ind);
    });
  });

  // ─── Wire industry switcher in topbar ───────────────────────
  $industrySwitch?.addEventListener('click', () => openSwitcher());
  $modal?.addEventListener('click', (e) => {
    if (e.target === $modal) closeSwitcher();
  });

  // ─── Wire language toggle in topbar ─────────────────────────
  document.getElementById('lang-switch')?.addEventListener('click', toggleLanguage);
  document.getElementById('theme-switch')?.addEventListener('click', toggleTheme);
  applyTheme();

  // Apply i18n to all data-i18n elements on first load
  applyI18n();

  // ─── Wire bottom nav ────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const screen = btn.dataset.nav;
      goToScreen(screen);
    });
  });

  // Also wire any in-screen "See all →" links that have data-nav
  document.querySelectorAll('a[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      goToScreen(a.dataset.nav);
    });
  });

  // Back button on call detail
  document.getElementById('back-from-detail')?.addEventListener('click', () => {
    stopAudio();
    goToScreen(previousScreen || 'home');
  });

  // Audio play/pause toggle
  document.getElementById('audio-play')?.addEventListener('click', () => {
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      stopAudio();
    } else if (currentCall) {
      playTranscript(currentCall);
    }
  });

  // Event delegation: any .call-row click opens detail
  document.addEventListener('click', (e) => {
    const row = e.target.closest('.call-row[data-call-idx]');
    if (!row || !currentData) return;
    const idx = parseInt(row.dataset.callIdx, 10);
    const call = currentData.calls[idx];
    if (!call) return;
    openCallDetail(call);
  });

  // ─── Boot: check URL query first, then localStorage ────────
  const urlParams = new URLSearchParams(window.location.search);
  const queryInd = urlParams.get('industry');
  const storedInd = localStorage.getItem(STORAGE_KEY);

  if (queryInd && INDUSTRIES[queryInd]) {
    selectIndustry(queryInd);
  } else if (storedInd && INDUSTRIES[storedInd]) {
    selectIndustry(storedInd);
  }
  // Otherwise: stay on onboarding

  // ─── Functions ──────────────────────────────────────────────

  function selectIndustry(ind) {
    if (!INDUSTRIES[ind]) return;
    localStorage.setItem(STORAGE_KEY, ind);
    document.documentElement.dataset.industry = ind;
    loadIndustryData(ind).then((data) => {
      renderApp(ind, data);
    });
  }

  function loadIndustryData(ind) {
    return fetch(`data/${ind}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => data || generateFallbackData(ind));
  }

  function renderApp(ind, data) {
    currentData = data;
    // Hide onboarding, show app shell
    $onboard.classList.add('hidden');
    $topbar.classList.remove('hidden');
    $screens.classList.remove('hidden');
    $bottomnav.classList.remove('hidden');
    closeSwitcher();

    // Update topbar industry pill
    $industryCurrentIcon.textContent = INDUSTRIES[ind].icon;
    $industryCurrentName.textContent = INDUSTRIES[ind].name;

    // Render home screen
    document.getElementById('biz-name').textContent = data.business.name;
    const dateLocale = currentLang === 'es' ? 'es-ES' : 'en-US';
    document.getElementById('biz-tag').textContent = `${t('home.biz-tag-prefix')} · ${new Date().toLocaleDateString(dateLocale, { month: 'long', day: 'numeric' })}`;

    document.getElementById('kpi-calls').textContent = data.kpis.calls;
    document.getElementById('kpi-bookings').textContent = data.kpis.bookings;
    document.getElementById('kpi-bookings-delta').textContent = `+$${data.kpis.bookings_revenue.toLocaleString()}`;
    document.getElementById('kpi-noshows').textContent = data.kpis.noshow_pct;
    document.getElementById('kpi-reviews').textContent = data.kpis.reviews_pending;
    // live_message: use _es variant if available + ES is current, else fall back to en
    const liveMsg = (currentLang === 'es' && data.live_message_es) ? data.live_message_es : data.live_message;
    document.getElementById('live-msg').innerHTML = liveMsg;

    // Render recent calls (first 5)
    renderCallList(document.getElementById('home-calls'), data.calls.slice(0, 5));
    renderCallList(document.getElementById('all-calls'), data.calls);
    renderCalendar(document.getElementById('calendar-list'), data.calendar || []);

    // Reset to home screen
    goToScreen('home');

    // Build switcher modal grid
    buildPickerGrid(ind);
  }

  function renderCallList(container, calls) {
    if (!container || !currentData) return;
    container.innerHTML = calls.map(c => {
      const idx = currentData.calls.indexOf(c);
      return `
      <div class="call-row" data-call-idx="${idx}">
        <div class="call-avatar">${initials(c.name)}</div>
        <div class="call-meta">
          <div class="call-name">${escapeHtml(c.name)}</div>
          <div class="call-detail">${escapeHtml(c.time)} · ${escapeHtml(c.summary)}</div>
        </div>
        <div class="call-status ${c.status}">${statusLabel(c.status)}</div>
      </div>
    `;
    }).join('');
  }

  function renderCalendar(container, bookings) {
    if (!container) return;
    if (!bookings.length) {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 12px 14px;">No bookings yet today.</p>';
      return;
    }
    container.innerHTML = bookings.map(b => `
      <div class="call-row">
        <div class="call-avatar">${initials(b.customer)}</div>
        <div class="call-meta">
          <div class="call-name">${escapeHtml(b.customer)}</div>
          <div class="call-detail">${escapeHtml(b.time)} · ${escapeHtml(b.service)}</div>
        </div>
        <div class="call-status booked">${escapeHtml(b.duration || '30m')}</div>
      </div>
    `).join('');
  }

  function openCallDetail(call) {
    currentCall = call;
    stopAudio();

    document.getElementById('detail-avatar').textContent = initials(call.name);
    document.getElementById('detail-name').textContent = call.name;
    document.getElementById('detail-time').textContent = call.time + (call.duration ? ` · ${call.duration}` : '');
    const $st = document.getElementById('detail-status');
    $st.textContent = statusLabel(call.status);
    $st.className = `call-status ${call.status}`;

    const $list = document.getElementById('transcript-list');
    const $play = document.getElementById('audio-play');
    const $status = document.getElementById('audio-status');

    if (Array.isArray(call.transcript) && call.transcript.length) {
      $list.innerHTML = call.transcript.map(turn => `
        <div class="transcript-bubble ${turn.role === 'agent' ? 'agent' : 'caller'}">
          <span class="transcript-role">${turn.role === 'agent' ? t('agent.role') : escapeHtml(call.name.split(' ')[0])}</span>
          ${escapeHtml(turn.text)}
        </div>
      `).join('');
      $play.disabled = false;
      $status.textContent = t('detail.tap-play');
    } else {
      $list.innerHTML = `<div class="transcript-empty">${t('detail.transcript-empty')}</div>`;
      $play.disabled = true;
      $status.textContent = t('detail.no-audio');
    }

    document.getElementById('summary-box').textContent = call.summary_long || call.summary;

    // Remember where we came from so back returns there
    const active = document.querySelector('.screen.active');
    if (active && active.dataset.screen !== 'call-detail') {
      previousScreen = active.dataset.screen;
    }
    goToScreen('call-detail');
  }

  // Audio playback via Web Speech API.
  // Falls back gracefully if SpeechSynthesis is unavailable.
  let speechVoices = [];
  function loadVoices() {
    if (!window.speechSynthesis) return;
    speechVoices = window.speechSynthesis.getVoices();
  }
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickVoice(role) {
    if (!speechVoices.length) return null;
    const enVoices = speechVoices.filter(v => v.lang && v.lang.startsWith('en'));
    const pool = enVoices.length ? enVoices : speechVoices;
    if (role === 'agent') {
      return pool.find(v => /samantha|google us english|female|allison|karen|nicky/i.test(v.name)) || pool[0];
    }
    return pool.find(v => /alex|google uk english male|daniel|fred|tom/i.test(v.name)) || pool[pool.length - 1];
  }

  function playTranscript(call) {
    if (!window.speechSynthesis || !Array.isArray(call.transcript) || !call.transcript.length) {
      document.getElementById('audio-status').textContent = t('detail.no-support');
      return;
    }
    window.speechSynthesis.cancel();
    setPlayButton(true);

    let i = 0;
    const bubbles = document.querySelectorAll('.transcript-bubble');

    function speakNext() {
      if (i >= call.transcript.length) {
        setPlayButton(false);
        document.getElementById('audio-status').textContent = t('detail.playback-complete');
        bubbles.forEach(b => b.classList.remove('speaking'));
        return;
      }
      const turn = call.transcript[i];
      bubbles.forEach((b, idx) => b.classList.toggle('speaking', idx === i));
      const u = new SpeechSynthesisUtterance(turn.text);
      const v = pickVoice(turn.role);
      if (v) u.voice = v;
      u.rate = 1.05;
      u.pitch = turn.role === 'agent' ? 1.05 : 0.95;
      u.onend = () => { i += 1; speakNext(); };
      u.onerror = () => { i += 1; speakNext(); };
      window.speechSynthesis.speak(u);
    }

    document.getElementById('audio-status').textContent = t('detail.playing');
    speakNext();
  }

  function stopAudio() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    document.querySelectorAll('.transcript-bubble').forEach(b => b.classList.remove('speaking'));
    setPlayButton(false);
  }

  function setPlayButton(isPlaying) {
    const $icon = document.getElementById('audio-icon');
    const $label = document.getElementById('audio-label');
    if (!$icon || !$label) return;
    $icon.textContent = isPlaying ? '⏸' : '▶';
    $label.textContent = isPlaying ? t('detail.pause') : t('detail.play');
  }

  function statusLabel(s) {
    return ({
      booked: 'BOOKED',
      qualifying: 'LIVE',
      missed: 'MISSED',
      faq: 'FAQ',
    })[s] || s.toUpperCase();
  }

  function initials(name) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function goToScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.dataset.screen === name));
    // Bottom nav only highlights primary screens
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
    // If navigating to a primary screen via nav, stop any audio
    if (name !== 'call-detail') stopAudio();
    window.scrollTo(0, 0);
  }

  function openSwitcher() {
    $modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSwitcher() {
    $modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function buildPickerGrid(currentInd) {
    $pickerGrid.innerHTML = Object.entries(INDUSTRIES).map(([key, ind]) => `
      <button class="industry-card" data-industry="${key}" ${key === currentInd ? 'style="border-color: var(--teal-3); background: var(--bg-tinted);"' : ''}>
        <div class="ind-icon">${ind.icon}</div>
        <div class="ind-name">${t('industry.' + key)}</div>
        <div class="ind-tag">${ind.biz}</div>
      </button>
    `).join('');
    // Re-wire clicks
    $pickerGrid.querySelectorAll('.industry-card').forEach(card => {
      card.addEventListener('click', () => {
        selectIndustry(card.dataset.industry);
      });
    });
  }

  // ─── Fallback mock data generator ─────────────────────────
  // Used if data/<ind>.json doesn't exist yet during dev.
  function generateFallbackData(ind) {
    const biz = INDUSTRIES[ind]?.biz || 'Your Business';
    return {
      business: { name: biz, vertical: ind },
      kpis: {
        calls: 12,
        bookings: 8,
        bookings_revenue: 3440,
        noshow_pct: '7%',
        reviews_pending: 4,
      },
      live_message: `<strong>Maria R.</strong> is on a call right now. The agent is qualifying her — she's calling about a Thursday appointment.`,
      calls: [
        { name: 'Maria Rodriguez', time: '10:47 AM', summary: 'Booked Thursday 2pm', status: 'booked' },
        { name: 'Anonymous caller', time: '10:12 AM', summary: 'Hours / location inquiry', status: 'faq' },
        { name: 'John Park', time: '9:33 AM', summary: 'Currently on call', status: 'qualifying' },
        { name: 'Sarah Liu',  time: 'Yesterday 7:42pm', summary: 'After-hours booked Friday', status: 'booked' },
        { name: 'David Cohen',time: 'Yesterday 6:18pm', summary: 'Booked Saturday 10am', status: 'booked' },
      ],
      calendar: [
        { customer: 'Maria Rodriguez', time: 'Thu 2:00 PM', service: 'Service appointment', duration: '60m' },
        { customer: 'Sarah Liu',       time: 'Fri 10:00 AM', service: 'New customer intake', duration: '45m' },
        { customer: 'David Cohen',     time: 'Sat 10:00 AM', service: 'Recurring visit', duration: '30m' },
      ],
    };
  }

})();
