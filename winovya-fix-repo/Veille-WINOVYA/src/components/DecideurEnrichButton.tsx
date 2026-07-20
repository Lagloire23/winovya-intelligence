import { useState } from 'react'
import { Mail, Phone, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Decideur } from '../lib/types'

type EnrichStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'in_progress' | 'error' | 'credits'

interface EnrichState {
  status: EnrichStatus
  value?: string
  enrichmentId?: string
}

async function callFullEnrich(payload: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('fullenrich-lookup', { body: payload })
  if (error) return { status: 'ERROR' }
  return data
}

// Bouton "Enrichir email"/"Enrichir tél." pour un décideur, réutilisé partout
// où un contact est affiché sans coordonnées connues (section Contacts d'une
// alerte, popup Décideurs & organigrammes…). Appelle la fonction Edge
// FullEnrich côté serveur, avec repli sur un sondage (poll) si l'enrichissement
// est encore en cours. Le mot "FullEnrich" n'est jamais montré à l'utilisateur.
type EnrichableContact = Pick<Decideur, 'prenom_personne' | 'nom_personne' | 'structure_entreprise'>

export function DecideurEnrichButton({ decideur, field }: { decideur: EnrichableContact; field: 'email' | 'phone' }) {
  const [state, setState] = useState<EnrichState>({ status: 'idle' })

  async function poll(enrichmentId: string, attemptsLeft: number) {
    if (attemptsLeft <= 0) {
      setState({ status: 'in_progress', enrichmentId })
      return
    }
    const result = await callFullEnrich({ action: 'poll', enrichmentId, field })
    if (result.status === 'FINISHED') setState({ status: 'found', value: result.value })
    else if (result.status === 'NOT_FOUND') setState({ status: 'not_found' })
    else if (result.status === 'CREDITS_INSUFFICIENT') setState({ status: 'credits' })
    else if (result.status === 'ERROR') setState({ status: 'error' })
    else await poll(enrichmentId, attemptsLeft - 1)
  }

  async function run() {
    setState({ status: 'loading' })
    const result = await callFullEnrich({
      action: 'start',
      firstName: decideur.prenom_personne,
      lastName: decideur.nom_personne,
      companyName: decideur.structure_entreprise || undefined,
      field,
    })
    if (result.status === 'FINISHED') setState({ status: 'found', value: result.value })
    else if (result.status === 'NOT_FOUND') setState({ status: 'not_found' })
    else if (result.status === 'CREDITS_INSUFFICIENT') setState({ status: 'credits' })
    else if (result.status === 'ERROR') setState({ status: 'error' })
    else if (result.status === 'IN_PROGRESS' && result.enrichmentId) await poll(result.enrichmentId, 3)
    else setState({ status: 'error' })
  }

  if (state.status === 'found' && state.value) {
    return field === 'email' ? (
      <a href={`mailto:${state.value}`} className="text-xs inline-flex items-center gap-1 text-brand-primary">
        <Mail size={12} /> {state.value}
      </a>
    ) : (
      <a href={`tel:${state.value}`} className="text-xs inline-flex items-center gap-1 text-brand-primary">
        <Phone size={12} /> {state.value}
      </a>
    )
  }

  if (state.status === 'loading') {
    return (
      <span className="text-xs inline-flex items-center gap-1 text-[hsl(217,4%,46%)]">
        <Loader2 size={12} className="animate-spin" /> Recherche…
      </span>
    )
  }

  if (state.status === 'not_found') {
    return <span className="text-xs text-[hsl(217,4%,46%)]">Aucun résultat</span>
  }

  if (state.status === 'in_progress') {
    return (
      <button onClick={() => poll(state.enrichmentId!, 3)} className="text-xs text-brand-primary underline">
        En cours — cliquer pour vérifier
      </button>
    )
  }

  if (state.status === 'credits') {
    return <span className="text-xs text-red-600">Crédit insuffisant</span>
  }

  if (state.status === 'error') {
    return <span className="text-xs text-red-600">Erreur</span>
  }

  return (
    <button
      onClick={run}
      className="text-xs inline-flex items-center gap-1 bg-brand-primary text-white px-2 py-1 rounded-md hover:opacity-90 transition"
    >
      {field === 'email' ? <Mail size={12} /> : <Phone size={12} />}
      {field === 'email' ? 'Enrichir email' : 'Enrichir tél.'}
    </button>
  )
}
