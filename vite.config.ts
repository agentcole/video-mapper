import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user reloads (see
      // UpdatePrompt) — never an automatic reload in the middle of a show.
      // Registration happens only through the virtual:pwa-register module.
      registerType: 'prompt',
      includeAssets: ['videomapper.svg', '/*.svg'],
      manifest: {
        name: 'Video Mapper',
        short_name: 'VideoMapper',
        description: 'A high-performance web-based video mapping application',
        theme_color: '#1e293b',
        background_color: '#1e293b',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        categories: ['productivity', 'multimedia', 'utilities'],
        icons: [
          {
            src: 'videomapper.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ],
        shortcuts: [
          {
            name: 'New Project',
            short_name: 'New',
            description: 'Create a new video mapping project',
            url: '/',
            icons: [{ src: 'videomapper.svg', sizes: 'any' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(?:mp4|webm|ogg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'video-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
