import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto', // Forza l'attivazione della PWA
      workbox: {
        globPatterns: ['**/*.{js,css,html,jpg,jpeg,png,svg,ico}'] // Dice alla PWA di scaricare il tuo JPG
      },
      manifest: {
        name: 'ChallengerHouse',
        short_name: 'Challenger',
        description: 'Algoritmo predittivo per affitti brevi',
        theme_color: '#1e40af', 
        background_color: '#f8fafc',
        display: 'standalone', 
        icons: [
          {
            src: 'casa_soldi_icon.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
            purpose: 'any maskable' // Cruciale per Android
          },
          {
            src: 'casa_soldi_icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable' // Cruciale per Android
          }
        ]
      }
    })
  ]
})