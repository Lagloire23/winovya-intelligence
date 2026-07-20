// Sprint 7 — Panneaux de lecture du dossier (Phase 4) : alertes liées,
// preuves, décideurs, chronologie. Toutes les données viennent
// exclusivement de createOpportuniteQueryService() (Sprint 5) — lecture
// seule, aucune action, aucune règle recalculée.
//
// Sprint 8 (Phase 4) : chaque panneau gère désormais explicitement son
// état d'erreur réseau/RLS (auparavant absent — une promesse rejetée
// laissait le panneau bloqué sur "Chargement…" sans retour utilisateur,
// voir audit Phase 1).

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FileText, GitCommitVertical, Users2 } from 'lucide-react'
import type { OpportuniteQueryService } from '../../lib/opportunities/query'
import type {
  AlerteLieeDto,
  ChronologieEntryDto,
  DecideurLieDto,
  PreuveDto,
} from '../../lib/opportunities/query/types'
import { LinkedinLink } from '../LinkedinLink'
import { formatDate, formatMontant } from '../../lib/opportunities/uiHelpers'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'
import { EmptyState, ErrorState } from '../common/States'

interface BaseProps {
  opportuniteId: string
  queryService: OpportuniteQueryService
}

export function AlertesLieesPanel({ opportuniteId, queryService }: BaseProps) {
  const [alertes, setAlertes] = useState<AlerteLieeDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    queryService
      .getAlertesLiees(opportuniteId)
      .then((list) => {
        if (!cancelled) setAlertes(list)
      })
      .catch((e) => {
        logDevError({ screen: 'AlertesLieesPanel', operation: 'getAlertesLiees' }, e)
        if (!cancelled) setError(translateError(e, 'Le chargement des alertes liées a échoué.'))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, queryService])

  useEffect(() => load(), [load])

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <FileText size={15} className="text-brand-primary" /> Alertes liées
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : alertes === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : alertes.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune alerte liée" />
      ) : (
        <ul className="space-y-3">
          {alertes.map((a) => (
            <li key={a.id} className="border border-[hsl(217,6%,90%)] dark:border-white/10 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-brand-navy dark:text-white">{a.titre}</p>
                {a.lienSourceUrl && (
                  <a href={a.lienSourceUrl} target="_blank" rel="noopener noreferrer" className="text-[hsl(217,4%,55%)] hover:text-brand-primary shrink-0" aria-label="Ouvrir la source de l'alerte">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[hsl(217,4%,46%)]">
                <span>{formatDate(a.dateDetection)}</span>
                <span>{a.categorieVeille || 'Catégorie non précisée'}</span>
                <span className="font-medium text-brand-navy dark:text-gray-200">{a.montant !== null ? formatMontant(a.montant) : 'Montant non identifié'}</span>
                {a.referenceOfficielle && <span>Réf. {a.referenceOfficielle}</span>}
              </div>
              <p className="text-xs text-[hsl(217,4%,46%)] mt-2 line-clamp-2">{a.resume || 'Aucun résumé disponible.'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PreuvesPanel({ opportuniteId, queryService }: BaseProps) {
  const [preuves, setPreuves] = useState<PreuveDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    queryService
      .getPreuves(opportuniteId)
      .then((list) => {
        if (!cancelled) setPreuves(list)
      })
      .catch((e) => {
        logDevError({ screen: 'PreuvesPanel', operation: 'getPreuves' }, e)
        if (!cancelled) setError(translateError(e, 'Le chargement des preuves a échoué.'))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, queryService])

  useEffect(() => load(), [load])

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <FileText size={15} className="text-brand-primary" /> Preuves
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : preuves === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : preuves.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune preuve enregistrée" />
      ) : (
        <ul className="space-y-3">
          {preuves.map((p) => (
            <li key={p.id} className="border border-[hsl(217,6%,90%)] dark:border-white/10 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-brand-navy dark:text-white">{p.source ?? 'Source non précisée'}</p>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(217,4%,55%)] hover:text-brand-primary shrink-0" aria-label="Ouvrir la preuve">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p className="text-xs text-[hsl(217,4%,46%)] italic mt-1">{p.citation ? `« ${p.citation} »` : 'Aucune citation disponible.'}</p>
              <p className="text-[11px] text-[hsl(217,4%,55%)] mt-2">{formatDate(p.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DecideursPanel({ opportuniteId, queryService }: BaseProps) {
  const [decideurs, setDecideurs] = useState<DecideurLieDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    queryService
      .getDecideursLies(opportuniteId)
      .then((list) => {
        if (!cancelled) setDecideurs(list)
      })
      .catch((e) => {
        logDevError({ screen: 'DecideursPanel', operation: 'getDecideursLies' }, e)
        if (!cancelled) setError(translateError(e, 'Le chargement des décideurs a échoué.'))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, queryService])

  useEffect(() => load(), [load])

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <Users2 size={15} className="text-brand-primary" /> Décideurs
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : decideurs === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : decideurs.length === 0 ? (
        <EmptyState icon={Users2} title="Aucun décideur rattaché" />
      ) : (
        <ul className="space-y-3">
          {decideurs.map((d) => {
            const nom = [d.prenomPersonne, d.nomPersonne].filter(Boolean).join(' ') || d.nom || 'Décideur'
            return (
              <li key={d.id} className="border border-[hsl(217,6%,90%)] dark:border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-navy dark:text-white">{nom}</p>
                  {d.linkedin && <LinkedinLink url={d.linkedin} />}
                </div>
                <p className="text-xs text-[hsl(217,4%,46%)]">{d.fonctionPoste || 'Fonction non précisée'}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[hsl(217,4%,46%)]">
                  {d.email && <span>{d.email}</span>}
                  {d.telephone && <span>{d.telephone}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const CHRONOLOGIE_ICON = {
  signal: FileText,
  preuve: FileText,
  decideur_lie: Users2,
} as const

export function ChronologiePanel({ opportuniteId, queryService }: BaseProps) {
  const [entries, setEntries] = useState<ChronologieEntryDto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    queryService
      .getChronologie(opportuniteId)
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((e) => {
        logDevError({ screen: 'ChronologiePanel', operation: 'getChronologie' }, e)
        if (!cancelled) setError(translateError(e, 'Le chargement de la chronologie a échoué.'))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, queryService])

  useEffect(() => load(), [load])

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-4 flex items-center gap-2">
        <GitCommitVertical size={15} className="text-brand-primary" /> Chronologie
      </h2>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={GitCommitVertical} title="Aucun événement chronologique" />
      ) : (
        <ol className="relative border-l border-[hsl(217,6%,90%)] dark:border-white/10 pl-4 space-y-3">
          {entries.map((e, i) => {
            const Icon = CHRONOLOGIE_ICON[e.type]
            return (
              <li key={`${e.refId}-${i}`} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand-primary" />
                <p className="text-sm text-brand-navy dark:text-white flex items-center gap-1.5">
                  <Icon size={13} className="text-[hsl(217,4%,55%)]" />
                  {e.label}
                </p>
                <p className="text-[11px] text-[hsl(217,4%,55%)]">{formatDate(e.date)}</p>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
