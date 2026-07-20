import { FormEvent, useState } from 'react'
import { X, Send, Loader2, UserPlus, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AlerteWithRelations } from '../lib/types'

interface Props {
  alerte: AlerteWithRelations
  onClose: () => void
  onAssigned: (email: string) => void
}

// Popup "Assigner cette alerte à un(e) collègue" : e-mail + message
// d'accompagnement. Envoie la demande à l'edge function assign-alert, qui
// exige que le destinataire ait DÉJÀ un compte WINOVYA Market Intelligence
// (création manuelle uniquement, via Administration → Utilisateurs) — dans
// ce cas un email avec un lien de connexion direct (magic link) est envoyé,
// et la personne est ramenée sur cette alerte précise une fois connectée.
export function AssignAlertModal({ alerte, onClose, onAssigned }: Props) {
  const [email, setEmail] = useState(alerte.assigne_email || '')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    const fallback = "L'assignation a échoué. Réessayez dans un instant."
    try {
      const { data, error: fnError } = await supabase.functions.invoke('assign-alert', {
        body: { alerteId: alerte.id, email: trimmed, message: message.trim() },
      })
      if (fnError || !data?.ok) {
        // Quand l'edge function répond avec un statut d'erreur (400/500...),
        // supabase-js renvoie `data: null` et met le détail dans
        // `fnError.context` (la Response brute) plutôt que dans `data` — il
        // faut donc explicitement relire son corps JSON pour récupérer le
        // vrai message ("email requis", "aucun compte pour cette adresse",
        // etc.) au lieu de toujours retomber sur le message générique.
        let serverMessage: string | undefined = data?.error
        const ctx = (fnError as unknown as { context?: Response })?.context
        if (!serverMessage && ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.clone().json()
            serverMessage = body?.error
          } catch {
            // corps non-JSON ou déjà consommé : on garde le message générique
          }
        }
        setError(serverMessage || fallback)
      } else {
        setDone(true)
        onAssigned(trimmed)
      }
    } catch {
      setError(fallback)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-[hsl(217,6%,90%)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(217,6%,90%)]">
          <p className="text-sm font-semibold text-brand-navy flex items-center gap-1.5">
            <UserPlus size={15} className="text-brand-primary" /> Assigner cette alerte
          </p>
          <button onClick={onClose} className="text-[hsl(217,4%,46%)] hover:text-brand-navy">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="p-5 space-y-3">
            <p className="text-sm text-brand-green-deep bg-brand-green-light/10 border border-brand-green-light/30 rounded-md p-3 flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>Alerte assignée. Un email avec un lien de connexion direct vers cette alerte a été envoyé.</span>
            </p>
            <button onClick={onClose} className="btn-primary w-full">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-[hsl(217,4%,46%)]">
              La personne recevra un email avec un bouton qui la renvoie directement sur cette alerte. Si elle n'a pas
              encore de compte WINOVYA Market Intelligence, il devra en créer un ou demander à son administrateur la
              création d'un compte.
            </p>
            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                Adresse email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collegue@entreprise.fr"
                className="input-winovya"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                Message d'accompagnement (optionnel)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ex. Peux-tu regarder cette opportunité et me dire si on y répond ?"
                rows={3}
                className="input-winovya resize-none"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Annuler
              </button>
              <button type="submit" disabled={!email.trim() || loading} className="btn-primary flex-1">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Assigner
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
