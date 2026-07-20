// Sprint 5 — Barrel de l'API métier de consultation des dossiers d'opportunité.
//
// Point d'entrée recommandé pour tout consommateur applicatif (Frontend,
// Dashboard, exports, Assistant IA, CRM) : `createOpportuniteQueryService()`
// construit le service avec les vraies classes I/O (client Supabase
// anon-key réel, jamais service_role). OpportuniteQueryService.ts lui-même
// n'importe ces classes qu'en tant que TYPES (`import type`), afin de
// rester testable sans environnement Supabase réel (voir
// scripts/sprint5-query-tests.ts).
import { OpportunityDossierService } from '../dossier/DossierRepository'
import { OpportuniteQueryRepository } from './OpportuniteQueryRepository'
import { OpportuniteQueryService } from './OpportuniteQueryService'

export * from './types'
export { OpportuniteQueryRepository } from './OpportuniteQueryRepository'
export { OpportuniteQueryService } from './OpportuniteQueryService'

/** Construit une instance prête à l'emploi, câblée sur le client Supabase applicatif réel (anon-key). */
export function createOpportuniteQueryService(): OpportuniteQueryService {
  return new OpportuniteQueryService(new OpportuniteQueryRepository(), new OpportunityDossierService())
}
