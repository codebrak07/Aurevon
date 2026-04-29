import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['aurevon.ico', 'aurevon.png', 'aurevon.jpg'],
      manifest: {
        name: 'Aurevon - AI Music Player',
        short_name: 'Aurevon',
        description: 'AI-powered music player and discovery platform',
        theme_color: '#06060a',
        background_color: '#0e0e0e',
        display: 'standalone',
        icons: [
          {
            src: 'aurevon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'aurevon.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'aurevon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: 'localhost',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/api/spotify-token': {
        target: 'https://accounts.spotify.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/spotify-token/, '/api/token')
      }
    }
  }
})
