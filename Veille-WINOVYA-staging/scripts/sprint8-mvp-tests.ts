// Sprint 8 — Tests ciblés (Phase 9). Réutilise le framework existant du
// projet : `node:assert` + `npx tsx`, exactement comme
// scripts/sprint5-query-tests.ts et scripts/sprint6-commercial-tests.ts.
// Aucun nouveau framework de test ajouté (règle absolue Sprint 8).
//
// Ne teste QUE des fonctions pures important le vrai code expédié
// (aucun accès réseau) : mapping DTO de l'assignation (Phase 2),
// formatage défensif des dates (Phase 5), traduction des erreurs
// métier/techniques en messages UI (Phase 4). Le pattern d'assurance
// "aucune requête N+1" est vérifié statiquement (le code source de la
// page liste ne doit plus jamais appeler getAssignment).

import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { mapToListItemDto } from '../src/lib/opportunities/query/OpportuniteQueryService'
import type { RawDossierRow } from '../src/lib/opportunities/query/OpportuniteQueryRepository'
import { formatDate, formatDateTime, formatMontant, formatRelative } from '../src/lib/opportunities/uiHelpers'
import { translateError, isSessionExpiredError, GENERIC_ERROR_MESSAGE } from '../src/lib/opportunities/errorMessages'
import { InvalidTransitionError } from '../src/lib/opportunities/commercial/lifecycle'
import { OpportuniteArchivedError, OpportuniteNotFoundError, NoteNotFoundError } from '../src/lib/opportunities/commercial/CommercialService'

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

function baseRow(overrides: Partial<RawDossierRow> = {}): RawDossierRow {
  return {
    opportuniteId: 'opp-1',
    entrepriseId: 'ent-1',
    titre: 'Titre test',
    resumeMetier: null,
    statutOpportunite: 'NEW',
    typeOpportunite: null,
    entiteCible: null,
    geographie: null,
    secteur: null,
    phaseProjet: null,
    budgetIdentifie: null,
    budgetSource: null,
    budgetFiabilite: null,
    budgetEstime: null,
    niveauConfiance: null,
    statutEnrichissement: 'ready',
    raisons: [],
    nombreSignaux: 1,
    datePremierSignal: null,
    dateDernierSignal: null,
    derniereConsolidationAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    nombrePreuves: 0,
    nombreDecideurs: 0,
    createdAt: '2026-01-01T00:00:00Z',
    niveauConfianceRang: 0,
    derniereEvolutionMetierAt: '2026-01-01T00:00:00Z',
    assignedTo: null,
    assignedAt: null,
    ...overrides,
  }
}

console.log('\n=== Sprint 8 — Phase 2 : mapping assignation (N+1 supprimé) ===')

test('mapToListItemDto expose assignation.profilId = null quand non assignée', () => {
  const dto = mapToListItemDto(baseRow({ assignedTo: null, assignedAt: null }))
  assert.strictEqual(dto.assignation.profilId, null)
  assert.strictEqual(dto.assignation.depuis, null)
})

test('mapToListItemDto expose assignation.profilId/depuis tels que lus (aucune invention de nom)', () => {
  const dto = mapToListItemDto(
    baseRow({ assignedTo: '82231ff5-8a5c-4521-aead-aca8b2063770', assignedAt: '2026-07-14T15:07:08Z' })
  )
  assert.strictEqual(dto.assignation.profilId, '82231ff5-8a5c-4521-aead-aca8b2063770')
  assert.strictEqual(dto.assignation.depuis, '2026-07-14T15:07:08Z')
})

test('OpportunitesPage.tsx ne contient plus aucun appel getAssignment (N+1 supprimé statiquement)', () => {
  const src = readFileSync(new URL('../src/pages/OpportunitesPage.tsx', import.meta.url), 'utf8')
  assert.ok(!src.includes('getAssignment'), 'la page liste ne doit plus appeler getAssignment (Sprint 7)')
  assert.ok(!src.includes('createOpportuniteCommercialService'), 'la page liste ne doit plus instancier CommercialService')
  assert.ok(src.includes('item.assignation.profilId'), "la page liste doit lire l'assignation directement depuis le DTO de liste")
})

console.log('\n=== Sprint 8 — Phase 5 : formatage défensif des dates (jamais "Invalid Date") ===')

test('formatDate renvoie "—" pour une date invalide (jamais "Invalid Date")', () => {
  const out = formatDate('ceci-nest-pas-une-date')
  assert.notStrictEqual(out, 'Invalid Date')
  assert.strictEqual(out, '—')
})

test('formatDateTime renvoie "—" pour une date invalide (jamais "Invalid Date")', () => {
  const out = formatDateTime('ceci-nest-pas-une-date')
  assert.notStrictEqual(out, 'Invalid Date')
  assert.strictEqual(out, '—')
})

test('formatDate renvoie "—" pour null', () => {
  assert.strictEqual(formatDate(null), '—')
})

test('formatDate formate correctement une date ISO valide', () => {
  const out = formatDate('2026-07-14T00:00:00Z')
  assert.ok(out.includes('2026'))
  assert.notStrictEqual(out, '—')
})

test('formatRelative ne renvoie jamais "NaN" pour une date invalide', () => {
  const out = formatRelative('pas-une-date')
  assert.ok(!out.includes('NaN'))
})

test('formatMontant renvoie null (jamais "NaN €") pour une valeur absente', () => {
  assert.strictEqual(formatMontant(null), null)
})

console.log('\n=== Sprint 8 — Phase 4 : traduction des erreurs en messages UI ===')

test('translateError traduit InvalidTransitionError sans exposer les noms d\'états bruts en pièges techniques', () => {
  const msg = translateError(new InvalidTransitionError('WON', 'NEW', 'test'))
  assert.ok(msg.length > 0)
  assert.ok(!msg.includes('undefined'))
})

test('translateError traduit OpportuniteArchivedError sans exposer l\'UUID', () => {
  const err = new OpportuniteArchivedError('3cde15ae-146a-4b64-8ab2-03e14d2f4c4d')
  const msg = translateError(err)
  assert.ok(!msg.includes('3cde15ae-146a-4b64-8ab2-03e14d2f4c4d'), "l'UUID technique ne doit jamais apparaître dans le message utilisateur")
  assert.ok(msg.toLowerCase().includes('archivée'))
})

test('translateError traduit OpportuniteNotFoundError sans exposer l\'UUID', () => {
  const err = new OpportuniteNotFoundError('3cde15ae-146a-4b64-8ab2-03e14d2f4c4d')
  const msg = translateError(err)
  assert.ok(!msg.includes('3cde15ae-146a-4b64-8ab2-03e14d2f4c4d'))
})

test('translateError traduit NoteNotFoundError sans exposer l\'UUID', () => {
  const err = new NoteNotFoundError('note-abc-123')
  const msg = translateError(err)
  assert.ok(!msg.includes('note-abc-123'))
})

test('translateError masque un message RLS brut (nom de table) derrière un message générique', () => {
  const pgErr = Object.assign(new Error('new row violates row-level security policy for table "opportunite_notes"'), {
    code: '42501',
  })
  const msg = translateError(pgErr)
  assert.ok(!msg.includes('opportunite_notes'), 'le nom de table ne doit jamais apparaître')
  assert.ok(!msg.toLowerCase().includes('row-level security'))
  assert.ok(msg.toLowerCase().includes('droits'))
})

test('translateError détecte une session expirée (JWT) et propose la reconnexion', () => {
  const pgErr = Object.assign(new Error('JWT expired'), { code: 'PGRST301' })
  const msg = translateError(pgErr)
  assert.ok(msg.toLowerCase().includes('session'))
  assert.ok(isSessionExpiredError(pgErr))
})

test('translateError retombe sur le fallback fourni par l\'appelant pour une erreur inconnue', () => {
  const msg = translateError(new Error('quelque chose de totalement inattendu'), 'Le chargement a échoué.')
  assert.strictEqual(msg, 'Le chargement a échoué.')
})

test('translateError retombe sur le message générique par défaut si aucun fallback n\'est fourni', () => {
  const msg = translateError(new Error('quelque chose de totalement inattendu'))
  assert.strictEqual(msg, GENERIC_ERROR_MESSAGE)
})

test('translateError ne lève jamais d\'exception, même sur une valeur non-Error', () => {
  assert.doesNotThrow(() => translateError('juste une chaîne'))
  assert.doesNotThrow(() => translateError(undefined))
  assert.doesNotThrow(() => translateError({ random: 'object' }))
})

console.log(`\n=== Résultat : ${passed}/${passed + failed} tests réussis ===\n`)
if (failed > 0) process.exit(1)
