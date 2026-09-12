import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.tsx'

// Error logging only: tracesSampleRate stays 0 and no tracing/replay
// integrations are added. If VITE_SENTRY_DSN is unset (local dev before a real
// DSN exists), Sentry.init creates a disabled no-op client.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0,
})

const queryClient = new QueryClient()

const root = createRoot(document.getElementById('root')!, {
  // onCaughtError is deliberately not wired here to avoid double-reporting
  // errors already captured by the ErrorBoundary below.
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
})

root.render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
