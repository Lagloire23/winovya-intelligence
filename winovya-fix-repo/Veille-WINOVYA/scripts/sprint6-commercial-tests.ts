// Sprint 6 — Tests purs (règles de cycle de vie + orchestration avec
// double de test du repository) du domaine métier commercial. Même
// convention que scripts/sprint5-query-tests.ts : node:assert/strict,
// exécuté via `npx tsx`, aucune nouvelle dépendance. Importe le vrai code
// expédié (lifecycle.ts, CommercialService), jamais réimplémenté.
//
// La démonstration avec données réelles sur Staging (notes CRUD,
// assignation, transitions, journal, RLS) est exécutée séparément (voir
// docs/opportunity-commercial-domain.md et le rapport final).

import assert from 'node:assert/strict'
import {
  assertValidTransition,
  canModify,
  isValidTransition,
  InvalidTransitionError,
  LIFECYCLE_STATES,
} from '../src/lib/opportunities/commercial/lifecycle'
import {
  CommercialService,
  OpportuniteArchivedError,
  OpportuniteNotFoundError,
  NoteNotFoundError,
} from '../src/lib/opportunities/commercial/CommercialService'
import type { NoteDto } from '../src/lib/opportunities/commercial/types'

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

// --- lifecycle.ts (Phase 2/7) --------------------------------------------

test('7 états exactement, dans l\'ordre attendu', () => {
  assert.deepEqual(LIFECYCLE_STATES, ['NEW', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST', 'ARCHIVED'])
})

test('transitions valides du parcours normal', () => {
  assert.equal(isValidTransition('NEW', 'QUALIFYING'), true)
  assert.equal(isValidTransition('QUALIFYING', 'QUALIFIED'), true)
  assert.equal(isValidTransition('QUALIFIED', 'PROPOSAL'), true)
  assert.equal(isValidTransition('PROPOSAL', 'WON'), true)
})

test('LOST et ARCHIVED accessibles depuis chaque état non-terminal', () => {
  for (const s of ['NEW', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL'] as const) {
    assert.equal(isValidTransition(s, 'LOST'), true, `${s} -> LOST`)
    assert.equal(isValidTransition(s, 'ARCHIVED'), true, `${s} -> ARCHIVED`)
  }
})

test('une opportunité gagnée ne peut plus redevenir NEW (règle Phase 7 explicite)', () => {
  assert.equal(isValidTransition('WON', 'NEW'), false)
  assert.equal(isValidTransition('WON', 'ARCHIVED'), true)
  assert.equal(isValidTransition('WON', 'QUALIFYING'), false)
})

test('ARCHIVED est un état terminal : aucune transition sortante', () => {
  assert.equal(isValidTransition('ARCHIVED', 'NEW'), false)
  assert.equal(isValidTransition('ARCHIVED', 'QUALIFYING'), false)
  assert.equal(isValidTransition('ARCHIVED', 'WON'), false)
})

test('transition vers le même état toujours invalide', () => {
  assert.equal(isValidTransition('QUALIFIED', 'QUALIFIED'), false)
})

test('état hors cycle de vie Sprint 6 (ex. IN_PROGRESS hérité) : transition toujours invalide', () => {
  assert.equal(isValidTransition('IN_PROGRESS', 'QUALIFIED'), false)
})

test('assertValidTransition lève InvalidTransitionError avec from/to corrects', () => {
  assert.throws(
    () => assertValidTransition('ARCHIVED', 'NEW'),
    (err: unknown) => err instanceof InvalidTransitionError && err.from === 'ARCHIVED' && err.to === 'NEW'
  )
})

test('canModify : faux uniquement pour ARCHIVED (Phase 7, généralisé à notes/assignation)', () => {
  assert.equal(canModify('ARCHIVED'), false)
  for (const s of ['NEW', 'QUALIFYING', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST']) {
    assert.equal(canModify(s), true, s)
  }
})

// --- CommercialService (orchestration, double de test du repository) ---

function makeNote(overrides: Partial<NoteDto> = {}): NoteDto {
  return {
    id: 'note-1',
    opportuniteId: 'opp-1',
    auteurId: 'user-1',
    contenu: 'contenu',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  }
}

function makeFakeRepository(initialStatut: string, notesById: Record<string, NoteDto> = {}) {
  const state = { statut: initialStatut, assignedTo: null as string | null, assignedAt: null as string | null }
  const calls = { updateStatut: 0, assign: 0, unassign: 0, createNote: 0, updateNote: 0, softDeleteNote: 0 }
  return {
    state,
    calls,
    async getStatut(_id: string) {
      return state.statut
    },
    async updateStatut(_id: string, statut: string) {
      calls.updateStatut++
      state.statut = statut
    },
    async getAssignment(_id: string) {
      return { assignedTo: state.assignedTo, assignedAt: state.assignedAt }
    },
    async assign(_id: string, profileId: string) {
      calls.assign++
      state.assignedTo = profileId
      state.assignedAt = new Date().toISOString()
    },
    async unassign(_id: string) {
      calls.unassign++
      state.assignedTo = null
      state.assignedAt = new Date().toISOString()
    },
    async listNotes(_id: string) {
      return Object.values(notesById).filter((n) => !n.deletedAt)
    },
    async getNote(id: string) {
      return notesById[id] ?? null
    },
    async createNote(opportuniteId: string, auteurId: string, contenu: string) {
      calls.createNote++
      const note = makeNote({ id: `note-new-${calls.createNote}`, opportuniteId, auteurId, contenu })
      notesById[note.id] = note
      return note
    },
    async updateNote(id: string, contenu: string) {
      calls.updateNote++
      notesById[id] = { ...notesById[id], contenu, updatedAt: new Date().toISOString() }
      return notesById[id]
    },
    async softDeleteNote(id: string) {
      calls.softDeleteNote++
      notesById[id] = { ...notesById[id], deletedAt: new Date().toISOString() }
      return notesById[id]
    },
    async getActivityLog(_id: string) {
      return []
    },
  }
}

asyncTest('changeStatut : transition valide appliquée, repository.updateStatut appelé une fois', async () => {
  const repo = makeFakeRepository('NEW')
  const service = new CommercialService(repo as any)
  const result = await service.changeStatut('opp-1', 'QUALIFYING')
  assert.equal(result.from, 'NEW')
  assert.equal(result.to, 'QUALIFYING')
  assert.equal(repo.calls.updateStatut, 1)
  assert.equal(repo.state.statut, 'QUALIFYING')
})

asyncTest('changeStatut : transition invalide rejetée, repository.updateStatut jamais appelé', async () => {
  const repo = makeFakeRepository('WON')
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.changeStatut('opp-1', 'NEW'), InvalidTransitionError)
  assert.equal(repo.calls.updateStatut, 0)
  assert.equal(repo.state.statut, 'WON')
})

asyncTest('changeStatut : opportunité inexistante => OpportuniteNotFoundError', async () => {
  const repo = { async getStatut() { return null } }
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.changeStatut('opp-x', 'QUALIFYING'), OpportuniteNotFoundError)
})

asyncTest('assign / unassign : fonctionne sur une opportunité modifiable', async () => {
  const repo = makeFakeRepository('QUALIFIED')
  const service = new CommercialService(repo as any)
  const assigned = await service.assign('opp-1', 'user-42')
  assert.equal(assigned.assignedTo, 'user-42')
  assert.equal(repo.calls.assign, 1)
  const unassigned = await service.unassign('opp-1')
  assert.equal(unassigned.assignedTo, null)
  assert.equal(repo.calls.unassign, 1)
})

asyncTest('assign / unassign : refusé sur une opportunité archivée (Phase 7)', async () => {
  const repo = makeFakeRepository('ARCHIVED')
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.assign('opp-1', 'user-42'), OpportuniteArchivedError)
  await assert.rejects(() => service.unassign('opp-1'), OpportuniteArchivedError)
  assert.equal(repo.calls.assign, 0)
  assert.equal(repo.calls.unassign, 0)
})

asyncTest('createNote : fonctionne sur une opportunité modifiable', async () => {
  const repo = makeFakeRepository('NEW')
  const service = new CommercialService(repo as any)
  const note = await service.createNote('opp-1', 'user-1', 'Premier contact effectué')
  assert.equal(note.contenu, 'Premier contact effectué')
  assert.equal(repo.calls.createNote, 1)
})

asyncTest('createNote / updateNote / deleteNote : refusés sur une opportunité archivée', async () => {
  const notes: Record<string, NoteDto> = { 'note-1': makeNote({ opportuniteId: 'opp-1' }) }
  const repo = makeFakeRepository('ARCHIVED', notes)
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.createNote('opp-1', 'user-1', 'x'), OpportuniteArchivedError)
  await assert.rejects(() => service.updateNote('opp-1', 'note-1', 'y'), OpportuniteArchivedError)
  await assert.rejects(() => service.deleteNote('opp-1', 'note-1'), OpportuniteArchivedError)
  assert.equal(repo.calls.createNote, 0)
  assert.equal(repo.calls.updateNote, 0)
  assert.equal(repo.calls.softDeleteNote, 0)
})

asyncTest('updateNote / deleteNote : note inexistante => NoteNotFoundError', async () => {
  const repo = makeFakeRepository('NEW', {})
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.updateNote('opp-1', 'note-inexistante', 'x'), NoteNotFoundError)
  await assert.rejects(() => service.deleteNote('opp-1', 'note-inexistante'), NoteNotFoundError)
})

asyncTest('updateNote : note appartenant à une AUTRE opportunité => NoteNotFoundError (pas de fuite inter-dossiers)', async () => {
  const notes: Record<string, NoteDto> = { 'note-1': makeNote({ opportuniteId: 'opp-AUTRE' }) }
  const repo = makeFakeRepository('NEW', notes)
  const service = new CommercialService(repo as any)
  await assert.rejects(() => service.updateNote('opp-1', 'note-1', 'x'), NoteNotFoundError)
})

asyncTest('deleteNote : suppression logique uniquement (deletedAt renseigné, jamais retirée de la base)', async () => {
  const notes: Record<string, NoteDto> = { 'note-1': makeNote({ opportuniteId: 'opp-1' }) }
  const repo = makeFakeRepository('NEW', notes)
  const service = new CommercialService(repo as any)
  const deleted = await service.deleteNote('opp-1', 'note-1')
  assert.notEqual(deleted.deletedAt, null)
  assert.equal(repo.calls.softDeleteNote, 1)
})

asyncTest('getActivityLog : lecture seule, passthrough', async () => {
  const repo = makeFakeRepository('NEW')
  const service = new CommercialService(repo as any)
  const log = await service.getActivityLog('opp-1')
  assert.deepEqual(log, [])
})

async function main() {
  for (const t of asyncTests) await t()
  console.log(results.join('\n'))
  console.log(`\n${passed}/${results.length} tests passés`)
  if (passed !== results.length) process.exit(1)
}
main()
