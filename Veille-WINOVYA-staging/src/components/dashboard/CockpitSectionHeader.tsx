// Sprint 9 — En-tête de section réutilisé par toutes les sous-sections
// du cockpit (admin et utilisateur). Purement présentationnel, réutilise
// la typographie existante (font-heading, brand-navy) — aucune nouvelle
// police, aucune nouvelle couleur.
import type { ReactNode } from 'react'

export function CockpitSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h2 className="text-base font-heading font-bold text-brand-navy dark:text-white">{title}</h2>
        {subtitle && <p className="text-xs text-[hsl(217,4%,46%)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
