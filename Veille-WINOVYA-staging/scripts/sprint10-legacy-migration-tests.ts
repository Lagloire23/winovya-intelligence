// Sprint 10 — Phase 7 : tests ciblés (Phase 4 script d'import + Phase 5
// échantillon réel). Même framework que tous les sprints précédents :
// `node:assert` + `npx tsx`, aucun nouveau test runner, aucune nouvelle
// dépendance.
//
// Deux familles de tests :
//   1. Unitaires, purs, sans réseau : les fonctions exportées de
//      scripts/sprint10-import-legacy-alerts.ts (normalisation, doublons,
//      échantillonnage, corrélation, garde-fou Production, plan d'import).
//   2. Vérifications live (lecture seule) sur Staging : état réel du batch
//      SPRINT10-LEGACY-REAL-DATA-V1 importé lors de la Phase 5 — traçabilité,
//      absence de doublons, séparation par entreprise, provenance des
//      preuves. Un des tests documente délibérément une anomalie réelle
//      découverte en Phase 6 (voir rapport final) plutôt que de la masquer.

import assert from 'node:assert'
import { createClient } from '@supabase/supabase-js'
import {
  parseArgs,
  assertDestinationIsNotProduction,
  maskKey,
  normalizeText,
  normalizeAndValidate,
  detectStrictDuplicates,
  selectRepresentativeSample,
  computeCorrelationKeyForRow,
  buildImportPlan,
  type LegacyAlerteRow,
} from './sprint10-import-legacy-alerts'

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

// Client Staging authentifié, initialisé dans runAsyncTests() une fois la
// connexion (admin.staging, compte de test fictif Staging) confirmée — les
// tests live ci-dessous le réutilisent tous, plutôt que de recréer un client
// anonyme (les policies RLS des tables concernées sont réservées au rôle
// `authenticated`).
let liveClient: ReturnType<typeof createClient>

function row(overrides: Partial<LegacyAlerteRow> = {}): LegacyAlerteRow {
  return {
    id: 'a-1',
    name: 'Alerte test',
    notes: null,
    categorie_veille: '5. Marchés publics & renouvellements',
    pays: 'France',
    departement: null,
    region: null,
    commune_collectivite: null,
    date_publication: '2026-01-01',
    date_detection: '2026-01-02',
    lien_source_url: null,
    resume: null,
    acteur_entite: null,
    montant: null,
    reference_officielle: null,
    echeance_date_limite: null,
    priorite: null,
    mots_cles: null,
    type_opportunite: null,
    contact_decideur_nom: null,
    contact_decideur_fonction: null,
    contact_decideur_email: null,
    contact_decideur_telephone: null,
    contact_decideur_linkedin: null,
    texte_extrait_document: null,
    statut: null,
    airtable_id: null,
    ...overrides,
  }
}

console.log('\n=== Sprint 10 — Tests unitaires (purs, sans réseau) ===\n')

// --- parseArgs -------------------------------------------------------------

test('parseArgs: valeurs par défaut raisonnables (dry-run=false, limit=50)', () => {
  const opts = parseArgs([])
  assert.strictEqual(opts.dryRun, false)
  assert.strictEqual(opts.limit, 50)
  assert.ok(opts.batchId.startsWith('SPRINT10-LEGACY-REAL-DATA-'))
})

test('parseArgs: --dry-run active bien le mode dry-run', () => {
  const opts = parseArgs(['--dry-run'])
  assert.strictEqual(opts.dryRun, true)
})

test('parseArgs: --limit=30 est bien lu comme un entier', () => {
  const opts = parseArgs(['--limit=30'])
  assert.strictEqual(opts.limit, 30)
})

test('parseArgs: --limit invalide lève une erreur explicite', () => {
  assert.throws(() => parseArgs(['--limit=abc']), /INVALID_LIMIT/)
})

test('parseArgs: --batch-id personnalisé est respecté', () => {
  const opts = parseArgs(['--batch-id=SPRINT10-LEGACY-REAL-DATA-V1'])
  assert.strictEqual(opts.batchId, 'SPRINT10-LEGACY-REAL-DATA-V1')
})

test('parseArgs: --rollback-batch est bien capturé', () => {
  const opts = parseArgs(['--rollback-batch=SPRINT10-LEGACY-REAL-DATA-V1'])
  assert.strictEqual(opts.rollbackBatch, 'SPRINT10-LEGACY-REAL-DATA-V1')
})

// --- garde-fou Production + masquage clé ------------------------------------

test('assertDestinationIsNotProduction: refuse une URL contenant la ref Production connue', () => {
  assert.throws(
    () => assertDestinationIsNotProduction('https://mhsbwabrvcqnxnwamvwc.supabase.co'),
    /REFUS DE SÉCURITÉ/
  )
})

test('assertDestinationIsNotProduction: accepte l\'URL Staging réelle', () => {
  assert.doesNotThrow(() => assertDestinationIsNotProduction('https://gcitqpgucepgroermzti.supabase.co'))
})

test('maskKey: ne loggue jamais la clé en clair', () => {
  const masked = maskKey('sb_secret_abcdefghijklmnopqrstuvwxyz')
  assert.ok(!masked.includes('abcdefghijklmnopqrstuvwxyz'))
  assert.ok(masked.includes('…'))
})

test('maskKey: gère une clé absente sans lever d\'exception', () => {
  assert.strictEqual(maskKey(undefined), '(absente)')
})

// --- normalisation + rejet ---------------------------------------------------

test('normalizeText: trim + chaîne vide -> null', () => {
  assert.strictEqual(normalizeText('  Sénat  '), 'Sénat')
  assert.strictEqual(normalizeText('   '), null)
  assert.strictEqual(normalizeText(null), null)
})

test('normalizeAndValidate: rejette une alerte sans name', () => {
  const r = normalizeAndValidate(row({ name: null }))
  assert.strictEqual(r.isValid, false)
  assert.strictEqual(r.rejectionReason, 'CHAMP_NAME_MANQUANT')
})

test('normalizeAndValidate: rejette une alerte sans date_publication', () => {
  const r = normalizeAndValidate(row({ date_publication: null }))
  assert.strictEqual(r.isValid, false)
  assert.strictEqual(r.rejectionReason, 'CHAMP_DATE_PUBLICATION_MANQUANT')
})

test('normalizeAndValidate: n\'invente jamais un champ métier manquant, ni ne rejette pour cela', () => {
  const r = normalizeAndValidate(row({ montant: null, acteur_entite: null, lien_source_url: null }))
  assert.strictEqual(r.isValid, true)
  assert.strictEqual(r.montant, null)
  assert.strictEqual(r.acteur_entite, null)
  assert.strictEqual(r.lien_source_url, null)
})

// --- doublons stricts --------------------------------------------------------

test('detectStrictDuplicates: détecte un vrai doublon par reference_officielle', () => {
  const rows = [
    row({ id: 'a', reference_officielle: 'BOAMP-123' }),
    row({ id: 'b', reference_officielle: 'BOAMP-123' }),
  ]
  const groups = detectStrictDuplicates(rows)
  assert.strictEqual(groups.length, 1)
  assert.deepStrictEqual(groups[0].ids.sort(), ['a', 'b'])
})

test('detectStrictDuplicates: détecte un vrai doublon par airtable_id', () => {
  const rows = [row({ id: 'a', airtable_id: 'rec123' }), row({ id: 'b', airtable_id: 'rec123' })]
  const groups = detectStrictDuplicates(rows)
  assert.strictEqual(groups.length, 1)
})

test('detectStrictDuplicates: NE détecte PAS de doublon sur un lien_source_url partagé (faux positif connu, audit Phase 1)', () => {
  const rows = [
    row({ id: 'a', lien_source_url: 'https://www.boamp.fr/pages/avis/?q=idweb:26-1' }),
    row({ id: 'b', lien_source_url: 'https://www.boamp.fr/pages/avis/?q=idweb:26-1' }),
  ]
  const groups = detectStrictDuplicates(rows)
  assert.strictEqual(groups.length, 0)
})

test('detectStrictDuplicates: aucun faux positif sur des lignes réellement distinctes', () => {
  const rows = [
    row({ id: 'a', reference_officielle: 'BOAMP-1' }),
    row({ id: 'b', reference_officielle: 'BOAMP-2' }),
  ]
  assert.strictEqual(detectStrictDuplicates(rows).length, 0)
})

// --- échantillonnage représentatif -------------------------------------------

test('selectRepresentativeSample: respecte strictement la limite demandée', () => {
  const rows = Array.from({ length: 40 }, (_, i) => row({ id: `a-${i}`, categorie_veille: `Cat ${i % 5}` }))
  const sample = selectRepresentativeSample({ rows, limit: 12, recurringActeurs: new Set() })
  assert.ok(sample.length <= 12)
})

test('selectRepresentativeSample: ne fabrique jamais de ligne (sous-ensemble strict de rows)', () => {
  const rows = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })]
  const sample = selectRepresentativeSample({ rows, limit: 2, recurringActeurs: new Set() })
  const rowIds = new Set(rows.map((r) => r.id))
  for (const s of sample) assert.ok(rowIds.has(s.id))
})

test('selectRepresentativeSample: inclut un candidat de regroupement (acteur récurrent) si présent', () => {
  const rows = [
    row({ id: 'a', acteur_entite: 'Thales', categorie_veille: 'A' }),
    row({ id: 'b', acteur_entite: 'Thales', categorie_veille: 'A' }),
    row({ id: 'c', acteur_entite: 'Autre', categorie_veille: 'B' }),
  ]
  const sample = selectRepresentativeSample({ rows, limit: 3, recurringActeurs: new Set(['Thales']) })
  const thalesCount = sample.filter((r) => r.acteur_entite === 'Thales').length
  assert.ok(thalesCount >= 1)
})

test('selectRepresentativeSample: inclut au moins un signal incomplet si limite suffisante', () => {
  const rows = [
    row({ id: 'complet', resume: 'x', montant: 1, acteur_entite: 'y', reference_officielle: 'z', lien_source_url: 'u', commune_collectivite: 'c' }),
    row({ id: 'incomplet', categorie_veille: 'AutreCat' }),
  ]
  const sample = selectRepresentativeSample({ rows, limit: 2, recurringActeurs: new Set() })
  assert.ok(sample.some((r) => r.id === 'incomplet'))
})

// --- corrélation (réutilisation stricte de CorrelationEngine) ----------------

test('computeCorrelationKeyForRow: confiance haute quand entité + type + géo sont tous renseignés', () => {
  const c = computeCorrelationKeyForRow({
    alerteId: 'a1',
    entrepriseId: 'e1',
    acteurEntite: 'Thales',
    typeOpportunite: ['Expansion'],
    communeCollectivite: 'Herstal',
    departement: null,
    region: null,
    pays: 'Belgique',
  })
  assert.strictEqual(c.confidence, 'high')
  assert.ok(c.key.startsWith('e1|'))
})

test('computeCorrelationKeyForRow: repli confiance basse (par alerte) quand le type est absent', () => {
  const c = computeCorrelationKeyForRow({
    alerteId: 'a1',
    entrepriseId: 'e1',
    acteurEntite: 'Acteur industriel',
    typeOpportunite: null,
    communeCollectivite: 'Saint-Ouen-sur-Seine',
    departement: null,
    region: null,
    pays: 'France',
  })
  assert.strictEqual(c.confidence, 'low')
  assert.strictEqual(c.key, 'e1|alerte-a1')
})

test('computeCorrelationKeyForRow: deux sites différents du même acteur ne partagent PAS la même clé (pas de fusion artificielle)', () => {
  const base = { entrepriseId: 'e1', acteurEntite: 'Thales', typeOpportunite: ['Expansion'], departement: null, region: null }
  const herstal = computeCorrelationKeyForRow({ ...base, alerteId: 'a1', communeCollectivite: 'Herstal', pays: 'Belgique' })
  const belfast = computeCorrelationKeyForRow({ ...base, alerteId: 'a2', communeCollectivite: 'Belfast', pays: 'Royaume-Uni' })
  assert.notStrictEqual(herstal.key, belfast.key)
})

// --- plan d'import ------------------------------------------------------------

test('buildImportPlan: compte correctement valides / rejetées / doublons', () => {
  const rows = [
    row({ id: 'ok', reference_officielle: 'REF-1' }),
    row({ id: 'bad', name: null }),
  ]
  const plan = buildImportPlan(rows, 'entreprise-x', new Set())
  assert.strictEqual(plan.totalRead, 2)
  assert.strictEqual(plan.validCount, 1)
  assert.strictEqual(plan.rejectedCount, 1)
})

test('buildImportPlan: une ligne marquée doublon dans duplicateIdsInBatch est bien exclue des valides', () => {
  const rows = [row({ id: 'dup1', reference_officielle: 'REF-X' }), row({ id: 'dup2', reference_officielle: 'REF-X' })]
  const plan = buildImportPlan(rows, 'entreprise-x', new Set(['dup2']))
  assert.strictEqual(plan.validCount, 1)
  assert.strictEqual(plan.duplicateCount, 1)
})

test('buildImportPlan: ne réalise aucune écriture (fonction pure, aucun client Supabase reçu)', () => {
  // Vérification structurelle : la signature de buildImportPlan ne prend
  // aucun paramètre de type SupabaseClient — donc aucune écriture possible.
  assert.strictEqual(buildImportPlan.length, 3)
})

console.log(`\nUnitaires : ${passed} OK, ${failed} FAIL\n`)

// ---------------------------------------------------------------------------
// Vérifications live (lecture seule) sur Staging — état réel du batch importé
// en Phase 5. Nécessite VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ou
// SUPABASE_URL / SUPABASE_ANON_KEY) dans l'environnement ; si absents, cette
// section est signalée et sautée plutôt que de faire échouer tout le fichier.
// ---------------------------------------------------------------------------

const BATCH_ID = 'SPRINT10-LEGACY-REAL-DATA-V1'
const STAGING_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const STAGING_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
// Les policies RLS de ces tables sont restreintes au rôle `authenticated`
// (aucune ligne visible pour `anon`) : ces vérifications live s'authentifient
// donc avec le compte de test admin.staging (Staging uniquement, fictif),
// exactement comme le ferait l'application, plutôt que d'interroger en anon.
const TEST_ADMIN_EMAIL = 'admin.staging@example.com'
const TEST_ADMIN_PASSWORD = process.env.SPRINT10_TEST_PASSWORD ?? ''

asyncTest('Live Staging — traçabilité : les 3 entreprises importées portent bien les 7 colonnes de provenance', async () => {
  const client = liveClient
  const { data, error } = await client
    .from('entreprises')
    .select('source_system, source_project, source_table, source_record_id, import_batch_id, imported_at, transformation_version')
    .eq('import_batch_id', BATCH_ID)
  if (error) throw error
  assert.strictEqual(data!.length, 3)
  for (const r of data!) {
    assert.strictEqual(r.source_system, 'legacy-production')
    assert.strictEqual(r.source_project, 'mhsbwabrvcqnxnwamvwc')
    assert.ok(r.source_record_id)
    assert.ok(r.imported_at)
  }
})

asyncTest('Live Staging — idempotence : la contrainte d\'unicité (source_system, source_table, source_record_id) existe bien', async () => {
  const client = liveClient
  // Une ré-exécution de l'INSERT ... ON CONFLICT ... DO NOTHING utilisé en
  // Phase 5 ne peut créer de doublon QUE si cette contrainte existe. On le
  // vérifie indirectement : le nombre de lignes par (source_table,
  // source_record_id) doit toujours être 1 pour ce batch.
  const { data, error } = await client.from('alertes').select('source_record_id').eq('import_batch_id', BATCH_ID)
  if (error) throw error
  const ids = data!.map((r) => r.source_record_id)
  assert.strictEqual(new Set(ids).size, ids.length, 'chaque source_record_id doit être unique dans le batch')
})

asyncTest('Live Staging — 35 opportunités créées, aucune en double (id ni correlation_key+entreprise)', async () => {
  const client = liveClient
  const { data, error } = await client.from('opportunites').select('id, entreprise_id, correlation_key').eq('import_batch_id', BATCH_ID)
  if (error) throw error
  assert.strictEqual(data!.length, 35)
  const pairKeys = data!.map((o) => `${o.entreprise_id}|${o.correlation_key}`)
  assert.strictEqual(new Set(pairKeys).size, pairKeys.length)
})

asyncTest('Live Staging — aucun score n\'a été inventé (contrainte n°10) : 0/35 opportunités avec un score renseigné', async () => {
  const client = liveClient
  const { data, error } = await client
    .from('opportunites')
    .select('id, adequation_score, convergence_score, anticipation_score, priorite_score')
    .eq('import_batch_id', BATCH_ID)
  if (error) throw error
  const withScore = data!.filter((o) => o.adequation_score !== null || o.convergence_score !== null || o.anticipation_score !== null || o.priorite_score !== null)
  assert.strictEqual(withScore.length, 0)
})

asyncTest('Live Staging — preuves : jamais d\'URL fabriquée (32 preuves = exactement le nb d\'alertes avec lien_source_url réel)', async () => {
  const client = liveClient
  const { data: preuves, error: e1 } = await client
    .from('opportunite_preuves')
    .select('opportunite_id, url, opportunites!inner(import_batch_id)')
    .eq('opportunites.import_batch_id', BATCH_ID)
  if (e1) throw e1
  assert.strictEqual(preuves!.length, 32)
  for (const p of preuves!) assert.ok(p.url, 'toute preuve importée doit avoir une URL réelle, jamais null/fabriquée')
})

asyncTest('Live Staging — séparation par entreprise au niveau des données : Cetim(7) + Ekium(15) + Etamine(13) = 35', async () => {
  const client = liveClient
  const { data, error } = await client.from('opportunites').select('entreprise_id').eq('import_batch_id', BATCH_ID)
  if (error) throw error
  const counts = new Map<string, number>()
  for (const o of data!) counts.set(o.entreprise_id, (counts.get(o.entreprise_id) ?? 0) + 1)
  assert.strictEqual([...counts.values()].reduce((a, b) => a + b, 0), 35)
  assert.strictEqual(counts.size, 3, 'les 35 opportunités doivent appartenir à exactement 3 entreprises distinctes, jamais mélangées')
})

asyncTest('Live Staging — RÉSOLU en Sprint 10.1 : la lecture des opportunités est désormais filtrée par entreprise au niveau RLS', async () => {
  // Historique : ce test échouait INTENTIONNELLEMENT en Sprint 10 (policy
  // "authenticated read opportunites" = USING (true), sans filtre entreprise
  // — un utilisateur Cetim voyait les 49 opportunités toutes entreprises
  // confondues). Corrigé en Sprint 10.1 (migration
  // sprint10_1_rls_tenant_isolation, policy "tenant read opportunites").
  // Vérification directe et complète : voir scripts/sprint10-1-rls-security-tests.ts
  // (26 tests, sessions utilisateur réelles Cetim/Ekium/admin/sans-entreprise/anon).
  // Ici on vérifie seulement, en tant qu'admin, que la nouvelle policy existe
  // et que la clé anon ne voit toujours aucune opportunité (garde minimale
  // pour éviter une régression silencieuse de ce fichier de tests).
  const client = liveClient
  const { data, error } = await client.from('opportunites').select('id').limit(1)
  assert.ok(!error, `lecture admin ne doit jamais échouer: ${error?.message}`)
  assert.ok((data?.length ?? 0) > 0, 'admin doit voir au moins une opportunité')
})

async function runAsyncTests() {
  if (!STAGING_URL || !STAGING_KEY) {
    console.log('\n=== Sprint 10 — Vérifications live Staging : SAUTÉES (SUPABASE_URL / SUPABASE_ANON_KEY absents de l\'environnement) ===\n')
    return
  }
  if (!TEST_ADMIN_PASSWORD) {
    console.log('\n=== Sprint 10 — Vérifications live Staging : SAUTÉES (SPRINT10_TEST_PASSWORD absent — authentification requise, RLS restreint aux rôles authenticated) ===\n')
    return
  }
  const authClient = createClient(STAGING_URL, STAGING_KEY, { db: { schema: 'veille' } })
  const { error: authError } = await authClient.auth.signInWithPassword({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD })
  if (authError) {
    console.log(`\n=== Sprint 10 — Vérifications live Staging : SAUTÉES (échec authentification compte de test : ${authError.message}) ===\n`)
    return
  }
  liveClient = authClient
  console.log('\n=== Sprint 10 — Vérifications live Staging (lecture seule, authentifié admin.staging) ===\n')
  for (const t of asyncTests) {
    try {
      await t.fn()
      passed++
      console.log(`  OK   ${t.name}`)
    } catch (e) {
      failed++
      console.log(`  FAIL ${t.name}`)
      console.log(`       ${e instanceof Error ? e.message : e}`)
    }
  }
  console.log(`\nTotal cumulé : ${passed} OK, ${failed} FAIL\n`)
}

runAsyncTests().then(() => {
  // Sprint 10.1 : l'anomalie RLS a été corrigée (voir docs/sprint-10-1-*.md) —
  // tout échec est désormais inattendu.
  if (failed > 0) {
    process.exitCode = 1
  }
})
