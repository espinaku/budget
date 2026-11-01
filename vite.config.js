import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로 빌드: GitHub Pages(/저장소이름/ 하위 경로)나 Cloudflare Pages(루트) 어디에 올려도 동작
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // 새 버전을 배포하면 다음 실행 때 자동으로 교체
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '가계부',
        short_name: '가계부',
        description: '이 기기에만 저장되는 개인 가계부',
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f5f6f8',
        theme_color: '#0f9d78',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
})
