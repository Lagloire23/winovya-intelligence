import { useState, type ChangeEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ScorePertinence } from '../lib/types'
import { CATEGORY_LABELS } from '../lib/displayHelpers'
import {
  REGIONS,
  FRANCE_ENTIERE,
  TYPE_OPPORTUNITE_OPTIONS,
  getDepartements,
  getEpcis,
  getCommunes,
  type GeoNode,
} from '../lib/geoData'

interface Props {
  presetEntrepriseId: string | null
  onClose: () => void
}

const CATEGORIES = Object.keys(CATEGORY_LABELS).sort()

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function removeCodes(set: Set<string>, codes: Set<string>): Set<string> {
  return new Set(Array.from(set).filter((c) => !codes.has(c)))
}

function lookupName(code: string, buckets: Record<string, GeoNode[]>): string {
  for (const list of Object.values(buckets)) {
    const found = list.find((n) => n.code === code)
    if (found) return found.nom
  }
  return code
}

export function SubscribeModal({ onClose }: Props) {
  const { profile } = useAuth()
  const [email, setEmail] = useState(profile?.email || '')
  const [nom, setNom] = useState(profile?.full_name || '')
  const [scoreMinimum, setScoreMinimum] = useState<ScorePertinence | ''>('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())

  // Geographic drill-down: région -> département -> EPCI (communauté de
  // communes / d'agglo…) -> commune. All four levels are independently
  // selectable checkboxes backed by live data from geo.api.gouv.fr —
  // nothing is typed by hand.
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set())
  const [selectedDepartements, setSelectedDepartements] = useState<Set<string>>(new Set())
  const [selectedEpcis, setSelectedEpcis] = useState<Set<string>>(new Set())
  const [selectedCommunes, setSelectedCommunes] = useState<Set<string>>(new Set())
  const [departementsByRegion, setDepartementsByRegion] = useState<Record<string, GeoNode[]>>({})
  const [epcisByDept, setEpcisByDept] = useState<Record<string, GeoNode[]>>({})
  const [communesByEpci, setCommunesByEpci] = useState<Record<string, GeoNode[]>>({})
  const [loadingDept, setLoadingDept] = useState<Set<string>>(new Set())
  const [loadingEpci, setLoadingEpci] = useState<Set<string>>(new Set())
  const [loadingCommune, setLoadingCommune] = useState<Set<string>>(new Set())
  const [franceEntiere, setFranceEntiere] = useState(false)

  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleMultiSelect(e: ChangeEvent<HTMLSelectElement>, setter: (s: Set<string>) => void) {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value)
    setter(new Set(values))
  }

  async function toggleRegion(region: GeoNode) {
    const willExpand = !selectedRegions.has(region.code)
    setSelectedRegions((prev) => toggle(prev, region.code))
    if (!willExpand) {
      // Collapsing: cascade-clear every descendant selection under this région.
      const depts = departementsByRegion[region.code] || []
      const deptCodes = new Set(depts.map((d) => d.code))
      setSelectedDepartements((d) => removeCodes(d, deptCodes))
      let epciCodesAll = new Set<string>()
      deptCodes.forEach((dc) => (epcisByDept[dc] || []).forEach((e) => epciCodesAll.add(e.code)))
      setSelectedEpcis((e) => removeCodes(e, epciCodesAll))
      let communeCodesAll = new Set<string>()
      epciCodesAll.forEach((ec) => (communesByEpci[ec] || []).forEach((c) => communeCodesAll.add(c.code)))
      setSelectedCommunes((c) => removeCodes(c, communeCodesAll))
      return
    }
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

  async function toggleDepartement(dep: GeoNode) {
    const willExpand = !selectedDepartements.has(dep.code)
    setSelectedDepartements((prev) => toggle(prev, dep.code))
    if (!willExpand) {
      const epcis = epcisByDept[dep.code] || []
      const epciCodes = new Set(epcis.map((e) => e.code))
      setSelectedEpcis((e) => removeCodes(e, epciCodes))
      let communeCodesAll = new Set<string>()
      epciCodes.forEach((ec) => (communesByEpci[ec] || []).forEach((c) => communeCodesAll.add(c.code)))
      setSelectedCommunes((c) => removeCodes(c, communeCodesAll))
      return
    }
    if (!epcisByDept[dep.code]) {
      setLoadingEpci((s) => new Set(s).add(dep.code))
      const epcis = await getEpcis(dep.code)
      setEpcisByDept((prev) => ({ ...prev, [dep.code]: epcis }))
      setLoadingEpci((s) => {
        const n = new Set(s)
        n.delete(dep.code)
        return n
      })
    }
  }

  async function toggleEpci(epci: GeoNode) {
    const willExpand = !selectedEpcis.has(epci.code)
    setSelectedEpcis((prev) => toggle(prev, epci.code))
    if (!willExpand) {
      const communes = communesByEpci[epci.code] || []
      const communeCodes = new Set(communes.map((c) => c.code))
      setSelectedCommunes((c) => removeCodes(c, communeCodes))
      return
    }
    if (!communesByEpci[epci.code]) {
      setLoadingCommune((s) => new Set(s).add(epci.code))
      const communes = await getCommunes(epci.code)
      setCommunesByEpci((prev) => ({ ...prev, [epci.code]: communes }))
      setLoadingCommune((s) => {
        const n = new Set(s)
        n.delete(epci.code)
        return n
      })
    }
  }

  function toggleCommune(commune: GeoNode) {
    setSelectedCommunes((prev) => toggle(prev, commune.code))
  }

  async function subscribe() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('abonnements_alertes').insert({
      email,
      nom: nom || null,
      score_minimum: scoreMinimum || null,
      types_opportunite_suivis: Array.from(selectedTypes),
      categories_veille_suivies: Array.from(selectedCategories),
      regions: franceEntiere ? [] : Array.from(selectedRegions).map((c) => REGIONS.find((r) => r.code === c)?.nom || c),
      departements: franceEntiere ? [] : Array.from(selectedDepartements).map((c) => lookupName(c, departementsByRegion)),
      epci_suivis: franceEntiere ? [] : Array.from(selectedEpcis).map((c) => lookupName(c, epcisByDept)),
      communes_suivies: franceEntiere ? [] : Array.from(selectedCommunes).map((c) => lookupName(c, communesByEpci)),
      statut: 'Actif',
    })
    setSaving(false)
    if (err) setError(err.message)
    else setDone(true)
  }

  const canSubmit = !!email && consent && !saving

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(217,6%,90%)] shrink-0">
          <h2 className="font-heading font-bold text-brand-navy flex items-center gap-2">
            <span aria-hidden>🔔</span> Recevoir des alertes email
          </h2>
          <button onClick={onClose} className="text-[hsl(217,4%,46%)] hover:text-brand-navy">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {done ? (
            <p className="text-sm text-brand-green-deep">
              Abonnement enregistré pour {email}. Vous recevrez un email à chaque nouvelle alerte correspondant à vos
              critères.
            </p>
          ) : (
            <>
              <p className="text-sm text-[hsl(217,4%,46%)]">
                Choisissez vos critères : vous recevrez un email à chaque nouvelle alerte qui correspond, avec un lien
                vers son détail. Laissez un critère vide pour ne pas filtrer dessus.
              </p>

              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Email *
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="prenom.nom@entreprise.fr"
                  className="input-winovya"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Nom (optionnel)
                </label>
                <input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  type="text"
                  placeholder="Prénom Nom"
                  className="input-winovya"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                    Score minimum
                  </label>
                  <select
                    value={scoreMinimum}
                    onChange={(e) => setScoreMinimum(e.target.value as ScorePertinence | '')}
                    className="input-winovya"
                  >
                    <option value="">Tous scores</option>
                    <option value="Très Haute">≥ Très Haute</option>
                    <option value="Haute">≥ Haute</option>
                    <option value="Moyenne">≥ Moyenne</option>
                    <option value="Basse">≥ Basse</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                    Types d'opportunité suivis
                  </label>
                  <select
                    multiple
                    value={Array.from(selectedTypes)}
                    onChange={(e) => handleMultiSelect(e, setSelectedTypes)}
                    className="input-winovya h-28 text-xs"
                  >
                    {TYPE_OPPORTUNITE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1">Aucune sélection = tous les types.</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Catégories de veille suivies
                </label>
                <select
                  multiple
                  value={Array.from(selectedCategories)}
                  onChange={(e) => handleMultiSelect(e, setSelectedCategories)}
                  className="input-winovya h-28 text-xs"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] || c}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1">Aucune sélection = toutes catégories.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Zone géographique suivie
                </label>
                <div className="rounded-md border border-[hsl(217,6%,90%)] max-h-64 overflow-y-auto p-2 space-y-0.5">
                  {REGIONS.map((region) => (
                    <div key={region.code}>
                      <label className="flex items-center gap-2 text-sm text-[hsl(217,10%,25%)] px-1 py-1 rounded hover:bg-brand-neutral/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRegions.has(region.code)}
                          disabled={franceEntiere}
                          onChange={() => toggleRegion(region)}
                          className="accent-brand-primary"
                        />
                        {region.nom}
                        {loadingDept.has(region.code) && <Loader2 size={12} className="animate-spin text-brand-primary" />}
                      </label>

                      {selectedRegions.has(region.code) && !franceEntiere && (
                        <div className="ml-6 space-y-0.5">
                          {(departementsByRegion[region.code] || []).map((dep) => (
                            <div key={dep.code}>
                              <label className="flex items-center gap-2 text-xs text-[hsl(217,10%,25%)] px-1 py-1 rounded hover:bg-brand-neutral/60 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedDepartements.has(dep.code)}
                                  onChange={() => toggleDepartement(dep)}
                                  className="accent-brand-primary"
                                />
                                {dep.nom}
                                {loadingEpci.has(dep.code) && (
                                  <Loader2 size={11} className="animate-spin text-brand-primary" />
                                )}
                              </label>

                              {selectedDepartements.has(dep.code) && (
                                <div className="ml-6 space-y-0.5">
                                  {(epcisByDept[dep.code] || []).map((epci) => (
                                    <div key={epci.code}>
                                      <label className="flex items-center gap-2 text-[11px] text-[hsl(217,10%,25%)] px-1 py-0.5 rounded hover:bg-brand-neutral/60 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={selectedEpcis.has(epci.code)}
                                          onChange={() => toggleEpci(epci)}
                                          className="accent-brand-primary"
                                        />
                                        {epci.nom}
                                        {loadingCommune.has(epci.code) && (
                                          <Loader2 size={10} className="animate-spin text-brand-primary" />
                                        )}
                                      </label>

                                      {selectedEpcis.has(epci.code) && (
                                        <div className="ml-6 grid grid-cols-2 gap-x-2">
                                          {(communesByEpci[epci.code] || []).map((commune) => (
                                            <label
                                              key={commune.code}
                                              className="flex items-center gap-1.5 text-[11px] text-[hsl(217,10%,25%)] px-1 py-0.5 rounded hover:bg-brand-neutral/60 cursor-pointer"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={selectedCommunes.has(commune.code)}
                                                onChange={() => toggleCommune(commune)}
                                                className="accent-brand-primary"
                                              />
                                              {commune.nom}
                                            </label>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <label className="flex items-center gap-2 text-sm text-[hsl(217,10%,25%)] px-1 py-1 rounded hover:bg-brand-neutral/60 cursor-pointer border-t border-[hsl(217,6%,90%)] mt-1 pt-1.5">
                    <input
                      type="checkbox"
                      checked={franceEntiere}
                      onChange={(e) => setFranceEntiere(e.target.checked)}
                      className="accent-brand-primary"
                    />
                    🌍 {FRANCE_ENTIERE}
                  </label>
                </div>
                <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1">
                  Cochez une région pour afficher ses départements, un département pour afficher ses communautés de
                  communes, une communauté de communes pour afficher ses communes membres. Chaque case cochée est
                  suivie indépendamment (une région entière, ou seulement un département/une intercommunalité/une
                  commune précise). Aucune case cochée = France entière.
                </p>
              </div>

              <label className="flex items-start gap-2 text-xs text-[hsl(217,4%,46%)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="accent-brand-primary mt-0.5"
                />
                J'accepte de recevoir des emails de notification pour ces alertes de veille. Je pourrai me
                désabonner à tout moment via le lien présent dans chaque email.
              </label>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>

        {!done && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[hsl(217,6%,90%)] shrink-0">
            <button
              onClick={onClose}
              className="text-sm font-semibold text-[hsl(217,4%,46%)] px-4 py-2 rounded-md hover:bg-brand-neutral/60 transition"
            >
              Annuler
            </button>
            <button onClick={subscribe} disabled={!canSubmit} className="btn-primary">
              {saving ? 'Enregistrement…' : "S'abonner"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
