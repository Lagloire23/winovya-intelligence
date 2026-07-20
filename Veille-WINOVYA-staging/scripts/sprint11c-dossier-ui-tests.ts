// Sprint 11C — Tests de la refonte de la page détail "Dossier
// opportunité". Même convention que les sprints précédents :
//
//   1. Tests purs (node:assert/strict) sur la composition du fil
//      chronologique unifié (OpportuniteQueryService.getSignauxTimeline)
//      avec un double de test du repository (jamais d'accès réseau),
//      et sur la logique pure d'AnalyseMetierPanel (incertitudesMessage).
//
//   2. Vérifications structurelles (lecture de fichiers source, pas
//      d'exécution) confirmant que les panneaux "Preuves" et
//      "Chronologie" ont bien été supprimés de la page, et que les
//      nouveaux composants sont bien branchés — pas de framework de
//      rendu React disponible dans ce dépôt (pas de RTL/Jest), donc les
//      interactions UI (clic "Retirer"/"Réintégrer") restent couvertes
//      au niveau service par scripts/sprint11b-alerte-retrait-tests.ts,
//      inchangé et non retesté ici.
//
// Exécution : npx tsx scripts/sprint11c-dossier-ui-tests.ts

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OpportuniteQueryService, mapAlerteDto, mapAlerteEcarteeDto, mapPreuveDto } from '../src/lib/opportunities/query/OpportuniteQueryService'
import type {
  RawAlerteEcarteeRow,
  RawAlerteLieeRow,
  RawPreuveRow,
} from '../src/lib/opportunities/query/OpportuniteQueryRepository'
import { incertitudesMessage } from '../src/components/opportunites/AnalyseMetierPanel'

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

// -----------------------------------------------------------------------
// 1a. Tests purs — AnalyseMetierPanel (logique pure, aucune donnée
//     inventée : chaque statut d'enrichissement produit un message
//     déterministe, jamais fabriqué).
// -----------------------------------------------------------------------

test('incertitudesMessage : "ready" -> aucune incertitude signalée', () => {
  assert.match(incertitudesMessage('ready'), /Aucune incertitude/)
})

test('incertitudesMessage : "partial" -> mention explicite de consolidation partielle', () => {
  assert.match(incertitudesMessage('partial'), /partielle/i)
})

test('incertitudesMessage : "pending" -> mention explicite d\'un recalcul en attente', () => {
  assert.match(incertitudesMessage('pending'), /attente/i)
})

test('incertitudesMessage : "failed" -> mention explicite d\'un échec', () => {
  assert.match(incertitudesMessage('failed'), /Échec/i)
})

// -----------------------------------------------------------------------
// 1b. Tests purs — OpportuniteQueryService.getSignauxTimeline avec un
//     double de test du repository (même patron que
//     scripts/sprint6-commercial-tests.ts : jamais d'instanciation de la
//     vraie classe I/O, donc aucun accès réseau).
// -----------------------------------------------------------------------

function makeAlerteLiee(overrides: Partial<RawAlerteLieeRow> = {}): RawAlerteLieeRow {
  return {
    id: 'alerte-1',
    name: 'Alerte test',
    categorieVeille: '1. Documents administratifs',
    montant: 100000,
    dateDetection: '2026-01-10T00:00:00Z',
    datePublication: null,
    referenceOfficielle: null,
    lienSourceUrl: 'https://example.test/alerte-1',
    resume: 'Résumé de test.',
    roleCorrelation: 'declencheur',
    raisonCorrelation: 'Premier signal.',
    sourceRole: 'manuel',
    roleAttribueAt: '2026-01-11T00:00:00Z',
    ...overrides,
  }
}

function makeAlerteEcartee(overrides: Partial<RawAlerteEcarteeRow> = {}): RawAlerteEcarteeRow {
  return {
    id: 'alerte-ecartee-1',
    name: 'Alerte écartée test',
    categorieVeille: '2. Presse locale',
    montant: null,
    dateDetection: '2026-01-05T00:00:00Z',
    datePublication: null,
    referenceOfficielle: null,
    lienSourceUrl: null,
    resume: 'Résumé alerte écartée.',
    roleCorrelationAvant: 'contextuel',
    motifRetrait: 'doublon',
    commentaireRetrait: null,
    retirePar: 'user-1',
    retireAt: '2026-01-12T00:00:00Z',
    ...overrides,
  }
}

function makePreuve(overrides: Partial<RawPreuveRow> = {}): RawPreuveRow {
  return {
    id: 'preuve-1',
    source: 'Source test',
    citation: 'Citation test',
    url: null,
    createdAt: '2026-01-10T12:00:00Z',
    alerteId: null,
    ...overrides,
  }
}

function makeFakeRepository(opts: {
  actives?: RawAlerteLieeRow[]
  ecartees?: RawAlerteEcarteeRow[]
  preuves?: RawPreuveRow[]
}) {
  return {
    async fetchAlertesLiees(_id: string) {
      return opts.actives ?? []
    },
    async fetchAlertesEcartees(_id: string) {
      return opts.ecartees ?? []
    },
    async fetchPreuves(_id: string) {
      return opts.preuves ?? []
    },
  }
}

asyncTest('getSignauxTimeline : rendu d\'une alerte unique (active, sans preuve)', async () => {
  const repo = makeFakeRepository({ actives: [makeAlerteLiee()] })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].alerteId, 'alerte-1')
  assert.equal(result.entries[0].isActive, true)
  assert.deepEqual(result.entries[0].preuves, [])
  assert.equal(result.preuvesNonRattachees.length, 0)
})

asyncTest('getSignauxTimeline : plusieurs alertes triées du plus récent au plus ancien par défaut', async () => {
  const ancienne = makeAlerteLiee({ id: 'alerte-ancienne', dateDetection: '2026-01-01T00:00:00Z' })
  const recente = makeAlerteLiee({ id: 'alerte-recente', dateDetection: '2026-01-20T00:00:00Z' })
  const repo = makeFakeRepository({ actives: [ancienne, recente] })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries.length, 2)
  assert.equal(result.entries[0].alerteId, 'alerte-recente', 'la plus récente doit apparaître en premier par défaut')
  assert.equal(result.entries[1].alerteId, 'alerte-ancienne')
})

asyncTest('getSignauxTimeline : le rôle de corrélation (Sprint 11A) est propagé tel quel, jamais recalculé', async () => {
  const repo = makeFakeRepository({ actives: [makeAlerteLiee({ roleCorrelation: 'confirmant', raisonCorrelation: 'Signal convergent.' })] })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries[0].roleCorrelation, 'confirmant')
  assert.equal(result.entries[0].raisonCorrelation, 'Signal convergent.')
})

asyncTest('getSignauxTimeline : une alerte sans rôle de corrélation (donnée historique) reste null, jamais fabriquée', async () => {
  const repo = makeFakeRepository({ actives: [makeAlerteLiee({ roleCorrelation: null, raisonCorrelation: null, sourceRole: null, roleAttribueAt: null })] })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries[0].roleCorrelation, null)
})

asyncTest('getSignauxTimeline : les preuves rattachées à une alerte précise apparaissent imbriquées sous cette alerte', async () => {
  const repo = makeFakeRepository({
    actives: [makeAlerteLiee({ id: 'alerte-1' })],
    preuves: [makePreuve({ id: 'preuve-a', alerteId: 'alerte-1' }), makePreuve({ id: 'preuve-b', alerteId: null })],
  })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries[0].preuves.length, 1)
  assert.equal(result.entries[0].preuves[0].id, 'preuve-a')
  assert.equal(result.preuvesNonRattachees.length, 1, 'une preuve sans alerte_id doit être renvoyée à part, jamais rattachée au hasard')
  assert.equal(result.preuvesNonRattachees[0].id, 'preuve-b')
})

asyncTest('getSignauxTimeline : une alerte écartée apparaît avec isActive=false, motif et date de retrait', async () => {
  const repo = makeFakeRepository({ ecartees: [makeAlerteEcartee()] })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].isActive, false)
  assert.equal(result.entries[0].motifRetrait, 'doublon')
  assert.equal(result.entries[0].retireAt, '2026-01-12T00:00:00Z')
  assert.equal(result.entries[0].roleCorrelation, 'contextuel', 'le rôle avant retrait doit être visible dans le fil (Sprint 11B)')
})

asyncTest('getSignauxTimeline : mélange actives + écartées, aucun doublon, chaque alerte apparaît exactement une fois', async () => {
  const repo = makeFakeRepository({
    actives: [makeAlerteLiee({ id: 'alerte-active' })],
    ecartees: [makeAlerteEcartee({ id: 'alerte-ecartee' })],
  })
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries.length, 2)
  const ids = result.entries.map((e) => e.alerteId)
  assert.equal(new Set(ids).size, 2, 'aucun identifiant d\'alerte ne doit apparaître deux fois')
})

asyncTest('getSignauxTimeline : opportunité sans aucune alerte -> fil vide, aucune erreur', async () => {
  const repo = makeFakeRepository({})
  const service = new OpportuniteQueryService(repo as any, {} as any)
  const result = await service.getSignauxTimeline('opp-1')
  assert.equal(result.entries.length, 0)
  assert.equal(result.preuvesNonRattachees.length, 0)
})

// mapAlerteDto / mapAlerteEcarteeDto / mapPreuveDto restent la même
// forme que Sprint 11A/11B/11C (non-régression du mapping public).
test('mapAlerteDto / mapAlerteEcarteeDto / mapPreuveDto : mapping non-régressif', () => {
  const liee = mapAlerteDto(makeAlerteLiee())
  assert.equal(liee.titre, 'Alerte test')
  const ecartee = mapAlerteEcarteeDto(makeAlerteEcartee())
  assert.equal(ecartee.titre, 'Alerte écartée test')
  const preuve = mapPreuveDto(makePreuve({ alerteId: 'alerte-1' }))
  assert.equal(preuve.alerteId, 'alerte-1')
})

// -----------------------------------------------------------------------
// 2. Vérifications structurelles — suppression effective des panneaux
//    "Preuves"/"Chronologie", branchement des nouveaux composants,
//    non-régression des Décideurs/Notes/Historique. Lecture de fichiers
//    source uniquement (aucune exécution, aucun accès réseau).
// -----------------------------------------------------------------------

test('Suppression : DossierPanels.tsx n\'exporte plus PreuvesPanel ni ChronologiePanel', () => {
  const src = readFileSync(new URL('../src/components/opportunites/DossierPanels.tsx', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /export function PreuvesPanel/)
  assert.doesNotMatch(src, /export function ChronologiePanel/)
  assert.match(src, /export function SignauxEtAlertesPanel/)
  assert.match(src, /export function DecideursPanel/, 'DecideursPanel doit rester inchangé (non-régression)')
})

test('Suppression : OpportuniteDetailPage.tsx ne référence plus les anciens panneaux séparés', () => {
  const src = readFileSync(new URL('../src/pages/OpportuniteDetailPage.tsx', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /PreuvesPanel/)
  assert.doesNotMatch(src, /ChronologiePanel/)
  assert.doesNotMatch(src, /AlertesLieesPanel/)
  assert.doesNotMatch(src, /AlertesEcarteesPanel/)
})

test('Branchement : OpportuniteDetailPage.tsx utilise bien AnalyseMetierPanel et SignauxEtAlertesPanel', () => {
  const src = readFileSync(new URL('../src/pages/OpportuniteDetailPage.tsx', import.meta.url), 'utf-8')
  assert.match(src, /<AnalyseMetierPanel/)
  assert.match(src, /<SignauxEtAlertesPanel/)
})

test('Non-régression : Décideurs, Notes internes et Historique restent présents sur la fiche', () => {
  const src = readFileSync(new URL('../src/pages/OpportuniteDetailPage.tsx', import.meta.url), 'utf-8')
  assert.match(src, /<DecideursPanel/)
  assert.match(src, /<NotesPanel/)
  assert.match(src, /<ActivityTimeline/)
})

test('Autorisations : l\'action de retrait/réintégration reste conditionnée à isAdmin dans le fil unifié', () => {
  const src = readFileSync(new URL('../src/components/opportunites/DossierPanels.tsx', import.meta.url), 'utf-8')
  // La garde isAdmin doit encadrer les deux actions (retrait ET réintégration) dans
  // SignauxEtAlertesPanel : les deux libellés doivent apparaître textuellement après le
  // marqueur "{isAdmin && (" qui les précède dans le rendu de chaque entrée du fil
  // (approche par position, plus robuste qu'un regex sur l'AST JSX).
  const gardeIndex = src.indexOf('{isAdmin && (')
  assert.ok(gardeIndex !== -1, 'la garde isAdmin doit exister dans SignauxEtAlertesPanel')
  const retirerIndex = src.indexOf('Retirer de cette opportunité')
  const reintegrerIndex = src.indexOf('Réintégrer')
  assert.ok(retirerIndex > gardeIndex, 'le bouton "Retirer" doit être situé après la garde isAdmin')
  assert.ok(reintegrerIndex > gardeIndex, 'le bouton "Réintégrer" doit être situé après la garde isAdmin')
})

// Sprint 11C.1 (brief §2) : l'ancien panneau à 7 rubriques (dont 5
// "Non disponible") est remplacé par UNE SEULE carte compacte. Les 5
// axes sans donnée serveur (besoin probable, offres/compétences,
// facteurs favorables distincts, prochaine action) doivent avoir
// disparu du rendu plutôt que d'afficher un "Non disponible" répété.
test('Sprint 11C.1 : les 5 axes sans donnée serveur ont bien disparu du panneau (plus de "Non disponible" répété)', () => {
  const src = readFileSync(new URL('../src/components/opportunites/AnalyseMetierPanel.tsx', import.meta.url), 'utf-8')
  assert.doesNotMatch(src, /Besoin probable du donneur d'ordre/)
  assert.doesNotMatch(src, /Offres ou compétences potentiellement pertinentes/)
  assert.doesNotMatch(src, /Prochaine action recommandée/)
  assert.doesNotMatch(src, /Facteurs favorables/)
  assert.doesNotMatch(src, /fetch\(/i, 'aucun appel réseau/IA ne doit être fait directement depuis ce composant')
})

test('Sprint 11C.1 : la carte "Pourquoi cette opportunité mérite votre attention" utilise uniquement resumeMetier/raisons/statut déjà calculés', () => {
  const src = readFileSync(new URL('../src/components/opportunites/AnalyseMetierPanel.tsx', import.meta.url), 'utf-8')
  assert.match(src, /Pourquoi cette opportunité mérite votre attention/)
  assert.match(src, /resumeMetier/)
  assert.match(src, /enrichissement\.raisons/)
  assert.match(src, /incertitudesMessage\(dossier\.enrichissement\.statut\)/)
})

test('Sprint 11C.1 : la carte "Pertinence pour votre entreprise" affiche le placeholder tant qu\'aucune donnée de profil n\'existe', () => {
  const src = readFileSync(new URL('../src/components/opportunites/PertinenceEntreprisePanel.tsx', import.meta.url), 'utf-8')
  assert.match(src, /Pourquoi cette opportunité est pertinente pour votre entreprise/)
  assert.match(src, /Analyse personnalisée disponible après configuration du profil entreprise\./)
  assert.doesNotMatch(src, /fetch\(/i)
})

test('Sprint 11C.1 : hiérarchie de page respectée (en-tête, attention, pertinence, timeline, décideurs, notes, historique)', () => {
  const src = readFileSync(new URL('../src/pages/OpportuniteDetailPage.tsx', import.meta.url), 'utf-8')
  const order = [
    'LigneSynthese',
    '<AnalyseMetierPanel',
    '<PertinenceEntreprisePanel',
    '<SignauxEtAlertesPanel',
    '<DecideursPanel',
    '<NotesPanel',
    '<ActivityTimeline',
  ]
  let lastIndex = -1
  for (const marker of order) {
    const idx = src.indexOf(marker)
    assert.ok(idx !== -1, `marqueur "${marker}" introuvable dans OpportuniteDetailPage.tsx`)
    assert.ok(idx > lastIndex, `"${marker}" doit apparaître après les blocs précédents dans la hiérarchie`)
    lastIndex = idx
  }
})

test('Sprint 11C.1 : Notes et Historique sont des blocs repliables par défaut (<details>)', () => {
  const src = readFileSync(new URL('../src/pages/OpportuniteDetailPage.tsx', import.meta.url), 'utf-8')
  const detailsBlocks = src.match(/<details[^>]*>/g) ?? []
  assert.ok(detailsBlocks.length >= 2, 'Notes et Historique doivent chacun être enveloppés dans un <details> repliable')
})

test('Sprint 11C.1 : rappel générique décideurs par carte signal (pas de lien signal↔décideur fabriqué)', () => {
  const src = readFileSync(new URL('../src/components/opportunites/DossierPanels.tsx', import.meta.url), 'utf-8')
  assert.match(src, /nombreDecideurs/)
  assert.match(src, /voir la section Décideurs/)
})

test('Sprint 11C.1 : Documents associés (plus "Preuves associées") sous chaque signal', () => {
  const src = readFileSync(new URL('../src/components/opportunites/DossierPanels.tsx', import.meta.url), 'utf-8')
  assert.match(src, /Documents associés/)
  assert.doesNotMatch(src, /Preuves associées/)
})

test('Sprint 11C.1 : Décideurs affichés en grille de cartes avec Entreprise et Pourquoi identifié', () => {
  const src = readFileSync(new URL('../src/components/opportunites/DossierPanels.tsx', import.meta.url), 'utf-8')
  assert.match(src, /entreprise: string/)
  assert.match(src, /d\.roleAchat/)
})

async function main() {
  for (const t of asyncTests) await t()
  console.log(results.join('\n'))
  console.log(`\n${passed}/${results.length} tests passés`)
  if (passed !== results.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
