=== OrbisVoice Widget ===
Contributors: myorbisvoice
Tags: voice, ai, receptionist, widget, chatbot, voice-ai, lead-capture
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Drop the OrbisVoice AI voice receptionist mic button onto your WordPress site in two clicks. Paste your widget public key — done.

== Description ==

OrbisVoice is an AI voice receptionist platform for service businesses. This plugin makes installing the website widget on a WordPress site as easy as pasting an API key.

What you get once the plugin is configured:

* A floating mic button in the bottom-right corner of every page.
* Visitors press it to start a real-time voice conversation with your AI agent.
* Conversations are recorded, transcribed, and summarized in your MyOrbisVoice dashboard.
* The agent uses your tenant's Business DNA, prompt stack, and connected channels — no per-page configuration required.

= How it works =

1. Sign up at https://app.myorbisvoice.com/signup
2. Configure your Business DNA + enable the Widget channel
3. Copy your widget public key from Channels → Widget Test → Public key
4. Install + activate this plugin, paste the key in Settings → OrbisVoice Widget, save

The plugin injects a single `<script>` tag into your site's footer — no theme edits, no manual code paste.

= What this plugin does NOT do =

* It does not store any visitor data. All voice traffic is routed through the OrbisVoice gateway over HTTPS + WebSocket directly from the visitor's browser.
* It does not track visitors. No cookies, no fingerprinting, no analytics from this plugin.
* It does not modify your theme files.

== Installation ==

1. Upload the `orbisvoice-widget` folder to `/wp-content/plugins/` — OR install the .zip via Plugins → Add New → Upload Plugin
2. Activate "OrbisVoice Widget" through the Plugins screen
3. Go to Settings → OrbisVoice Widget
4. Paste your public key (find it in your MyOrbisVoice dashboard at Channels → Widget Test → Public key)
5. Save changes — the mic button will appear on your site within a minute. Hard-refresh if needed.

== Frequently Asked Questions ==

= Where do I find my widget public key? =

Log into your MyOrbisVoice dashboard at https://app.myorbisvoice.com → Channels → Widget Test. The public key is at the bottom of that page. It starts with `pk_`.

= My mic button isn't showing up =

Three things to check:
1. Is the Widget channel enabled in your dashboard? (Channels → Widget → toggle on)
2. Did you paste the full public key, including the `pk_` prefix?
3. Have you cleared your browser cache? Some caching plugins (W3 Total Cache, WP Rocket) hold onto the old HTML — purge their cache after saving the plugin settings.

= Does this work with [my caching plugin]? =

Yes. The plugin emits a standard `<script>` tag in the footer. Any caching plugin that respects WordPress hooks will include it correctly. After changing the public key, purge the page cache.

= Can I customize the button position / color? =

Not from this plugin yet. Visual customization (position, brand color, mic button labels) is done in your MyOrbisVoice dashboard under Channels → Widget. Future plugin versions will expose a subset of those options here.

= How is voice traffic routed? =

The widget loader script connects directly from the visitor's browser to `gateway.myorbisvoice.com` over WebSocket + HTTPS. Your WordPress server is not in the audio path.

== Changelog ==

= 1.0.0 =
* Initial release. Settings page, public-key + gateway-URL fields, footer injection of the OrbisVoice loader.
