/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@voiceautomation/types'],

  // Permanent redirects from the old "affiliate" URL paths to the new
  // "partner" paths. Keeps any existing bookmarks, email links, and
  // search-engine results working after the 2026-05-04 rename.
  async redirects() {
    return [
      { source: '/affiliate-portal',          destination: '/partner-portal',          permanent: true },
      { source: '/affiliate-portal/:path*',   destination: '/partner-portal/:path*',   permanent: true },
      { source: '/affiliate',                 destination: '/partner',                 permanent: true },
      { source: '/affiliate/:path*',          destination: '/partner/:path*',          permanent: true },
      { source: '/admin/affiliates',          destination: '/admin/partners',          permanent: true },
      { source: '/admin/affiliates/:path*',   destination: '/admin/partners/:path*',   permanent: true },
    ]
  },
}

export default nextConfig
