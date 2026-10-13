/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use JavaScript only — no TypeScript
  // Configure allowed image domains if needed
  images: {
    remotePatterns: [],
  },

  // Expose server-only env validation at startup
  serverExternalPackages: ['bcryptjs', 'nodemailer', 'bullmq', 'ioredis', 'mammoth', 'xlsx'],

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

export default nextConfig;
