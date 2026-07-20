// Sprint 7 — Dossier d'opportunité. Sprint 11C : refonte en 4 zones
// (en-tête / analyse métier / fil chronologique unifié / informations
// commerciales). Sprint 11C.1 : refonte UX "cockpit de décision
// commerciale" — sprint exclusivement frontend (brief §12) : aucune
// nouvelle donnée, aucun nouveau calcul, aucune migration. On
// réorganise uniquement les informations déjà disponibles, dans l'ordre
// imposé par le brief §9 : en-tête → pourquoi cette opportunité mérite
// votre attention → pourquoi elle est pertinente pour votre entreprise
// → timeline des signaux → décideurs → notes → historique. Notes et
// historique passent en blocs secondaires repliables (brief §6-7) pour
// réduire fortement la hauteur de page (brief §10). Assemble
// exclusivement des services déjà existants (createOpportuniteQueryService()
// Sprint 5, createOpportuniteCommercialService() Sprint 6,
// createAlerteRetraitService() Sprint 11B) — aucune règle métier, aucun
// accès direct à Supabase.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Building2, Coins, MapPin } from 'lucide-react'
import { createOpportuniteQueryService } from '../lib/opportunities/query'
import { createOpportuniteCommercialService } from '../lib/opportunities/commercial'
import { createAlerteRetraitService } from '../lib/opportunities/alerteRetrait'
import { canModify as canModifyStatut } from '../lib/opportunities/commercial/lifecycle'
import type { OpportuniteDetailDto } from '../lib/opportunities/query/types'
import { useAuth } from '../contexts/AuthContext'
import { ConfianceBadge, EnrichissementBadge, StatutCommercialBadge } from '../components/opportunites/Badges'
import { StatusControl } from '../components/opportunites/StatusControl'
import { AssignmentControl } from '../components/opportunites/AssignmentControl'
import { NotesPanel } from '../components/opportunites/NotesPanel'
import { ActivityTimeline } from '../components/opportunites/ActivityTimeline'
import { AnalyseMetierPanel } from '../components/opportunites/AnalyseMetierPanel'
import { PertinenceEntreprisePanel } from '../components/opportunites/PertinenceEntreprisePanel'
import { DecideursPanel, SignauxEtAlertesPanel } from '../components/opportunites/DossierPanels'
import { EmptyState, ErrorState, LoadingState } from '../components/common/States'
import { formatDate, formatMontant, formatRelative } from '../lib/opportunities/uiHelpers'
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
const alerteRetraitService = createAlerteRetraitService()

/** Sprint 11C.1 — ligne de synthèse compacte sous le titre (brief §1) :
 * "3 signaux • 2 décideurs • 5 documents • Dernier signal il y a 2 jours".
 * Purement une reformulation d'affichage des compteurs déjà exposés par
 * OpportuniteDetailDto (aucun nouveau champ, aucun nouveau calcul). */
function LigneSynthese({ dossier }: { dossier: OpportuniteDetailDto }) {
  const parts = [
    `${dossier.signaux.nombre} signal${dossier.signaux.nombre > 1 ? 'aux' : ''}`,
    `${dossier.compteurs.decideurs} décideur${dossier.compteurs.decideurs > 1 ? 's' : ''}`,
    `${dossier.compteurs.preuves} document${dossier.compteurs.preuves > 1 ? 's' : ''}`,
    `Dernier signal ${formatRelative(dossier.signaux.dateDernier)}`,
  ]
  return <p className="text-xs text-[hsl(217,4%,46%)] mt-2">{parts.join(' • ')}</p>
}

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

  const nomEntreprise = dossier.classification.entiteCible || dossier.titre

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link
        to="/dashboard/opportunites"
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(217,4%,46%)] hover:text-brand-primary"
      >
        <ArrowLeft size={14} /> Retour aux opportunités
      </Link>

      {/* 1. En-tête (brief §1) : compact, ligne de synthèse unique, statut/assignation intégrés */}
      <div className="card-winovya p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-heading text-brand-navy dark:text-white break-words">{dossier.titre}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-[hsl(217,4%,46%)]">
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
                <span className="flex items-center gap-1">
                  <Briefcase size={13} /> {PHASE_LABELS[dossier.classification.phaseProjet] ?? dossier.classification.phaseProjet}
                </span>
              )}
            </div>
            <LigneSynthese dossier={dossier} />
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

        <div className="mt-4 pt-3 border-t border-[hsl(217,6%,90%)] dark:border-white/10 grid sm:grid-cols-2 gap-4">
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
      </div>

      {/* 2. Pourquoi cette opportunité mérite votre attention (brief §2) */}
      <AnalyseMetierPanel dossier={dossier} />

      {/* 3. Pourquoi cette opportunité est pertinente pour votre entreprise (brief §3) */}
      <PertinenceEntreprisePanel />

      {/* 4. Timeline des signaux (brief §4) */}
      <SignauxEtAlertesPanel
        opportuniteId={dossier.id}
        queryService={queryService}
        alerteRetraitService={alerteRetraitService}
        isAdmin={isAdmin}
        currentUserId={profile?.id ?? null}
        refreshKey={refreshKey}
        onChanged={bumpActivity}
        nombreDecideurs={dossier.compteurs.decideurs}
      />

      {/* 5. Décideurs (brief §8) */}
      <DecideursPanel opportuniteId={dossier.id} queryService={queryService} entreprise={nomEntreprise} />

      {/* 6. Notes — bloc secondaire discret, replié par défaut (brief §7) */}
      <details className="card-winovya p-5 group">
        <summary className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white cursor-pointer select-none list-none flex items-center justify-between">
          Notes internes
          <span className="text-xs font-normal normal-case text-[hsl(217,4%,55%)] group-open:hidden">Afficher</span>
          <span className="text-xs font-normal normal-case text-[hsl(217,4%,55%)] hidden group-open:inline">Masquer</span>
        </summary>
        <div className="mt-4">
          <NotesPanel
            opportuniteId={dossier.id}
            commercialService={commercialService}
            currentUserId={profile?.id ?? null}
            isAdmin={isAdmin}
            canModify={modifiable}
            onActivity={bumpActivity}
          />
        </div>
      </details>

      {/* 7. Historique — bloc secondaire, replié par défaut (brief §6) */}
      <details className="card-winovya p-5 group">
        <summary className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white cursor-pointer select-none list-none flex items-center justify-between">
          Historique
          <span className="text-xs font-normal normal-case text-[hsl(217,4%,55%)] group-open:hidden">Afficher</span>
          <span className="text-xs font-normal normal-case text-[hsl(217,4%,55%)] hidden group-open:inline">Masquer</span>
        </summary>
        <div className="mt-4">
          <ActivityTimeline opportuniteId={dossier.id} commercialService={commercialService} refreshKey={refreshKey} />
        </div>
      </details>
    </div>
  )
}
