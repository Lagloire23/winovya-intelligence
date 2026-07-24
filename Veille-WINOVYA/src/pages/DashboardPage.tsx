import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Loader2, Inbox } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardNav } from '../contexts/DashboardNavContext'
import type { AlerteWithRelations, Entreprise, ScorePertinence } from '../lib/types'
import { AlertRow } from '../components/AlertRow'
import { AppSidebar } from '../components/AppSidebar'
import { SCORE_ORDER, SCORE_KPI_STYLE, CATEGORY_LABELS } from '../lib/displayHelpers'

export function DashboardPage() {
  const { profile } = useAuth()
  const {
    bucket,
    categorie,
    reset,
    setCounts,
    setCategorieFilter,
    activeEntrepriseId: activeEntreprise,
    setActiveEntrepriseId: setActiveEntreprise,
  } = useDashboardNav()
  const [searchParams] = useSearchParams()
  const [alertes, setAlertes] = useState<AlerteWithRelations[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('__all')
  const [departement, setDepartement] = useState('__all')
  const [typeOpp, setTypeOpp] = useState('__all')
  const [score, setScore] = useState('__all')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  const isMember = profile?.role === 'member'

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErrorMsg(null)

      const [{ data: entData, error: entErr }, { data: alData, error: alErr }] = await Promise.all([
        supabase.from('entreprises').select('*').eq('status', 'Actif').order('name'),
        supabase
          .from('alertes')
          .select(
            `*,
            pertinence_entreprise(*, entreprises(id, name)),
            attachments(*),
            alerte_decideurs(decideurs(*))`
          )
          .order('date_publication', { ascending: false })
          .limit(600),
      ])

      if (entErr || alErr) {
        setErrorMsg(
          (entErr?.message || alErr?.message || 'Erreur de chargement') +
            (String(entErr?.message || alErr?.message || '').includes('schema')
              ? ' — le schéma "veille" doit être ajouté aux "Exposed schemas" dans Supabase (Settings > Data API).'
              : '')
        )
        setLoading(false)
        return
      }

      const ents = (entData as Entreprise[]) || []
      setEntreprises(ents)

      const normalized: AlerteWithRelations[] = ((alData as any[]) || []).map((row) => ({
        ...row,
        pertinence_entreprise: row.pertinence_entreprise || [],
        attachments: row.attachments || [],
        decideurs: (row.alerte_decideurs || []).map((ad: any) => ad.decideurs).filter(Boolean),
      }))
      setAlertes(normalized)
      setLoading(false)

      // Default entreprise selection: member -> their own entreprise, admin -> first one.
      if (isMember && profile?.entreprise_id) {
        setActiveEntreprise(profile.entreprise_id)
      } else if (ents.length > 0) {
        setActiveEntreprise((prev) => prev || ents[0].id)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  // Collapse any expanded alert row whenever the active filter view changes.
  useEffect(() => {
    setExpandedId(null)
  }, [bucket, categorie])

  // Deep-link support: when arriving via ?alert=<id> (e.g. from an
  // assignation email, magic-link or invite redirect), jump straight to that
  // alerte — pick the entreprise it belongs to, clear any filter that could
  // hide it, expand it, and scroll it into view.
  useEffect(() => {
    if (loading) return
    const targetId = searchParams.get('alert')
    if (!targetId) return
    const target = alertes.find((a) => a.id === targetId)
    if (!target) return

    const pert = target.pertinence_entreprise[0]
    setActiveEntreprise(pert ? pert.entreprise_id : '__all')
    reset()
    setSearch('')
    setRegion('__all')
    setDepartement('__all')
    setTypeOpp('__all')
    setScore('__all')
    setExpandedId(targetId)

    const timer = setTimeout(() => {
      document.getElementById(`alerte-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, alertes, searchParams])

  function handleChanged(id: string, patch: Partial<AlerteWithRelations>) {
    setAlertes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const activeEntrepriseObj = entreprises.find((e) => e.id === activeEntreprise)
  const activeEntrepriseLabel = activeEntreprise === '__all' ? 'Toutes les entreprises' : activeEntrepriseObj?.name || ''
  // TEMPORAIRE (dev/QA) : sélecteur ouvert à tous les rôles pour tester l'affichage
  // par entreprise. À supprimer avant mise en prod finale et remettre le filtre
  // `isMember ? entreprises.filter((e) => e.id === profile?.entreprise_id) : entreprises`.
  const visibleEntreprises = entreprises

  // All alertes relevant to the selected entreprise (i.e. it has a pertinence row for it).
  // '__all' (dev/QA only) shows every alerte regardless of company.
  const forEntreprise = useMemo(
    () =>
      activeEntreprise === '__all'
        ? alertes
        : alertes.filter((a) => a.pertinence_entreprise.some((p) => p.entreprise_id === activeEntreprise)),
    [alertes, activeEntreprise]
  )

  // Pertinence rows relevant to the current selection, for a given alerte.
  function pertsFor(a: AlerteWithRelations) {
    return activeEntreprise === '__all'
      ? a.pertinence_entreprise
      : a.pertinence_entreprise.filter((p) => p.entreprise_id === activeEntreprise)
  }

  const bucketCounts = useMemo(() => {
    const counts: Record<string, number> = { __all: forEntreprise.length, NOUVEAU: 0, ASSIGNE: 0, TRAITE: 0, ARCHIVE: 0 }
    forEntreprise.forEach((a) => {
      counts[a.statut] = (counts[a.statut] || 0) + 1
    })
    return counts
  }, [forEntreprise])

  const scoreCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    forEntreprise.forEach((a) => {
      pertsFor(a).forEach((p) => {
        const s = p.score_pertinence || 'À confirmer'
        counts[s] = (counts[s] || 0) + 1
      })
    })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forEntreprise, activeEntreprise])

  const categorieCounts = useMemo(() => {
    const counts: Record<string, number> = { DELIBERATIONS: 0, RENOUVELLEMENTS: 0 }
    forEntreprise.forEach((a) => {
      if (a.categorie_veille === '6. Délibérations') counts.DELIBERATIONS++
      if (a.categorie_veille === '5. Marchés publics & renouvellements') counts.RENOUVELLEMENTS++
    })
    return counts
  }, [forEntreprise])

  // Keep the shared nav context (used by the sidebar in the app shell) in sync
  // with counts computed from this page's data.
  useEffect(() => {
    setCounts(bucketCounts, categorieCounts)
  }, [bucketCounts, categorieCounts, setCounts])

  const filterOptions = useMemo(() => {
    const categories = new Set<string>()
    const regions = new Set<string>()
    const departements = new Set<string>()
    const types = new Set<string>()
    forEntreprise.forEach((a) => {
      if (a.categorie_veille) categories.add(a.categorie_veille)
      a.region?.forEach((r) => regions.add(r))
      if (a.departement) departements.add(a.departement)
      pertsFor(a).forEach((p) => p.type_opportunite?.forEach((t) => types.add(t)))
    })
    return {
      categories: Array.from(categories).sort(),
      regions: Array.from(regions).sort(),
      departements: Array.from(departements).sort(),
      types: Array.from(types).sort(),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forEntreprise, activeEntreprise])

  const filtered = useMemo(() => {
    let list = forEntreprise
    if (bucket !== '__all') list = list.filter((a) => a.statut === bucket)
    if (categorie !== '__all') list = list.filter((a) => a.categorie_veille === categorie)
    if (region !== '__all') list = list.filter((a) => a.region?.includes(region))
    if (departement !== '__all') list = list.filter((a) => a.departement === departement)
    if (typeOpp !== '__all') {
      list = list.filter((a) => pertsFor(a).some((p) => p.type_opportunite?.includes(typeOpp)))
    }
    if (score !== '__all') {
      list = list.filter((a) => pertsFor(a).some((p) => (p.score_pertinence || 'À confirmer') === score))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) => {
        const hay = [a.name, a.resume, a.acteur_entite, a.commune_collectivite, a.reference_officielle]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    const sorted = [...list].sort((a, b) => {
      const da = a.date_publication ? new Date(a.date_publication).getTime() : 0
      const db = b.date_publication ? new Date(b.date_publication).getTime() : 0
      return sortDir === 'desc' ? db - da : da - db
    })
    return sorted
  }, [forEntreprise, bucket, categorie, region, departement, typeOpp, score, search, sortDir, activeEntreprise])

  return (
    <div>
      <div className="lg:hidden mb-5 card-winovya p-3">
        <AppSidebar />
      </div>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold text-brand-navy mb-1">Opportunités {activeEntrepriseLabel}</h1>
        <p className="text-sm text-[hsl(217,4%,46%)]">
          Alertes scorées pour {activeEntrepriseLabel || 'votre entreprise'} selon ses compétences, références et
          secteurs d'intervention.
        </p>
      </div>

      {/* Entreprise selector */}
      {visibleEntreprises.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-5 card-winovya p-3">
          <span className="text-xs font-semibold text-brand-navy uppercase tracking-wide shrink-0">Entreprise :</span>
          <select
            value={activeEntreprise}
            onChange={(e) => {
              setActiveEntreprise(e.target.value)
              reset()
              setExpandedId(null)
            }}
            className="input-winovya w-auto"
          >
            <option value="__all">Toutes les entreprises</option>
            {visibleEntreprises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <div className="card-winovya p-3 border-brand-primary/30">
          <p className="text-2xl font-heading font-bold text-brand-navy">{bucketCounts.__all}</p>
          <p className="text-xs text-[hsl(217,4%,46%)]">Total alertes</p>
        </div>
        {SCORE_ORDER.map((s) => (
          <div key={s} className={`rounded-lg p-3 ${SCORE_KPI_STYLE[s as ScorePertinence]}`}>
            <p className="text-2xl font-heading font-bold">{scoreCounts[s] || 0}</p>
            <p className="text-xs opacity-80">{s}</p>
          </div>
        ))}
      </div>

      {errorMsg && <div className="card-winovya p-4 mb-6 border-red-200 bg-red-50 text-red-700 text-sm">{errorMsg}</div>}

      <div>
        {/* Filter bar — row 1: search only */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(217,4%,46%)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (commune, acteur, mot-clé, décideur…)"
              className="input-winovya pl-9 !py-1.5 text-sm"
            />
          </div>
          <button
            onClick={() => setSearch(search)}
            className="inline-flex items-center gap-1.5 bg-brand-primary text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:opacity-90 transition shrink-0"
          >
            <Search size={13} /> Rechercher
          </button>
        </div>

        {/* Row 2: tous les filtres + tri + compteur, sur une seule ligne */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={categorie}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="input-winovya w-auto !py-1.5 text-xs"
          >
            <option value="__all">Toutes catégories</option>
            {filterOptions.categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c}
              </option>
            ))}
          </select>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="input-winovya w-auto !py-1.5 text-xs"
          >
            <option value="__all">Toutes régions</option>
            {filterOptions.regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={departement}
            onChange={(e) => setDepartement(e.target.value)}
            className="input-winovya w-auto !py-1.5 text-xs"
          >
            <option value="__all">Tous départements</option>
            {filterOptions.departements.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={typeOpp}
            onChange={(e) => setTypeOpp(e.target.value)}
            className="input-winovya w-auto !py-1.5 text-xs"
          >
            <option value="__all">Tous types d'opportunité</option>
            {filterOptions.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="input-winovya w-auto !py-1.5 text-xs"
          >
            <option value="__all">Tous scores</option>
            {SCORE_ORDER.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as 'desc' | 'asc')}
            className="input-winovya w-auto !py-1.5 text-xs shrink-0"
          >
            <option value="desc">Plus récent d'abord</option>
            <option value="asc">Plus ancien d'abord</option>
          </select>
          <span className="text-xs text-[hsl(217,4%,46%)] ml-auto shrink-0">
            {filtered.length} / {forEntreprise.length} alertes
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-brand-primary" size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-[hsl(217,4%,46%)]">
            <Inbox size={32} className="mb-3" />
            <p className="text-sm">Aucune alerte ne correspond à ces filtres.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((a, i) => (
              <AlertRow
                key={a.id}
                alerte={a}
                entrepriseId={activeEntreprise}
                entreprises={entreprises}
                index={i + 1}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                onChanged={handleChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
