// Correctif écran blanc — régénère les colonnes de consolidation
// (raisons, resume, statut_enrichissement, niveau_confiance, budget_*,
// phase_projet) des opportunités réelles issues du Sprint 10 encore au
// statut 'pending', en appelant EXCLUSIVEMENT la fonction pure existante
// DossierEnrichmentService.consolidate (Sprint 4, non modifiée, non
// réécrite ici) — jamais de nouvelle règle métier.
//
// Pourquoi ce script plutôt que d'ouvrir chaque dossier dans l'app : le
// mécanisme de "consolidation à la lecture" (OpportuniteQueryService.getDossier)
// est censé s'en charger automatiquement, mais son écriture
// (DossierRepository.saveConsolidation) ne vérifie jamais le nombre de
// lignes réellement affectées par l'UPDATE. Or la policy RLS d'écriture
// sur veille.opportunites est admin-only (voir Sprint 10.1) : quand un
// utilisateur "member" ouvre un dossier encore 'pending', l'UPDATE est
// silencieusement filtré à 0 ligne par RLS (aucune erreur renvoyée), donc
// la donnée malformée n'est jamais réparée pour lui — c'est un bug
// distinct, non corrigé ici (hors périmètre de cette mission, signalé
// dans le rapport). Ce script exécute donc la MÊME logique via un accès
// privilégié (service_role, hors RLS), pour réparer les données déjà en
// base sans dépendre de ce chemin applicatif cassé.
//
// Aucune donnée n'est inventée : consolidate() ne fait que dériver des
// faits déjà en base (nombre de signaux/preuves/décideurs, montant
// observé, catégorie de veille) — voir DossierEnrichmentService.ts.

import { createClient } from '@supabase/supabase-js'
import { DossierEnrichmentService } from '../src/lib/opportunities/dossier/DossierEnrichmentService'
import type { CorrelationConfidence, DossierSignalInput, PhaseProjet } from '../src/lib/opportunities/dossier/types'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY requis (service_role, hors RLS, jamais loggé).')
  }
  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { db: { schema: 'veille' } })

  const { data: pendingRows, error: pendingErr } = await client
    .from('opportunites')
    .select('id, titre, entite_cible, type_opportunite, geographie, nombre_signaux, date_premier_signal, date_dernier_signal, score_details')
    .eq('statut_enrichissement', 'pending')
    .eq('import_batch_id', 'SPRINT10-LEGACY-REAL-DATA-V1')
  if (pendingErr) throw pendingErr
  const rows = pendingRows ?? []
  console.log(`Opportunités 'pending' du batch Sprint 10 à consolider : ${rows.length}`)

  let ok = 0
  let failed = 0

  for (const opp of rows) {
    try {
      const { data: links, error: linksErr } = await client
        .from('opportunite_alertes')
        .select('alerte_id')
        .eq('opportunite_id', opp.id)
      if (linksErr) throw linksErr
      const alerteIds = (links ?? []).map((l: any) => l.alerte_id as string)

      let signaux: DossierSignalInput[] = []
      if (alerteIds.length > 0) {
        const { data: alertes, error: alertesErr } = await client
          .from('alertes')
          .select('id, montant, categorie_veille, date_detection, reference_officielle, lien_source_url, name')
          .in('id', alerteIds)
        if (alertesErr) throw alertesErr
        signaux = (alertes ?? []).map((a: any) => ({
          alerteId: String(a.id),
          montant: (a.montant as number | null) ?? null,
          categorieVeille: (a.categorie_veille as string | null) ?? null,
          dateDetection: String(a.date_detection),
          referenceOfficielle: (a.reference_officielle as string | null) ?? null,
          lienSourceUrl: (a.lien_source_url as string | null) ?? null,
          name: String(a.name ?? ''),
        }))
      }

      const { count: nombrePreuves, error: preuvesErr } = await client
        .from('opportunite_preuves')
        .select('id', { count: 'exact', head: true })
        .eq('opportunite_id', opp.id)
      if (preuvesErr) throw preuvesErr

      const { count: nombreDecideurs, error: decideursErr } = await client
        .from('opportunite_decideurs')
        .select('opportunite_id', { count: 'exact', head: true })
        .eq('opportunite_id', opp.id)
      if (decideursErr) throw decideursErr

      const scoreDetails = (opp.score_details as Record<string, unknown> | null) ?? null
      const correlation = scoreDetails?.correlation as { confidence?: CorrelationConfidence } | undefined
      const anticipation = scoreDetails?.anticipation as { etapeProjet?: PhaseProjet } | undefined

      const input = {
        opportuniteId: String(opp.id),
        titre: String(opp.titre),
        entiteCible: (opp.entite_cible as string | null) ?? null,
        typeOpportunite: (opp.type_opportunite as string | null) ?? null,
        geographie: (opp.geographie as string | null) ?? null,
        nombreSignaux: Number((opp as any).nombre_signaux ?? signaux.length),
        nombrePreuves: nombrePreuves ?? 0,
        nombreDecideurs: nombreDecideurs ?? 0,
        datePremierSignal: (opp.date_premier_signal as string | null) ?? null,
        dateDernierSignal: (opp.date_dernier_signal as string | null) ?? null,
        correlationConfidence: correlation?.confidence ?? null,
        etapeProjet: anticipation?.etapeProjet ?? null,
        signaux,
      }

      // Fonction pure existante (Sprint 4), non modifiée, non réimplémentée.
      const result = DossierEnrichmentService.consolidate(input)

      const { error: updErr } = await client
        .from('opportunites')
        .update({
          phase_projet: result.phaseProjet,
          budget_identifie: result.budgetIdentifie,
          budget_source: result.budgetSource,
          budget_fiabilite: result.budgetFiabilite,
          niveau_confiance: result.niveauConfiance,
          raisons: result.raisons,
          resume: result.resumeMetier,
          statut_enrichissement: result.statutEnrichissement,
          derniere_consolidation_at: new Date().toISOString(),
        })
        .eq('id', opp.id)
      if (updErr) throw updErr

      ok++
    } catch (e) {
      failed++
      console.error(`  ECHEC consolidation ${opp.id} (${opp.titre}):`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`Consolidées avec succès : ${ok} / ${rows.length}. Échecs : ${failed}.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
