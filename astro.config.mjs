// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    // Allow dev-server previews via tunnels (cloudflared, ngrok, etc.)
    // Safe for dev only — production is a static build, this setting is ignored.
    server: {
      host: true,
      allowedHosts: true,
    },
  },

  adapter: cloudflare(),
});