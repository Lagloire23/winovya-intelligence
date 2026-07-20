import { useState } from 'react'
import { Search, Loader2, Mail, Phone, Check, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AlerteWithRelations, Decideur, NatureDecideur } from '../lib/types'
import { LinkedinLink } from './LinkedinLink'
import { DecideurEnrichButton } from './DecideurEnrichButton'

interface FoundContact {
  prenom: string | null
  nom: string | null
  fonction: string | null
  email: string | null
  telephone: string | null
  source: 'document' | 'pappers_dirigeant' | 'pappers_entreprise' | 'rne_elu'
  confiance: 'haute' | 'probable'
}

type Status = 'idle' | 'loading' | 'found' | 'not_found' | 'error' | 'added'

// Libellés de source utilisés uniquement en interne (note enregistrée sur le
// décideur une fois ajouté) — plus affichés à l'écran, sur demande.
const SOURCE_LABEL: Record<FoundContact['source'], string> = {
  document: 'Trouvé directement dans le document/article de l’alerte',
  pappers_dirigeant: 'Dirigeant identifié via les données officielles de l’entreprise',
  pappers_entreprise: 'Coordonnées générales de l’entreprise — aucun nom de contact identifié',
  rne_elu: 'Élu(e) identifié(e) via le Répertoire National des Élus',
}

interface Props {
  alerte: AlerteWithRelations
  onChanged: (id: string, patch: Partial<AlerteWithRelations>) => void
}

export function ContactFinder({ alerte, onChanged }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [contact, setContact] = useState<FoundContact | null>(null)

  async function search() {
    setStatus('loading')
    setContact(null)
    try {
      const { data, error } = await supabase.functions.invoke('find-donneur-ordre-contact', {
        body: {
          acteurEntite: alerte.acteur_entite || '',
          communeCollectivite: alerte.commune_collectivite || '',
          resume: alerte.resume || '',
          texteExtraitDocument: alerte.texte_extrait_document || '',
        },
      })
      if (error) {
        setStatus('error')
      } else if (data?.status === 'FOUND') {
        setContact(data.contact)
        setStatus('found')
      } else if (data?.status === 'NOT_FOUND') {
        setStatus('not_found')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  async function addToDecideurs() {
    if (!contact) return
    const fullName = [contact.prenom, contact.nom].filter(Boolean).join(' ')
    const structure = alerte.acteur_entite || alerte.commune_collectivite || null
    const nature: NatureDecideur | null =
      contact.source === 'rne_elu' ? 'Public' : contact.source.startsWith('pappers') ? 'Privé' : null

    const { data, error } = await supabase
      .from('decideurs')
      .insert({
        nom: fullName || structure || 'Contact',
        structure_entreprise: structure,
        nature,
        nom_personne: contact.nom,
        prenom_personne: contact.prenom,
        fonction_poste: contact.fonction,
        email: contact.email,
        telephone: contact.telephone,
        statut: 'À revérifier',
        notes: `Ajouté automatiquement depuis l'alerte « ${alerte.name} ». Source : ${SOURCE_LABEL[contact.source]}.`,
      })
      .select()
      .single()

    if (error || !data) {
      setStatus('error')
      return
    }

    await supabase.from('alerte_decideurs').insert({ alerte_id: alerte.id, decideur_id: data.id })

    onChanged(alerte.id, { decideurs: [...alerte.decideurs, data as Decideur] })
    setStatus('added')
  }

  if (status === 'added') {
    return <p className="text-xs text-brand-green-deep flex items-center gap-1"><Check size={13} /> Contact ajouté.</p>
  }

  if (status === 'found' && contact) {
    const hasName = Boolean(contact.prenom || contact.nom)
    const enrichable = { prenom_personne: contact.prenom, nom_personne: contact.nom, structure_entreprise: alerte.acteur_entite || alerte.commune_collectivite || null }
    return (
      <div className="rounded-md border border-[hsl(217,6%,90%)] bg-white p-2.5 space-y-1.5">
        {hasName && (
          <p className="text-sm font-semibold text-brand-navy flex items-center gap-1.5">
            {[contact.prenom, contact.nom].filter(Boolean).join(' ')}
            <LinkedinLink url={null} />
          </p>
        )}
        {contact.fonction && <p className="text-xs text-[hsl(217,4%,46%)]">{contact.fonction}</p>}
        <div className="flex flex-wrap gap-2 mt-1 text-xs">
          {contact.email ? (
            <span className="inline-flex items-center gap-1 text-brand-primary"><Mail size={12} /> {contact.email}</span>
          ) : hasName ? (
            <DecideurEnrichButton decideur={enrichable} field="email" />
          ) : null}
          {contact.telephone ? (
            <span className="inline-flex items-center gap-1 text-brand-primary"><Phone size={12} /> {contact.telephone}</span>
          ) : hasName ? (
            <DecideurEnrichButton decideur={enrichable} field="phone" />
          ) : null}
        </div>
        <button onClick={addToDecideurs} className="btn-primary !py-1 !px-3 text-xs mt-1">
          <Check size={12} /> Ajouter aux décideurs
        </button>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[hsl(217,4%,46%)]">
        <Loader2 size={13} className="animate-spin" /> Recherche multi-source…
      </span>
    )
  }

  if (status === 'not_found') {
    return <p className="text-xs text-[hsl(217,4%,46%)]">Aucun contact trouvé automatiquement pour cette alerte.</p>
  }

  if (status === 'error') {
    return <p className="text-xs text-red-600">La recherche a échoué. Réessayez dans un instant.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[hsl(217,4%,46%)]">Aucun contact identifié.</p>
      <button onClick={search} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline">
        <Search size={13} /> Rechercher le contact
        <Sparkles size={11} />
      </button>
    </div>
  )
}
