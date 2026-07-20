// Sprint 6 — Barrel du domaine métier commercial des opportunités.
import { CommercialRepository } from './CommercialRepository'
import { CommercialService } from './CommercialService'

export * from './types'
export * from './lifecycle'
export { CommercialRepository } from './CommercialRepository'
export {
  CommercialService,
  OpportuniteArchivedError,
  OpportuniteNotFoundError,
  NoteNotFoundError,
} from './CommercialService'

/** Construit une instance prête à l'emploi, câblée sur le client Supabase applicatif réel (anon-key). */
export function createOpportuniteCommercialService(): CommercialService {
  return new CommercialService(new CommercialRepository())
}
