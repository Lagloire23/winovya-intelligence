// Sprint 11B — Barrel du point d'entrée de demande de recalcul.
import { RecalculationRepository } from './RecalculationRepository'

export { RecalculationRepository } from './RecalculationRepository'

/** Construit une instance prête à l'emploi, câblée sur le client Supabase applicatif réel (anon-key). */
export function createRecalculationRepository(): RecalculationRepository {
  return new RecalculationRepository()
}
