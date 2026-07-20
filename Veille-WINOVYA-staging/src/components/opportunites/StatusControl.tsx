// Sprint 7 — Contrôle de changement de statut commercial (Phase 5).
// Réutilise les règles PURES du Sprint 6 (lifecycle.ts, jamais
// recopiées) pour ne proposer que les transitions valides, puis délègue
// l'écriture à CommercialService.changeStatut (Sprint 6, inchangé).

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { LIFECYCLE_STATES, isValidTransition, type CommercialService } from '../../lib/opportunities/commercial'
import type { StatutOpportunite } from '../../lib/opportunities/commercial/types'
import { STATUT_COMMERCIAL_LABELS, statutCommercialStyle } from '../../lib/opportunities/uiHelpers'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'

export function StatusControl({
  opportuniteId,
  current,
  commercialService,
  disabled,
  isAdmin,
  onChanged,
}: {
  opportuniteId: string
  current: string
  commercialService: CommercialService
  disabled: boolean
  /** Seul un admin peut écrire sur `opportunites` (policy RLS "admin write
   * opportunites", Sprint 1, inchangée — voir docs/opportunity-commercial-domain.md §84-85).
   * Un non-admin voit le statut en lecture seule plutôt que de tenter une
   * écriture systématiquement bloquée par la RLS. */
  isAdmin: boolean
  onChanged: (next: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = LIFECYCLE_STATES.filter((s) => isValidTransition(current, s))

  async function handleChange(next: StatutOpportunite) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await commercialService.changeStatut(opportuniteId, next)
      onChanged(result.to)
    } catch (e) {
      logDevError({ screen: 'StatusControl', operation: 'changeStatut' }, e)
      setError(translateError(e, 'Le changement de statut a échoué.'))
    } finally {
      setBusy(false)
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5">Statut</p>
        <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md border ${statutCommercialStyle(current)}`}>
          {STATUT_COMMERCIAL_LABELS[current as StatutOpportunite] ?? current}
        </span>
        <p className="text-[11px] text-[hsl(217,4%,60%)] mt-1">Seul un administrateur peut changer le statut.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5">Statut</p>
      <div className="flex items-center gap-2">
        <select
          value=""
          aria-label="Changer le statut de l'opportunité"
          disabled={disabled || busy || options.length === 0}
          onChange={(e) => e.target.value && handleChange(e.target.value as StatutOpportunite)}
          className={`text-xs font-semibold px-2 py-1.5 rounded-md border cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none ${statutCommercialStyle(current)}`}
        >
          <option value="" disabled>
            {busy ? 'Mise à jour…' : options.length === 0 ? 'Aucune transition possible' : 'Changer le statut…'}
          </option>
          {options.map((s) => (
            <option key={s} value={s}>
              → {STATUT_COMMERCIAL_LABELS[s]}
            </option>
          ))}
        </select>
        {busy && <Loader2 size={14} className="animate-spin text-brand-primary" />}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}
