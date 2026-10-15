import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OutputApp } from './output/OutputApp.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { OUTPUT_QUERY_PARAM } from './output/protocol.ts'

// The service worker is registered by <UpdatePrompt /> (vite-plugin-pwa).
// `?output` opens the projector output instead of the editor.
const isOutputWindow = new URLSearchParams(window.location.search).has(OUTPUT_QUERY_PARAM)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOutputWindow ? (
      <ErrorBoundary>
        <OutputApp />
      </ErrorBoundary>
    ) : (
      <App />
    )}
  </StrictMode>,
)
