import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Mesa - Gestão de Restaurante',
        short_name: 'Mesa',
        description: 'Pedidos à mesa, cozinha em tempo real e fecho de contas.',
        lang: 'pt-PT',
        dir: 'ltr',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#faf7f2',
        theme_color: '#1d3f63',
        categories: ['food', 'business', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // The menu is the one thing a tablet must still render with
            // the network down, so it is served from cache first.
            urlPattern: /\/api\/menu/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mesa-menu',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Live state must never be served stale, but a cached copy is
            // better than a blank screen while the LAN comes back.
            urlPattern: /\/api\/(tables|sessions|bills|kds|reports)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mesa-live',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true, // reachable from tablets on the same LAN
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET.replace('http', 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
