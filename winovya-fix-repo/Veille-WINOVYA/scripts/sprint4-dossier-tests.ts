// Sprint 4 — Tests des calculateurs purs du dossier d'opportunité
// (Phase 5-8 : pas d'accès base ici, voir la démonstration Staging du
// rapport final pour les cas nécessitant la base réelle). Même
// convention que scripts/sprint2-engine-tests.ts : node:assert/strict,
// exécuté via `npx tsx`, aucune nouvelle dépendance.

import assert from 'node:assert/strict'
import {
  buildRaisons,
  buildResumeMetier,
  computeNiveauConfiance,
  computeStatutEnrichissement,
} from '../src/lib/opportunities/dossier/DossierEnrichmentService'

let passed = 0
const results: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    results.push(`PASS - ${name}`)
  } catch (e) {
    results.push(`FAIL - ${name}: ${(e as Error).message}`)
  }
}

// -- niveau de confiance -----------------------------------------------

test('confiance : correlation high + plusieurs signaux => Élevé', () => {
  assert.equal(computeNiveauConfiance('high', 3), 'Élevé')
})

test('confiance : correlation high + un seul signal => Moyen', () => {
  assert.equal(computeNiveauConfiance('high', 1), 'Moyen')
})

test('confiance : correlation low => Faible, quel que soit le nombre de signaux', () => {
  assert.equal(computeNiveauConfiance('low', 5), 'Faible')
})

test('confiance : pas encore scoré (null) + plusieurs signaux => Moyen', () => {
  assert.equal(computeNiveauConfiance(null, 2), 'Moyen')
})

test('confiance : pas encore scoré (null) + un seul signal => Faible', () => {
  assert.equal(computeNiveauConfiance(null, 1), 'Faible')
})

// -- statut d'enrichissement --------------------------------------------

test('statut : preuves + décideurs + confiance non Faible => ready', () => {
  assert.equal(computeStatutEnrichissement(2, 1, 'Moyen'), 'ready')
})

test('statut : aucune preuve => partial même avec décideurs et bonne confiance', () => {
  assert.equal(computeStatutEnrichissement(0, 1, 'Élevé'), 'partial')
})

test('statut : aucun décideur => partial même avec preuves et bonne confiance', () => {
  assert.equal(computeStatutEnrichissement(3, 0, 'Élevé'), 'partial')
})

test('statut : confiance Faible => partial même avec preuves et décideurs', () => {
  assert.equal(computeStatutEnrichissement(1, 1, 'Faible'), 'partial')
})

test('statut : dossier vide (aucune preuve, aucun décideur) => partial, jamais ready', () => {
  assert.equal(computeStatutEnrichissement(0, 0, 'Faible'), 'partial')
})

// -- raisons factuelles ---------------------------------------------------

test('raisons : dossier complet contient budget, décideurs, preuves, phase', () => {
  const raisons = buildRaisons({
    nombreSignaux: 3,
    nombreDecideurs: 2,
    nombrePreuves: 4,
    budgetIdentifie: 1200000,
    budgetFiabilite: 'Officiel',
    correlationConfidence: 'high',
    etapeProjet: 'ETUDE',
  })
  assert.ok(raisons.some((r) => r.includes('3 signaux')))
  assert.ok(raisons.some((r) => r.includes('1 200 000') && r.includes('Officiel')))
  assert.ok(raisons.some((r) => r.includes('2 décideur')))
  assert.ok(raisons.some((r) => r.includes('4 preuve')))
  assert.ok(raisons.some((r) => r.includes('phase ETUDE')))
  assert.ok(raisons.some((r) => r.toLowerCase().includes('fiable')))
})

test('raisons : dossier vide reste honnête (aucune preuve/décideur/budget explicitement dit)', () => {
  const raisons = buildRaisons({
    nombreSignaux: 1,
    nombreDecideurs: 0,
    nombrePreuves: 0,
    budgetIdentifie: null,
    budgetFiabilite: null,
    correlationConfidence: null,
    etapeProjet: null,
  })
  assert.ok(raisons.some((r) => r.includes('1 signal rattaché')))
  assert.ok(raisons.some((r) => r.includes('Aucun décideur')))
  assert.ok(raisons.some((r) => r.includes('Aucune preuve')))
  assert.ok(!raisons.some((r) => r.includes('Budget identifié')), 'ne doit jamais inventer un budget')
  assert.ok(!raisons.some((r) => r.includes('phase')), 'ne doit jamais inventer une phase de projet')
})

// -- résumé métier --------------------------------------------------------

test('résumé : dossier complet ne contient aucune mention "non identifié/non précisé" superflue', () => {
  const resume = buildResumeMetier({
    titre: 'Peu importe (non utilisé dans le gabarit)',
    entiteCible: 'MBDA',
    typeOpportunite: 'Nouvelle usine',
    geographie: 'Bourges',
    nombreSignaux: 2,
    nombreDecideurs: 1,
    nombrePreuves: 2,
    budgetIdentifie: 500000,
    datePremierSignal: '2026-03-01T00:00:00.000Z',
    dateDernierSignal: '2026-05-01T00:00:00.000Z',
  })
  assert.ok(resume.includes('MBDA'))
  assert.ok(resume.includes('Nouvelle usine'))
  assert.ok(resume.includes('Bourges'))
  assert.ok(resume.includes('500 000'))
  assert.ok(resume.includes('1 décideur'))
  assert.ok(resume.includes('2 preuve'))
  assert.ok(!resume.includes('non identifiée'))
})

test('résumé : dossier minimal dit explicitement ce qui manque, n\'invente rien', () => {
  const resume = buildResumeMetier({
    titre: 'X',
    entiteCible: null,
    typeOpportunite: null,
    geographie: null,
    nombreSignaux: 1,
    nombreDecideurs: 0,
    nombrePreuves: 0,
    budgetIdentifie: null,
    datePremierSignal: null,
    dateDernierSignal: null,
  })
  assert.ok(resume.includes('entité non identifiée'))
  assert.ok(resume.includes('type non précisé'))
  assert.ok(resume.includes('géographie non précisée'))
  assert.ok(resume.includes('Aucun décideur identifié'))
  assert.ok(resume.includes('Aucune preuve documentaire'))
  assert.ok(!resume.includes('Budget identifié'), 'ne doit jamais inventer un budget absent')
})

test('résumé : idempotent (même entrée => même sortie, deux appels)', () => {
  const input = {
    titre: 'X',
    entiteCible: 'Acme',
    typeOpportunite: 'Consultation',
    geographie: 'Lyon',
    nombreSignaux: 2,
    nombreDecideurs: 1,
    nombrePreuves: 1,
    budgetIdentifie: 42,
    datePremierSignal: '2026-01-01T00:00:00.000Z',
    dateDernierSignal: '2026-02-01T00:00:00.000Z',
  }
  assert.equal(buildResumeMetier(input), buildResumeMetier(input))
})

console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} tests passés`)
if (passed !== results.length) {
  process.exitCode = 1
}
