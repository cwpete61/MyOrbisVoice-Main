/* MyOrbis login: light/dark (matches storefront + apex; mor_theme in localStorage). */
(function () {
  function setEarly() {
    try {
      var t = localStorage.getItem('mor_theme');
      if (t !== 'light' && t !== 'dark') t = 'dark';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  }
  setEarly();

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  function cur() { return document.documentElement.getAttribute('data-theme') || 'dark'; }

  function inject() {
    if (document.querySelector('.mor-theme-toggle')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mor-theme-toggle';
    b.setAttribute('aria-label', 'Toggle light or dark theme');
    function paint() { b.innerHTML = cur() === 'dark' ? SUN : MOON; }
    paint();
    b.addEventListener('click', function () {
      var n = cur() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', n);
      try { localStorage.setItem('mor_theme', n); } catch (e) {}
      paint();
    });
    document.body.appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
