// Calcule (sans écrire nulle part) le résultat de consolidation pour un
// lot d'opportunités, en appelant EXCLUSIVEMENT la fonction pure existante
// DossierEnrichmentService.consolidate (Sprint 4, non modifiée). Lit
// /tmp/mission-fix/input.json (extrait en lecture seule de Staging via
// l'outil MCP Supabase), écrit /tmp/mission-fix/output.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { DossierEnrichmentService } from '../src/lib/opportunities/dossier/DossierEnrichmentService'
import type { CorrelationConfidence, DossierSignalInput, PhaseProjet } from '../src/lib/opportunities/dossier/types'

interface InputRow {
  id: string
  titre: string
  entite_cible: string | null
  type_opportunite: string | null
  geographie: string | null
  nombre_signaux: number
  date_premier_signal: string | null
  date_dernier_signal: string | null
  score_details: Record<string, unknown> | null
  nombre_preuves: number
  nombre_decideurs: number
  signaux: Array<{
    alerteId: string
    montant: number | null
    categorieVeille: string | null
    dateDetection: string
    referenceOfficielle: string | null
    lienSourceUrl: string | null
    name: string
  }>
}

const rows: InputRow[] = JSON.parse(readFileSync('/tmp/mission-fix/input.json', 'utf-8'))

const results = rows.map((opp) => {
  const scoreDetails = opp.score_details ?? null
  const correlation = scoreDetails?.correlation as { confidence?: CorrelationConfidence } | undefined
  const anticipation = scoreDetails?.anticipation as { etapeProjet?: PhaseProjet } | undefined

  const signaux: DossierSignalInput[] = opp.signaux.map((s) => ({
    alerteId: s.alerteId,
    montant: s.montant,
    categorieVeille: s.categorieVeille,
    dateDetection: s.dateDetection,
    referenceOfficielle: s.referenceOfficielle,
    lienSourceUrl: s.lienSourceUrl,
    name: s.name,
  }))

  const input = {
    opportuniteId: opp.id,
    titre: opp.titre,
    entiteCible: opp.entite_cible,
    typeOpportunite: opp.type_opportunite,
    geographie: opp.geographie,
    nombreSignaux: opp.nombre_signaux ?? signaux.length,
    nombrePreuves: opp.nombre_preuves ?? 0,
    nombreDecideurs: opp.nombre_decideurs ?? 0,
    datePremierSignal: opp.date_premier_signal,
    dateDernierSignal: opp.date_dernier_signal,
    correlationConfidence: correlation?.confidence ?? null,
    etapeProjet: anticipation?.etapeProjet ?? null,
    signaux,
  }

  const result = DossierEnrichmentService.consolidate(input)
  return { id: opp.id, ...result }
})

writeFileSync('/tmp/mission-fix/output.json', JSON.stringify(results, null, 2))
console.log(`Consolidation calculée pour ${results.length} opportunités.`)
for (const r of results.slice(0, 3)) {
  console.log(JSON.stringify(r, null, 2))
}
