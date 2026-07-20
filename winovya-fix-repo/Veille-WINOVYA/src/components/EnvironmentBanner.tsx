/**
 * Bandeau visuel permanent affiché uniquement sur les environnements non
 * productifs (staging, development), pour qu'il soit impossible de
 * confondre un environnement de recette avec la production. N'affiche
 * jamais rien si VITE_APP_ENV=production (ou absent, par sécurité — voir
 * assertEnvironmentIsolation qui bloque de toute façon ce cas au démarrage).
 */
export function EnvironmentBanner() {
  const env = (import.meta.env.VITE_APP_ENV || '').trim().toLowerCase()

  if (env === 'production' || env === '') return null

  const label = env === 'staging' ? 'STAGING' : 'DEVELOPMENT'

  return (
    <div
      role="banner"
      aria-label={`Environnement ${label}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#facc15',
        color: '#111827',
        textAlign: 'center',
        fontWeight: 800,
        fontSize: '12px',
        letterSpacing: '0.15em',
        padding: '4px 0',
        pointerEvents: 'none',
      }}
    >
      {label} — CECI N'EST PAS LA PRODUCTION
    </div>
  )
}
