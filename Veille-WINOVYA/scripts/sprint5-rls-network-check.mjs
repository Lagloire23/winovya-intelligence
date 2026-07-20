// Sprint 5 — Vérification réseau réelle (Phase 9/11 : RLS) de
// OpportuniteQueryRepository, exécutée avec la clé anonyme (publishable)
// réelle contre Supabase Staging — exactement le client que le Frontend
// utiliserait (jamais service_role). Ce script lit l'URL/la clé
// exclusivement depuis les variables d'environnement (mêmes noms que
// src/lib/supabase.ts) : aucun secret écrit en dur ici. Utilitaire de
// vérification, pas un test unitaire — exécuté manuellement une fois
// pour ce rapport (voir docs/opportunity-query-api.md).
//
// Attendu : un client non authentifié (rôle "anon") ne doit reçevoir
// AUCUNE ligne de veille.opportunite_dossier (RLS des tables sources
// veille.opportunites, security_invoker = true), sans erreur bloquante —
// preuve que le Frontend ne peut jamais lire les dossiers sans session
// authentifiée, quelle que soit la couche applicative utilisée.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants dans l\'environnement.')
  process.exit(1)
}

const anonClient = createClient(url, anonKey, { db: { schema: 'veille' } })

const { data, error, count } = await anonClient
  .from('opportunite_dossier')
  .select('*', { count: 'exact' })
  .ilike('texte_recherche', '%sprint5-test%')

console.log('anon SELECT opportunite_dossier -> error:', error ? error.message : null, '| rows:', data ? data.length : null, '| count:', count)

const { data: single, error: singleError } = await anonClient
  .from('opportunite_dossier')
  .select('*')
  .eq('opportunite_id', '9a97c8e2-971f-43e5-a0e0-2918f1657e2b')
  .maybeSingle()
console.log('anon SELECT single opportunite -> error:', singleError ? singleError.message : null, '| row:', single)

// Écriture anonyme : doit être bloquée par la policy "admin write opportunites".
const { error: writeError } = await anonClient
  .from('opportunites')
  .update({ statut_enrichissement: 'ready' })
  .eq('id', '9a97c8e2-971f-43e5-a0e0-2918f1657e2b')
console.log('anon UPDATE opportunites -> error (attendu : non-null ou 0 ligne affectée):', writeError ? writeError.message : '(pas d\'erreur reportée, vérifier 0 ligne affectée côté SQL)')
