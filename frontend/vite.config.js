import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}']
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
            src: 'casa_soldi_icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'casa_soldi_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})