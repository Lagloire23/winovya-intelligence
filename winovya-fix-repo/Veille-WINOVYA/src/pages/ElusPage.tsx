import { useState } from 'react'
import { Search, Loader2, Mail, Phone, Globe, MapPin, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  searchCommunes,
  searchElusByName,
  getMunicipalCouncil,
  getMairieContact,
  type Elu,
  type MairieContact,
} from '../lib/rneApi'

interface EluCardData {
  elu: Elu
  contact: MairieContact | null
}

type EnrichStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'in_progress' | 'error' | 'credits'

interface EnrichState {
  status: EnrichStatus
  value?: string
  enrichmentId?: string
}

function fonctionBadgeClass(fonction: string | null): string {
  if (!fonction) return 'bg-brand-neutral text-[hsl(217,4%,46%)] border-[hsl(217,6%,90%)]'
  if (fonction === 'Maire' || fonction.toLowerCase().includes('président'))
    return 'bg-brand-primary/10 text-brand-primary border-brand-primary/30'
  return 'bg-brand-neutral text-brand-navy border-[hsl(217,6%,90%)]'
}

async function callFullEnrich(payload: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('fullenrich-lookup', { body: payload })
  if (error) return { status: 'ERROR', message: error.message }
  return data
}

function EnrichButton({
  label,
  elu,
  field,
}: {
  label: string
  elu: Elu
  field: 'email' | 'phone'
}) {
  const [state, setState] = useState<EnrichState>({ status: 'idle' })

  async function poll(enrichmentId: string, attemptsLeft: number) {
    if (attemptsLeft <= 0) {
      setState({ status: 'in_progress', enrichmentId })
      return
    }
    const result = await callFullEnrich({ action: 'poll', enrichmentId, field })
    if (result.status === 'FINISHED') {
      setState({ status: 'found', value: result.value })
    } else if (result.status === 'NOT_FOUND') {
      setState({ status: 'not_found' })
    } else if (result.status === 'CREDITS_INSUFFICIENT') {
      setState({ status: 'credits' })
    } else if (result.status === 'ERROR') {
      setState({ status: 'error' })
    } else {
      await poll(enrichmentId, attemptsLeft - 1)
    }
  }

  async function run() {
    setState({ status: 'loading' })
    const companyName =
      elu.mandat === 'Municipal'
        ? elu.commune
        : elu.mandat === 'Communautaire (EPCI)'
          ? elu.epci
          : elu.mandat?.toLowerCase().includes('départemental')
            ? elu.departement
            : elu.region
    const result = await callFullEnrich({
      action: 'start',
      firstName: elu.prenom,
      lastName: elu.nom,
      companyName: companyName || undefined,
      field,
    })
    if (result.status === 'FINISHED') {
      setState({ status: 'found', value: result.value })
    } else if (result.status === 'NOT_FOUND') {
      setState({ status: 'not_found' })
    } else if (result.status === 'CREDITS_INSUFFICIENT') {
      setState({ status: 'credits' })
    } else if (result.status === 'ERROR') {
      setState({ status: 'error' })
    } else if (result.status === 'IN_PROGRESS' && result.enrichmentId) {
      await poll(result.enrichmentId, 3)
    } else {
      setState({ status: 'error' })
    }
  }

  if (state.status === 'found' && state.value) {
    return field === 'email' ? (
      <a href={`mailto:${state.value}`} className="inline-flex items-center gap-1 text-brand-primary text-[11px]">
        <Mail size={11} /> {state.value}
      </a>
    ) : (
      <a href={`tel:${state.value}`} className="inline-flex items-center gap-1 text-brand-primary text-[11px]">
        <Phone size={11} /> {state.value}
      </a>
    )
  }

  if (state.status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(217,4%,46%)]">
        <Loader2 size={11} className="animate-spin" /> Recherche…
      </span>
    )
  }

  if (state.status === 'not_found') {
    return <span className="text-[11px] text-[hsl(217,4%,46%)]">Aucun résultat</span>
  }

  if (state.status === 'in_progress') {
    return (
      <button onClick={() => poll(state.enrichmentId!, 3)} className="text-[11px] text-brand-primary underline">
        Toujours en cours — cliquer pour vérifier
      </button>
    )
  }

  if (state.status === 'credits') {
    return <span className="text-[11px] text-red-600">Crédit insuffisant</span>
  }

  if (state.status === 'error') {
    return <span className="text-[11px] text-red-600">Erreur</span>
  }

  return (
    <button onClick={run} className="inline-flex items-center gap-1 text-[11px] text-brand-primary hover:underline">
      <Sparkles size={11} /> {label}
    </button>
  )
}

function EluCard({ elu, contact }: EluCardData) {
  return (
    <div className="card-winovya p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-navy">{[elu.prenom, elu.nom].filter(Boolean).join(' ')}</p>
          <p className="text-xs text-[hsl(217,4%,46%)] mt-0.5">
            {[elu.commune, elu.departement, elu.region].filter(Boolean).join(' · ')}
          </p>
        </div>
        {elu.fonction && <span className={`badge shrink-0 ${fonctionBadgeClass(elu.fonction)}`}>{elu.fonction}</span>}
      </div>
      <p className="text-xs text-[hsl(217,4%,46%)] mt-1.5">
        Mandat {elu.mandat?.toLowerCase() || ''}
        {elu.dateDebutMandat ? ` depuis le ${new Date(elu.dateDebutMandat).toLocaleDateString('fr-FR')}` : ''}
      </p>

      <div className="mt-3 pt-3 border-t border-[hsl(217,6%,90%)] space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {contact?.telephone ? (
            <a href={`tel:${contact.telephone}`} className="inline-flex items-center gap-1 text-brand-primary text-xs">
              <Phone size={12} /> {contact.telephone}
            </a>
          ) : (
            <span className="text-xs text-[hsl(217,4%,46%)]">Téléphone de la mairie non disponible.</span>
          )}
        </div>
        <EnrichButton label="Enrichir téléphone" elu={elu} field="phone" />

        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
          {contact?.email ? (
            <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1 text-brand-primary text-xs">
              <Mail size={12} /> {contact.email}
            </a>
          ) : (
            <span className="text-xs text-[hsl(217,4%,46%)]">Email de la mairie non disponible.</span>
          )}
        </div>
        <EnrichButton label="Enrichir email" elu={elu} field="email" />

        {contact?.siteWeb && (
          <a
            href={contact.siteWeb}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand-primary text-xs pt-1"
          >
            <Globe size={12} /> Site de la mairie
          </a>
        )}
      </div>
    </div>
  )
}

export function ElusPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [communeLabel, setCommuneLabel] = useState<string | null>(null)
  const [communeTotal, setCommuneTotal] = useState(0)
  const [communeElus, setCommuneElus] = useState<EluCardData[]>([])

  const [nameElus, setNameElus] = useState<EluCardData[]>([])
  const [nameTotal, setNameTotal] = useState(0)

  async function attachContacts(elus: Elu[]): Promise<EluCardData[]> {
    const uniqueCodes = Array.from(new Set(elus.map((e) => e.comCode).filter(Boolean))) as string[]
    const contactByCode = new Map<string, MairieContact | null>()
    await Promise.all(
      uniqueCodes.map(async (code) => {
        contactByCode.set(code, await getMairieContact(code))
      })
    )
    return elus.map((elu) => ({ elu, contact: elu.comCode ? contactByCode.get(elu.comCode) || null : null }))
  }

  async function search() {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setSearched(true)
    setError(null)
    setCommuneLabel(null)
    setCommuneElus([])
    setCommuneTotal(0)
    setNameElus([])
    setNameTotal(0)

    try {
      const [communeMatches, nameResult] = await Promise.all([searchCommunes(q), searchElusByName(q)])

      if (nameResult.elus.length > 0) {
        setNameTotal(nameResult.total)
        setNameElus(await attachContacts(nameResult.elus))
      }

      const bestCommune = communeMatches[0]
      if (bestCommune && bestCommune.score > 0.35) {
        const council = await getMunicipalCouncil(bestCommune.code)
        if (council.elus.length > 0) {
          setCommuneLabel(bestCommune.nom)
          setCommuneTotal(council.total)
          setCommuneElus(await attachContacts(council.elus))
        }
      }

      if (nameResult.elus.length === 0 && (!bestCommune || bestCommune.score <= 0.35)) {
        setError('Aucun résultat. Vérifiez l\'orthographe de la commune ou du nom de l\'élu.')
      }
    } catch {
      setError('La recherche a échoué. Réessayez dans un instant.')
    }
    setLoading(false)
  }

  const hasResults = communeElus.length > 0 || nameElus.length > 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-brand-navy mb-1 flex items-center gap-2">
          <MapPin size={22} /> Trouver le maire ou élu(e) d'une commune
        </h1>
        <p className="text-sm text-[hsl(217,4%,46%)]">
          Recherchez par nom de commune ou directement par nom d'élu·e.
        </p>
      </div>

      <div className="card-winovya p-5 mb-6">
        <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
          Nom de la commune
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
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
            placeholder="Ex. Béziers, Saint-Denis, Argenteuil…"
            className="input-winovya flex-1"
          />
          <button onClick={search} disabled={!query.trim() || loading} className="btn-primary shrink-0">
            <Search size={14} /> Rechercher
          </button>
        </div>
        <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1.5">
          Vous pouvez aussi saisir directement le nom d'un·e élu·e (ex. « Dupont »).
        </p>
      </div>

      {error && <p className="text-xs text-red-600 mb-4">{error}</p>}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="animate-spin text-brand-primary" size={26} />
        </div>
      )}

      {!loading && searched && hasResults && (
        <div className="space-y-6">
          {nameElus.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2">
                Élu(e)s correspondant à « {query} » {nameTotal > nameElus.length ? `(${nameElus.length} sur ${nameTotal})` : ''}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nameElus.map((c, i) => (
                  <EluCard key={i} elu={c.elu} contact={c.contact} />
                ))}
              </div>
            </div>
          )}

          {communeElus.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin size={12} /> Conseil municipal de {communeLabel}
                {communeTotal > communeElus.length ? ` (${communeElus.length} sur ${communeTotal})` : ''}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {communeElus.map((c, i) => (
                  <EluCard key={i} elu={c.elu} contact={c.contact} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
