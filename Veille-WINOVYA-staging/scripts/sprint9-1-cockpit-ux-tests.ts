// Sprint 9.1 — Tests ciblés (Phase 7). Même framework que tous les
// sprints précédents : `node:assert` + `npx tsx`, aucun nouveau test
// runner, aucune nouvelle dépendance. Deux familles de tests :
//
//   1. KPI temporel ("nouvelles_periode") : libellé, calcul, cohérence
//      avec la synthèse — via DashboardService + un FAUX repository
//      (aucun accès réseau réel), même patron que
//      scripts/sprint9-dashboard-tests.ts.
//   2. Navigation de repli du cockpit : vérification STRUCTURALE par
//      inspection du code source (pas de framework de rendu React
//      disponible dans ce projet — aucun ajouté ici, conformément à la
//      règle absolue du sprint) : on vérifie que CockpitPage.tsx importe
//      et rend AppSidebar dans un bloc `lg:hidden` (repli mobile/tablette),
//      exactement comme DashboardPage.tsx le fait déjà, et que la sidebar
//      desktop (Layout.tsx) reste dans un bloc `hidden lg:block` — les
//      deux blocs sont mutuellement exclusifs par construction Tailwind,
//      donc jamais affichés en même temps.

import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import type { DashboardOpportuniteRow } from '../src/lib/dashboard/dashboard.repository'
import { DashboardService } from '../src/lib/dashboard/dashboard.service'

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

class FakeDashboardRepository {
  constructor(
    private readonly allDossiers: DashboardOpportuniteRow[],
    private readonly forUser: DashboardOpportuniteRow[] = [],
    private readonly activity: Array<{
      id: string
      opportuniteId: string
      eventType: string
      details: Record<string, unknown>
      createdAt: string
    }> = []
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

function daysAgoIso(days: number, now: number = NOW): string {
  return new Date(now - days * 86_400_000).toISOString()
}

// --- 1/2/4/5/6/7/8 : KPI "nouvelles_periode" (Phase 3/4) --------------------

asyncTest('KPI temporel : libellé explicite, jamais "Nouvelles" seul (Phase 3)', async () => {
  const rows = [row({ id: '1', createdAt: daysAgoIso(5) })]
  const fake = new FakeDashboardRepository(rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const data = await new DashboardService(fake).getAdminDashboard(30)
  const k = data.kpis.find((x) => x.key === 'nouvelles_periode')
  assert.ok(k, 'le KPI nouvelles_periode doit exister')
  assert.notStrictEqual(k!.label, 'Nouvelles', 'le libellé ambigu "Nouvelles" seul ne doit plus être utilisé')
  assert.strictEqual(k!.label, 'Opportunités détectées')
  assert.ok(k!.hint, 'un sous-texte explicite doit être présent')
  assert.ok(
    k!.hint!.toLowerCase().includes('tous statuts confondus'),
    'le sous-texte doit expliciter que tous les statuts sont inclus (option préférée retenue, Phase 3)'
  )
})

asyncTest('KPI temporel : le calcul inclut bien tous statuts confondus (WON/LOST/ARCHIVED/IN_PROGRESS compris) — cohérent avec le libellé "détectées" (Phase 3)', async () => {
  const rows = [
    row({ id: '1', statutOpportunite: 'NEW', createdAt: daysAgoIso(5) }),
    row({ id: '2', statutOpportunite: 'WON', createdAt: daysAgoIso(5) }),
    row({ id: '3', statutOpportunite: 'LOST', createdAt: daysAgoIso(5) }),
    row({ id: '4', statutOpportunite: 'ARCHIVED', createdAt: daysAgoIso(5) }),
    row({ id: '5', statutOpportunite: 'IN_PROGRESS', createdAt: daysAgoIso(5) }),
    row({ id: '6', statutOpportunite: 'NEW', createdAt: daysAgoIso(60) }), // hors période 30j
  ]
  const fake = new FakeDashboardRepository(rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const data = await new DashboardService(fake).getAdminDashboard(30)
  const k = data.kpis.find((x) => x.key === 'nouvelles_periode')
  assert.strictEqual(k!.value, '5', 'les 5 lignes créées dans les 30 derniers jours doivent être comptées, quel que soit leur statut')
})

for (const period of [7, 30, 90] as const) {
  asyncTest(`KPI temporel : calcul correct sur la période ${period} jours, jamais NaN (Phase 3/7)`, async () => {
    const rows = [
      row({ id: '1', createdAt: daysAgoIso(1) }),
      row({ id: '2', createdAt: daysAgoIso(Math.floor(period / 2) || 1) }),
      row({ id: '3', createdAt: daysAgoIso(period + 5) }), // toujours hors période
    ]
    const fake = new FakeDashboardRepository(rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
    const data = await new DashboardService(fake).getAdminDashboard(period)
    const k = data.kpis.find((x) => x.key === 'nouvelles_periode')
    assert.ok(k, `KPI présent pour la période ${period}`)
    assert.notStrictEqual(k!.value, 'NaN')
    assert.strictEqual(k!.value, '2', `2 opportunités sur les 2 dans la fenêtre de ${period} jours`)
    assert.ok(k!.hint!.includes(String(period)), 'le sous-texte doit mentionner la période exacte sélectionnée')
  })
}

asyncTest('Aucun autre KPI admin modifié involontairement (Phase 3 — non-régression ciblée)', async () => {
  const rows = [
    row({ id: '1', statutOpportunite: 'NEW', assignedTo: null, niveauConfianceRang: 3, budgetIdentifie: 5000, createdAt: daysAgoIso(5) }),
    row({ id: '2', statutOpportunite: 'WON', updatedAt: new Date(NOW).toISOString(), createdAt: daysAgoIso(5) }),
  ]
  const fake = new FakeDashboardRepository(rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const data = await new DashboardService(fake).getAdminDashboard(30)
  const keys = data.kpis.map((k) => k.key)
  assert.deepStrictEqual(keys, [
    'total_actives',
    'nouvelles_periode',
    'confiance_elevee',
    'non_assignees',
    'budget_identifie',
    'gagnees_periode',
  ])
  assert.strictEqual(data.kpis.find((k) => k.key === 'total_actives')!.label, 'Opportunités actives')
  assert.strictEqual(data.kpis.find((k) => k.key === 'confiance_elevee')!.label, 'Confiance élevée')
  assert.strictEqual(data.kpis.find((k) => k.key === 'non_assignees')!.label, 'Non assignées')
  assert.strictEqual(data.kpis.find((k) => k.key === 'budget_identifie')!.label, 'Avec budget identifié')
  assert.strictEqual(data.kpis.find((k) => k.key === 'gagnees_periode')!.label, 'Gagnées')
})

asyncTest('KPI utilisateur ("Mes opportunités actives") inchangé (Phase 3 — non-régression ciblée cockpit membre)', async () => {
  const rows = [row({ id: '1', assignedTo: 'user-a', statutOpportunite: 'NEW', niveauConfianceRang: 2 })]
  const fake = new FakeDashboardRepository([], rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const data = await new DashboardService(fake).getUserDashboard({ userId: 'user-a', role: 'member' }, 30)
  assert.strictEqual(data.kpis[0].label, 'Mes opportunités actives')
  assert.strictEqual(data.kpis[0].value, '1')
})

// --- 3 : cohérence KPI / synthèse (Phase 4) ---------------------------------

asyncTest('Synthèse de portefeuille : ne reprend jamais le terme ambigu "nouvelles" isolément (Phase 4)', async () => {
  const rows = [
    row({ id: '1', statutOpportunite: 'NEW', niveauConfianceRang: 3, budgetIdentifie: 1000, createdAt: daysAgoIso(2) }),
    row({ id: '2', statutOpportunite: 'QUALIFYING', assignedTo: null, createdAt: daysAgoIso(2) }),
  ]
  const fake = new FakeDashboardRepository(rows) as unknown as import('../src/lib/dashboard/dashboard.repository').DashboardRepository
  const data = await new DashboardService(fake).getAdminDashboard(30)
  assert.ok(
    !/nouvelles?\b/i.test(data.synthese.text),
    'la synthèse ne doit jamais introduire une notion de "nouvelles" opportunités distincte du KPI "Opportunités détectées"'
  )
  assert.strictEqual(data.synthese.source, 'deterministic')
})

// --- 9/10 : navigation de repli du cockpit (Phase 2) — vérification structurale ---

test('CockpitPage.tsx importe AppSidebar (repli de navigation, Phase 2)', () => {
  const src = readFileSync(new URL('../src/pages/CockpitPage.tsx', import.meta.url), 'utf8')
  assert.ok(
    src.includes("import { AppSidebar } from '../components/AppSidebar'"),
    'CockpitPage.tsx doit réutiliser AppSidebar tel quel (aucune nouvelle bibliothèque de navigation)'
  )
})

test('CockpitPage.tsx rend AppSidebar dans un bloc "lg:hidden" (repli mobile/tablette, Phase 2)', () => {
  const src = readFileSync(new URL('../src/pages/CockpitPage.tsx', import.meta.url), 'utf8')
  const match = src.match(/className="lg:hidden[^"]*"[\s\S]{0,60}<AppSidebar\s*\/>/)
  assert.ok(match, 'un bloc `lg:hidden` doit envelopper `<AppSidebar />`, identique au patron déjà utilisé dans DashboardPage.tsx')
  const occurrences = (src.match(/<AppSidebar\s*\/>/g) || []).length
  assert.strictEqual(occurrences, 1, "AppSidebar ne doit être rendu qu'une seule fois dans CockpitPage.tsx")
})

test('DashboardPage.tsx conserve son bloc de repli "lg:hidden" existant (non-régression, Phase 2)', () => {
  const src = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8')
  const match = src.match(/className="lg:hidden[^"]*"[\s\S]{0,60}<AppSidebar\s*\/>/)
  assert.ok(match, 'le patron de référence (DashboardPage.tsx) ne doit pas avoir été modifié par ce sprint')
})

test('Layout.tsx : la sidebar desktop reste dans un bloc "hidden lg:block" — jamais affichée en même temps que le repli (Phase 2/6)', () => {
  const src = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8')
  assert.ok(
    /className="hidden lg:block[^"]*"/.test(src),
    'la sidebar desktop (aside) doit rester masquée sous `lg` — classes Tailwind mutuellement exclusives avec le repli `lg:hidden`'
  )
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
