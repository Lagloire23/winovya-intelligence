import type { ScorePertinence, StatutAlerte } from './types'

// Numeric score shown on cards, derived from the text enum (no numeric
// column exists in the DB — this mirrors the scale used in the legacy
// Airtable interface).
export const SCORE_NUMERIC: Record<ScorePertinence, number> = {
  'Très Haute': 9.5,
  Haute: 8.0,
  Moyenne: 6.0,
  Basse: 4.0,
  'À confirmer': 0,
}

export const SCORE_BADGE_STYLE: Record<ScorePertinence, string> = {
  'Très Haute': 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/20',
  Haute: 'bg-brand-green-light/15 text-brand-green-deep border-brand-green-light/30',
  Moyenne: 'bg-amber-50 text-amber-700 border-amber-200',
  Basse: 'bg-red-50 text-red-600 border-red-200',
  'À confirmer': 'bg-gray-100 text-gray-500 border-gray-200',
}

export const SCORE_KPI_STYLE: Record<ScorePertinence, string> = {
  'Très Haute': 'bg-brand-green-deep/10 text-brand-green-deep',
  Haute: 'bg-brand-green-light/15 text-brand-green-deep',
  Moyenne: 'bg-amber-50 text-amber-700',
  Basse: 'bg-red-50 text-red-600',
  'À confirmer': 'bg-gray-100 text-gray-500',
}

export const SCORE_ORDER: ScorePertinence[] = ['Très Haute', 'Haute', 'Moyenne', 'Basse', 'À confirmer']

// Couleur de fond distincte par statut d'alerte, utilisée sur le select de
// statut affiché sous le titre de chaque alerte.
export const STATUT_BADGE_STYLE: Record<StatutAlerte, string> = {
  NOUVEAU: 'bg-brand-green-light/20 text-brand-green-deep border-brand-green-light/40',
  ASSIGNE: 'bg-brand-primary/15 text-brand-primary border-brand-primary/40',
  TRAITE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  ARCHIVE: 'bg-gray-100 text-gray-500 border-gray-200',
}

export const CATEGORY_LABELS: Record<string, string> = {
  '7. ICPE': 'ICPE',
  '5. Marchés publics & renouvellements': 'Marchés publics',
  '2. Presse locale': 'Presse locale',
  '6. Délibérations': 'Délibérations',
  '3. Maîtrise foncière': 'Maîtrise foncière',
  '1. Documents administratifs': 'Documents administratifs',
  '9. Arrêtés préfectoraux': 'Arrêtés préfectoraux',
  '12. Budgets collectivités / investissements': 'Budgets collectivités',
}

export function formatDate(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('fr-FR')
  } catch {
    return d
  }
}

export function formatTime(d: string | null): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
