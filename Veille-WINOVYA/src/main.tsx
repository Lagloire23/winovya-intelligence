import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { assertEnvironmentIsolation } from './lib/env'

// Garde-fou : bloque le démarrage si l'environnement déclaré (VITE_APP_ENV)
// et le projet Supabase réellement ciblé (VITE_SUPABASE_URL) sont
// incohérents (ex. build "staging" pointant vers Supabase production).
assertEnvironmentIsolation(import.meta.env.VITE_APP_ENV, import.meta.env.VITE_SUPABASE_URL)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
