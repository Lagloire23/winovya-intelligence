// Sprint 8 — Traduction centralisée des erreurs en messages UI (Phase 3/4
// : "gestion d'erreur" est le seul élément que la spec demande de
// centraliser ; aucune abstraction générique disproportionnée n'est
// introduite ailleurs). Point d'entrée UNIQUE pour tous les composants du
// module Opportunités : jamais de stack trace, de SQL, de nom de table,
// de détail interne Supabase ou d'identifiant technique inutile affiché
// à l'utilisateur (Phase 4, règle explicite).
//
// Ne redéfinit AUCUNE règle métier : reconnaît simplement, par
// `instanceof`, les erreurs déjà typées par CommercialService/lifecycle.ts
// (Sprint 6, inchangées) pour leur donner un libellé humain sans les UUID
// qu'elles embarquent (utiles en journalisation dev, jamais côté
// utilisateur — voir devLog.ts).
//
// Fichier volontairement PUR (aucun import Supabase, aucun
// `import.meta.env`) : testable sans environnement Vite (voir
// scripts/sprint8-mvp-tests.ts).

import { InvalidTransitionError } from './commercial/lifecycle'
import { OpportuniteArchivedError, OpportuniteNotFoundError, NoteNotFoundError } from './commercial/CommercialService'

export const GENERIC_ERROR_MESSAGE =
  'Une erreur inattendue est survenue. Réessayez ou contactez le support si le problème persiste.'

/** Forme minimale d'un PostgrestError (Sprint 5/6) sans dépendre du type exact du package. */
interface PostgrestLikeError {
  message: string
  code?: string
}

function isPostgrestLike(e: unknown): e is PostgrestLikeError {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string'
}

/**
 * Traduit une erreur technique/métier en message affichable (Phase 4).
 * `fallback` permet à l'appelant de préciser un message générique adapté
 * au contexte (ex. "Le chargement du dossier a échoué.") quand aucune
 * catégorie connue ne correspond — jamais le message brut de l'erreur
 * d'origine.
 */
export function translateError(e: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (e instanceof InvalidTransitionError) {
    return "Ce changement de statut n'est pas autorisé pour cette opportunité."
  }
  if (e instanceof OpportuniteArchivedError) {
    return "Cette opportunité est archivée : aucune modification n'est possible."
  }
  if (e instanceof OpportuniteNotFoundError) {
    return 'Cette opportunité est introuvable (elle a peut-être été supprimée).'
  }
  if (e instanceof NoteNotFoundError) {
    return 'Cette note est introuvable (elle a peut-être déjà été supprimée).'
  }

  if (isPostgrestLike(e)) {
    const msg = e.message.toLowerCase()
    const code = e.code ?? ''
    if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
      return "Vous n'avez pas les droits nécessaires pour effectuer cette action."
    }
    if (msg.includes('jwt') || msg.includes('session') || code === 'PGRST301') {
      return 'Votre session a expiré. Veuillez vous reconnecter.'
    }
  }

  if (e instanceof TypeError && /fetch|network/i.test(e.message)) {
    return 'Problème de connexion réseau. Vérifiez votre connexion et réessayez.'
  }

  return fallback
}

/** true si l'erreur correspond à une session expirée/invalide (Phase 4) — permet à l'appelant de rediriger vers /login plutôt que de simplement afficher un message. */
export function isSessionExpiredError(e: unknown): boolean {
  if (!isPostgrestLike(e)) return false
  const msg = e.message.toLowerCase()
  return msg.includes('jwt') || e.code === 'PGRST301'
}
