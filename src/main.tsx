import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { listenForInstallPrompt } from './pwa/install.ts'
import { registerServiceWorker } from './pwa/register.ts'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('index.html has no #root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The event that lets the game install itself can come before the first screen is drawn. In
// `pnpm dev` there is no service worker: the build makes it.
listenForInstallPrompt()
if (import.meta.env.PROD && 'serviceWorker' in navigator) registerServiceWorker()
