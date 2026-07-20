import { useState } from 'react'
import { X, Search, Loader2, Mail, Phone, Users, Building2, MapPin, Globe, TrendingUp, Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Decideur } from '../lib/types'
import { LinkedinLink } from './LinkedinLink'
import { DecideurEnrichButton } from './DecideurEnrichButton'

interface Props {
  presetEntrepriseId: string | null
  onClose: () => void
}

interface Dirigeant {
  nom: string
  qualite: string | null
}

interface CompanyFinances {
  annee: number | null
  chiffreAffaires: number | null
  margeBrute: number | null
  valeurAjoutee: number | null
  excedentBrutExploitation: number | null
  resultatExploitation: number | null
  resultatNet: number | null
}

interface EntrepriseLiee {
  siren: string
  nom: string
  viaPersonne: string
  qualite: string | null
}

interface CompanyInfo {
  nom: string | null
  siren: string | null
  siret: string | null
  formeJuridique: string | null
  adresse: string | null
  latitude: number | null
  longitude: number | null
  codeNaf: string | null
  libelleNaf: string | null
  dateCreation: string | null
  effectif: string | null
  siteWeb: string | null
  telephone: string | null
  email: string | null
  finances: CompanyFinances | null
  dirigeants: Dirigeant[]
  reseau: EntrepriseLiee[]
}

type PappersStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'not_configured' | 'error'

function formatMontant(v: number | null): string | null {
  if (v === null || v === undefined) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v)
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// Graphe radial simple (SVG fait main, sans librairie) : le nœud central est
// l'entreprise recherchée, les nœuds satellites sont les entreprises liées
// via un dirigeant commun (dirigeant/administrateur/gérant réel — les
// commissaires aux comptes et mandataires multi-cartes sont déjà exclus
// côté serveur pour éviter un réseau bruité). Ce n'est pas un réseau
// "donneurs d'ordre / attributaires" de marchés publics (donnée non
// disponible via Pappers) mais un réseau de dirigeants communs.
function ReseauGraph({ nomEntreprise, liens }: { nomEntreprise: string; liens: EntrepriseLiee[] }) {
  const shown = liens.slice(0, 12)
  const size = 340
  const center = size / 2
  const radius = 128
  const nodeR = 16
  const centerR = 22

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[340px] mx-auto" role="img" aria-label="Réseau d'entreprises liées">
        {shown.map((ent, i) => {
          const angle = (2 * Math.PI * i) / shown.length - Math.PI / 2
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)
          return (
            <line
              key={`line-${ent.siren}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="hsl(217,6%,85%)"
              strokeWidth={1.5}
            />
          )
        })}
        {shown.map((ent, i) => {
          const angle = (2 * Math.PI * i) / shown.length - Math.PI / 2
          const x = center + radius * Math.cos(angle)
          const y = center + radius * Math.sin(angle)
          const labelY = y + (Math.sin(angle) >= 0 ? 1 : -1) * (nodeR + 11)
          return (
            <g key={ent.siren}>
              <circle cx={x} cy={y} r={nodeR} fill="hsl(217,42%,45%)" fillOpacity={0.12} stroke="hsl(217,42%,45%)" strokeWidth={1.5} />
              <text x={x} y={y + 3} textAnchor="middle" fontSize={9} fill="hsl(217,42%,45%)" fontWeight={700}>
                {truncate(ent.nom, 2).toUpperCase()}
              </text>
              <text x={x} y={labelY} textAnchor="middle" fontSize={8.5} fill="hsl(217,10%,25%)">
                {truncate(ent.nom, 16)}
              </text>
            </g>
          )
        })}
        <circle cx={center} cy={center} r={centerR} fill="hsl(149,100%,27%)" fillOpacity={0.15} stroke="hsl(149,100%,27%)" strokeWidth={2} />
        <text x={center} y={center + 4} textAnchor="middle" fontSize={9} fill="hsl(149,100%,27%)" fontWeight={700}>
          {truncate(nomEntreprise, 14)}
        </text>
      </svg>
      <div className="flex items-center justify-center gap-4 mt-1 text-[11px] text-[hsl(217,4%,46%)]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-green-deep/20 border border-brand-green-deep" />
          Établissement recherché
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-brand-primary/20 border border-brand-primary" />
          Entreprises liées (dirigeant commun)
        </span>
      </div>
      {liens.length > shown.length && (
        <p className="text-center text-xs text-[hsl(217,4%,46%)] mt-1">+ {liens.length - shown.length} autres</p>
      )}
    </div>
  )
}

export function DecideursModal({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [decideurs, setDecideurs] = useState<Decideur[]>([])
  const [pappersStatus, setPappersStatus] = useState<PappersStatus>('idle')
  const [company, setCompany] = useState<CompanyInfo | null>(null)

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setSearched(true)
    setDecideurs([])
    setOrgName(null)
    setCompany(null)
    setPappersStatus('idle')

    // Recherche sur les décideurs (personnes) ET les sociétés/structures en
    // base — jamais sur les collectivités en tant que telles (ça, c'est le
    // rôle du popup "Trouver le maire ou élu·e d'une commune"). On matche
    // donc sur le nom de la structure, le nom du décideur ou son
    // prénom/nom séparés.
    const safeQ = q.replace(/[,()]/g, ' ').trim()
    const { data } = await supabase
      .from('decideurs')
      .select('*')
      .or(
        `structure_entreprise.ilike.%${safeQ}%,nom.ilike.%${safeQ}%,nom_personne.ilike.%${safeQ}%,prenom_personne.ilike.%${safeQ}%`
      )
      .order('structure_entreprise')
      .limit(50)

    const rows = (data as Decideur[]) || []
    setDecideurs(rows)
    if (rows.length > 0) setOrgName(rows[0].structure_entreprise)

    // On complète automatiquement avec des données officielles d'entreprise
    // quand la structure trouvée est une entreprise privée, ou quand aucune
    // structure n'a été trouvée dans notre base de décideurs (la recherche
    // peut alors porter directement sur une raison sociale ou un SIREN).
    const isPrive = rows.length > 0 && rows.every((d) => d.nature === 'Privé')
    const shouldTryPappers = rows.length === 0 || isPrive

    if (shouldTryPappers) {
      setPappersStatus('loading')
      try {
        const { data: fnData, error } = await supabase.functions.invoke('pappers-lookup', { body: { query: q } })
        if (error) {
          setPappersStatus('error')
        } else if (fnData?.status === 'FOUND') {
          setCompany(fnData.company)
          setPappersStatus('found')
        } else if (fnData?.status === 'NOT_CONFIGURED') {
          setPappersStatus('not_configured')
        } else if (fnData?.status === 'NOT_FOUND') {
          setPappersStatus('not_found')
        } else {
          setPappersStatus('error')
        }
      } catch {
        setPappersStatus('error')
      }
    }

    setLoading(false)
  }

  const hasResults = decideurs.length > 0 || company !== null
  const showNoResults = !loading && searched && !hasResults && pappersStatus !== 'loading' && pappersStatus !== 'not_configured'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(217,6%,90%)] shrink-0">
          <h2 className="font-heading font-bold text-brand-navy flex items-center gap-2">
            <Users size={16} /> Décideurs &amp; organigrammes
          </h2>
          <button onClick={onClose} className="text-[hsl(217,4%,46%)] hover:text-brand-navy">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className="text-sm font-semibold text-brand-primary mb-1.5 block">
              Rechercher un décideur ou une entreprise
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  search()
                }
              }}
              type="text"
              placeholder="Ex. MBDA, Jean Dupont, Cetim…"
              className="input-winovya"
            />
            <p className="text-xs text-[hsl(217,4%,46%)] mt-1">
              Recherche dans notre base de décideurs et, pour les entreprises privées, complétée automatiquement.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-brand-primary" size={24} />
            </div>
          )}

          {showNoResults && (
            <p className="text-sm text-[hsl(217,4%,46%)]">Aucun résultat pour « {query} ».</p>
          )}

          {!loading && decideurs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Building2 size={13} /> {orgName}
              </p>
              <div className="space-y-2">
                {decideurs.map((d) => (
                  <div key={d.id} className="card-winovya p-3">
                    <p className="text-sm font-semibold text-brand-navy flex items-center gap-1.5">
                      {[d.prenom_personne, d.nom_personne].filter(Boolean).join(' ') || d.nom}
                      <LinkedinLink url={d.linkedin} />
                    </p>
                    {d.fonction_poste && (
                      <p className="text-xs text-[hsl(217,4%,46%)]">{d.fonction_poste}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                      {d.email ? (
                        <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1 text-brand-primary">
                          <Mail size={12} /> {d.email}
                        </a>
                      ) : (
                        <DecideurEnrichButton decideur={d} field="email" />
                      )}
                      {d.telephone ? (
                        <a href={`tel:${d.telephone}`} className="inline-flex items-center gap-1 text-brand-primary">
                          <Phone size={12} /> {d.telephone}
                        </a>
                      ) : (
                        <DecideurEnrichButton decideur={d} field="phone" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && pappersStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-[hsl(217,4%,46%)] py-1">
              <Loader2 size={13} className="animate-spin" /> Recherche entreprise…
            </div>
          )}

          {!loading && pappersStatus === 'not_configured' && decideurs.length === 0 && (
            <p className="text-xs text-[hsl(217,4%,46%)] italic">
              Recherche d'entreprise non disponible pour le moment.
            </p>
          )}

          {!loading && pappersStatus === 'error' && (
            <p className="text-xs text-red-600">La recherche entreprise a échoué. Réessayez dans un instant.</p>
          )}

          {!loading && pappersStatus === 'found' && company && (
            <div className="space-y-3">
              <div className="card-winovya p-3">
                <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Building2 size={13} /> Informations
                </p>
                <p className="text-sm font-semibold text-brand-navy">{company.nom}</p>
                {(company.formeJuridique || company.libelleNaf) && (
                  <p className="text-xs text-[hsl(217,4%,46%)] mt-0.5">
                    {[company.formeJuridique, company.libelleNaf].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                  {company.siren && (
                    <div>
                      <span className="text-[hsl(217,4%,46%)]">SIREN </span>
                      {company.siren}
                    </div>
                  )}
                  {company.siret && (
                    <div>
                      <span className="text-[hsl(217,4%,46%)]">SIRET siège </span>
                      {company.siret}
                    </div>
                  )}
                  {company.dateCreation && (
                    <div>
                      <span className="text-[hsl(217,4%,46%)]">Créée le </span>
                      {new Date(company.dateCreation).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                  {company.effectif && (
                    <div>
                      <span className="text-[hsl(217,4%,46%)]">Effectif </span>
                      {company.effectif}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  {company.email && (
                    <a href={`mailto:${company.email}`} className="inline-flex items-center gap-1 text-brand-primary">
                      <Mail size={12} /> {company.email}
                    </a>
                  )}
                  {company.telephone && (
                    <a href={`tel:${company.telephone}`} className="inline-flex items-center gap-1 text-brand-primary">
                      <Phone size={12} /> {company.telephone}
                    </a>
                  )}
                  {company.siteWeb && (
                    <a
                      href={company.siteWeb}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                    >
                      <Globe size={12} /> {company.siteWeb}
                    </a>
                  )}
                </div>
                {company.adresse && (
                  <p className="text-xs text-[hsl(217,4%,46%)] mt-2 flex items-center gap-1">
                    <MapPin size={12} className="shrink-0" /> {company.adresse}
                  </p>
                )}
                {company.latitude != null && company.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${company.latitude},${company.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-primary mt-1 inline-flex items-center gap-1 hover:underline ml-[18px]"
                  >
                    Voir sur la carte
                  </a>
                )}
              </div>

              {company.dirigeants.length > 0 && (
                <div className="card-winovya p-3">
                  <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Users size={13} /> Contacts
                  </p>
                  <ul className="text-sm space-y-1.5">
                    {company.dirigeants.map((dir, i) => (
                      <li key={i}>
                        <span className="font-semibold text-brand-navy">{dir.nom}</span>
                        {dir.qualite && (
                          <span className="block text-xs text-[hsl(217,4%,46%)]">{dir.qualite}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {company.finances && (
                <div className="card-winovya p-3">
                  <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <TrendingUp size={13} />
                    Informations financières{company.finances.annee ? ` — exercice ${company.finances.annee}` : ''}
                  </p>
                  <dl className="text-xs space-y-1">
                    {company.finances.chiffreAffaires !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Chiffre d'affaires</dt>
                        <dd className="font-semibold text-brand-navy">
                          {formatMontant(company.finances.chiffreAffaires)}
                        </dd>
                      </div>
                    )}
                    {company.finances.margeBrute !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Marge brute</dt>
                        <dd className="font-semibold text-brand-navy">{formatMontant(company.finances.margeBrute)}</dd>
                      </div>
                    )}
                    {company.finances.valeurAjoutee !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Valeur ajoutée</dt>
                        <dd className="font-semibold text-brand-navy">
                          {formatMontant(company.finances.valeurAjoutee)}
                        </dd>
                      </div>
                    )}
                    {company.finances.excedentBrutExploitation !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Excédent brut d'exploitation</dt>
                        <dd className="font-semibold text-brand-navy">
                          {formatMontant(company.finances.excedentBrutExploitation)}
                        </dd>
                      </div>
                    )}
                    {company.finances.resultatExploitation !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Résultat d'exploitation</dt>
                        <dd className="font-semibold text-brand-navy">
                          {formatMontant(company.finances.resultatExploitation)}
                        </dd>
                      </div>
                    )}
                    {company.finances.resultatNet !== null && (
                      <div className="flex justify-between">
                        <dt className="text-[hsl(217,4%,46%)]">Résultat net</dt>
                        <dd className="font-semibold text-brand-navy">{formatMontant(company.finances.resultatNet)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {company.reseau.length > 0 && (
                <div className="card-winovya p-3">
                  <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Share2 size={13} /> Réseau — entreprises liées
                  </p>
                  <ReseauGraph nomEntreprise={company.nom || '—'} liens={company.reseau} />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[hsl(217,6%,90%)] shrink-0">
          <button
            onClick={onClose}
            className="text-sm font-semibold text-[hsl(217,4%,46%)] px-4 py-2 rounded-md hover:bg-brand-neutral/60 transition"
          >
            Fermer
          </button>
          <button onClick={search} disabled={!query.trim() || loading} className="btn-primary">
            <Search size={14} /> Rechercher
          </button>
        </div>
      </div>
    </div>
  )
}
