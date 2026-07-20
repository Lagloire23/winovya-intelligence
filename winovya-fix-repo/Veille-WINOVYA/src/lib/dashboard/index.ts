// Sprint 9 — Barrel du module cockpit. Point d'entrée recommandé pour
// tout consommateur applicatif (Frontend) : `createDashboardService()`
// construit le service avec le vrai repository (client Supabase
// anon-key réel, jamais service_role). dashboard.service.ts lui-même
// n'importe DashboardRepository qu'en tant que TYPE, afin de rester
// testable sans environnement Supabase réel (voir
// scripts/sprint9-dashboard-tests.ts), suivant exactement le même
// patron que src/lib/opportunities/query/index.ts (Sprint 5).

import { DashboardRepository } from './dashboard.repository'
import { DashboardService } from './dashboard.service'

export * from './dashboard.types'
export * from './dashboard.dto'
export * from './dashboard.errors'
export { DashboardRepository } from './dashboard.repository'
export type { DashboardOpportuniteRow, DashboardActivityRow } from './dashboard.repository'
export { DashboardService } from './dashboard.service'
export * as dashboardHelpers from './dashboard.helpers'

/** Construit une instance prête à l'emploi, câblée sur le client Supabase applicatif réel (anon-key). */
export function createDashboardService(): DashboardService {
  return new DashboardService(new DashboardRepository())
}
