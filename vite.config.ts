import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Installable + offline: the game is 100% client-side (localStorage saves),
    // so precaching the bundle makes it fully playable with no connection.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Retro Gaffer',
        short_name: 'Retro Gaffer',
        description: 'Retro football auto-battler — draft, build chemistry, climb the pyramid.',
        theme_color: '#0a1f12',
        background_color: '#06140c',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        // Google Fonts stylesheets/woffs cache at runtime for offline type.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the bundle so vendor libs and the player database cache
        // independently of app code (and no single >500KB chunk).
        manualChunks(id) {
          if (id.includes('players.json')) return 'players-data';
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@dnd-kit')) return 'vendor-dnd';
            if (id.includes('/react') || id.includes('react-dom') || id.includes('scheduler'))
              return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
});
