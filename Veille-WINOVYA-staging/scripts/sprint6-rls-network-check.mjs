// Sprint 6 — Vérification réseau réelle (Phase 8/9 : RLS) sur les
// nouvelles tables (opportunite_notes, opportunite_activity_log) et sur
// l'assignation (opportunites.assigned_to/assigned_at), avec la clé
// anonyme publiable réelle contre Supabase Staging — exactement le
// client que le Frontend utiliserait (jamais service_role). Même
// méthodologie que scripts/sprint5-rls-network-check.mjs.
//
// Attendu : un client non authentifié (rôle "anon") ne doit RIEN lire ni
// écrire sur ces tables, sans erreur bloquante.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants dans l\'environnement.')
  process.exit(1)
}

const anonClient = createClient(url, anonKey, { db: { schema: 'veille' } })

const { data: notes, error: notesError } = await anonClient.from('opportunite_notes').select('*')
console.log('anon SELECT opportunite_notes -> error:', notesError ? notesError.message : null, '| rows:', notes ? notes.length : null)

const { data: log, error: logError } = await anonClient.from('opportunite_activity_log').select('*')
console.log('anon SELECT opportunite_activity_log -> error:', logError ? logError.message : null, '| rows:', log ? log.length : null)

const { data: insertedNote, error: insertError } = await anonClient
  .from('opportunite_notes')
  .insert({ opportunite_id: '22222222-2222-2222-2222-222222222222', auteur_id: '82231ff5-8a5c-4521-aead-aca8b2063770', contenu: 'HACKED-BY-ANON' })
  .select()
console.log('anon INSERT opportunite_notes -> error:', insertError ? insertError.message : null, '| rows:', insertedNote)

const { data: assignAttempt, error: assignError } = await anonClient
  .from('opportunites')
  .update({ assigned_to: '82231ff5-8a5c-4521-aead-aca8b2063770' })
  .eq('id', '22222222-2222-2222-2222-222222222222')
  .select()
console.log('anon UPDATE opportunites.assigned_to -> error:', assignError ? assignError.message : null, '| rows:', assignAttempt)
