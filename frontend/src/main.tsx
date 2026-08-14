import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { loadSettings } from './settings.ts'

// apply saved theme before first paint (no flash) — dark by default
if (localStorage.theme !== 'light') document.documentElement.classList.add('dark')

// fetch app name / user name / favicon (renders meanwhile)
loadSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
