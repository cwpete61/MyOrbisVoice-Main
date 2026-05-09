# OrbisVoice WordPress Plugin

Source for the `orbisvoice-widget` WordPress plugin. Tenants download the
zipped version from the dashboard at **Channels → Widget Test → Download
plugin** to install the widget on a WordPress site.

## Files

- `orbisvoice-widget/orbisvoice-widget.php` — main plugin (settings page +
  footer injection of the loader script).
- `orbisvoice-widget/readme.txt` — WP plugin directory readme (used both by
  the WP admin and any future submission to wordpress.org/plugins).

## Rebuild the zip

After editing the plugin source, regenerate the zip that ships to tenants:

```bash
cd infrastructure/wordpress-plugin
rm -f ../../apps/web/public/downloads/orbisvoice-widget.zip
zip -r ../../apps/web/public/downloads/orbisvoice-widget.zip orbisvoice-widget -x "*.DS_Store"
```

The zip is committed to the repo (~5 KB) so the deploy pipeline doesn't need
to build it. The `apps/web/public/downloads/` folder is served as static
content by Next.js, so once committed and deployed the URL is
`https://app.myorbisvoice.com/downloads/orbisvoice-widget.zip`.

## Versioning

When you bump the plugin version:
1. Update `Version:` in the header of `orbisvoice-widget.php`
2. Update `Stable tag:` in `readme.txt`
3. Add a `= X.Y.Z =` entry to the `== Changelog ==` section
4. Rebuild the zip (above)
5. Commit both source + zip

## What the plugin does

1. Adds a Settings menu under **Settings → OrbisVoice Widget**.
2. Stores the tenant's widget public key (and an optional gateway URL
   override — defaults to `https://gateway.myorbisvoice.com`).
3. Enqueues the OrbisVoice loader script in `wp_footer`.
4. Prints an inline `OrbisVoice.init({ publicKey })` call after the loader
   so the floating mic button appears site-wide.

No tracking, no cookies, no data collection on the WP side. Voice traffic
goes directly from the visitor's browser to the OrbisVoice gateway.
