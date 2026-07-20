// Sprint 11B — Tests du retrait/réintégration logique d'une alerte liée
// à une opportunité (P11.1 §retrait).
//
// Même convention que scripts/sprint6-commercial-tests.ts et
// scripts/sprint11a-role-correlation-tests.ts :
//
//   1. Tests purs (node:assert/strict) sur la validation de domaine
//      (types.ts) et sur AlerteRetraitService avec un double de test du
//      repository (jamais d'accès réseau) — toujours exécutés.
//
//   2. Tests réseau réels contre Supabase Staging, exécutés seulement si
//      SUPABASE_URL / SUPABASE_ANON_KEY / SPRINT10_TEST_PASSWORD sont
//      présents dans l'environnement (mêmes comptes de test que les
//      sprints précédents). Sinon, ignorés proprement.
//
// Exécution : npx tsx scripts/sprint11b-alerte-retrait-tests.ts

import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import {
  assertRetraitInputValide,
  isValidMotifRetrait,
  sanitizeMotifRetrait,
  AlerteDejaActiveError,
  AlerteDejaRetireeError,
  LienAlerteOpportuniteIntrouvableError,
  MotifRetraitInvalideError,
  OpportuniteIntrouvableError,
  RetraitNonAppliqueError,
  type MotifRetrait,
} from '../src/lib/opportunities/alerteRetrait/types'
import { AlerteRetraitService } from '../src/lib/opportunities/alerteRetrait/AlerteRetraitService'

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
// 1a. Tests purs — taxonomie et validation de domaine (aucun accès réseau)
// -----------------------------------------------------------------------

const ALL_MOTIFS: MotifRetrait[] = [
  'hors_sujet',
  'mauvaise_entite',
  'mauvais_projet',
  'doublon',
  'temporalite_incoherente',
  'mauvaise_localisation',
  'mauvais_rapprochement_semantique',
  'autre',
]

test('isValidMotifRetrait accepte les 8 valeurs de la taxonomie P11.1', () => {
  for (const m of ALL_MOTIFS) assert.ok(isValidMotifRetrait(m), `${m} devrait être valide`)
})

test('isValidMotifRetrait rejette une valeur hors taxonomie', () => {
  assert.equal(isValidMotifRetrait('non_pertinent'), false)
  assert.equal(isValidMotifRetrait(''), false)
  assert.equal(isValidMotifRetrait(null), false)
  assert.equal(isValidMotifRetrait(undefined), false)
})

test('sanitizeMotifRetrait : valeur invalide ou absente -> null (jamais une fabrication)', () => {
  assert.equal(sanitizeMotifRetrait('inconnu'), null)
  assert.equal(sanitizeMotifRetrait(null), null)
  assert.equal(sanitizeMotifRetrait('doublon'), 'doublon')
})

test('assertRetraitInputValide : accepte chacun des 8 motifs (commentaire requis seulement pour "autre")', () => {
  for (const m of ALL_MOTIFS) {
    const commentaire = m === 'autre' ? 'Justification obligatoire' : null
    assertRetraitInputValide({ motif: m, commentaire })
  }
})

test('assertRetraitInputValide : motif vide/inconnu rejeté', () => {
  assert.throws(() => assertRetraitInputValide({ motif: '' as MotifRetrait }), MotifRetraitInvalideError)
  assert.throws(() => assertRetraitInputValide({ motif: 'improbable' as MotifRetrait }), MotifRetraitInvalideError)
})

test('assertRetraitInputValide : "autre" sans commentaire rejeté', () => {
  assert.throws(() => assertRetraitInputValide({ motif: 'autre' }), MotifRetraitInvalideError)
  assert.throws(() => assertRetraitInputValide({ motif: 'autre', commentaire: '   ' }), MotifRetraitInvalideError)
})

test('assertRetraitInputValide : commentaire optionnel pour les autres motifs', () => {
  assertRetraitInputValide({ motif: 'doublon' })
  assertRetraitInputValide({ motif: 'doublon', commentaire: null })
})

// -----------------------------------------------------------------------
// 1b. Tests purs — AlerteRetraitService avec double de test du repository
//     (même patron que makeFakeRepository, scripts/sprint6-commercial-tests.ts)
// -----------------------------------------------------------------------

function makeFakeAlerteRetraitRepository(opts: {
  opportuniteExiste?: boolean
  lien?: { isActive: boolean; roleCorrelation: string | null } | null
  retirerReturns?: number
  reintegrerReturns?: number
} = {}) {
  const calls = { opportuniteExiste: 0, getLien: 0, retirer: 0, reintegrer: 0 }
  const retirerArgs: unknown[][] = []
  const reintegrerArgs: unknown[][] = []
  return {
    calls,
    retirerArgs,
    reintegrerArgs,
    async opportuniteExiste(_id: string) {
      calls.opportuniteExiste++
      return opts.opportuniteExiste ?? true
    },
    async getLien(_oppId: string, _alerteId: string) {
      calls.getLien++
      return opts.lien === undefined ? { isActive: true, roleCorrelation: 'confirmant' } : opts.lien
    },
    async retirer(oppId: string, alerteId: string, actorId: string, motif: MotifRetrait, commentaire: string | null) {
      calls.retirer++
      retirerArgs.push([oppId, alerteId, actorId, motif, commentaire])
      return opts.retirerReturns ?? 1
    },
    async reintegrer(oppId: string, alerteId: string) {
      calls.reintegrer++
      reintegrerArgs.push([oppId, alerteId])
      return opts.reintegrerReturns ?? 1
    },
  }
}

function makeFakeRecalculationRepository() {
  const calls = { requestOpportunityRecalculation: 0 }
  const args: string[] = []
  return {
    calls,
    args,
    async requestOpportunityRecalculation(opportuniteId: string) {
      calls.requestOpportunityRecalculation++
      args.push(opportuniteId)
    },
  }
}

asyncTest('retirerAlerteDeOpportunite : retrait valide -> repository.retirer appelé, recalcul demandé une fois', async () => {
  const repo = makeFakeAlerteRetraitRepository()
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'doublon', commentaire: null })
  assert.equal(repo.calls.retirer, 1)
  assert.equal(recalc.calls.requestOpportunityRecalculation, 1)
  assert.deepEqual(recalc.args, ['opp-1'])
})

asyncTest("retirerAlerteDeOpportunite : l'alerte globale n'est jamais touchée (aucun appel autre que le lien)", async () => {
  const repo = makeFakeAlerteRetraitRepository()
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'doublon' })
  // Le double de test n'expose aucune méthode de suppression de veille.alertes :
  // la seule surface d'écriture disponible au service est le lien (retirer/reintegrer).
  assert.equal(repo.calls.retirer, 1)
})

asyncTest('retirerAlerteDeOpportunite : opportunité introuvable rejetée sans appeler retirer', async () => {
  const repo = makeFakeAlerteRetraitRepository({ opportuniteExiste: false })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-x', 'alerte-1', 'user-1', { motif: 'doublon' }),
    OpportuniteIntrouvableError
  )
  assert.equal(repo.calls.retirer, 0)
  assert.equal(recalc.calls.requestOpportunityRecalculation, 0)
})

asyncTest('retirerAlerteDeOpportunite : lien introuvable rejeté', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: null })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-1', 'alerte-x', 'user-1', { motif: 'doublon' }),
    LienAlerteOpportuniteIntrouvableError
  )
  assert.equal(repo.calls.retirer, 0)
})

asyncTest('retirerAlerteDeOpportunite : double retrait rejeté (lien déjà inactif)', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: { isActive: false, roleCorrelation: null } })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'doublon' }),
    AlerteDejaRetireeError
  )
  assert.equal(repo.calls.retirer, 0, 'un lien déjà inactif ne doit jamais déclencher un second retrait')
})

asyncTest('retirerAlerteDeOpportunite : motif invalide rejeté avant tout accès au repository', async () => {
  const repo = makeFakeAlerteRetraitRepository()
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'invalide' as MotifRetrait }),
    MotifRetraitInvalideError
  )
  assert.equal(repo.calls.opportuniteExiste, 0, 'la validation de domaine doit précéder tout accès I/O')
})

asyncTest('retirerAlerteDeOpportunite : commentaire obligatoire manquant pour "autre" rejeté', async () => {
  const repo = makeFakeAlerteRetraitRepository()
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'autre' }),
    MotifRetraitInvalideError
  )
})

asyncTest('retirerAlerteDeOpportunite : 0 ligne modifiée (refus RLS silencieux) -> RetraitNonAppliqueError', async () => {
  const repo = makeFakeAlerteRetraitRepository({ retirerReturns: 0 })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(
    () => service.retirerAlerteDeOpportunite('opp-1', 'alerte-1', 'user-1', { motif: 'doublon' }),
    RetraitNonAppliqueError
  )
  assert.equal(recalc.calls.requestOpportunityRecalculation, 0, 'aucun recalcul ne doit être demandé si le retrait n\'a pas réellement été appliqué')
})

asyncTest('reintegrerAlerteDansOpportunite : réintégration valide -> repository.reintegrer appelé, recalcul demandé', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: { isActive: false, roleCorrelation: 'declencheur' } })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await service.reintegrerAlerteDansOpportunite('opp-1', 'alerte-1')
  assert.equal(repo.calls.reintegrer, 1)
  assert.equal(recalc.calls.requestOpportunityRecalculation, 1)
})

asyncTest("reintegrerAlerteDansOpportunite : le rôle de corrélation n'est jamais transmis (jamais recalculé, restauré trivialement)", async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: { isActive: false, roleCorrelation: 'declencheur' } })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await service.reintegrerAlerteDansOpportunite('opp-1', 'alerte-1')
  // reintegrer(oppId, alerteId) ne prend que 2 arguments : le rôle n'est
  // jamais un paramètre de cette opération (il n'a jamais été modifié).
  assert.deepEqual(repo.reintegrerArgs[0], ['opp-1', 'alerte-1'])
})

asyncTest('reintegrerAlerteDansOpportunite : opportunité introuvable rejetée', async () => {
  const repo = makeFakeAlerteRetraitRepository({ opportuniteExiste: false })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(() => service.reintegrerAlerteDansOpportunite('opp-x', 'alerte-1'), OpportuniteIntrouvableError)
  assert.equal(repo.calls.reintegrer, 0)
})

asyncTest('reintegrerAlerteDansOpportunite : lien introuvable rejeté', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: null })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(() => service.reintegrerAlerteDansOpportunite('opp-1', 'alerte-x'), LienAlerteOpportuniteIntrouvableError)
})

asyncTest('reintegrerAlerteDansOpportunite : double réintégration rejetée (lien déjà actif)', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: { isActive: true, roleCorrelation: null } })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(() => service.reintegrerAlerteDansOpportunite('opp-1', 'alerte-1'), AlerteDejaActiveError)
  assert.equal(repo.calls.reintegrer, 0, 'un lien déjà actif ne doit jamais déclencher une seconde réintégration')
})

asyncTest('reintegrerAlerteDansOpportunite : 0 ligne modifiée -> RetraitNonAppliqueError', async () => {
  const repo = makeFakeAlerteRetraitRepository({ lien: { isActive: false, roleCorrelation: null }, reintegrerReturns: 0 })
  const recalc = makeFakeRecalculationRepository()
  const service = new AlerteRetraitService(repo as any, recalc as any)
  await assert.rejects(() => service.reintegrerAlerteDansOpportunite('opp-1', 'alerte-1'), RetraitNonAppliqueError)
})

// -----------------------------------------------------------------------
// 2. Tests réseau réels (Staging) — migration, historique, RLS.
// -----------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PASSWORD = process.env.SPRINT10_TEST_PASSWORD ?? ''

// Lien réel existant (Cetim), utilisé uniquement pour un aller-retour
// écriture/lecture/nettoyage — jamais laissé modifié après le test.
const CETIM_OPP = '22cf217c-abe9-464e-845d-77647b589756'
const CETIM_ALERTE = '41aeed31-4457-46b9-af3a-30771667b646'
const EKIUM_OPP = '2c55a39f-6358-45c8-ac40-ceb65138faa3'

async function runNetworkTests() {
  const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
  const { error: adminAuthErr } = await admin.auth.signInWithPassword({ email: 'admin.staging@example.com', password: PASSWORD })
  if (adminAuthErr) throw new Error(`Echec connexion admin: ${adminAuthErr.message}`)

  await testAsyncWrapper('Rétrocompat : le lien Cetim existant est actif (is_active = true) avant toute écriture de ce test', async () => {
    const { data, error } = await admin
      .from('opportunite_alertes')
      .select('is_active, motif_retrait, retire_par, retire_at')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    if (error) throw error
    assert.equal(data?.is_active, true, 'un lien historique jamais retiré doit être actif par défaut')
    assert.equal(data?.motif_retrait ?? null, null)
  })

  await testAsyncWrapper('Rejet d\'un motif hors taxonomie par la contrainte CHECK', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({ motif_retrait: 'improbable' })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    assert.ok(error, 'la base doit refuser un motif hors taxonomie')
    assert.match(error!.message.toLowerCase(), /check|constraint/)
  })

  await testAsyncWrapper('Retrait réel : UPDATE is_active=false + métadonnées cohérentes accepté, alerte globale intacte', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({
        is_active: false,
        retire_at: new Date().toISOString(),
        retire_par: (await admin.auth.getUser()).data.user?.id,
        motif_retrait: 'doublon',
        commentaire_retrait: null,
      })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    if (error) throw error

    const { data: alerteGlobale, error: alerteErr } = await admin.from('alertes').select('id').eq('id', CETIM_ALERTE).maybeSingle()
    if (alerteErr) throw alerteErr
    assert.ok(alerteGlobale, "l'alerte globale doit continuer d'exister (jamais supprimée par un retrait logique)")
  })

  await testAsyncWrapper('Le lien retiré est bien exclu de la requête utilisée par fetchAlertesLiees (is_active = true)', async () => {
    const { data, error } = await admin
      .from('opportunite_alertes')
      .select('alerte_id')
      .eq('opportunite_id', CETIM_OPP)
      .eq('is_active', true)
    if (error) throw error
    const ids = (data ?? []).map((d) => d.alerte_id)
    assert.ok(!ids.includes(CETIM_ALERTE), 'une alerte retirée ne doit plus apparaître dans les lectures actives')
  })

  await testAsyncWrapper('Le lien retiré apparaît bien dans la requête des alertes écartées (is_active = false)', async () => {
    const { data, error } = await admin
      .from('opportunite_alertes')
      .select('alerte_id, motif_retrait')
      .eq('opportunite_id', CETIM_OPP)
      .eq('is_active', false)
    if (error) throw error
    const found = (data ?? []).find((d) => d.alerte_id === CETIM_ALERTE)
    assert.ok(found, 'le lien retiré doit apparaître dans les alertes écartées')
    assert.equal(found?.motif_retrait, 'doublon')
  })

  await testAsyncWrapper("Traçabilité : un événement 'alerte_retiree' a bien été journalisé (trigger SECURITY DEFINER)", async () => {
    const { data, error } = await admin
      .from('opportunite_activity_log')
      .select('event_type, details')
      .eq('opportunite_id', CETIM_OPP)
      .eq('event_type', 'alerte_retiree')
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) throw error
    assert.ok((data ?? []).length > 0, "le trigger doit avoir inséré un événement 'alerte_retiree'")
    assert.equal((data![0].details as Record<string, unknown>).alerte_id, CETIM_ALERTE)
    assert.equal((data![0].details as Record<string, unknown>).motif, 'doublon')
  })

  await testAsyncWrapper('Réintégration réelle : UPDATE is_active=true nettoie les métadonnées de retrait', async () => {
    const { error } = await admin
      .from('opportunite_alertes')
      .update({ is_active: true, retire_at: null, retire_par: null, motif_retrait: null, commentaire_retrait: null })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
    if (error) throw error
    const { data } = await admin
      .from('opportunite_alertes')
      .select('is_active, motif_retrait')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    assert.equal(data?.is_active, true)
    assert.equal(data?.motif_retrait ?? null, null)
  })

  await testAsyncWrapper("Traçabilité : un événement 'alerte_reintegree' a bien été journalisé, l'historique du retrait original reste lisible", async () => {
    const { data, error } = await admin
      .from('opportunite_activity_log')
      .select('event_type, details')
      .eq('opportunite_id', CETIM_OPP)
      .in('event_type', ['alerte_retiree', 'alerte_reintegree'])
      .order('created_at', { ascending: false })
      .limit(5)
    if (error) throw error
    const types = (data ?? []).map((d) => d.event_type)
    assert.ok(types.includes('alerte_reintegree'), "un événement 'alerte_reintegree' doit avoir été journalisé")
    assert.ok(types.includes('alerte_retiree'), "l'événement de retrait original ne doit jamais être effacé (append-only)")
  })

  await testAsyncWrapper('RLS : Cetim (user.staging) voit toujours ses propres alertes liées (non-régression)', async () => {
    const cetimClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
    const { error: authErr } = await cetimClient.auth.signInWithPassword({ email: 'user.staging@example.com', password: PASSWORD })
    if (authErr) throw authErr
    const { data, error } = await cetimClient.from('opportunite_alertes').select('*').eq('opportunite_id', CETIM_OPP)
    if (error) throw error
    assert.ok((data ?? []).length > 0)
  })

  await testAsyncWrapper('RLS : Cetim (user.staging) ne voit toujours pas les alertes liées Ekium (contrôle négatif, cross-tenant)', async () => {
    const cetimClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
    const { error: authErr } = await cetimClient.auth.signInWithPassword({ email: 'user.staging@example.com', password: PASSWORD })
    if (authErr) throw authErr
    const { data, error } = await cetimClient.from('opportunite_alertes').select('*').eq('opportunite_id', EKIUM_OPP)
    if (error) throw error
    assert.equal((data ?? []).length, 0)
  })

  await testAsyncWrapper('RLS : un utilisateur non-admin ne peut pas retirer une alerte (écriture bloquée, 0 ligne affectée)', async () => {
    const cetimClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
    const { error: authErr } = await cetimClient.auth.signInWithPassword({ email: 'user.staging@example.com', password: PASSWORD })
    if (authErr) throw authErr
    const { data, error } = await cetimClient
      .from('opportunite_alertes')
      .update({ is_active: false, retire_at: new Date().toISOString(), motif_retrait: 'doublon' })
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .select()
    // Pas d'erreur PostgREST : RLS bloque silencieusement (0 ligne) — voir AlerteRetraitRepository.
    if (error) throw error
    assert.equal((data ?? []).length, 0, "un utilisateur non-admin ne doit pouvoir modifier aucune ligne (RLS 'admin write opportunite_alertes')")
  })

  await testAsyncWrapper('Non-régression : détail (vue opportunite_dossier) de l\'opportunité Cetim toujours accessible', async () => {
    const { data, error } = await admin.from('opportunite_dossier').select('opportunite_id').eq('opportunite_id', CETIM_OPP).maybeSingle()
    if (error) throw error
    assert.ok(data)
  })

  await testAsyncWrapper('Nettoyage final : le lien de test est bien actif, sans motif résiduel (aucune trace laissée)', async () => {
    const { data } = await admin
      .from('opportunite_alertes')
      .select('is_active, motif_retrait, retire_at, retire_par, commentaire_retrait')
      .eq('opportunite_id', CETIM_OPP)
      .eq('alerte_id', CETIM_ALERTE)
      .maybeSingle()
    assert.equal(data?.is_active, true)
    assert.equal(data?.motif_retrait ?? null, null)
    assert.equal(data?.retire_at ?? null, null)
    assert.equal(data?.retire_par ?? null, null)
  })
}

// Petit alias pour rester cohérent avec le nom utilisé dans la section réseau ci-dessus.
async function testAsyncWrapper(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    passed++
    results.push(`PASS - ${name}`)
  } catch (e) {
    results.push(`FAIL - ${name}: ${(e as Error).message}`)
  }
}

async function main() {
  for (const t of asyncTests) await t()

  let networkSkippedNote = ''
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PASSWORD) {
    networkSkippedNote =
      "\n(Tests réseau Staging ignorés : SUPABASE_URL / SUPABASE_ANON_KEY / SPRINT10_TEST_PASSWORD absents de l'environnement.)"
  } else {
    await runNetworkTests()
  }

  console.log(results.join('\n'))
  console.log(networkSkippedNote)
  const total = results.length
  console.log(`\n${passed}/${total} tests passés`)
  if (passed !== total) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
