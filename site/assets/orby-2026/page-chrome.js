/* MyOrbisVoice — Page Chrome 2026 enhancer
 *
 * Runs on every legacy static-HTML page (loaded via <script defer>).
 * - Default theme: LIGHT (legacy style.css). Visitor can flip to DARK via toggle.
 * - Persists choice in localStorage('orby-theme').
 * - Injects a sun/moon theme toggle into every page's nav-cta.
 * - Injects "Family" column into legacy footer-grid.
 * - Restyles the lang-toggle into the brand-teal pill (with globe + lang code).
 *
 * Idempotent. Safe to re-run.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'orby-theme';

  // Platform tenant WIDGET channel publicKey — embeds the real Orby voice
  // widget on every marketing page. Grab from Admin → Tenants →
  // orbis-platform → Channels → WIDGET. Update + redeploy when rotated.
  // If empty, widget is skipped (no JS error, just no floating button).
  var ORBY_WIDGET_PUBLIC_KEY = '';
  var GATEWAY_WIDGET_URL = 'https://gateway.myorbisvoice.com/widget/orbisvoice-widget.js';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function isSpanish() {
    return (document.documentElement.lang || '').toLowerCase().startsWith('es');
  }

  // ── Theme handling ──────────────────────────────────────────────────────
  function readStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) {}
    return null;
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.setAttribute('data-theme', 'light');
    // Refresh any toggle icon already on the page
    document.querySelectorAll('.theme-toggle').forEach(updateToggleIcon);
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  var SUN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var MOON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function updateToggleIcon(btn) {
    var dark = currentTheme() === 'dark';
    btn.innerHTML = dark ? SUN : MOON;
    var es = isSpanish();
    btn.setAttribute('aria-label', es
      ? (dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro')
      : (dark ? 'Switch to light mode' : 'Switch to dark mode'));
    btn.title = btn.getAttribute('aria-label');
  }

  function injectThemeToggle() {
    var nav = document.querySelector('.site-nav .nav-cta');
    if (!nav) return;
    if (nav.querySelector('.theme-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.addEventListener('click', toggleTheme);
    nav.appendChild(btn);
    updateToggleIcon(btn);
  }

  // ── Signup NOW! pill (amber) — upgrades existing /signup link or injects new ─
  function injectSignupCta() {
    var nav = document.querySelector('.site-nav .nav-cta');
    if (!nav) return;
    if (nav.querySelector('.signup-cta')) return;
    var es = isSpanish();
    var label = es ? '¡Regístrate AHORA!' : 'Signup NOW!';
    var url = 'https://app.myorbisvoice.com/signup';

    // 1. If an existing /signup link is in nav-cta, upgrade it in place
    var existing = nav.querySelector('a[href*="/signup"]');
    if (existing) {
      existing.classList.add('signup-cta');
      existing.classList.remove('btn', 'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-sm');
      existing.textContent = label;
      existing.href = url;
      return;
    }

    // 2. Otherwise inject a new pill before the theme toggle
    var a = document.createElement('a');
    a.className = 'signup-cta';
    a.href = url;
    a.textContent = label;
    var themeBtn = nav.querySelector('.theme-toggle');
    if (themeBtn) nav.insertBefore(a, themeBtn);
    else nav.appendChild(a);
  }

  // ── Family column injection ────────────────────────────────────────────
  function injectFamilyColumn() {
    var grid = document.querySelector('.site-footer .footer-grid');
    if (!grid) return;
    if (grid.querySelector('[data-orby-family]')) return;
    var es = isSpanish();
    var col = document.createElement('div');
    col.className = 'footer-col';
    col.setAttribute('data-orby-family', '');
    col.innerHTML =
      '<h5>' + (es ? 'Familia' : 'Family') + '</h5>' +
      '<a href="https://myorbisresults.com" target="_blank" rel="noopener">MyOrbisResults</a>' +
      '<a href="https://myorbislocal.com" target="_blank" rel="noopener">MyOrbisLocal <span class="footer-soon">' + (es ? 'pronto' : 'soon') + '</span></a>' +
      '<a href="https://myorbisweb.com" target="_blank" rel="noopener">MyOrbisWeb <span class="footer-soon">' + (es ? 'pronto' : 'soon') + '</span></a>';
    grid.appendChild(col);
  }

  // ── Lang toggle pill polish ────────────────────────────────────────────
  function upgradeLangToggle() {
    document.querySelectorAll('.site-nav .lang-toggle').forEach(function (a) {
      if (a.dataset.orbyPill) return;
      a.dataset.orbyPill = '1';
      var es = isSpanish();
      a.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="10"/>' +
          '<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' +
        '</svg> ' +
        (es ? 'EN' : 'ES');
    });
  }

  // ── Boot ───────────────────────────────────────────────────────────────
  // Apply persisted theme before paint where possible. The inline-script
  // version is the gold standard for no-flicker; this defer'd script runs
  // after first paint, so legacy pages briefly show light. Acceptable since
  // default IS light. Users in dark mode see a quick flash; tolerable.
  var stored = readStored();
  applyTheme(stored || 'dark');

  // Swap legacy nav-logo-icon SVG (white circle) for the real OrbisVoice logo.
  function upgradeLogoMarks() {
    document.querySelectorAll('.nav-logo .nav-logo-icon, .footer-brand .nav-logo .nav-logo-icon').forEach(function (mark) {
      if (mark.dataset.orbyLogo) return;
      mark.dataset.orbyLogo = '1';
      mark.innerHTML =
        '<img src="/assets/img/orbisvoice-logo-64.png" alt="" width="22" height="22" ' +
        'style="display:block;border-radius:5px;" />';
      mark.style.background = 'transparent';
      mark.style.padding = '0';
    });
  }

  // ── Real Orby voice widget — floating bottom-right on every page ───
  function injectOrbyWidget() {
    if (!ORBY_WIDGET_PUBLIC_KEY) return; // not configured yet
    if (document.getElementById('ov-widget-script')) return;
    if (window.OrbisVoice) {
      try { window.OrbisVoice.init({ publicKey: ORBY_WIDGET_PUBLIC_KEY }); } catch (e) {}
      return;
    }
    var s = document.createElement('script');
    s.id  = 'ov-widget-script';
    s.src = GATEWAY_WIDGET_URL;
    s.async = true;
    s.onload = function () {
      if (window.OrbisVoice && typeof window.OrbisVoice.init === 'function') {
        try { window.OrbisVoice.init({ publicKey: ORBY_WIDGET_PUBLIC_KEY }); } catch (e) {}
      }
    };
    document.body.appendChild(s);
  }

  ready(function () {
    injectFamilyColumn();
    upgradeLangToggle();
    injectSignupCta();
    injectThemeToggle();
    upgradeLogoMarks();
    injectOrbyWidget();
  });
})();
