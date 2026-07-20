import { useState } from 'react'
import { Sparkles, Send, Loader2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AlerteWithRelations } from '../lib/types'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Contexte "pourquoi cette alerte est pertinente pour telle entreprise
// cliente WINOVYA", calcule par AlertRow a partir des tables
// pertinence_entreprise + entreprises. Transmis a l'edge function pour que
// l'assistant puisse repondre a des questions comme "en quoi est-ce
// interessant pour Cetim ?" avec des donnees reelles, jamais inventees.
interface PertinenceContext {
  entrepriseName: string | null
  scorePertinence: string | null
  typeOpportunite: string[] | null
  lienBusiness: string | null
  donneurOrdreDejaClient: string | null
  competences: string | null
  secteursIntervention: string | null
  descriptionCourte: string | null
  motsClesMetiers: string | null
}

// Chat RAG dont l'unique base de connaissance est le contenu deja rattache a
// CETTE alerte (resume, texte extrait du document, page source citee, noms
// des pieces jointes, pertinence/profil des entreprises clientes concernees)
// -- jamais de connaissance externe. Cote serveur, l'edge function
// "alert-assistant" applique la meme regle stricte dans son prompt systeme.
// Conversation ephemere (non persistee), propre a chaque alerte ouverte.
export function AlertAssistant({
  alerte,
  pertinences,
}: {
  alerte: AlerteWithRelations
  pertinences: PertinenceContext[]
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setError(null)
    const nextMessages = [...messages, { role: 'user', content: question } as Message]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('alert-assistant', {
        body: {
          question,
          history: nextMessages.slice(-6),
          alerte: {
            name: alerte.name,
            categorieVeille: alerte.categorie_veille,
            acteurEntite: alerte.acteur_entite,
            referenceOfficielle: alerte.reference_officielle,
            datePublication: alerte.date_publication,
            echeanceDateLimite: alerte.echeance_date_limite,
            montant: alerte.montant,
            resume: alerte.resume,
            texteExtraitDocument: alerte.texte_extrait_document,
            lienSourceUrl: alerte.lien_source_url,
            attachments: alerte.attachments.map((a) => a.filename).filter(Boolean),
            pertinences,
          },
        },
      })
      if (fnError || data?.status !== 'OK') {
        setError("L'assistant n'a pas pu répondre. Réessayez dans un instant.")
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }])
      }
    } catch {
      setError("L'assistant n'a pas pu répondre. Réessayez dans un instant.")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-primary text-white font-semibold text-xs px-4 py-2 rounded-md hover:opacity-90 transition"
      >
        <Sparkles size={14} />
        Assistant IA
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-[hsl(217,6%,90%)] bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-brand-neutral/40 border-b border-[hsl(217,6%,90%)]">
        <p className="text-xs font-semibold text-brand-navy flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-primary" /> Assistant IA — sources de cette alerte
        </p>
        <button onClick={() => setOpen(false)} className="text-[hsl(217,4%,46%)] hover:text-brand-navy">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-[hsl(217,4%,46%)]">
            Posez une question sur cette alerte — l'assistant répond uniquement à partir du résumé, du texte extrait
            du document et de la page source citée ci-dessus. Il vous dira honnêtement s'il ne trouve pas la réponse
            dans ces sources.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs rounded-md px-3 py-2 max-w-[92%] whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-brand-primary text-white ml-auto'
                : 'bg-brand-neutral/60 text-[hsl(217,10%,25%)]'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-[hsl(217,4%,46%)]">
            <Loader2 size={12} className="animate-spin" /> L'assistant réfléchit…
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex items-center gap-2 p-2 border-t border-[hsl(217,6%,90%)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ask()
            }
          }}
          type="text"
          placeholder="Ex. Quel est le montant ? Qui est concerné ?"
          className="input-winovya text-xs flex-1"
        />
        <button onClick={ask} disabled={!input.trim() || loading} className="btn-primary !py-1.5 !px-3 text-xs shrink-0">
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
