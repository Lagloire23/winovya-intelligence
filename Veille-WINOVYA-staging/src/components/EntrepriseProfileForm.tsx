import { useEffect, useState } from 'react'
import { Loader2, Building2, Check, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDashboardNav } from '../contexts/DashboardNavContext'
import type { SecteurClients } from '../lib/types'
import { REGIONS, TYPE_OPPORTUNITE_OPTIONS, getDepartements, type GeoNode } from '../lib/geoData'

// Formulaire complet "profil entreprise + filtres de veille", partagé entre
// deux points d'entrée :
//  - OnboardingPage (étape 3, après mini-formulaire + extraction IA
//    optionnelle) : les valeurs déjà saisies/extraites sont passées via
//    `initialOverrides` et priment sur celles chargées depuis la base.
//  - La page "Critères" (sous-menu Intelligence marché), accessible à tout
//    moment une fois l'onboarding terminé, pour relire et corriger le profil
//    sans repasser par le mini-formulaire ni l'IA : utilisée sans
//    `initialOverrides`, elle charge l'entreprise ACTUELLEMENT SÉLECTIONNÉE
//    dans le sélecteur "Entreprise" du tableau de bord (DashboardNavContext),
//    et retombe sur celle du profil connecté si aucune n'est sélectionnée
//    (ex. pendant l'onboarding, avant même d'avoir visité le dashboard).
// Dans les deux cas, la validation appelle la même edge function
// onboarding-save (qui crée ou met à jour veille.entreprises).

export const PAYS_OPTIONS = ['France', 'Union Européenne', 'Afrique francophone']

export interface FullForm {
  name: string
  competences: string
  references_clients: string
  description_courte: string
  secteurs_intervention: string
  zone_geographique: string
  mots_cles_metiers: string
  effectif_taille: string
  secteur_clients: SecteurClients | ''
  site_web: string
}

export const EMPTY_FORM: FullForm = {
  name: '',
  competences: '',
  references_clients: '',
  description_courte: '',
  secteurs_intervention: '',
  zone_geographique: '',
  mots_cles_metiers: '',
  effectif_taille: '',
  secteur_clients: '',
  site_web: '',
}

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

interface Props {
  // Valeurs (mini-formulaire + extraction IA) à faire primer sur celles
  // chargées depuis la base, le cas échéant — uniquement pour les champs
  // non vides. Laisser vide pour un simple formulaire d'édition.
  initialOverrides?: Partial<FullForm>
  // Message d'avertissement affiché en haut (ex. échec d'extraction IA côté onboarding).
  noticeMessage?: string | null
  submitLabel?: string
  onSaved?: () => void
}

export function EntrepriseProfileForm({ initialOverrides, noticeMessage, submitLabel = 'Valider', onSaved }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { activeEntrepriseId } = useDashboardNav()
  // '' ou '__all' -> pas d'entreprise précise sélectionnée dans le dashboard
  // (cas de l'onboarding, avant la première visite du tableau de bord, ou du
  // filtre "Toutes les entreprises") : on retombe alors sur celle du profil.
  const targetEntrepriseId =
    activeEntrepriseId && activeEntrepriseId !== '__all' ? activeEntrepriseId : profile?.entreprise_id || null

  const [loadingExisting, setLoadingExisting] = useState(true)
  const [form, setForm] = useState<FullForm>({ ...EMPTY_FORM, ...initialOverrides })
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [selectedPays, setSelectedPays] = useState<Set<string>>(new Set(['France']))
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  const [departementsByRegion, setDepartementsByRegion] = useState<Record<string, GeoNode[]>>({})
  const [loadingDept, setLoadingDept] = useState<Set<string>>(new Set())
  const [selectedDepartements, setSelectedDepartements] = useState<Set<string>>(new Set())
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [extraTypes, setExtraTypes] = useState<string[]>([])
  const [newTypeInput, setNewTypeInput] = useState('')

  useEffect(() => {
    async function loadExisting() {
      setLoadingExisting(true)
      if (!targetEntrepriseId) {
        setForm({ ...EMPTY_FORM, ...initialOverrides })
        setLoadingExisting(false)
        return
      }
      const { data } = await supabase.from('entreprises').select('*').eq('id', targetEntrepriseId).single()
      // Repartir de zéro à chaque changement d'entreprise sélectionnée, pour
      // ne pas garder les filtres/champs de la précédente si la nouvelle n'en
      // a pas (ou en a d'autres).
      setSelectedPays(new Set(['France']))
      setSelectedRegions(new Set())
      setDepartementsByRegion({})
      setSelectedDepartements(new Set())
      setSelectedTypes(new Set())
      setExtraTypes([])
      if (data) {
        const dbForm: FullForm = {
          name: data.name || '',
          competences: data.competences || '',
          references_clients: data.references_clients || '',
          description_courte: data.description_courte || '',
          secteurs_intervention: data.secteurs_intervention || '',
          zone_geographique: data.zone_geographique || '',
          mots_cles_metiers: data.mots_cles_metiers || '',
          effectif_taille: data.effectif_taille || '',
          secteur_clients: data.secteur_clients || '',
          site_web: data.site_web || '',
        }
        // Les valeurs fraîches (mini-formulaire / extraction IA) priment sur
        // celles déjà en base, champ par champ, uniquement si non vides.
        const merged = { ...dbForm }
        if (initialOverrides) {
          for (const key of Object.keys(initialOverrides) as (keyof FullForm)[]) {
            const v = initialOverrides[key]
            if (v) (merged[key] as string) = v as string
          }
        }
        setForm(merged)
        if (Array.isArray(data.pays) && data.pays.length > 0) setSelectedPays(new Set(data.pays))
        if (Array.isArray(data.regions_suivies)) setSelectedRegions(new Set(data.regions_suivies))
        if (Array.isArray(data.departements_suivis)) setSelectedDepartements(new Set(data.departements_suivis))
        if (Array.isArray(data.types_opportunite_suivis)) {
          setSelectedTypes(new Set(data.types_opportunite_suivis))
          setExtraTypes(data.types_opportunite_suivis.filter((t: string) => !TYPE_OPPORTUNITE_OPTIONS.includes(t)))
        }
      } else {
        setForm({ ...EMPTY_FORM, ...initialOverrides })
      }
      setLoadingExisting(false)
    }
    loadExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEntrepriseId])

  function field<K extends keyof FullForm>(key: K, value: FullForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function toggleRegion(region: GeoNode) {
    setSelectedRegions((prev) => toggleInSet(prev, region.nom))
    setSaved(false)
    if (!departementsByRegion[region.code]) {
      setLoadingDept((s) => new Set(s).add(region.code))
      const depts = await getDepartements(region.code)
      setDepartementsByRegion((prev) => ({ ...prev, [region.code]: depts }))
      setLoadingDept((s) => {
        const n = new Set(s)
        n.delete(region.code)
        return n
      })
    }
  }

  function addCustomType() {
    const t = newTypeInput.trim()
    if (!t) return
    if (!TYPE_OPPORTUNITE_OPTIONS.includes(t) && !extraTypes.includes(t)) {
      setExtraTypes((list) => [...list, t])
    }
    setSelectedTypes((prev) => new Set(prev).add(t))
    setNewTypeInput('')
    setSaved(false)
  }

  async function handleValidate() {
    setSaving(true)
    setSaveError(null)
    const { data, error } = await supabase.functions.invoke('onboarding-save', {
      body: {
        // Entreprise ciblée par l'édition : celle sélectionnée dans le
        // dashboard si elle diffère de la sienne (utile pour un admin qui
        // corrige le profil d'un autre client) — l'edge function vérifie
        // côté serveur que seul un compte admin peut cibler une entreprise
        // différente de la sienne.
        entrepriseId: targetEntrepriseId || undefined,
        entrepriseFields: {
          name: form.name,
          competences: form.competences,
          references_clients: form.references_clients,
          description_courte: form.description_courte,
          secteurs_intervention: form.secteurs_intervention,
          zone_geographique: form.zone_geographique,
          mots_cles_metiers: form.mots_cles_metiers,
          effectif_taille: form.effectif_taille,
          secteur_clients: form.secteur_clients || null,
          site_web: form.site_web,
        },
        pays: Array.from(selectedPays),
        regions_suivies: Array.from(selectedRegions),
        departements_suivis: Array.from(selectedDepartements),
        types_opportunite_suivis: Array.from(selectedTypes),
      },
    })
    setSaving(false)
    if (error || !data?.ok) {
      setSaveError(data?.error || "L'enregistrement a échoué. Réessayez dans un instant.")
      return
    }
    setSaved(true)
    await refreshProfile()
    onSaved?.()
  }

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-brand-primary" size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {noticeMessage && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">{noticeMessage}</p>
      )}

      <div className="card-winovya p-6 space-y-4">
        <p className="text-xs font-semibold text-brand-primary uppercase tracking-wide flex items-center gap-1.5">
          <Building2 size={13} /> Profil entreprise — relisez et corrigez si besoin
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Nom de l'entreprise *</label>
            <input required value={form.name} onChange={(e) => field('name', e.target.value)} className="input-winovya" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Site internet</label>
            <input value={form.site_web} onChange={(e) => field('site_web', e.target.value)} className="input-winovya" />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Effectif</label>
            <input
              value={form.effectif_taille}
              onChange={(e) => field('effectif_taille', e.target.value)}
              className="input-winovya"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Zone géographique</label>
            <input
              value={form.zone_geographique}
              onChange={(e) => field('zone_geographique', e.target.value)}
              className="input-winovya"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Secteurs d'intervention</label>
            <input
              value={form.secteurs_intervention}
              onChange={(e) => field('secteurs_intervention', e.target.value)}
              className="input-winovya"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Secteur clients</label>
            <select
              value={form.secteur_clients}
              onChange={(e) => field('secteur_clients', e.target.value as SecteurClients)}
              className="input-winovya"
            >
              <option value="">—</option>
              <option value="Majoritairement privé">Majoritairement privé</option>
              <option value="Majoritairement public">Majoritairement public</option>
              <option value="Mixte (public et privé)">Mixte (public et privé)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Compétences</label>
          <textarea
            value={form.competences}
            onChange={(e) => field('competences', e.target.value)}
            rows={2}
            className="input-winovya"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Description courte</label>
          <textarea
            value={form.description_courte}
            onChange={(e) => field('description_courte', e.target.value)}
            rows={2}
            className="input-winovya"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Références clients</label>
          <textarea
            value={form.references_clients}
            onChange={(e) => field('references_clients', e.target.value)}
            rows={2}
            className="input-winovya"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[hsl(217,4%,46%)] mb-1 block">Mots-clés métiers</label>
          <input
            value={form.mots_cles_metiers}
            onChange={(e) => field('mots_cles_metiers', e.target.value)}
            className="input-winovya"
          />
        </div>
      </div>

      <div className="card-winovya p-6 space-y-4">
        <p className="text-xs font-semibold text-brand-primary uppercase tracking-wide">
          Filtres de veille — ce que vous voulez voir remonter
        </p>

        <div>
          <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">Pays</label>
          <div className="flex flex-wrap gap-3">
            {PAYS_OPTIONS.map((p) => (
              <label key={p} className="flex items-center gap-1.5 text-sm text-[hsl(217,10%,25%)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPays.has(p)}
                  onChange={() => {
                    setSelectedPays((prev) => toggleInSet(prev, p))
                    setSaved(false)
                  }}
                  className="accent-brand-primary"
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
            Régions &amp; départements suivis
          </label>
          <div className="rounded-md border border-[hsl(217,6%,90%)] max-h-56 overflow-y-auto p-2 space-y-0.5">
            {REGIONS.map((region) => (
              <div key={region.code}>
                <label className="flex items-center gap-2 text-sm text-[hsl(217,10%,25%)] px-1 py-1 rounded hover:bg-brand-neutral/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRegions.has(region.nom)}
                    onChange={() => toggleRegion(region)}
                    className="accent-brand-primary"
                  />
                  {region.nom}
                  {loadingDept.has(region.code) && <Loader2 size={12} className="animate-spin text-brand-primary" />}
                </label>
                {selectedRegions.has(region.nom) && (
                  <div className="ml-6 grid grid-cols-2 gap-x-2">
                    {(departementsByRegion[region.code] || []).map((dep) => (
                      <label
                        key={dep.code}
                        className="flex items-center gap-1.5 text-xs text-[hsl(217,10%,25%)] px-1 py-0.5 rounded hover:bg-brand-neutral/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartements.has(dep.nom)}
                          onChange={() => {
                            setSelectedDepartements((prev) => toggleInSet(prev, dep.nom))
                            setSaved(false)
                          }}
                          className="accent-brand-primary"
                        />
                        {dep.nom}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1">
            Aucune région cochée = France entière, sans filtre géographique.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
            Types d'opportunité suivis
          </label>
          <div className="rounded-md border border-[hsl(217,6%,90%)] max-h-48 overflow-y-auto p-2 space-y-0.5">
            {[...TYPE_OPPORTUNITE_OPTIONS, ...extraTypes].map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 text-xs text-[hsl(217,10%,25%)] px-1 py-1 rounded hover:bg-brand-neutral/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.has(t)}
                  onChange={() => {
                    setSelectedTypes((prev) => toggleInSet(prev, t))
                    setSaved(false)
                  }}
                  className="accent-brand-primary"
                />
                {t}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input
              value={newTypeInput}
              onChange={(e) => setNewTypeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCustomType()
                }
              }}
              placeholder="Ajouter un type d'opportunité personnalisé…"
              className="input-winovya flex-1 !py-1.5 text-xs"
            />
            <button type="button" onClick={addCustomType} className="btn-secondary !py-1.5 !px-3 text-xs shrink-0">
              <Plus size={13} />
              Ajouter
            </button>
          </div>
          {extraTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {extraTypes.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 text-[11px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => {
                      setExtraTypes((list) => list.filter((x) => x !== t))
                      setSelectedTypes((prev) => {
                        const n = new Set(prev)
                        n.delete(t)
                        return n
                      })
                      setSaved(false)
                    }}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1">Aucune sélection = tous les types.</p>
        </div>
      </div>

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}

      <div className="flex items-center gap-3">
        <button onClick={handleValidate} disabled={saving || !form.name.trim()} className="btn-primary flex-1">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {submitLabel}
        </button>
        {saved && !saving && <span className="text-xs text-brand-green-deep shrink-0">✓ Enregistré</span>}
      </div>
    </div>
  )
}
