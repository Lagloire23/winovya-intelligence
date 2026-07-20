// Sprint 11B — Barrel du domaine métier de retrait/réintégration logique
// d'une alerte liée à une opportunité.
import { AlerteRetraitRepository } from './AlerteRetraitRepository'
import { AlerteRetraitService } from './AlerteRetraitService'
import { RecalculationRepository } from '../recalculation/RecalculationRepository'

export * from './types'
export { AlerteRetraitRepository } from './AlerteRetraitRepository'
export { AlerteRetraitService } from './AlerteRetraitService'

/** Construit une instance prête à l'emploi, câblée sur le client Supabase applicatif réel (anon-key). */
export function createAlerteRetraitService(): AlerteRetraitService {
  return new AlerteRetraitService(new AlerteRetraitRepository(), new RecalculationRepository())
}
