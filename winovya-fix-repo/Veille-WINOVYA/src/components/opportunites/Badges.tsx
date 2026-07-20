// Sprint 7 — Badges de présentation (statut commercial, confiance,
// enrichissement, fiabilité budget). Purement cosmétique : affiche des
// valeurs déjà calculées par le backend (Sprint 4/5/6), ne recalcule
// jamais rien.

import type { NiveauConfiance, StatutEnrichissement, BudgetFiabilite } from '../../lib/opportunities/query/types'
import {
  CONFIANCE_BADGE_STYLE,
  ENRICHISSEMENT_BADGE_STYLE,
  ENRICHISSEMENT_LABELS,
  statutCommercialLabel,
  statutCommercialStyle,
} from '../../lib/opportunities/uiHelpers'

const BASE = 'inline-flex items-center whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-md border'

export function StatutCommercialBadge({ statut }: { statut: string }) {
  return <span className={`${BASE} ${statutCommercialStyle(statut)}`}>{statutCommercialLabel(statut)}</span>
}

export function ConfianceBadge({ niveau }: { niveau: NiveauConfiance | null }) {
  if (!niveau) {
    return (
      <span className={`${BASE} bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:text-gray-500 dark:border-white/10`}>
        Non évalué
      </span>
    )
  }
  return <span className={`${BASE} ${CONFIANCE_BADGE_STYLE[niveau]}`}>{niveau}</span>
}

export function EnrichissementBadge({ statut }: { statut: StatutEnrichissement }) {
  return <span className={`${BASE} ${ENRICHISSEMENT_BADGE_STYLE[statut]}`}>{ENRICHISSEMENT_LABELS[statut]}</span>
}

const BUDGET_FIABILITE_STYLE: Record<BudgetFiabilite, string> = {
  Officiel: 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/20',
  Probable: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  'À vérifier': 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
}

export function BudgetFiabiliteBadge({ fiabilite }: { fiabilite: BudgetFiabilite | null }) {
  if (!fiabilite) return null
  return <span className={`${BASE} ${BUDGET_FIABILITE_STYLE[fiabilite]}`}>{fiabilite}</span>
}
