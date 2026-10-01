import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/postcss'
import cascadeLayers from '@csstools/postcss-cascade-layers'
import path from 'path'
import { browserslistToTargets } from 'lightningcss'
import browserslist from 'browserslist'

// Build config separado para gerar o APK do App Motorista
// sem dependência do servidor (funciona offline)
export default defineConfig({
  root: '.',
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\.supabase\.co/],
        runtimeCaching: [
          {
            // Supabase API — Network First (tenta online, cai para cache)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Assets externos — Cache First
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'App Motorista - Gestão Sucena',
        short_name: 'Motorista',
        description: 'App operacional para motoristas da frota Sucena',
        theme_color: '#10b981',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '.',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@tanstack/react-start': path.resolve(import.meta.dirname, './src/lib/dummy-start.ts'),
    }
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        cascadeLayers()
      ]
    }
  },
  build: {
    target: 'es2020',
    minify: false,
    cssMinify: 'lightningcss',
    modulePreload: false,
    outDir: 'dist-motorista',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: 'index-motorista.html' },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    }
  }
})
