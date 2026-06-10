import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
