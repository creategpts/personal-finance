import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { Providers } from './providers.tsx'

// apply saved theme before first paint (no flash) — dark by default
if (localStorage.theme !== 'light') document.documentElement.classList.add('dark')

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Providers>
          <App />
        </Providers>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
