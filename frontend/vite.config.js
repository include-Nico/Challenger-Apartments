import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
            type: 'image/jpeg'
          },
          {
            src: 'casa_soldi_icon.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ]
})