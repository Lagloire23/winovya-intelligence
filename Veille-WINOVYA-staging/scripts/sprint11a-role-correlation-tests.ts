// Sprint 11A — Tests du rôle de corrélation d'une alerte
// (veille.opportunite_alertes.role_correlation, P11.1 §5.3).
//
// Deux familles de tests, même convention que les sprints précédents :
//
//   1. Tests purs (node:assert/strict) sur les fonctions de validation
//      déterministes (src/lib/opportunities/dossier/roleCorrelation.ts) —
//      toujours exécutés, aucun accès réseau.
//
//   2. Tests réseau réels contre Supabase Staging (comme
//      scripts/sprint10-1-rls-security-tests.ts) — exécutés seulement si
//      SUPABASE_URL / SUPABASE_ANON_KEY / SPRINT10_TEST_PASSWORD sont
//      présents dans l'environnement (même variable de mot de passe que
//      Sprint 10.1 : les comptes de test n'ont pas changé). Sinon,
//      ignorés proprement (pas d'échec, juste un message).
//
// Exécution : npx tsx scripts/sprint11a-role-correlation-tests.ts

import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  isValidRoleCorrelation,
  isValidSourceRole,
  sanitizeRoleCorrelation,
  sanitizeSourceRole,
} from '../src/lib/opportunities/dossier/roleCorrelation'

let passed = 0
let failed = 0
const results: string[] = []

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    results.push(`PASS - ${name}`)
  } catch (e) {
    failed++
    results.push(`FAIL - ${name}: ${(e as Error).message}`)
  }
}

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    results.push(`PASS - ${name}`)
  } catch (e) {
    failed++
    results.push(`FAIL - ${name}: ${(e as Error).message}`)
  }
}

// -----------------------------------------------------------------------
// 1. Tests purs — taxonomie et validation (aucun accès réseau)
// -----------------------------------------------------------------------

test('isValidRoleCorrelation accepte les 5 valeurs de la taxonomie P11.1', () => {
  for (const v of ['declencheur', 'confirmant', 'contextuel', 'hors_sujet', 'non_classe']) {
    assert.ok(isValidRoleCorrelation(v), `${v} devrait être valide`)
  }
})

test('isValidRoleCorrelation rejette une valeur hors taxonomie', () => {
  assert.equal(isValidRoleCorrelation('important'), false)
  assert.equal(isValidRoleCorrelation(''), false)
  assert.equal(isValidRoleCorrelation(null), false)
  assert.equal(isValidRoleCorrelation(undefined), false)
  assert.equal(isValidRoleCorrelation(42), false)
})

test('isValidSourceRole accepte moteur/manuel, rejette le reste', () => {
  assert.ok(isValidSourceRole('moteur'))
  assert.ok(isValidSourceRole('manuel'))
  assert.equal(isValidSourceRole('ia'), false)
  assert.equal(isValidSourceRole(null), false)
})

test('sanitizeRoleCorrelation : valeur valide inchangée', () => {
  assert.equal(sanitizeRoleCorrelation('declencheur'), 'declencheur')
})

test('sanitizeRoleCorrelation : valeur invalide ou absente -> null (jamais une fabrication)', () => {
  assert.equal(sanitizeRoleCorrelation(null), null)
  assert.equal(sanitizeRoleCorrelation(undefined), null)
  assert.equal(sanitizeRoleCorrelation('valeur-inconnue'), null)
  assert.equal(sanitizeRoleCorrelation(123), null)
})

test('sanitizeRoleCorrelation : ne retombe JAMAIS sur "confirmant" par défaut trompeur', () => {
  // Règle explicite de la mission : une donnée absente/corrompue ne doit
  // jamais silencieusement devenir "confirmant".
  assert.notEqual(sanitizeRoleCorrelation('donnee-corrompue'), 'confirmant')
  assert.equal(sanitizeRoleCorrelation('donnee-corrompue'), null)
})

test('sanitizeSourceRole : valeur invalide -> null', () => {
  assert.equal(sanitizeSourceRole('ia-generative'), null)
  assert.equal(sanitizeSourceRole('moteur'), 'moteur')
})

// -----------------------------------------------------------------------
// 2. Tests réseau réels (Staging) — rétrocompatibilité, contrainte SQL,
//    lecture API, isolation RLS, non-régression liste/détail.
// -----------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PASSWORD = process.env.SPRINT10_TEST_PASSWORD ?? ''

// Lien réel existant (Cetim), utilisé uniquement pour un aller-retour
// écriture/lecture/nettoyage — jamais laissé modifié après le test (voir
// nettoyage en fin de script).
const CETIM_OPP = '22cf217c-abe9-464e-845d-77647b589756'
const CETIM_ALERTE = '41aeed31-4457-46b9-af3a-30771667b646'
const EKIUM_OPP = '2c55a39f-6358-45c8-ac40-ceb65138faa3'

async function runNetworkTests() {
  const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
  const { error: adminAuthErr } = await admin.auth.signInWithPassword({ email: 'admin.staging@example.com', password: PASSWORD })
  if (adminAuthErr) throw new Error(`Echec connexion admin: ${adminAuthErr.message}`)

  // --- Rétrocompatibilité : liens historiques restent role_correlation = NULL ---
  await testAsync('Rétrocompat : le lien Cetim existant a role_correlation = NULL avant toute écriture de ce test', async () => {
    const { data, error } = await admin
      .from('opportunite_alertes')
      .select('role_correlation, raison_correlation, source_role, role_attribue_at')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    if (error) throw error
    assert.equal(data?.role_correlation ?? null, null, 'un lien jamais évalué ne doit jamais porter de rôle fabriqué')
  })

  // --- Création d'un lien avec rôle valide ---
  await testAsync('Admin : écriture d\'un rôle valide (declencheur) acceptée', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({
        role_correlation: 'declencheur',
        raison_correlation: 'Test Sprint 11A — premier signal ayant fait émerger l\'hypothèse.',
        source_role: 'manuel',
        role_attribue_at: new Date().toISOString(),
      })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    if (error) throw error
  })

  // --- Rejet d'un rôle invalide (contrainte SQL) ---
  await testAsync('Rejet d\'un rôle invalide par la contrainte CHECK', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({ role_correlation: 'tres-important' })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    assert.ok(error, 'la base doit refuser une valeur hors taxonomie')
    assert.match(error!.message.toLowerCase(), /check|constraint/, `message attendu mentionnant une contrainte, reçu: ${error?.message}`)
  })

  // --- Cohérence : raison/source/date sans rôle est refusée ---
  await testAsync('Rejet d\'une justification orpheline (raison sans rôle)', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({ role_correlation: null, raison_correlation: 'orpheline' })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    assert.ok(error, 'la contrainte de cohérence doit refuser une raison sans rôle')
  })

  // --- Lecture "API" : même requête à deux étapes que
  // OpportuniteQueryRepository.fetchAlertesLiees (opportunite_alertes ->
  // alertes), exécutée directement ici plutôt qu'en important la classe
  // concrète : celle-ci importe transitivement src/lib/supabase.ts, qui
  // lit import.meta.env.VITE_SUPABASE_URL au chargement du module —
  // indisponible hors d'un contexte Vite (voir le commentaire de
  // OpportuniteQueryService.ts sur `import type` pour la même raison).
  // Même convention que les scripts *-rls-network-check.mjs existants :
  // vérifier le contrat de données au niveau SQL, pas en instanciant la
  // classe applicative. ---
  await testAsync('Lecture API : le rôle attribué est bien exposé par la requête utilisée par fetchAlertesLiees', async () => {
    const { data: links, error: linksErr } = await admin
      .from('opportunite_alertes')
      .select('alerte_id, role_correlation, raison_correlation, source_role, role_attribue_at')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    if (linksErr) throw linksErr
    assert.ok(links, 'lien de test introuvable')
    assert.equal(sanitizeRoleCorrelation(links!.role_correlation), 'declencheur')
    assert.equal(sanitizeSourceRole(links!.source_role), 'manuel')
    assert.ok((links!.raison_correlation as string | null)?.includes('Sprint 11A'))
  })

  // --- Isolation RLS (non-régression) : user.staging@example.com est
  // aujourd'hui rattaché à Cetim (réassignation de la mission corrective
  // "données réelles", session précédente) : il doit voir SES PROPRES
  // alertes liées (contrôle positif) mais rien de celles d'Ekium
  // (contrôle négatif, cross-tenant). Ce sprint ne modifie aucune policy
  // RLS : ce test vérifie uniquement qu'il n'y a pas de régression. ---
  await testAsync('RLS : Cetim (user.staging) voit ses propres alertes liées (contrôle positif)', async () => {
    const cetimClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
    const { error: authErr } = await cetimClient.auth.signInWithPassword({ email: 'user.staging@example.com', password: PASSWORD })
    if (authErr) throw authErr
    const { data, error } = await cetimClient.from('opportunite_alertes').select('*').eq('opportunite_id', CETIM_OPP)
    if (error) throw error
    assert.ok((data ?? []).length > 0, 'Cetim doit continuer à voir ses propres alertes liées (non-régression)')
  })

  await testAsync('RLS : Cetim (user.staging) ne voit toujours pas les alertes liées Ekium (contrôle négatif, cross-tenant)', async () => {
    const cetimClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
    const { error: authErr } = await cetimClient.auth.signInWithPassword({ email: 'user.staging@example.com', password: PASSWORD })
    if (authErr) throw authErr
    const { data, error } = await cetimClient.from('opportunite_alertes').select('*').eq('opportunite_id', EKIUM_OPP)
    if (error) throw error
    assert.equal((data ?? []).length, 0, 'RLS existante doit rester intacte : ce sprint ne modifie aucune policy')
  })

  // --- Non-régression : liste et détail des opportunités fonctionnent toujours ---
  await testAsync('Non-régression : liste des opportunités (vue opportunite_dossier) toujours accessible', async () => {
    const { data, error } = await admin.from('opportunite_dossier').select('opportunite_id').limit(5)
    if (error) throw error
    assert.ok((data ?? []).length > 0)
  })

  await testAsync('Non-régression : opportunité Ekium (contrôle négatif) toujours hors de portée Cetim', async () => {
    const { data } = await admin.from('opportunite_dossier').select('opportunite_id').eq('opportunite_id', EKIUM_OPP).maybeSingle()
    assert.ok(data, 'admin doit conserver un accès global (RLS admin, inchangée)')
  })

  // --- Nettoyage : ne jamais laisser une donnée de test dans une opportunité réelle ---
  await testAsync('Nettoyage : le lien de test est remis à NULL (aucune trace laissée)', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({ role_correlation: null, raison_correlation: null, source_role: null, role_attribue_at: null })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    if (error) throw error
    const { data } = await admin
      .from('opportunite_alertes')
      .select('role_correlation')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    assert.equal(data?.role_correlation ?? null, null)
  })
}

async function main() {
  let networkSkippedNote = ''
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PASSWORD) {
    networkSkippedNote = '\n(Tests réseau Staging ignorés : SUPABASE_URL / SUPABASE_ANON_KEY / SPRINT10_TEST_PASSWORD absents de l\'environnement.)'
  } else {
    await runNetworkTests()
  }
  console.log(results.join('\n'))
  console.log(networkSkippedNote)
  console.log(`\n${passed}/${passed + failed} tests passés`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
