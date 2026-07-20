// Sprint 10.1 — Phase 5 : tests de sécurité directs contre Supabase Staging.
// Aucun frontend impliqué : ce script utilise @supabase/supabase-js avec la
// clé anon publique + de vraies sessions utilisateur (signInWithPassword),
// exactement comme le ferait le navigateur, mais en contournant entièrement
// React/le cockpit — conforme à la contrainte n°9 du cahier des charges
// ("tenter de contourner le frontend et interroger directement Supabase").
//
// Le script est piloté par une variable d'environnement ROUND, car chaque
// round nécessite un état différent du profil `user.staging@example.com`
// (rattaché à Cetim, puis Ekium, puis aucune entreprise) — bascule effectuée
// entre chaque appel via l'outil MCP Supabase (SQL direct sur Staging), donc
// hors de ce script. `npx tsx` est invoqué une fois par round.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PASSWORD = process.env.SPRINT10_TEST_PASSWORD ?? ''
const ROUND = process.env.ROUND ?? ''

const CETIM_ID = '18dc39f5-049e-4627-b526-c07bbb13e4b0'
const EKIUM_ID = 'b7b7f3c2-fca3-4255-b080-a4475981d83e'
const ETAMINE_ID = 'b0ccb4a3-83ac-41c6-9d05-49ff782fb50c'

const CETIM_OPP = '22cf217c-abe9-464e-845d-77647b589756'
const CETIM_OPP_PREUVE = 'acf2b9c1-52b7-4510-bb9c-7e21e855d648'
const CETIM_OPP_LOG = '01b1a26c-3862-419d-8341-46fd9505fea8'
const EKIUM_OPP = '2c55a39f-6358-45c8-ac40-ceb65138faa3'
const EKIUM_OPP_PREUVE = '144d0b31-5c67-44cd-bec3-512d01009f59'
const EKIUM_OPP_LOG = '0b51547d-374d-47fd-9259-85c00eb092cf'
const ETAMINE_OPP = 'dc8b99ff-745a-42bf-94c5-a9e8fc795ae8'
const ETAMINE_DECIDEUR_LINK_DECIDEUR_ID = '58531ed1-81f6-4ab4-b6f5-cea325553d82'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`Echec connexion ${email}: ${error.message}`)
  return client
}

async function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { db: { schema: 'veille' } })
}

async function runAdminRound() {
  console.log('\n=== Round ADMIN (admin.staging@example.com) ===\n')
  const client = await signIn('admin.staging@example.com')

  const { data: all, error: e1 } = await client.from('opportunites').select('id, entreprise_id')
  check('1. Admin: aucune erreur de lecture globale', !e1, e1?.message)
  check('1. Admin: voit bien les 3 entreprises du batch Sprint 10 (>=35 lignes)', (all?.length ?? 0) >= 35, `count=${all?.length}`)
  const seenCompanies = new Set((all ?? []).map((o: any) => o.entreprise_id))
  check('1. Admin: voit Cetim + Ekium + Etamine simultanément', [CETIM_ID, EKIUM_ID, ETAMINE_ID].every((id) => seenCompanies.has(id)))

  const { data: cetimOpp } = await client.from('opportunites').select('id').eq('id', CETIM_OPP).maybeSingle()
  const { data: ekiumOpp } = await client.from('opportunites').select('id').eq('id', EKIUM_OPP).maybeSingle()
  check('1. Admin: accès direct par UUID à une opportunité Cetim OK', Boolean(cetimOpp))
  check('1. Admin: accès direct par UUID à une opportunité Ekium OK', Boolean(ekiumOpp))
}

async function runCetimRound() {
  console.log('\n=== Round UTILISATEUR CETIM (user.staging rattaché à Cetim) ===\n')
  const client = await signIn('user.staging@example.com')

  const { data: opps, error: e1 } = await client.from('opportunites').select('id, entreprise_id')
  check('2. Cetim: aucune erreur de lecture', !e1, e1?.message)
  const companies = new Set((opps ?? []).map((o: any) => o.entreprise_id))
  check('2. Cetim: ne voit QUE des opportunités Cetim', companies.size === 1 && companies.has(CETIM_ID), `entreprises vues=${[...companies]}`)
  check('2. Cetim: ne voit aucune opportunité Ekium', !(opps ?? []).some((o: any) => o.entreprise_id === EKIUM_ID))
  check('2. Cetim: ne voit aucune opportunité Etamine', !(opps ?? []).some((o: any) => o.entreprise_id === ETAMINE_ID))

  // 5. Accès direct par UUID étranger
  const { data: foreign, error: e2 } = await client.from('opportunites').select('*').eq('id', EKIUM_OPP).maybeSingle()
  check('5. Cetim: accès direct à un UUID Ekium échoue (aucune ligne renvoyée)', !foreign && !e2, JSON.stringify({ foreign, error: e2?.message }))

  // 6. Tables enfants d'une opportunité NON autorisée
  const { data: foreignPreuve } = await client.from('opportunite_preuves').select('*').eq('id', EKIUM_OPP_PREUVE).maybeSingle()
  check('6. Cetim: preuve d\'une opportunité Ekium inaccessible', !foreignPreuve)
  const { data: foreignLog } = await client.from('opportunite_activity_log').select('*').eq('id', EKIUM_OPP_LOG).maybeSingle()
  check('6. Cetim: activité d\'une opportunité Ekium inaccessible', !foreignLog)
  const { data: foreignDecideurs } = await client.from('opportunite_decideurs').select('*').eq('opportunite_id', ETAMINE_OPP)
  check('6. Cetim: décideurs d\'une opportunité Etamine inaccessibles', (foreignDecideurs ?? []).length === 0)

  // Tables enfants d'une opportunité AUTORISÉE (positif — ne doit pas casser l'usage légitime)
  const { data: ownPreuve } = await client.from('opportunite_preuves').select('*').eq('id', CETIM_OPP_PREUVE).maybeSingle()
  check('6. Cetim: preuve de SA PROPRE opportunité reste accessible', Boolean(ownPreuve))
  const { data: ownLog } = await client.from('opportunite_activity_log').select('*').eq('id', CETIM_OPP_LOG).maybeSingle()
  check('6. Cetim: activité de SA PROPRE opportunité reste accessible', Boolean(ownLog))

  // 7. Recherche/filtres : impossible de faire apparaître une autre entreprise via un filtre explicite
  const { data: filtered } = await client.from('opportunites').select('id, entreprise_id').eq('entreprise_id', EKIUM_ID)
  check('7. Cetim: filtrer explicitement sur entreprise_id=Ekium ne renvoie rien', (filtered ?? []).length === 0)

  // 8. Pagination / comptage : le total ne doit pas inclure les autres entreprises
  const { count } = await client.from('opportunites').select('id', { count: 'exact', head: true })
  check('8. Cetim: le total compté (head count) correspond uniquement à Cetim (7)', count === 7, `count=${count}`)

  // 9. Écritures inter-entreprises : tentative de modifier une opportunité Ekium
  const { error: writeErr, data: writeData } = await client
    .from('opportunites')
    .update({ statut: 'QUALIFIED' })
    .eq('id', EKIUM_OPP)
    .select()
  check('9. Cetim: UPDATE sur une opportunité Ekium ne modifie aucune ligne (bloqué par RLS écriture admin-only)', (writeData ?? []).length === 0, JSON.stringify({ writeErr: writeErr?.message, writeData }))
}

async function runEkiumRound() {
  console.log('\n=== Round UTILISATEUR EKIUM (user.staging rattaché à Ekium) ===\n')
  const client = await signIn('user.staging@example.com')
  const { data: opps, error } = await client.from('opportunites').select('id, entreprise_id')
  check('3. Ekium: aucune erreur de lecture', !error, error?.message)
  const companies = new Set((opps ?? []).map((o: any) => o.entreprise_id))
  check('3. Ekium: ne voit QUE des opportunités Ekium', companies.size === 1 && companies.has(EKIUM_ID), `entreprises vues=${[...companies]}`)
  check('3. Ekium: total = 15', (opps ?? []).length === 15, `count=${opps?.length}`)
}

async function runNoCompanyRound() {
  console.log('\n=== Round UTILISATEUR SANS ENTREPRISE (user.staging entreprise_id = NULL) ===\n')
  const client = await signIn('user.staging@example.com')
  const { data: opps, error } = await client.from('opportunites').select('id')
  check('4. Sans entreprise: aucune erreur de lecture', !error, error?.message)
  check('4. Sans entreprise: voit zéro opportunité', (opps ?? []).length === 0, `count=${opps?.length}`)
  const { data: pertinence } = await client.from('pertinence_entreprise').select('id')
  check('4. Sans entreprise: voit zéro pertinence_entreprise', (pertinence ?? []).length === 0)
}

async function runAnonRound() {
  console.log('\n=== Round CLÉ ANON (non authentifié) ===\n')
  const client = await anonClient()
  const { data: opps, error } = await client.from('opportunites').select('id')
  check('10. Anon: aucune donnée métier privée accessible sans authentification', (opps ?? []).length === 0, JSON.stringify({ error: error?.message, count: opps?.length }))
  const { data: pert } = await client.from('pertinence_entreprise').select('id')
  check('10. Anon: pertinence_entreprise également vide sans authentification', (pert ?? []).length === 0)
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !PASSWORD) {
    console.log('Variables d\'environnement manquantes (SUPABASE_URL / SUPABASE_ANON_KEY / SPRINT10_TEST_PASSWORD) — round ignoré.')
    return
  }
  switch (ROUND) {
    case 'admin':
      await runAdminRound()
      break
    case 'cetim':
      await runCetimRound()
      break
    case 'ekium':
      await runEkiumRound()
      break
    case 'none':
      await runNoCompanyRound()
      break
    case 'anon':
      await runAnonRound()
      break
    default:
      throw new Error(`ROUND inconnu ou absent: "${ROUND}" (attendu: admin|cetim|ekium|none|anon)`)
  }
  console.log(`\nRound "${ROUND}" : ${passed} OK, ${failed} FAIL\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
