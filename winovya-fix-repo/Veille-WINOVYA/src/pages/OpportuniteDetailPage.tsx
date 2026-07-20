// Sprint 7 — Dossier d'opportunité (Phase 4/5). Page produit principale :
// assemble exclusivement des services déjà existants
// (createOpportuniteQueryService() Sprint 5, createOpportuniteCommercialService()
// Sprint 6) — aucune règle métier, aucun accès direct à Supabase pour les
// données d'opportunité. `commercialService`/`queryService` sont créés une
// seule fois (hors composant) et réutilisés, comme sur la page liste.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Calendar, Coins, Lightbulb, MapPin } from 'lucide-react'
import { createOpportuniteQueryService } from '../lib/opportunities/query'
import { createOpportuniteCommercialService } from '../lib/opportunities/commercial'
import { canModify as canModifyStatut } from '../lib/opportunities/commercial/lifecycle'
import type { OpportuniteDetailDto } from '../lib/opportunities/query/types'
import { useAuth } from '../contexts/AuthContext'
import {
  ConfianceBadge,
  EnrichissementBadge,
  StatutCommercialBadge,
} from '../components/opportunites/Badges'
import { StatusControl } from '../components/opportunites/StatusControl'
import { AssignmentControl } from '../components/opportunites/AssignmentControl'
import { NotesPanel } from '../components/opportunites/NotesPanel'
import { ActivityTimeline } from '../components/opportunites/ActivityTimeline'
import { AlertesLieesPanel, ChronologiePanel, DecideursPanel, PreuvesPanel } from '../components/opportunites/DossierPanels'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { formatDate, formatMontant } from '../lib/opportunities/uiHelpers'
import { translateError } from '../lib/opportunities/errorMessages'
import { logDevError } from '../lib/opportunities/devLog'

const PHASE_LABELS: Record<string, string> = {
  INTENTION: 'Intention',
  ETUDE: 'Étude',
  FONCIER: 'Foncier',
  AUTORISATION: 'Autorisation',
  RECRUTEMENT: 'Recrutement',
  CONSULTATION: 'Consultation',
  ANNONCE: 'Annonce',
  APPEL_OFFRES: "Appel d'offres",
}

const queryService = createOpportuniteQueryService()
const commercialService = createOpportuniteCommercialService()

export function OpportuniteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [dossier, setDossier] = useState<OpportuniteDetailDto | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(() => {
    if (!id) return
    setError(null)
    queryService
      .getDossier(id)
      .then((d) => setDossier(d))
      .catch((e) => {
        logDevError({ screen: 'OpportuniteDetailPage', operation: 'getDossier' }, e)
        setError(translateError(e, 'Le chargement du dossier a échoué.'))
      })
  }, [id])

  useEffect(() => {
    setDossier(undefined)
    load()
  }, [load])

  const bumpActivity = useCallback(() => {
    setRefreshKey((k) => k + 1)
    load()
  }, [load])

  const modifiable = useMemo(() => (dossier ? canModifyStatut(dossier.statutOpportunite) : false), [dossier])

  if (!id) {
    return <ErrorState message="Identifiant d'opportunité manquant." />
  }

  if (dossier === undefined) {
    return <LoadingState label="Chargement du dossier…" />
  }

  if (error) {
    return <ErrorState message={error} onRetry={load} />
  }

  if (dossier === null) {
    return (
      <EmptyState
        title="Opportunité introuvable"
        description="Ce dossier n'existe pas ou plus."
        action={
          <button onClick={() => navigate('/dashboard/opportunites')} className="btn-secondary text-sm">
            Retour à la liste
          </button>
        }
      />
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <Link
        to="/dashboard/opportunites"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(217,4%,46%)] hover:text-brand-primary"
      >
        <ArrowLeft size={14} /> Retour aux opportunités
      </Link>

      <div className="card-winovya p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-heading text-brand-navy dark:text-white break-words">{dossier.titre}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-[hsl(217,4%,46%)]">
              <span className="flex items-center gap-1">
                <Building2 size={13} /> {dossier.classification.entiteCible || 'Entité non identifiée'}
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {dossier.classification.geographie || 'Géographie non identifiée'}
              </span>
              <span className="flex items-center gap-1 font-medium text-brand-navy dark:text-gray-200">
                <Coins size={13} /> {dossier.budget.identifie !== null ? formatMontant(dossier.budget.identifie) : 'Budget non identifié'}
              </span>
              {dossier.classification.phaseProjet && (
                <span>{PHASE_LABELS[dossier.classification.phaseProjet] ?? dossier.classification.phaseProjet}</span>
              )}
            </div>
            {(dossier.enrichissement.statut === 'pending' || dossier.enrichissement.statut === 'partial') && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-2.5 py-1.5 inline-block">
                Enrichissement en cours : certaines informations peuvent encore évoluer.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ConfianceBadge niveau={dossier.confiance} />
            <EnrichissementBadge statut={dossier.enrichissement.statut} />
            <StatutCommercialBadge statut={dossier.statutOpportunite} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <StatusControl
            opportuniteId={dossier.id}
            current={dossier.statutOpportunite}
            commercialService={commercialService}
            disabled={!modifiable}
            isAdmin={isAdmin}
            onChanged={(next) => {
              setDossier((prev) => (prev ? { ...prev, statutOpportunite: next } : prev))
              bumpActivity()
            }}
          />
          <AssignmentControl
            opportuniteId={dossier.id}
            commercialService={commercialService}
            isAdmin={isAdmin}
            currentUserId={profile?.id ?? null}
            disabled={!modifiable}
            refreshKey={refreshKey}
            onChanged={bumpActivity}
          />
        </div>

        <div className="mt-5 pt-5 border-t border-[hsl(217,6%,90%)] dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5">Résumé métier</p>
          <p className="text-sm text-brand-navy dark:text-gray-200 leading-relaxed">
            {dossier.resumeMetier || 'Aucun résumé disponible pour le moment.'}
          </p>
        </div>

        <div className="mt-5 pt-5 border-t border-[hsl(217,6%,90%)] dark:border-white/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-2 flex items-center gap-1.5">
            <Lightbulb size={13} /> Pourquoi cette opportunité
          </p>
          {dossier.enrichissement.raisons.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {dossier.enrichissement.raisons.map((r, i) => (
                <li key={i} className="text-sm text-brand-navy dark:text-gray-200">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[hsl(217,4%,46%)]">Aucune justification disponible pour le moment.</p>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-[hsl(217,6%,90%)] dark:border-white/10 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[hsl(217,4%,55%)]">
          <span className="flex items-center gap-1">
            <Calendar size={12} /> Créée le {formatDate(dossier.createdAt)}
          </span>
          <span>Dernier signal le {formatDate(dossier.signaux.dateDernier)}</span>
          <span>{dossier.signaux.nombre} signal(aux)</span>
          <span>{dossier.compteurs.preuves} preuve(s)</span>
          <span>{dossier.compteurs.decideurs} décideur(s)</span>
          <span>Consolidé le {formatDate(dossier.enrichissement.derniereConsolidationAt)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <AlertesLieesPanel opportuniteId={dossier.id} queryService={queryService} />
        <PreuvesPanel opportuniteId={dossier.id} queryService={queryService} />
        <DecideursPanel opportuniteId={dossier.id} queryService={queryService} />
        <ChronologiePanel opportuniteId={dossier.id} queryService={queryService} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <NotesPanel
          opportuniteId={dossier.id}
          commercialService={commercialService}
          currentUserId={profile?.id ?? null}
          isAdmin={isAdmin}
          canModify={modifiable}
          onActivity={bumpActivity}
        />
        <ActivityTimeline opportuniteId={dossier.id} commercialService={commercialService} refreshKey={refreshKey} />
      </div>
    </div>
  )
}
