import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OutputApp } from './output/OutputApp.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { OUTPUT_QUERY_PARAM } from './output/protocol.ts'
import { BenchmarkApp } from './benchmark/BenchmarkApp.tsx'
import { IsfCheckApp } from './effects/IsfCheckApp.tsx'

// The service worker is registered by <UpdatePrompt /> (vite-plugin-pwa).
// `?output` opens the projector output, `?benchmark` the video benchmark,
// `?isf-check` compiles every effect shader.
const params = new URLSearchParams(window.location.search)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {params.has(OUTPUT_QUERY_PARAM) ? (
      <ErrorBoundary>
        <OutputApp />
      </ErrorBoundary>
    ) : params.has('benchmark') ? (
      <BenchmarkApp />
    ) : params.has('isf-check') ? (
      <IsfCheckApp />
    ) : (
      <App />
    )}
  </StrictMode>,
)
