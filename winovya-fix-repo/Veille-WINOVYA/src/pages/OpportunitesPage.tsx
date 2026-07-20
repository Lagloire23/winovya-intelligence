// Sprint 7 — Page "Liste des opportunités" (Phase 3). Remplace le
// placeholder Sprint 1. Consomme exclusivement
// createOpportuniteQueryService() (Sprint 5) — aucune requête SQL
// directe, aucune règle métier recalculée ici. L'assignation (Sprint 8,
// Phase 2) vient directement du DTO de liste (veille.opportunite_dossier
// étendue) : plus de lecture par ligne visible (voir docs/frontend-mvp.md).

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowUp, ArrowDown, Target, FileText, Users2, X } from 'lucide-react'
import { createOpportuniteQueryService } from '../lib/opportunities/query'
import type {
  NiveauConfiance,
  OpportuniteFilters,
  OpportuniteListItemDto,
  PhaseProjet,
  SortDirection,
  SortField,
} from '../lib/opportunities/query/types'
import { StatutCommercialBadge, ConfianceBadge, EnrichissementBadge } from '../components/opportunites/Badges'
import { LoadingState, ErrorState, EmptyState } from '../components/common/States'
import { STATUT_COMMERCIAL_LABELS, formatMontant, formatRelative } from '../lib/opportunities/uiHelpers'
import { translateError } from '../lib/opportunities/errorMessages'
import { logDevError } from '../lib/opportunities/devLog'

const queryService = createOpportuniteQueryService()

const PAGE_SIZE = 20

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'dernierSignal', label: 'Dernier signal' },
  { value: 'premierSignal', label: 'Premier signal' },
  { value: 'dateCreation', label: 'Date de création' },
  { value: 'confiance', label: 'Confiance' },
  { value: 'nombreSignaux', label: 'Nombre de signaux' },
  { value: 'budgetIdentifie', label: 'Budget identifié' },
  { value: 'alphabetique', label: 'Titre (A→Z)' },
]

const STATUT_FILTER_OPTIONS = Object.entries(STATUT_COMMERCIAL_LABELS)
const CONFIANCE_FILTER_OPTIONS: NiveauConfiance[] = ['Élevé', 'Moyen', 'Faible']
const PHASE_FILTER_OPTIONS: PhaseProjet[] = [
  'INTENTION', 'ETUDE', 'FONCIER', 'AUTORISATION', 'RECRUTEMENT', 'CONSULTATION', 'ANNONCE', 'APPEL_OFFRES',
]
const PHASE_LABELS: Record<PhaseProjet, string> = {
  INTENTION: 'Intention',
  ETUDE: 'Étude',
  FONCIER: 'Foncier',
  AUTORISATION: 'Autorisation',
  RECRUTEMENT: 'Recrutement',
  CONSULTATION: 'Consultation',
  ANNONCE: 'Annonce',
  APPEL_OFFRES: "Appel d'offres",
}

interface RowProps {
  item: OpportuniteListItemDto
  onOpen: (id: string) => void
}

// memo() : la liste peut afficher jusqu'à 20 lignes par page — éviter de
// re-rendre chaque ligne quand seul un filtre en amont change une donnée
// non pertinente pour cette ligne (Phase 7, performance).
const OpportuniteRow = memo(function OpportuniteRow({ item, onOpen }: RowProps) {
  return (
    <tr
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item.id)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ouvrir le dossier ${item.titre}`}
      className="cursor-pointer border-b border-[hsl(217,6%,92%)] dark:border-white/10 hover:bg-brand-neutral/40 dark:hover:bg-white/5 transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary focus-visible:outline-none"
    >
      <td className="px-4 py-3 min-w-[220px] max-w-[320px]">
        <p className="text-sm font-semibold text-brand-navy dark:text-white truncate" title={item.titre}>
          {item.titre}
        </p>
        <p
          className="text-xs text-[hsl(217,4%,46%)] truncate"
          title={[item.classification.entiteCible, item.classification.geographie].filter(Boolean).join(' · ') || undefined}
        >
          {[item.classification.entiteCible, item.classification.geographie].filter(Boolean).join(' · ') || '—'}
        </p>
      </td>
      <td className="px-4 py-3">
        <StatutCommercialBadge statut={item.statutOpportunite} />
      </td>
      <td className="px-4 py-3">
        <ConfianceBadge niveau={item.confiance} />
      </td>
      <td className="px-4 py-3">
        <EnrichissementBadge statut={item.enrichissement.statut} />
      </td>
      <td className="px-4 py-3 text-sm text-[hsl(217,10%,25%)] dark:text-gray-300">
        {item.classification.phaseProjet ? PHASE_LABELS[item.classification.phaseProjet] : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-[hsl(217,10%,25%)] dark:text-gray-300 whitespace-nowrap">
        {formatMontant(item.budget.identifie) ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm text-center text-[hsl(217,10%,25%)] dark:text-gray-300">{item.compteurs.preuves}</td>
      <td className="px-4 py-3 text-sm text-center text-[hsl(217,10%,25%)] dark:text-gray-300">{item.compteurs.decideurs}</td>
      <td className="px-4 py-3 text-sm text-[hsl(217,10%,25%)] dark:text-gray-300 whitespace-nowrap">
        {formatRelative(item.signaux.dateDernier)}
      </td>
      <td className="px-4 py-3">
        {item.assignation.profilId ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary">
            <Users2 size={13} /> Assignée
          </span>
        ) : (
          <span className="text-xs text-[hsl(217,4%,60%)]">Non assignée</span>
        )}
      </td>
    </tr>
  )
})

export function OpportunitesPage() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [confianceFilter, setConfianceFilter] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [sort, setSort] = useState<SortField>('dernierSignal')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)

  const [items, setItems] = useState<OpportuniteListItemDto[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  // Recherche instantanée mais débouncée (Phase 3/7) : évite une requête à
  // chaque frappe.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [statutFilter, confianceFilter, phaseFilter, sort, sortDirection])

  const filters: OpportuniteFilters = useMemo(() => {
    const f: OpportuniteFilters = {}
    if (statutFilter) f.statutOpportunite = [statutFilter]
    if (confianceFilter) f.niveauConfiance = [confianceFilter as NiveauConfiance]
    if (phaseFilter) f.phaseProjet = [phaseFilter as PhaseProjet]
    return f
  }, [statutFilter, confianceFilter, phaseFilter])

  const load = useCallback(async () => {
    const myRequestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const result = await queryService.listDossiers({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        filters,
        sort,
        sortDirection,
      })
      if (myRequestId !== requestIdRef.current) return
      setItems(result.items)
      setTotal(result.total)
      setTotalPages(result.totalPages)
      // Sprint 8 (Phase 2) : l'assignation vient directement du DTO de liste
      // (veille.opportunite_dossier étendue), dans cette même requête —
      // plus aucun appel réseau par ligne (voir docs/frontend-mvp.md,
      // limitation Sprint 7 levée).
    } catch (e) {
      if (myRequestId !== requestIdRef.current) return
      logDevError({ screen: 'OpportunitesPage', operation: 'listDossiers' }, e)
      setError(translateError(e, 'Le chargement des opportunités a échoué.'))
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false)
    }
  }, [page, search, filters, sort, sortDirection])

  useEffect(() => {
    load()
  }, [load])

  const hasActiveFilters = Boolean(statutFilter || confianceFilter || phaseFilter || search)

  function resetFilters() {
    setSearchInput('')
    setSearch('')
    setStatutFilter('')
    setConfianceFilter('')
    setPhaseFilter('')
    setPage(1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-heading font-bold text-brand-navy dark:text-white">Opportunités</h1>
      </div>
      <p className="text-sm text-[hsl(217,4%,46%)] mb-6">
        {loading ? 'Chargement…' : `${total} opportunité${total > 1 ? 's' : ''}`}
      </p>

      {/* Barre d'outils : recherche, filtres, tri (Phase 3) */}
      <div className="card-winovya p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(217,4%,60%)]" />
          <label htmlFor="opportunites-search" className="sr-only">
            Rechercher une opportunité
          </label>
          <input
            id="opportunites-search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher un titre, une entité, une géographie…"
            className="input-winovya pl-9"
          />
        </div>

        <label htmlFor="opportunites-filter-statut" className="sr-only">
          Filtrer par statut
        </label>
        <select
          id="opportunites-filter-statut"
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="input-winovya w-auto text-sm"
        >
          <option value="">Tous les statuts</option>
          {STATUT_FILTER_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="opportunites-filter-confiance" className="sr-only">
          Filtrer par niveau de confiance
        </label>
        <select
          id="opportunites-filter-confiance"
          value={confianceFilter}
          onChange={(e) => setConfianceFilter(e.target.value)}
          className="input-winovya w-auto text-sm"
        >
          <option value="">Toute confiance</option>
          {CONFIANCE_FILTER_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <label htmlFor="opportunites-filter-phase" className="sr-only">
          Filtrer par phase de projet
        </label>
        <select
          id="opportunites-filter-phase"
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="input-winovya w-auto text-sm"
        >
          <option value="">Toute phase</option>
          {PHASE_FILTER_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {PHASE_LABELS[v]}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <label htmlFor="opportunites-sort" className="sr-only">
            Trier les opportunités
          </label>
          <select
            id="opportunites-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortField)}
            className="input-winovya w-auto text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="p-2 rounded-md border border-[hsl(217,6%,90%)] dark:border-white/10 hover:bg-brand-neutral/60 dark:hover:bg-white/5 transition focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none"
            title={sortDirection === 'asc' ? 'Croissant' : 'Décroissant'}
            aria-label={sortDirection === 'asc' ? 'Trier par ordre croissant (cliquer pour inverser)' : 'Trier par ordre décroissant (cliquer pour inverser)'}
          >
            {sortDirection === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
          </button>
        </div>

        {hasActiveFilters && (
          <button onClick={resetFilters} className="flex items-center gap-1 text-xs font-medium text-[hsl(217,4%,46%)] hover:text-brand-navy dark:hover:text-white transition">
            <X size={13} /> Réinitialiser
          </button>
        )}
      </div>

      <div className="card-winovya overflow-hidden">
        {loading && items.length === 0 ? (
          <LoadingState label="Chargement des opportunités…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Target}
            title={hasActiveFilters ? 'Aucune opportunité ne correspond à ces critères' : 'Aucune opportunité pour le moment'}
            description={
              hasActiveFilters
                ? 'Essayez de modifier ou réinitialiser vos filtres.'
                : "Les opportunités détectées automatiquement par le moteur de veille apparaîtront ici."
            }
            action={
              hasActiveFilters ? (
                <button onClick={resetFilters} className="btn-secondary">
                  Réinitialiser les filtres
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[hsl(217,6%,90%)] dark:border-white/10 text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,46%)]">
                  <th className="px-4 py-3" scope="col">Opportunité</th>
                  <th className="px-4 py-3" scope="col">Statut</th>
                  <th className="px-4 py-3" scope="col">Confiance</th>
                  <th className="px-4 py-3" scope="col">Enrichissement</th>
                  <th className="px-4 py-3" scope="col">Phase</th>
                  <th className="px-4 py-3" scope="col">Budget</th>
                  <th className="px-4 py-3 text-center" scope="col">
                    <span title="Preuves" aria-hidden="true"><FileText size={13} className="inline" /></span>
                    <span className="sr-only">Preuves</span>
                  </th>
                  <th className="px-4 py-3 text-center" scope="col">
                    <span title="Décideurs" aria-hidden="true"><Users2 size={13} className="inline" /></span>
                    <span className="sr-only">Décideurs</span>
                  </th>
                  <th className="px-4 py-3" scope="col">Dernier signal</th>
                  <th className="px-4 py-3" scope="col">Assignation</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <OpportuniteRow
                    key={item.id}
                    item={item}
                    onOpen={(id) => navigate(`/dashboard/opportunites/${id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(217,6%,90%)] dark:border-white/10">
            <p className="text-xs text-[hsl(217,4%,46%)]">
              Page {page} / {totalPages} — {total} résultat{total > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Précédent
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary py-1.5 px-3 text-xs"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
