import { withCloudflare } from '@cloudflare/next-on-pages';

export default withCloudflare({
  reactStrictMode: true,
  experimental: {
    appDir: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || ''
  }
});
