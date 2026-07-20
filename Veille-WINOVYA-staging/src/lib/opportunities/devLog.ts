// Sprint 8 — Observabilité minimale MVP (Phase 10). Journalisation
// structurée, développement uniquement, jamais de donnée sensible :
// contenu de note utilisateur, secret ou identifiant technique complet
// ne sont jamais inclus dans le message loggé (l'objet d'erreur original
// est passé séparément à console.error pour l'inspection locale du
// développeur, jamais transmis à un service distant — aucun nouveau
// service de monitoring externe n'est intégré dans ce sprint).
//
// Point d'intégration futur documenté : un service comme Sentry pourrait
// wrapper `logDevError` sans changer sa signature ni les appels
// existants (docs/mvp-known-limitations.md).

interface ErrorLogContext {
  /** Écran/composant d'origine, ex. "OpportunitesPage", "NotesPanel". */
  screen: string
  /** Opération en cours, ex. "listDossiers", "changeStatut", "createNote". */
  operation: string
}

/** Catégorie large de l'erreur (jamais le message brut) — suffisant en dev pour trier sans exposer de détail. */
function categorize(e: unknown): string {
  if (e instanceof Error) return e.name || 'Error'
  return typeof e
}

export function logDevError(context: ErrorLogContext, error: unknown): void {
  // import.meta.env.DEV : uniquement en développement local (Vite),
  // jamais en build de production — cohérent avec le reste du projet
  // (src/lib/supabase.ts utilise déjà import.meta.env de la même façon).
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return
  // eslint-disable-next-line no-console
  console.error(`[opportunites] ${context.screen} · ${context.operation} · ${categorize(error)}`, error)
}
