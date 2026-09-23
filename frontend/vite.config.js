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
        theme_color: '#1e40af', /* Il blu del tuo header */
        background_color: '#f8fafc',
        display: 'standalone', /* Questo fa sparire la barra degli indirizzi di Safari/Chrome! */
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})