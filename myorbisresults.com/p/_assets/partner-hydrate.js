/**
 * Partner-page hydration script.
 *
 * Runs on every /p/<slug>/voice-X/ partner page. Reads the slug from the
 * URL, fetches the live partner record from the public API, and overlays
 * the hardcoded bootstrap content (Alex Rivera placeholder) with the actual
 * partner's name + phone + email + avatar + business name + bio.
 *
 * Static content stays as the fallback — if the API is unreachable or returns
 * 404, the page keeps the Alex Rivera bootstrap values. This means the worst
 * possible failure mode for a real partner is "shows the placeholder" rather
 * than "broken page."
 *
 * Hydrated fields:
 *   - Display name (10 occurrences of "Alex Rivera" → partner.displayName)
 *   - Email mailto: + visible address ("alex@myorbisresults.com" → partner.partnerEmail)
 *   - Phone tel:/sms: + visible display ("+15551234567" / "+1 (555) 123-4567" → partner.partnerPhone)
 *   - Avatar img src (sample-partner.jpg → partner.avatarUrl)
 */
(function () {
  'use strict';

  // Find the slug in the URL: /p/<slug>/voice-X/ or /es/p/<slug>/voice-X/
  const match = location.pathname.match(/^\/(?:es\/)?p\/([^/]+)\//);
  if (!match) return;
  let slug = match[1];
  if (slug === 'sample') slug = 'alex.rivera';  // legacy /p/sample/ URL fallback

  const API_BASE = 'https://api.myorbisvoice.com';

  function normalizeToE164(display) {
    // "+1 (555) 123-4567" -> "+15551234567"
    if (!display) return null;
    const cleaned = String(display).replace(/[^\d+]/g, '');
    return cleaned || null;
  }

  function replaceTextNodes(root, replacements) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const toUpdate = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      let text = node.nodeValue;
      let changed = false;
      for (const r of replacements) {
        if (text.indexOf(r.from) !== -1) {
          text = text.split(r.from).join(r.to);
          changed = true;
        }
      }
      if (changed) toUpdate.push({ node, text });
    }
    for (const u of toUpdate) u.node.nodeValue = u.text;
  }

  function replaceAttribute(selector, attr, replacements) {
    document.querySelectorAll(selector).forEach((el) => {
      let val = el.getAttribute(attr);
      if (!val) return;
      let changed = false;
      for (const r of replacements) {
        if (val.indexOf(r.from) !== -1) {
          val = val.split(r.from).join(r.to);
          changed = true;
        }
      }
      if (changed) el.setAttribute(attr, val);
    });
  }

  function hydrate(partner) {
    const phoneE164 = normalizeToE164(partner.partnerPhone);
    const phoneDisplay = partner.partnerPhone;

    // Text-node replacements (run across the whole body)
    const textReplacements = [];
    if (partner.displayName && partner.displayName !== 'Alex Rivera') {
      textReplacements.push({ from: 'Alex Rivera', to: partner.displayName });
    }
    if (partner.partnerEmail && partner.partnerEmail !== 'alex@myorbisresults.com') {
      textReplacements.push({ from: 'alex@myorbisresults.com', to: partner.partnerEmail });
    }
    if (phoneDisplay && phoneDisplay !== '+1 (555) 123-4567') {
      textReplacements.push({ from: '+1 (555) 123-4567', to: phoneDisplay });
    }
    if (textReplacements.length) replaceTextNodes(document.body, textReplacements);

    // Attribute replacements: href on <a>, src on <img>
    const hrefReplacements = [];
    if (partner.partnerEmail && partner.partnerEmail !== 'alex@myorbisresults.com') {
      hrefReplacements.push({ from: 'alex@myorbisresults.com', to: partner.partnerEmail });
    }
    if (phoneE164 && phoneE164 !== '+15551234567') {
      hrefReplacements.push({ from: '+15551234567', to: phoneE164 });
    }
    if (hrefReplacements.length) replaceAttribute('a[href]', 'href', hrefReplacements);

    // Avatar — replace any <img> whose src contains the sample-partner placeholder
    if (partner.avatarUrl) {
      document.querySelectorAll('img[src*="sample-partner.jpg"]').forEach((img) => {
        img.setAttribute('src', partner.avatarUrl);
      });
    }

    document.documentElement.setAttribute('data-partner-hydrated', partner.slug);
  }

  fetch(`${API_BASE}/api/public/partner/${encodeURIComponent(slug)}`)
    .then((res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .then((payload) => {
      const partner = payload && payload.data;
      if (!partner || !partner.slug) return;
      // Run synchronously if DOM is ready; otherwise wait
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => hydrate(partner));
      } else {
        hydrate(partner);
      }
    })
    .catch(() => { /* silent — fall back to static bootstrap content */ });
})();
