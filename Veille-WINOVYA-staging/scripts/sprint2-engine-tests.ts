// Sprint 2 — Tests des calculateurs purs et du générateur de clé de
// corrélation (Phase 9, cas ne nécessitant pas d'accès à la base).
// Aucune nouvelle dépendance de test : utilise uniquement le module
// intégré `node:assert/strict`, exécuté via `npx tsx` (déjà présent
// dans l'environnement, n'apparaît pas dans package.json). Importe le
// code réellement expédié dans src/lib/opportunities/engine — ce ne
// sont pas des réimplémentations séparées.

import assert from 'node:assert/strict'
import {
  computeAdequationScore,
  computeAnticipationScore,
  computeConvergenceScore,
  computePrioriteScore,
  ADEQUATION_WEIGHTS,
} from '../src/lib/opportunities/engine/ScoreEngine'
import { generateCorrelationKey, normalizeForCorrelation } from '../src/lib/opportunities/engine/CorrelationEngine'

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

// Cas #13 — Calcul pondéré du score d'adéquation (7 sous-scores).
test('cas #13 — adéquation pondérée, valeurs médianes connues', () => {
  const score = computeAdequationScore({
    competences: 100,
    types_opportunite: 100,
    secteurs: 0,
    references: 0,
    geographie: 0,
    mots_cles: 0,
    compte_strategique: 0,
  })
  // 100*0.30 + 100*0.25 = 55
  assert.equal(score, 55)
})

test('somme des poids d’adéquation = 1.00', () => {
  const sum = Object.values(ADEQUATION_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(sum - 1) < 1e-9, `somme=${sum}`)
})

// Cas #7 — sous-score hors intervalle rejeté.
test('cas #7 — sous-score hors intervalle [0,100] rejeté', () => {
  assert.throws(() =>
    computeAdequationScore({
      competences: 150,
      types_opportunite: 50,
      secteurs: 50,
      references: 50,
      geographie: 50,
      mots_cles: 50,
      compte_strategique: 50,
    })
  )
})

test('sous-score manquant rejeté (aucune valeur par défaut)', () => {
  assert.throws(() =>
    computeAdequationScore({
      competences: 50,
      types_opportunite: 50,
      secteurs: 50,
      references: 50,
      geographie: 50,
      mots_cles: 50,
    } as never)
  )
})

// Cas #15 — anticipation : étapes précoces > étapes tardives.
test('cas #15 — anticipation : INTENTION > APPEL_OFFRES', () => {
  const early = computeAnticipationScore('INTENTION')
  const late = computeAnticipationScore('APPEL_OFFRES')
  assert.ok(early > late, `early=${early} late=${late}`)
  assert.equal(early, 100)
  assert.equal(late, 0)
})

// Cas #8 — étape de projet invalide rejetée.
test('cas #8 — étape de projet invalide rejetée', () => {
  assert.throws(() => computeAnticipationScore('ETAPE_INEXISTANTE' as never))
})

// Cas #14 — convergence : plus de signaux + diversité + proximité + cohérence => score plus haut.
test('cas #14 — convergence : un seul signal, pas de proximité temporelle ni cohérence => score bas', () => {
  // nombreSignaux=1 => composante signalCount=0 (pas encore confirmé par
  // plusieurs sources) et sourceDiversity=0 (diversité non mesurable à 1
  // signal). spanDays volontairement élevé pour isoler ces deux
  // composantes (sinon spanDays=0 ferait remonter temporalProximity à
  // 100, ce qui est correct mais ne teste pas ce qu'on veut isoler ici).
  const score = computeConvergenceScore({
    nombreSignaux: 1,
    distinctCategories: 1,
    spanDays: 400,
    entiteMatch: false,
    geoMatch: false,
  })
  assert.equal(score, 0)
})

test('cas #14 — convergence : un seul signal détecté à l’instant => proximité temporelle seule contribue', () => {
  // spanDays=0 (premier signal = dernier signal) => temporalProximity=100,
  // pondéré à 0.20 => 20, alors que signalCount/diversity/coherence
  // restent à 0. Documente explicitement ce cas limite attendu.
  const score = computeConvergenceScore({
    nombreSignaux: 1,
    distinctCategories: 1,
    spanDays: 0,
    entiteMatch: false,
    geoMatch: false,
  })
  assert.equal(score, 20)
})

test('cas #14 — convergence : signaux multiples + cohérents => score élevé', () => {
  const score = computeConvergenceScore({
    nombreSignaux: 5,
    distinctCategories: 5,
    spanDays: 3,
    entiteMatch: true,
    geoMatch: true,
  })
  assert.equal(score, 100)
})

// Cas #16 — priorité commerciale : combinaison pondérée des 3 indicateurs.
test('cas #16 — priorité : combinaison pondérée exacte', () => {
  const score = computePrioriteScore(80, 60, 40)
  // 80*0.45 + 60*0.35 + 40*0.20 = 36 + 21 + 8 = 65
  assert.equal(score, 65)
})

// Normalisation / clé de corrélation.
test('normalisation : accents, casse, ponctuation', () => {
  assert.equal(normalizeForCorrelation('Île-de-France, Zone Nord !'), 'ile-de-france-zone-nord')
})

test('clé de corrélation : déterministe pour les mêmes entrées', () => {
  const a = generateCorrelationKey({
    entrepriseId: 'ent-1',
    alerteId: 'alerte-1',
    entiteCible: 'Métropole de Lyon',
    typeOpportunite: 'Construction',
    geographie: 'Rhône',
  })
  const b = generateCorrelationKey({
    entrepriseId: 'ent-1',
    alerteId: 'alerte-2',
    entiteCible: 'métropole de lyon',
    typeOpportunite: 'construction',
    geographie: 'rhône',
  })
  assert.equal(a.key, b.key)
  assert.equal(a.confidence, 'high')
})

test('clé de corrélation : confiance faible + dossier isolé si donnée insuffisante', () => {
  const result = generateCorrelationKey({
    entrepriseId: 'ent-1',
    alerteId: 'alerte-42',
    entiteCible: null,
    typeOpportunite: 'Construction',
    geographie: 'Rhône',
  })
  assert.equal(result.confidence, 'low')
  assert.ok(result.key.includes('alerte-42'))
})

test('clé de corrélation : ne regroupe jamais aveuglément deux entités différentes', () => {
  const a = generateCorrelationKey({
    entrepriseId: 'ent-1',
    alerteId: 'a1',
    entiteCible: 'Métropole de Lyon',
    typeOpportunite: 'Construction',
    geographie: 'Rhône',
  })
  const b = generateCorrelationKey({
    entrepriseId: 'ent-1',
    alerteId: 'a2',
    entiteCible: 'Ville de Marseille',
    typeOpportunite: 'Construction',
    geographie: 'Rhône',
  })
  assert.notEqual(a.key, b.key)
})

// Régression Sprint 2.1 (Phase 2, revue de la clé de corrélation) :
// MBDA / "nouvelle usine" / Bourges, signaux détectés en Mars, Mai,
// Juillet et Septembre — même entité, même type, même géographie, seule
// la date change. La stratégie Sprint 2 (avec fenêtre mensuelle) aurait
// produit 4 clés différentes (faux négatif avéré). La stratégie B
// retenue (sans fenêtre temporelle) doit produire UNE SEULE clé pour
// les 4 signaux, quel que soit l'écart de plusieurs mois entre eux.
test('régression MBDA — 4 signaux sur 4 mois différents => une seule clé de corrélation', () => {
  const base = {
    entrepriseId: 'ent-mbda',
    entiteCible: 'MBDA',
    typeOpportunite: 'Nouvelle usine',
    geographie: 'Bourges',
  }
  const mars = generateCorrelationKey({ ...base, alerteId: 'alerte-mars' })
  const mai = generateCorrelationKey({ ...base, alerteId: 'alerte-mai' })
  const juillet = generateCorrelationKey({ ...base, alerteId: 'alerte-juillet' })
  const septembre = generateCorrelationKey({ ...base, alerteId: 'alerte-septembre' })

  assert.equal(mars.key, mai.key)
  assert.equal(mai.key, juillet.key)
  assert.equal(juillet.key, septembre.key)
  assert.equal(mars.confidence, 'high')
})

console.log(results.join('\n'))
console.log(`\n${passed}/${results.length} tests passés`)
if (passed !== results.length) {
  process.exitCode = 1
}
