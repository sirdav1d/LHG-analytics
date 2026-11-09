/** @type {import('next').NextConfig} */
const nextConfig = {
	cacheComponents: true,
	partialPrefetching: true,
  cacheLife: {
    dashboard: {
      stale: 30,
      revalidate: 30,
      expire: 300,
    },
    dashboard_historical: {
      stale: 300,
      revalidate: 900,
      expire: 86400,
    },
    dashboard_fast: {
      stale: 30,
      revalidate: 10,
      expire: 60,
    },
    dashboard_session: {
      stale: 900,
      revalidate: 900,
      expire: 1800,
    },
  },
  images: {
    // Uma entrada por host (com "||" só o primeiro valia).
    remotePatterns: [
      { hostname: 'cloudflare-ipfs.com' },
      { hostname: 'avatars.githubusercontent.com' },
    ],
  },
  // Cabeçalhos de segurança básicos. Sem CSP de script por enquanto: a página
  // de logout usa um script inline (api/session/logout) e precisaria de hash.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
