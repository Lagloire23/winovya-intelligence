// Sprint 5 — Tests purs (logique + orchestration, dépendances injectées
// en double de test) de l'API métier de consultation des dossiers
// d'opportunité. Même convention que scripts/sprint2-engine-tests.ts et
// scripts/sprint4-dossier-tests.ts : node:assert/strict, exécuté via
// `npx tsx`, aucune nouvelle dépendance.
//
// Ces tests importent le VRAI code expédié (OpportuniteQueryService,
// needsConsolidation, mapToListItemDto, etc. — jamais réimplémentés).
// Le Repository et le OpportunityDossierService (Sprint 4) sont
// remplacés par de faux objets en mémoire (aucun accès réseau ici) pour
// isoler : (a) la logique de décision de consolidation, (b) le mapping
// DTO, (c) l'agrégation de statistiques, (d) la fusion/tri de
// chronologie, (e) l'absence de recalcul inutile.
//
// La démonstration avec des données réelles sur Staging (recherche,
// filtres, tris, RLS, opportunité inexistante) est exécutée séparément
// via le MCP Supabase / une requête réseau avec la clé anonyme réelle et
// documentée dans le rapport final — voir docs/opportunity-query-api.md.

import assert from 'node:assert/strict'
import {
  mapAlerteDto,
  mapDecideurDto,
  mapPreuveDto,
  mapToDetailDto,
  mapToListItemDto,
  needsConsolidation,
  OpportuniteQueryService,
} from '../src/lib/opportunities/query/OpportuniteQueryService'
import type { RawDossierRow } from '../src/lib/opportunities/query/OpportuniteQueryRepository'

let passed = 0
const results: string[] = []

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn()
    if (r instanceof Promise) {
      throw new Error('use asyncTest for async test bodies')
    }
    passed++
    results.push(`PASS - ${name}`)
  } catch (e) {
    results.push(`FAIL - ${name}: ${(e as Error).message}`)
  }
}

const asyncTests: Array<() => Promise<void>> = []
function asyncTest(name: string, fn: () => Promise<void>) {
  asyncTests.push(async () => {
    try {
      await fn()
      passed++
      results.push(`PASS - ${name}`)
    } catch (e) {
      results.push(`FAIL - ${name}: ${(e as Error).message}`)
    }
  })
}

function makeRow(overrides: Partial<RawDossierRow> = {}): RawDossierRow {
  return {
    opportuniteId: 'opp-1',
    entrepriseId: 'ent-1',
    titre: 'Titre test',
    resumeMetier: 'Résumé test',
    statutOpportunite: 'QUALIFIED',
    typeOpportunite: 'Extension site',
    entiteCible: 'Entité test',
    geographie: 'Bretagne',
    secteur: 'Industrie',
    phaseProjet: 'CONSULTATION',
    budgetIdentifie: 100000,
    budgetSource: 'Alerte X',
    budgetFiabilite: 'Officiel',
    budgetEstime: null,
    niveauConfiance: 'Moyen',
    statutEnrichissement: 'partial',
    raisons: ['raison 1'],
    nombreSignaux: 2,
    datePremierSignal: '2026-01-01T00:00:00Z',
    dateDernierSignal: '2026-01-05T00:00:00Z',
    derniereConsolidationAt: '2026-01-06T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
    nombrePreuves: 1,
    nombreDecideurs: 1,
    createdAt: '2025-12-01T00:00:00Z',
    niveauConfianceRang: 2,
    derniereEvolutionMetierAt: '2026-01-05T00:00:00Z',
    ...overrides,
  }
}

// --- needsConsolidation (Phase 3) --------------------------------------

test('consolidation nécessaire : statut pending, quelle que soit derniere_consolidation_at', () => {
  assert.equal(needsConsolidation(makeRow({ statutEnrichissement: 'pending', derniereConsolidationAt: '2099-01-01T00:00:00Z' })), true)
})

test('consolidation nécessaire : derniere_consolidation_at absente', () => {
  assert.equal(needsConsolidation(makeRow({ statutEnrichissement: 'partial', derniereConsolidationAt: null })), true)
})

test('consolidation nécessaire : derniere_consolidation_at antérieure à derniere_evolution_metier_at', () => {
  assert.equal(
    needsConsolidation(
      makeRow({ statutEnrichissement: 'ready', derniereConsolidationAt: '2026-01-01T00:00:00Z', derniereEvolutionMetierAt: '2026-01-10T00:00:00Z' })
    ),
    true
  )
})

test('pas de consolidation nécessaire : ready, consolidation postérieure ou égale à la dernière évolution métier', () => {
  assert.equal(
    needsConsolidation(
      makeRow({ statutEnrichissement: 'ready', derniereConsolidationAt: '2026-01-10T00:00:00Z', derniereEvolutionMetierAt: '2026-01-05T00:00:00Z' })
    ),
    false
  )
})

test('pas de consolidation nécessaire : partial déjà à jour', () => {
  assert.equal(
    needsConsolidation(
      makeRow({ statutEnrichissement: 'partial', derniereConsolidationAt: '2026-01-05T00:00:00Z', derniereEvolutionMetierAt: '2026-01-05T00:00:00Z' })
    ),
    false
  )
})

// --- mapping DTO --------------------------------------------------------

test('mapToListItemDto : structure imbriquée correcte, aucune fabrication de valeur', () => {
  const row = makeRow()
  const dto = mapToListItemDto(row)
  assert.equal(dto.id, row.opportuniteId)
  assert.deepEqual(dto.classification, {
    typeOpportunite: row.typeOpportunite,
    entiteCible: row.entiteCible,
    geographie: row.geographie,
    secteur: row.secteur,
    phaseProjet: row.phaseProjet,
  })
  assert.deepEqual(dto.budget, { identifie: row.budgetIdentifie, fiabilite: row.budgetFiabilite })
  assert.deepEqual(dto.compteurs, { preuves: row.nombrePreuves, decideurs: row.nombreDecideurs })
  // Le DTO de liste ne doit PAS exposer resumeMetier / raisons (réservé au détail).
  assert.equal((dto as any).resumeMetier, undefined)
})

test('mapToDetailDto : étend le DTO de liste, ajoute budget complet + raisons + résumé', () => {
  const row = makeRow()
  const dto = mapToDetailDto(row)
  assert.equal(dto.resumeMetier, row.resumeMetier)
  assert.deepEqual(dto.budget, {
    identifie: row.budgetIdentifie,
    source: row.budgetSource,
    fiabilite: row.budgetFiabilite,
    estime: row.budgetEstime,
  })
  assert.deepEqual(dto.enrichissement, {
    statut: row.statutEnrichissement,
    raisons: row.raisons,
    derniereConsolidationAt: row.derniereConsolidationAt,
  })
})

test('mapAlerteDto / mapPreuveDto / mapDecideurDto : jamais de champ SQL brut exposé', () => {
  const alerte = mapAlerteDto({
    id: 'a1', name: 'Alerte X', categorieVeille: '2. Presse locale', montant: 500, dateDetection: '2026-01-01T00:00:00Z',
    datePublication: '2026-01-01', referenceOfficielle: 'REF-1', lienSourceUrl: 'https://x', resume: 'r',
  })
  assert.equal(alerte.titre, 'Alerte X')
  const preuve = mapPreuveDto({ id: 'p1', source: 's', citation: 'c', url: 'u', createdAt: '2026-01-01T00:00:00Z' })
  assert.equal(preuve.id, 'p1')
  const decideur = mapDecideurDto({
    id: 'd1', nom: null, nomPersonne: 'Martin', prenomPersonne: 'Alice', fonctionPoste: 'DAF',
    email: null, telephone: null, linkedin: null, roleAchat: 'Décideur budgétaire (DAF/DSI/élu rapporteur)', dateLiaison: '2026-01-02T00:00:00Z',
  })
  assert.equal(decideur.dateLiaison, '2026-01-02T00:00:00Z')
})

// --- orchestration (doubles de test, aucun accès réseau) ---------------

function makeFakeRepository(rows: Record<string, RawDossierRow | null>) {
  const calls = { fetchRowById: 0 }
  return {
    calls,
    async fetchRowById(id: string) {
      calls.fetchRowById++
      return rows[id] ?? null
    },
    async list() {
      throw new Error('not used in these tests')
    },
    async listAllForStats() {
      throw new Error('not used in these tests')
    },
    async fetchAlertesLiees() {
      return []
    },
    async fetchPreuves() {
      return []
    },
    async fetchDecideursLies() {
      return []
    },
  }
}

function makeFakeDossierService(onConsolidate: () => void) {
  const calls = { consolidateDossier: 0 }
  return {
    calls,
    async consolidateDossier(_id: string) {
      calls.consolidateDossier++
      onConsolidate()
      return {} as any
    },
  }
}

asyncTest('getDossier : dossier déjà consolidé et à jour => aucun recalcul (consolidateDossier jamais appelé)', async () => {
  const fresh = makeRow({ statutEnrichissement: 'ready', derniereConsolidationAt: '2026-01-10T00:00:00Z', derniereEvolutionMetierAt: '2026-01-05T00:00:00Z' })
  const repo = makeFakeRepository({ 'opp-1': fresh })
  const dossierSvc = makeFakeDossierService(() => {
    throw new Error('ne doit jamais être appelé pour un dossier déjà à jour')
  })
  const service = new OpportuniteQueryService(repo as any, dossierSvc as any)
  const dto = await service.getDossier('opp-1')
  assert.equal(dossierSvc.calls.consolidateDossier, 0)
  assert.equal(repo.calls.fetchRowById, 1)
  assert.ok(dto)
  assert.equal(dto!.enrichissement.statut, 'ready')
})

asyncTest('getDossier : dossier pending => consolidation automatique déclenchée exactement une fois, relecture ensuite', async () => {
  const pending = makeRow({ opportuniteId: 'opp-2', statutEnrichissement: 'pending', derniereConsolidationAt: null })
  const consolidated = makeRow({ opportuniteId: 'opp-2', statutEnrichissement: 'ready', derniereConsolidationAt: '2026-02-01T00:00:00Z', derniereEvolutionMetierAt: '2026-01-05T00:00:00Z' })
  let fetchCount = 0
  const repo = {
    calls: { fetchRowById: 0 },
    async fetchRowById(id: string) {
      fetchCount++
      repo.calls.fetchRowById++
      return fetchCount === 1 ? pending : consolidated
    },
    async fetchAlertesLiees() { return [] },
    async fetchPreuves() { return [] },
    async fetchDecideursLies() { return [] },
  }
  const dossierSvc = makeFakeDossierService(() => {})
  const service = new OpportuniteQueryService(repo as any, dossierSvc as any)
  const dto = await service.getDossier('opp-2')
  assert.equal(dossierSvc.calls.consolidateDossier, 1)
  assert.equal(repo.calls.fetchRowById, 2)
  assert.equal(dto!.enrichissement.statut, 'ready')
})

asyncTest('getDossier : opportunité inexistante => null, jamais de consolidation tentée', async () => {
  const repo = makeFakeRepository({})
  const dossierSvc = makeFakeDossierService(() => {
    throw new Error('ne doit jamais être appelé pour une opportunité inexistante')
  })
  const service = new OpportuniteQueryService(repo as any, dossierSvc as any)
  const dto = await service.getDossier('opp-inexistant')
  assert.equal(dto, null)
  assert.equal(dossierSvc.calls.consolidateDossier, 0)
})

asyncTest('getDossier : disparition entre la consolidation et la relecture => null, pas de crash', async () => {
  const pending = makeRow({ opportuniteId: 'opp-3', statutEnrichissement: 'pending', derniereConsolidationAt: null })
  let fetchCount = 0
  const repo = {
    async fetchRowById(_id: string) {
      fetchCount++
      return fetchCount === 1 ? pending : null
    },
    async fetchAlertesLiees() { return [] },
    async fetchPreuves() { return [] },
    async fetchDecideursLies() { return [] },
  }
  const dossierSvc = makeFakeDossierService(() => {})
  const service = new OpportuniteQueryService(repo as any, dossierSvc as any)
  const dto = await service.getDossier('opp-3')
  assert.equal(dto, null)
  assert.equal(dossierSvc.calls.consolidateDossier, 1)
})

asyncTest('listDossiers : pagination calculée correctement (total, totalPages), pageSize plafonnée à 100', async () => {
  const repo = {
    async list(params: any) {
      assert.equal(params.pageSize, 100) // demandé 500 -> plafonné
      return { rows: [makeRow()], total: 205 }
    },
    async fetchRowById() { return null },
    async fetchAlertesLiees() { return [] },
    async fetchPreuves() { return [] },
    async fetchDecideursLies() { return [] },
  }
  const service = new OpportuniteQueryService(repo as any, makeFakeDossierService(() => {}) as any)
  const page = await service.listDossiers({ page: 2, pageSize: 500 })
  assert.equal(page.total, 205)
  assert.equal(page.totalPages, 3)
  assert.equal(page.items.length, 1)
})

asyncTest('listDossiers : aucune consolidation déclenchée pour une liste (stratégie documentée)', async () => {
  const dossierSvc = makeFakeDossierService(() => {
    throw new Error('la liste ne doit jamais déclencher de consolidation')
  })
  const repo = {
    async list() {
      return { rows: [makeRow({ statutEnrichissement: 'pending' })], total: 1 }
    },
    async fetchRowById() { return null },
    async fetchAlertesLiees() { return [] },
    async fetchPreuves() { return [] },
    async fetchDecideursLies() { return [] },
  }
  const service = new OpportuniteQueryService(repo as any, dossierSvc as any)
  const page = await service.listDossiers({})
  assert.equal(page.items[0].enrichissement.statut, 'pending')
  assert.equal(dossierSvc.calls.consolidateDossier, 0)
})

asyncTest('getChronologie : fusion signaux + preuves + décideurs, triée par date décroissante', async () => {
  const repo = {
    async fetchRowById() { return null },
    async list() { return { rows: [], total: 0 } },
    async fetchAlertesLiees() {
      return [{ id: 'a1', name: 'Alerte', categorieVeille: null, montant: null, dateDetection: '2026-01-01T00:00:00Z', datePublication: null, referenceOfficielle: null, lienSourceUrl: null, resume: null }]
    },
    async fetchPreuves() {
      return [{ id: 'p1', source: 'src', citation: null, url: null, createdAt: '2026-01-03T00:00:00Z' }]
    },
    async fetchDecideursLies() {
      return [{ id: 'd1', nom: null, nomPersonne: 'Martin', prenomPersonne: 'Alice', fonctionPoste: null, email: null, telephone: null, linkedin: null, roleAchat: null, dateLiaison: '2026-01-02T00:00:00Z' }]
    },
  }
  const service = new OpportuniteQueryService(repo as any, makeFakeDossierService(() => {}) as any)
  const chrono = await service.getChronologie('opp-1')
  assert.equal(chrono.length, 3)
  assert.deepEqual(chrono.map((c) => c.type), ['preuve', 'decideur_lie', 'signal']) // décroissant : p1 (03) > d1 (02) > a1 (01)
})

asyncTest('getStats : agrégation correcte sur un jeu de lignes fictif, une seule requête (fake)', async () => {
  let callCount = 0
  const repo = {
    async fetchRowById() { return null },
    async list() { return { rows: [], total: 0 } },
    async listAllForStats() {
      callCount++
      return [
        { statutEnrichissement: 'ready', niveauConfiance: 'Élevé', budgetIdentifie: 100 },
        { statutEnrichissement: 'ready', niveauConfiance: 'Moyen', budgetIdentifie: 200 },
        { statutEnrichissement: 'partial', niveauConfiance: 'Moyen', budgetIdentifie: null },
        { statutEnrichissement: 'pending', niveauConfiance: null, budgetIdentifie: null },
      ] as any
    },
    async fetchAlertesLiees() { return [] },
    async fetchPreuves() { return [] },
    async fetchDecideursLies() { return [] },
  }
  const service = new OpportuniteQueryService(repo as any, makeFakeDossierService(() => {}) as any)
  const stats = await service.getStats()
  assert.equal(callCount, 1)
  assert.equal(stats.total, 4)
  assert.deepEqual(stats.parStatutEnrichissement, { ready: 2, partial: 1, pending: 1 })
  assert.deepEqual(stats.parNiveauConfiance, { 'Élevé': 1, Moyen: 2, 'Non évalué': 1 })
  assert.equal(stats.budgetIdentifieTotalConnu, 300)
  assert.equal(stats.nombreAvecBudgetIdentifie, 2)
})

async function main() {
  for (const t of asyncTests) await t()
  console.log(results.join('\n'))
  console.log(`\n${passed}/${results.length} tests passés`)
  if (passed !== results.length) process.exit(1)
}
main()
