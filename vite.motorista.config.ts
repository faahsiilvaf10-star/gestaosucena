import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Plugin para garantir que o dist-motorista sempre tenha index.html
const copyToIndexHtmlPlugin = () => ({
  name: 'copy-to-index-html',
  closeBundle() {
    const src = path.resolve(import.meta.dirname, 'dist-motorista/index-motorista.html')
    const dest = path.resolve(import.meta.dirname, 'dist-motorista/index.html')
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log('✓ Copiado index-motorista.html -> dist-motorista/index.html com sucesso!')
    }
  }
})

// Build config separado para gerar o APK do App Motorista
// sem dependência do servidor (funciona 100% offline no dispositivo)
export default defineConfig({
  root: '.',
  base: './',
  plugins: [
    tailwindcss(),
    react(),
    copyToIndexHtmlPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2,ttf,otf}'],
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
            // Assets externos e locais — Cache First
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
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
