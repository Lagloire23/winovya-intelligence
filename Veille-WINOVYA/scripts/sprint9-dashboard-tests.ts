// Sprint 9 — Tests ciblés (Phase 19). Même framework que les sprints
// précédents : `node:assert` + `npx tsx`, aucun nouveau test runner
// ajouté (règle absolue). Teste exclusivement des fonctions pures
// (dashboard.helpers.ts) et l'orchestration de DashboardService avec un
// FAUX repository (aucun accès réseau réel, aucune donnée Supabase).
//
// `DashboardRepository` est importé de dashboard.service.ts en tant que
// TYPE uniquement (voir dashboard.service.ts) : ce script ne déclenche
// donc jamais l'import réel de dashboard.repository.ts (qui importe
// src/lib/supabase.ts et planterait sous tsx pur, hors Vite) — même
// patron que scripts/sprint8-mvp-tests.ts.

import assert from 'node:assert'
import {
  activityEventLabel,
  buildActionsRequises,
  buildDistributionParConfiance,
  buildDistributionParStatut,
  buildPipeline,
  buildPortfolioSynthesis,
  computePriorityScore,
  daysSince,
  isActionableStatus,
  isStale,
  isWithinPeriod,
  mapActivityRow,
  rankPriorities,
  statutLabel,
} from '../src/lib/dashboard/dashboard.helpers'
import type { DashboardOpportuniteRow } from '../src/lib/dashboard/dashboard.repository'
import { DashboardService } from '../src/lib/dashboard/dashboard.service'
import { translateError, isSessionExpiredError } from '../src/lib/dashboard/dashboard.errors'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  OK   ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL ${name}`)
    console.log(`       ${e instanceof Error ? e.message : e}`)
  }
}

const asyncTests: Array<{ name: string; fn: () => Promise<void> }> = []
function asyncTest(name: string, fn: () => Promise<void>) {
  asyncTests.push({ name, fn })
}

const NOW = new Date('2026-07-17T12:00:00Z').getTime()

function row(overrides: Partial<DashboardOpportuniteRow> = {}): DashboardOpportuniteRow {
  return {
    id: 'opp-1',
    titre: 'Opportunité test',
    statutOpportunite: 'NEW',
    niveauConfiance: null,
    niveauConfianceRang: 0,
    budgetIdentifie: null,
    nombreSignaux: 0,
    dateDernierSignal: null,
    derniereEvolutionMetierAt: null,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    assignedTo: null,
    assignedAt: null,
    ...overrides,
  }
}

// --- 1-2 : isActionableStatus -------------------------------------------
test('isActionableStatus exclut WON/LOST/ARCHIVED/IN_PROGRESS', () => {
  assert.strictEqual(isActionableStatus('WON'), false)
  assert.strictEqual(isActionableStatus('LOST'), false)
  assert.strictEqual(isActionableStatus('ARCHIVED'), false)
  assert.strictEqual(isActionableStatus('IN_PROGRESS'), false)
})

test('isActionableStatus inclut les 4 statuts actifs du cycle de vie', () => {
  assert.strictEqual(isActionableStatus('NEW'), true)
  assert.strictEqual(isActionableStatus('QUALIFYING'), true)
  assert.strictEqual(isActionableStatus('QUALIFIED'), true)
  assert.strictEqual(isActionableStatus('PROPOSAL'), true)
})

// --- 3-4 : daysSince / isWithinPeriod ------------------------------------
test('daysSince retourne null pour une date absente ou invalide', () => {
  assert.strictEqual(daysSince(null, NOW), null)
  assert.strictEqual(daysSince('pas-une-date', NOW), null)
})

test('daysSince calcule un nombre de jours correct', () => {
  const tenDaysAgo = new Date(NOW - 10 * 86_400_000).toISOString()
  assert.strictEqual(daysSince(tenDaysAgo, NOW), 10)
})

test('isWithinPeriod respecte la borne (30j inclus, 31j exclu)', () => {
  const exactly30 = new Date(NOW - 30 * 86_400_000).toISOString()
  const exactly31 = new Date(NOW - 31 * 86_400_000).toISOString()
  assert.strictEqual(isWithinPeriod(exactly30, 30, NOW), true)
  assert.strictEqual(isWithinPeriod(exactly31, 30, NOW), false)
})

// --- 5-6 : isStale --------------------------------------------------------
test('isStale est toujours faux pour un statut fermé, même très ancien', () => {
  const veryOld = new Date(NOW - 200 * 86_400_000).toISOString()
  assert.strictEqual(isStale(row({ statutOpportunite: 'WON', derniereEvolutionMetierAt: veryOld }), NOW), false)
})

test('isStale est vrai pour un statut actif sans évolution depuis plus de 30 jours', () => {
  const old = new Date(NOW - 45 * 86_400_000).toISOString()
  assert.strictEqual(isStale(row({ statutOpportunite: 'PROPOSAL', derniereEvolutionMetierAt: old }), NOW), true)
})

// --- 7-11 : computePriorityScore -----------------------------------------
test('computePriorityScore : confiance élevée contribue 60 pts et une raison explicite', () => {
  const { score, reasons } = computePriorityScore(row({ niveauConfianceRang: 3 }), NOW)
  assert.strictEqual(score, 60)
  assert.ok(reasons.includes('Confiance élevée'))
})

test('computePriorityScore : budget identifié contribue +15 pts avec montant formaté', () => {
  const { score, reasons } = computePriorityScore(row({ budgetIdentifie: 100000 }), NOW)
  assert.strictEqual(score, 15)
  assert.ok(reasons.some((r) => r.includes('Budget identifié') && r.includes('100')))
})

test('computePriorityScore : signaux multiples (>=3) contribuent +10 pts', () => {
  const { score, reasons } = computePriorityScore(row({ nombreSignaux: 4 }), NOW)
  assert.strictEqual(score, 10)
  assert.ok(reasons.some((r) => r.includes('signaux corrélés')))
})

test('computePriorityScore : signal récent (<=7j) contribue +10 pts', () => {
  const recent = new Date(NOW - 3 * 86_400_000).toISOString()
  const { score } = computePriorityScore(row({ dateDernierSignal: recent }), NOW)
  assert.strictEqual(score, 10)
})

test('computePriorityScore : score plafonné à 100', () => {
  const recent = new Date(NOW - 1 * 86_400_000).toISOString()
  const { score } = computePriorityScore(
    row({ niveauConfianceRang: 3, budgetIdentifie: 999999, nombreSignaux: 10, dateDernierSignal: recent }),
    NOW
  )
  assert.ok(score <= 100)
})

// --- 12-13 : rankPriorities ------------------------------------------------
test('rankPriorities exclut systématiquement les statuts fermés', () => {
  const rows = [row({ id: 'a', statutOpportunite: 'WON', niveauConfianceRang: 3, budgetIdentifie: 1 })]
  assert.strictEqual(rankPriorities(rows, 5, NOW).length, 0)
})

test('rankPriorities trie par score décroissant et respecte la limite', () => {
  const rows = [
    row({ id: 'low', statutOpportunite: 'NEW', niveauConfianceRang: 1 }),
    row({ id: 'high', statutOpportunite: 'NEW', niveauConfianceRang: 3, budgetIdentifie: 1000 }),
  ]
  const ranked = rankPriorities(rows, 1, NOW)
  assert.strictEqual(ranked.length, 1)
  assert.strictEqual(ranked[0].id, 'high')
  assert.strictEqual(ranked[0].source, 'deterministic')
})

// --- 14-16 : pipeline / distributions --------------------------------------
test('buildPipeline expose les 7 états du cycle de vie, IN_PROGRESS exclu', () => {
  const stages = buildPipeline([row({ statutOpportunite: 'IN_PROGRESS' }), row({ statutOpportunite: 'NEW' })])
  assert.strictEqual(stages.length, 7)
  assert.ok(!stages.some((s) => s.statut === 'IN_PROGRESS'))
  assert.strictEqual(stages.find((s) => s.statut === 'NEW')?.count, 1)
})

test('buildDistributionParStatut omet les buckets vides', () => {
  const d = buildDistributionParStatut([row({ statutOpportunite: 'NEW' })])
  assert.ok(d.buckets.every((b) => b.count > 0))
  assert.strictEqual(d.buckets.length, 1)
})

test('buildDistributionParConfiance ajoute "Non renseigné" pour les valeurs manquantes', () => {
  const d = buildDistributionParConfiance([row({ niveauConfiance: null })])
  assert.ok(d.buckets.some((b) => b.label === 'Non renseigné'))
})

// --- 17-18 : actions requises ----------------------------------------------
test('buildActionsRequises : NEW non assignée déclenche une action', () => {
  const items = buildActionsRequises([row({ id: 'x', statutOpportunite: 'NEW', assignedTo: null })], 5, NOW)
  assert.strictEqual(items.length, 1)
  assert.ok(items[0].reason.includes('non assignée'))
})

test('buildActionsRequises : staleness déclenche une action distincte, sans doublon', () => {
  const old = new Date(NOW - 40 * 86_400_000).toISOString()
  const items = buildActionsRequises(
    [row({ id: 'y', statutOpportunite: 'PROPOSAL', assignedTo: 'user-1', derniereEvolutionMetierAt: old })],
    5,
    NOW
  )
  assert.strictEqual(items.length, 1)
  assert.ok(items[0].reason.includes('40 jours'))
})

// --- 19 : synthèse de portefeuille ------------------------------------------
test('buildPortfolioSynthesis produit un texte déterministe et complet', () => {
  const s = buildPortfolioSynthesis({
    total: 5,
    confianceElevee: 2,
    budgetIdentifie: 3,
    nonAssignees: 1,
    obsoletes: 1,
    periodDays: 30,
  })
  assert.strictEqual(s.source, 'deterministic')
  assert.ok(s.text.includes('5 opportunités'))
  assert.ok(s.text.includes('confiance élevée'))
  assert.ok(s.text.includes('budget identifié'))
  assert.ok(s.text.includes('assignation'))
  assert.ok(s.text.includes('30 jours'))
})

test('buildPortfolioSynthesis omet les parties à zéro (jamais "0 sans activité")', () => {
  const s = buildPortfolioSynthesis({
    total: 2,
    confianceElevee: 0,
    budgetIdentifie: 0,
    nonAssignees: 0,
    obsoletes: 0,
    periodDays: 7,
  })
  assert.ok(!s.text.includes('0 '))
})

// --- 20 : libellé d'activité, jamais le contenu d'une note ------------------
test('activityEventLabel traduit un changement de statut avec les libellés métier', () => {
  const label = activityEventLabel('status_changed', { from: 'NEW', to: 'QUALIFYING' })
  assert.ok(label.includes(statutLabel('NEW')))
  assert.ok(label.includes(statutLabel('QUALIFYING')))
})

test('activityEventLabel ne fuite jamais le contenu d\'une note, même présent dans details', () => {
  const label = activityEventLabel('note_added', { contenu: 'Texte confidentiel de la note' })
  assert.ok(!label.includes('Texte confidentiel'))
  assert.strictEqual(label, 'Note ajoutée')
})

test('mapActivityRow assemble un RecentActivityItemDto sûr', () => {
  const dto = mapActivityRow({
    id: 'log-1',
    opportuniteId: 'opp-1',
    opportuniteTitre: 'Test',
    eventType: 'assigned',
    details: {},
    createdAt: new Date(NOW).toISOString(),
  })
  assert.strictEqual(dto.label, 'Assignée')
  assert.strictEqual(dto.opportuniteTitre, 'Test')
})

// --- translateError (ré-export dashboard.errors) ---------------------------
test('dashboard.errors réexporte translateError/isSessionExpiredError fonctionnels', () => {
  assert.doesNotThrow(() => translateError(new Error('inattendu')))
  const pgErr = Object.assign(new Error('JWT expired'), { code: 'PGRST301' })
  assert.ok(isSessionExpiredError(pgErr))
})

// --- Orchestration DashboardService avec un FAUX repository ----------------
class FakeDashboardRepository {
  constructor(
    private readonly allDossiers: DashboardOpportuniteRow[],
    private readonly forUser: DashboardOpportuniteRow[],
    private readonly activity: Array<{ id: string; opportuniteId: string; eventType: string; details: Record<string, unknown>; createdAt: string }> = []
  ) {}
  async fetchAllDossiers() {
    return this.allDossiers
  }
  async fetchDossiersForUser(userId: string) {
    return this.forUser.filter((r) => r.assignedTo === userId)
  }
  async fetchRecentActivity() {
    return this.activity
  }
  async fetchRecentActivityForOpportunites(ids: string[]) {
    return this.activity.filter((a) => ids.includes(a.opportuniteId))
  }
}

asyncTest('DashboardService.getAdminDashboard assemble KPI/pipeline/priorités/actions/distributions/synthèse', async () => {
  const rows = [
    row({ id: '1', statutOpportunite: 'NEW', assignedTo: null, niveauConfianceRang: 3, budgetIdentifie: 5000 }),
    row({ id: '2', statutOpportunite: 'WON', createdAt: new Date(NOW).toISOString(), updatedAt: new Date(NOW).toISOString() }),
    row({ id: '3', statutOpportunite: 'PROPOSAL', assignedTo: 'u1', derniereEvolutionMetierAt: new Date(NOW - 40 * 86_400_000).toISOString() }),
  ]
  const fake = new FakeDashboardRepository(rows, [], []) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const service = new DashboardService(fake)
  const data = await service.getAdminDashboard(30)
  assert.strictEqual(data.period, 30)
  assert.ok(data.kpis.length >= 4 && data.kpis.length <= 6)
  assert.strictEqual(data.pipeline.length, 7)
  assert.ok(data.priorites.length >= 1)
  assert.ok(data.actionsRequises.some((a) => a.reason.includes('non assignée')))
  assert.ok(data.actionsRequises.some((a) => a.reason.includes('jours')))
  assert.strictEqual(data.distributions.length, 2)
  assert.strictEqual(data.synthese.source, 'deterministic')
})

asyncTest('DashboardService.getUserDashboard ne retourne que les dossiers assignés à l\'utilisateur', async () => {
  const rows = [
    row({ id: '1', assignedTo: 'user-a', statutOpportunite: 'NEW' }),
    row({ id: '2', assignedTo: 'user-b', statutOpportunite: 'NEW' }),
    row({ id: '3', assignedTo: 'user-a', statutOpportunite: 'QUALIFYING' }),
  ]
  const fake = new FakeDashboardRepository([], rows, []) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const service = new DashboardService(fake)
  const data = await service.getUserDashboard({ userId: 'user-a', role: 'member' }, 30)
  assert.strictEqual(data.mesOpportunitesTotal, 2)
  assert.ok(data.mesOpportunites.every((o) => ['1', '3'].includes(o.id)))
})

asyncTest('DashboardService.getDashboard détermine le rôle UNIQUEMENT depuis actor.role', async () => {
  const fake = new FakeDashboardRepository([], [], []) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const service = new DashboardService(fake)
  const adminResult = await service.getDashboard({ userId: 'x', role: 'admin' }, 7)
  assert.strictEqual(adminResult.role, 'admin')
  const memberResult = await service.getDashboard({ userId: 'x', role: 'member' }, 7)
  assert.strictEqual(memberResult.role, 'member')
})

async function main() {
  for (const { name, fn } of asyncTests) {
    try {
      await fn()
      passed++
      console.log(`  OK   ${name}`)
    } catch (e) {
      failed++
      console.log(`  FAIL ${name}`)
      console.log(`       ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\n=== Résultat : ${passed}/${passed + failed} tests réussis ===\n`)
  if (failed > 0) process.exit(1)
}

main()
