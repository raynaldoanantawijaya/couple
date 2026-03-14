import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raynaldo.synergy',
  appName: 'Our Space',
  webDir: 'out',
  server: {
    url: 'https://couple-production-7128.up.railway.app', // Using previous known production URL if exists, or local IP for testing. Next.js SSR apps must be hosted.
    cleartext: true
  }
};

export default config;
