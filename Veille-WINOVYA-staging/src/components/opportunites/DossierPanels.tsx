// Sprint 7 — Panneaux de lecture du dossier (Phase 4). Sprint 11C :
// refonte complète — les anciens panneaux séparés "Alertes liées",
// "Alertes écartées", "Preuves" et "Chronologie" sont remplacés par un
// unique bloc "Signaux détectés" (SignauxEtAlertesPanel), consommant
// OpportuniteQueryService.getSignauxTimeline (Sprint 11C, pure
// composition des lectures existantes — aucune nouvelle règle métier).
//
// Sprint 8 (Phase 4) : chaque panneau gère explicitement son état
// d'erreur réseau/RLS.
//
// Sprint 11A/11B : rôle de corrélation et retrait/réintégration logique
// intégrés directement dans chaque entrée du fil, plutôt que dans des
// panneaux séparés — plus de doublon entre "pourquoi cette alerte est
// liée" et "où se trouve la preuve associée".
//
// Sprint 11C.1 — Refonte UX cockpit (frontend uniquement, aucune
// nouvelle donnée) : la timeline devient plus visuelle (ligne verticale
// renforcée), les preuves d'une alerte sont désormais présentées sous
// le libellé "Documents associés", chaque
// carte affiche un rappel générique du nombre de décideurs liés à
// l'opportunité (compteurs.decideurs, déjà disponible — aucun lien
// signal↔décideur n'existe en base, donc ce rappel reste volontairement
// général plutôt que d'inventer une association précise). DecideursPanel
// passe en grille de cartes avec "Entreprise" (l'organisation de
// l'opportunité elle-même, identique sur toutes les cartes) et "Pourquoi
// identifié" (roleAchat, déjà disponible).

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  RotateCcw,
  Users2,
  XCircle,
} from 'lucide-react'
import type { OpportuniteQueryService } from '../../lib/opportunities/query'
import type { DecideurLieDto, SignalTimelineEntryDto } from '../../lib/opportunities/query/types'
import type { AlerteRetraitService } from '../../lib/opportunities/alerteRetrait'
import type { MotifRetrait } from '../../lib/opportunities/alerteRetrait/types'
import { LinkedinLink } from '../LinkedinLink'
import { RoleCorrelationBadge } from './Badges'
import { formatDate, formatDateTime, formatMontant } from '../../lib/opportunities/uiHelpers'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'
import { EmptyState, ErrorState } from '../common/States'

interface BaseProps {
  opportuniteId: string
  queryService: OpportuniteQueryService
}

const MOTIF_RETRAIT_OPTIONS: { value: MotifRetrait; label: string }[] = [
  { value: 'hors_sujet', label: 'Hors sujet' },
  { value: 'mauvaise_entite', label: 'Mauvaise entité' },
  { value: 'mauvais_projet', label: 'Mauvais projet' },
  { value: 'doublon', label: 'Doublon' },
  { value: 'temporalite_incoherente', label: 'Temporalité incohérente' },
  { value: 'mauvaise_localisation', label: 'Mauvaise localisation' },
  { value: 'mauvais_rapprochement_semantique', label: 'Mauvais rapprochement sémantique' },
  { value: 'autre', label: 'Autre' },
]

function motifLabel(motif: MotifRetrait | null): string {
  if (!motif) return 'Non précisé'
  return MOTIF_RETRAIT_OPTIONS.find((m) => m.value === motif)?.label ?? motif
}

type Filtre = 'toutes' | 'actives' | 'ecartees'

interface SignauxEtAlertesProps extends BaseProps {
  alerteRetraitService: AlerteRetraitService
  isAdmin: boolean
  currentUserId: string | null
  refreshKey: number
  onChanged: () => void
  /** Sprint 11C.1 : compteur déjà disponible (dossier.compteurs.decideurs), utilisé
   * uniquement pour un rappel générique par carte — aucun lien signal↔décideur
   * précis n'existe en base, donc jamais une association fabriquée. */
  nombreDecideurs: number
}

/**
 * Sprint 11C — bloc unique "Signaux détectés" : remplace
 * AlertesLieesPanel + AlertesEcarteesPanel + PreuvesPanel +
 * ChronologiePanel. Une entrée par alerte rattachée (active ou
 * écartée), triée chronologiquement, avec ses documents explicitement
 * associés imbriqués et l'action retrait/réintégration inline.
 * Sprint 11C.1 : timeline verticale renforcée visuellement (brief §4).
 */
export function SignauxEtAlertesPanel({
  opportuniteId,
  queryService,
  alerteRetraitService,
  isAdmin,
  currentUserId,
  refreshKey,
  onChanged,
  nombreDecideurs,
}: SignauxEtAlertesProps) {
  const [entries, setEntries] = useState<SignalTimelineEntryDto[] | null>(null)
  const [preuvesNonRattachees, setPreuvesNonRattachees] = useState<SignalTimelineEntryDto['preuves']>([])
  const [error, setError] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc')
  const [filtre, setFiltre] = useState<Filtre>('toutes')

  const [retraitOuvertPourId, setRetraitOuvertPourId] = useState<string | null>(null)
  const [motif, setMotif] = useState<MotifRetrait | ''>('')
  const [commentaire, setCommentaire] = useState('')
  const [busyAlerteId, setBusyAlerteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(() => {
    let cancelled = false
    setError(null)
    queryService
      .getSignauxTimeline(opportuniteId)
      .then((result) => {
        if (!cancelled) {
          setEntries(result.entries)
          setPreuvesNonRattachees(result.preuvesNonRattachees)
        }
      })
      .catch((e) => {
        logDevError({ screen: 'SignauxEtAlertesPanel', operation: 'getSignauxTimeline' }, e)
        if (!cancelled) setError(translateError(e, 'Le chargement des signaux et alertes liés a échoué.'))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, queryService])

  useEffect(() => load(), [load, refreshKey])

  const displayedEntries = useMemo(() => {
    if (!entries) return null
    const filtered =
      filtre === 'toutes' ? entries : filtre === 'actives' ? entries.filter((e) => e.isActive) : entries.filter((e) => !e.isActive)
    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.dateDetection).getTime() - new Date(b.dateDetection).getTime()
      return sortDirection === 'asc' ? diff : -diff
    })
    return sorted
  }, [entries, filtre, sortDirection])

  const nombreActives = entries?.filter((e) => e.isActive).length ?? 0
  const nombreEcartees = entries?.filter((e) => !e.isActive).length ?? 0

  function ouvrirRetrait(alerteId: string) {
    setRetraitOuvertPourId(alerteId)
    setMotif('')
    setCommentaire('')
    setActionError(null)
  }

  function annulerRetrait() {
    setRetraitOuvertPourId(null)
    setMotif('')
    setCommentaire('')
    setActionError(null)
  }

  async function confirmerRetrait(alerteId: string) {
    if (!motif || !currentUserId || busyAlerteId) return
    setBusyAlerteId(alerteId)
    setActionError(null)
    try {
      await alerteRetraitService.retirerAlerteDeOpportunite(opportuniteId, alerteId, currentUserId, {
        motif,
        commentaire: commentaire.trim() || null,
      })
      setRetraitOuvertPourId(null)
      setMotif('')
      setCommentaire('')
      load()
      onChanged()
    } catch (e) {
      logDevError({ screen: 'SignauxEtAlertesPanel', operation: 'retirerAlerteDeOpportunite' }, e)
      setActionError(translateError(e, "Le retrait de l'alerte a échoué."))
    } finally {
      setBusyAlerteId(null)
    }
  }

  async function handleReintegrer(alerteId: string) {
    if (busyAlerteId) return
    setBusyAlerteId(alerteId)
    setActionError(null)
    try {
      await alerteRetraitService.reintegrerAlerteDansOpportunite(opportuniteId, alerteId)
      load()
      onChanged()
    } catch (e) {
      logDevError({ screen: 'SignauxEtAlertesPanel', operation: 'reintegrerAlerteDansOpportunite' }, e)
      setActionError(translateError(e, "La réintégration de l'alerte a échoué."))
    } finally {
      setBusyAlerteId(null)
    }
  }

  return (
    <div className="card-winovya p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white flex items-center gap-2">
          <FileText size={15} className="text-brand-primary" /> Signaux détectés
        </h2>
        <button
          onClick={() => setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
          className="inline-flex items-center gap-1 text-xs text-[hsl(217,4%,46%)] hover:text-brand-primary"
          aria-label="Inverser l'ordre chronologique"
          title={sortDirection === 'desc' ? 'Plus récent en premier' : 'Plus ancien en premier'}
        >
          {sortDirection === 'desc' ? <ArrowDownNarrowWide size={14} /> : <ArrowUpNarrowWide size={14} />}
          {sortDirection === 'desc' ? 'Plus récent d\'abord' : 'Plus ancien d\'abord'}
        </button>
      </div>

      <div className="flex items-center gap-1.5 mb-4">
        {(['toutes', 'actives', 'ecartees'] as Filtre[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${
              filtre === f
                ? 'bg-brand-primary/15 text-brand-primary border-brand-primary/40'
                : 'bg-transparent text-[hsl(217,4%,55%)] border-[hsl(217,6%,88%)] dark:border-white/10'
            }`}
          >
            {f === 'toutes' ? `Toutes (${entries?.length ?? 0})` : f === 'actives' ? `Actives (${nombreActives})` : `Écartées (${nombreEcartees})`}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : entries === null ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune alerte liée" />
      ) : displayedEntries && displayedEntries.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune alerte dans ce filtre" />
      ) : (
        <ol className="relative border-l-2 border-brand-primary/25 dark:border-brand-primary/20 pl-5 space-y-5">
          {displayedEntries?.map((entry) => (
            <li key={entry.alerteId} className="relative">
              <span
                className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-brand-navy shadow-sm ${entry.isActive ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-white/20'}`}
              />
              <div
                className={`border rounded-lg p-3 ${
                  entry.isActive
                    ? 'border-[hsl(217,6%,90%)] dark:border-white/10'
                    : 'border-[hsl(217,6%,90%)] dark:border-white/10 opacity-80 bg-[hsl(217,20%,98%)] dark:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-navy dark:text-white">{entry.titre}</p>
                  {entry.lienSourceUrl && (
                    <a
                      href={entry.lienSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[hsl(217,4%,55%)] hover:text-brand-primary shrink-0"
                      aria-label="Ouvrir la source de l'alerte"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[hsl(217,4%,46%)]">
                  {entry.isActive ? (
                    <RoleCorrelationBadge role={entry.roleCorrelation} />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
                      <XCircle size={11} /> Écartée
                    </span>
                  )}
                  <span>{formatDate(entry.dateDetection)}</span>
                  <span>{entry.categorieVeille || 'Catégorie non précisée'}</span>
                  <span className="font-medium text-brand-navy dark:text-gray-200">
                    {entry.montant !== null ? formatMontant(entry.montant) : 'Montant non identifié'}
                  </span>
                  {entry.referenceOfficielle && <span>Réf. {entry.referenceOfficielle}</span>}
                </div>

                {entry.isActive && entry.raisonCorrelation && (
                  <p className="text-[11px] text-[hsl(217,4%,55%)] italic mt-1">{entry.raisonCorrelation}</p>
                )}

                <p className="text-xs text-[hsl(217,4%,46%)] mt-2 line-clamp-2">{entry.resume || 'Aucun résumé disponible.'}</p>

                {!entry.isActive && (
                  <div className="mt-2 pt-2 border-t border-[hsl(217,6%,92%)] dark:border-white/5 text-xs text-[hsl(217,4%,46%)]">
                    <p>
                      Motif : <span className="font-medium">{motifLabel(entry.motifRetrait)}</span>
                    </p>
                    {entry.commentaireRetrait && <p className="italic mt-0.5">{entry.commentaireRetrait}</p>}
                    <p className="text-[11px] mt-0.5">Retirée le {formatDateTime(entry.retireAt)}</p>
                  </div>
                )}

                {entry.preuves.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[hsl(217,6%,92%)] dark:border-white/5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5 flex items-center gap-1">
                      <Paperclip size={11} /> Documents associés
                    </p>
                    <ul className="space-y-1.5">
                      {entry.preuves.map((p) => (
                        <li key={p.id} className="text-xs text-[hsl(217,4%,46%)] flex items-start justify-between gap-2">
                          <span>
                            <span className="text-brand-navy dark:text-gray-200">{p.source ?? 'Source non précisée'}</span>
                            {p.citation && <span className="italic"> — « {p.citation} »</span>}
                          </span>
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(217,4%,55%)] hover:text-brand-primary shrink-0" aria-label="Ouvrir la preuve">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {nombreDecideurs > 0 && (
                  <p className="mt-2 pt-2 border-t border-[hsl(217,6%,92%)] dark:border-white/5 text-[11px] text-[hsl(217,4%,55%)] flex items-center gap-1">
                    <Users2 size={11} /> {nombreDecideurs} décideur{nombreDecideurs > 1 ? 's' : ''} lié{nombreDecideurs > 1 ? 's' : ''} à cette opportunité — voir la section Décideurs
                  </p>
                )}

                {isAdmin && (
                  <div className="mt-2 pt-2 border-t border-[hsl(217,6%,92%)] dark:border-white/5">
                    {entry.isActive ? (
                      retraitOuvertPourId !== entry.alerteId ? (
                        <button
                          onClick={() => ouvrirRetrait(entry.alerteId)}
                          className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          <XCircle size={12} /> Retirer de cette opportunité
                        </button>
                      ) : (
                        <div className="space-y-2 mt-1 bg-[hsl(217,20%,97%)] dark:bg-white/5 rounded-md p-2.5">
                          <p className="text-[11px] text-[hsl(217,4%,46%)]">
                            L'alerte globale ne sera jamais supprimée : elle reste consultable ailleurs et pourra être réintégrée ici à tout
                            moment. Un recalcul de cette opportunité sera demandé.
                          </p>
                          <select
                            value={motif}
                            onChange={(e) => setMotif(e.target.value as MotifRetrait)}
                            aria-label="Motif de retrait"
                            className="input-winovya w-full text-xs py-1.5"
                          >
                            <option value="" disabled>
                              Choisir un motif…
                            </option>
                            {MOTIF_RETRAIT_OPTIONS.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={commentaire}
                            onChange={(e) => setCommentaire(e.target.value)}
                            placeholder={motif === 'autre' ? "Commentaire (obligatoire pour 'Autre')" : 'Commentaire (optionnel)'}
                            className="input-winovya w-full text-xs"
                            rows={2}
                          />
                          {actionError && retraitOuvertPourId === entry.alerteId && (
                            <p className="text-xs text-red-600 dark:text-red-400">{actionError}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => confirmerRetrait(entry.alerteId)}
                              disabled={!motif || busyAlerteId === entry.alerteId || (motif === 'autre' && !commentaire.trim())}
                              className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
                            >
                              {busyAlerteId === entry.alerteId ? <Loader2 size={12} className="animate-spin" /> : 'Confirmer le retrait'}
                            </button>
                            <button onClick={annulerRetrait} className="text-xs text-[hsl(217,4%,55%)] hover:underline">
                              Annuler
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <>
                        <button
                          onClick={() => handleReintegrer(entry.alerteId)}
                          disabled={busyAlerteId === entry.alerteId}
                          className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline disabled:opacity-50"
                        >
                          {busyAlerteId === entry.alerteId ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Réintégrer
                        </button>
                        {actionError && busyAlerteId === null && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">{actionError}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {preuvesNonRattachees.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[hsl(217,6%,90%)] dark:border-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5 flex items-center gap-1">
            <Paperclip size={11} /> Documents non rattachés à un signal précis
          </p>
          <ul className="space-y-1.5">
            {preuvesNonRattachees.map((p) => (
              <li key={p.id} className="text-xs text-[hsl(217,4%,46%)] flex items-start justify-between gap-2">
                <span>
                  <span className="text-brand-navy dark:text-gray-200">{p.source ?? 'Source non précisée'}</span>
                  {p.citation && <span className="italic"> — « {p.citation} »</span>}
                </span>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(217,4%,55%)] hover:text-brand-primary shrink-0" aria-label="Ouvrir la preuve">
                    <ExternalLink size={12} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Sprint 11C.1 — grille de cartes (brief §8) : Nom, Fonction,
 * Entreprise (l'organisation de l'opportunité elle-même — identique
 * sur toutes les cartes, ce n'est pas une donnée par décideur et rien
 * n'est inventé), "Pourquoi identifié" (roleAchat, déjà disponible),
 * lien LinkedIn si connu. `entreprise` est un simple libellé d'affichage
 * (aucune nouvelle donnée, aucun nouvel appel réseau).
 */
export function DecideursPanel({ opportuniteId, queryService, entreprise }: BaseProps & { entreprise: string }) {
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
        <div className="grid sm:grid-cols-2 gap-3">
          {decideurs.map((d) => {
            const nom = [d.prenomPersonne, d.nomPersonne].filter(Boolean).join(' ') || d.nom || 'Décideur'
            return (
              <div key={d.id} className="border border-[hsl(217,6%,90%)] dark:border-white/10 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-navy dark:text-white">{nom}</p>
                  {d.linkedin && <LinkedinLink url={d.linkedin} />}
                </div>
                <p className="text-xs text-[hsl(217,4%,46%)]">{d.fonctionPoste || 'Fonction non précisée'}</p>
                <p className="text-xs text-[hsl(217,4%,46%)] mt-0.5">{entreprise}</p>
                {d.roleAchat && (
                  <p className="text-[11px] text-[hsl(217,4%,55%)] italic mt-1">Identifié : {d.roleAchat}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-[hsl(217,4%,46%)]">
                  {d.email && <span>{d.email}</span>}
                  {d.telephone && <span>{d.telephone}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
