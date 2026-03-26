/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  basePath: '/admin',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
    ],
    unoptimized: true,
  },
};

module.exports = nextConfig;
