// Sprint 7 — États partagés (chargement / vide / erreur), Phase 2.
// Composants purement présentationnels : aucune logique métier, aucune
// donnée fabriquée. Réutilisés par la liste et le dossier d'opportunité
// pour éviter toute duplication de markup.

import { AlertTriangle, Inbox, Loader2, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[hsl(217,4%,46%)]">
      <Loader2 size={28} className="animate-spin text-brand-primary" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
        <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
      </div>
      <p className="text-sm font-semibold text-brand-navy dark:text-white">Une erreur est survenue</p>
      <p className="text-sm text-[hsl(217,4%,46%)] max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-1">
          Réessayer
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
      <div className="h-12 w-12 rounded-full bg-brand-neutral dark:bg-white/5 flex items-center justify-center">
        <Icon size={22} className="text-[hsl(217,4%,55%)]" />
      </div>
      <p className="text-sm font-semibold text-brand-navy dark:text-white">{title}</p>
      {description && <p className="text-sm text-[hsl(217,4%,46%)] max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
