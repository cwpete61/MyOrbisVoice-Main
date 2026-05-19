import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@voiceautomation/types'],

  // Permanent redirects from the old "affiliate" URL paths to the new
  // "partner" paths. Keeps any existing bookmarks, email links, and
  // search-engine results working after the 2026-05-04 rename.
  async redirects() {
    return [
      // Root → /login at the routing layer. The src/app/page.tsx version
      // (redirect('/login') inside a server component) was hitting a Next.js
      // RSC bug where `clientModules` was undefined at runtime — only on
      // the root route, only after the locale-detect change made the layout
      // async. Doing the redirect here bypasses the React render entirely,
      // so the bug can't fire.
      { source: '/',                          destination: '/login',                   permanent: false },
      // Permanent redirects from the old "affiliate" URL paths to the new
      // "partner" paths. Keeps any existing bookmarks, email links, and
      // search-engine results working after the 2026-05-04 rename.
      { source: '/affiliate-portal',          destination: '/partner-portal',          permanent: true },
      { source: '/affiliate-portal/:path*',   destination: '/partner-portal/:path*',   permanent: true },
      { source: '/affiliate',                 destination: '/partner',                 permanent: true },
      { source: '/affiliate/:path*',          destination: '/partner/:path*',          permanent: true },
      { source: '/admin/affiliates',          destination: '/admin/partners',          permanent: true },
      { source: '/admin/affiliates/:path*',   destination: '/admin/partners/:path*',   permanent: true },
    ]
  },
}

// Sentry wraps the Next build for error monitoring. With no auth token /
// org / project set, source-map upload is skipped — the build is unaffected,
// and the runtime SDK no-ops until NEXT_PUBLIC_SENTRY_DSN is set.
export default withSentryConfig(nextConfig, {
  silent: true,
})
