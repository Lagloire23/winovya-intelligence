// Sprint 7 — Journal d'activité (Phase 4). Lecture seule : le journal
// n'est alimenté que par les triggers SQL du Sprint 6 (jamais par le
// Frontend). Consomme CommercialService.getActivityLog (Sprint 6).
//
// Sprint 8 (Phase 4) : gère désormais explicitement l'échec réseau/RLS
// (auparavant absent, voir audit Phase 1 — DossierPanels.tsx avait la
// même lacune).

import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import type { CommercialService } from '../../lib/opportunities/commercial'
import type { ActivityLogEntryDto } from '../../lib/opportunities/commercial/types'
import { ACTIVITY_EVENT_LABELS, formatRelative } from '../../lib/opportunities/uiHelpers'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'
import { EmptyState, ErrorState } from '../common/States'

function describeDetails(entry: ActivityLogEntryDto): string | null {
  const d = entry.details
  if (entry.eventType === 'status_changed' && typeof d.from === 'string' && typeof d.to === 'string') {
    return `${d.from} → ${d.to}`
  }
  return null
}

export function ActivityTimeline({
  opportuniteId,
  commercialService,
  refreshKey,
}: {
  opportuniteId: string
  commercialService: CommercialService
  refreshKey: number
}) {
  const [entries, setEntries] = useState<ActivityLogEntryDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    commercialService
      .getActivityLog(opportuniteId)
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((e) => {
        logDevError({ screen: 'ActivityTimeline', operation: 'getActivityLog' }, e)
        if (!cancelled) setError(translateError(e, "Le chargement de l'historique a échoué."))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, commercialService, refreshKey])

  useEffect(() => load(), [load])

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <History size={15} className="text-brand-primary" /> Historique
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="Aucun événement enregistré" />
      ) : (
        <ol className="relative border-l border-[hsl(217,6%,90%)] dark:border-white/10 pl-4 space-y-4">
          {entries.map((entry) => {
            const detail = describeDetails(entry)
            return (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-primary" />
                <p className="text-sm font-medium text-brand-navy dark:text-white">
                  {ACTIVITY_EVENT_LABELS[entry.eventType] ?? entry.eventType}
                </p>
                {detail && <p className="text-xs text-[hsl(217,4%,46%)]">{detail}</p>}
                <p className="text-[11px] text-[hsl(217,4%,55%)]">{formatRelative(entry.createdAt)}</p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
