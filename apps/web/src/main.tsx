import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA service worker via vite-plugin-pwa
// This handles both development and production environments
const updateSW = registerSW({
  onNeedRefresh() {
    // When a new version is available, auto-update
    updateSW(true)
  },
  onOfflineReady() {
    // App is ready to work offline
  },
})
