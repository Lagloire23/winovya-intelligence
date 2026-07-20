// Sprint 11C.1 — Refonte UX cockpit : l'ancien panneau "Analyse métier"
// (7 rubriques, dont 5 systématiquement "Non disponible") est remplacé
// par UNE SEULE carte compacte "Pourquoi cette opportunité mérite votre
// attention" (maximum ~8 lignes), conformément au brief. Sprint
// exclusivement frontend : aucune nouvelle donnée, aucun nouveau
// calcul — ce composant continue de consommer UNIQUEMENT les champs
// déjà exposés par OpportuniteDetailDto (resumeMetier / raisons /
// confiance / statut d'enrichissement, tous calculés par
// DossierEnrichmentService, Sprint 4). Les 5 axes qui n'ont aucune
// donnée serveur (besoin probable, offres/compétences, facteurs
// favorables distincts, prochaine action) disparaissent silencieusement
// plutôt que d'afficher un "Non disponible" répété — ils réapparaîtront
// au fil des sprints IA futurs (11D/14/15/16) une fois les champs
// serveur disponibles.
//
// `incertitudesMessage` reste exporté et inchangé (fonction pure,
// couverte par scripts/sprint11c-dossier-ui-tests.ts) : seule sa
// présentation change (une ligne compacte au lieu d'une rubrique à
// part entière).

import { Target } from 'lucide-react'
import type { OpportuniteDetailDto } from '../../lib/opportunities/query/types'

export function incertitudesMessage(statut: OpportuniteDetailDto['enrichissement']['statut']): string {
  switch (statut) {
    case 'ready':
      return 'Aucune incertitude structurelle signalée par la consolidation actuelle.'
    case 'partial':
      return 'Consolidation partielle : certaines informations peuvent encore évoluer.'
    case 'pending':
      return "Consolidation en attente d'un nouveau calcul (donnée récemment modifiée)."
    case 'failed':
      return 'Échec de la dernière consolidation : les informations affichées peuvent être incomplètes.'
    default:
      return 'Non disponible.'
  }
}

function pourquoiImportante(dossier: OpportuniteDetailDto): string {
  const n = dossier.enrichissement.raisons.length
  if (!dossier.confiance) return "Analyse en cours de consolidation : le niveau de confiance n'est pas encore établi."
  if (n === 0) return `Niveau de confiance ${dossier.confiance} — aucune justification détaillée disponible pour le moment.`
  return `Niveau de confiance ${dossier.confiance} — ${n} élément${n > 1 ? 's' : ''} confirmé${n > 1 ? 's' : ''} par les signaux détectés.`
}

export function AnalyseMetierPanel({ dossier }: { dossier: OpportuniteDetailDto }) {
  const raisons = dossier.enrichissement.raisons
  const raisonsAffichees = raisons.slice(0, 3)
  const raisonsRestantes = raisons.length - raisonsAffichees.length

  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-3 flex items-center gap-2">
        <Target size={15} className="text-brand-primary" /> Pourquoi cette opportunité mérite votre attention
      </h2>

      <div className="space-y-2 text-sm">
        <p className="text-brand-navy dark:text-gray-200 leading-snug">
          {dossier.resumeMetier || 'Aucun résumé disponible pour le moment.'}
        </p>

        <p className="text-[hsl(217,4%,46%)] leading-snug">{pourquoiImportante(dossier)}</p>

        {raisonsAffichees.length > 0 && (
          <p className="text-brand-navy dark:text-gray-200 leading-snug">
            <span className="font-semibold">Points forts : </span>
            {raisonsAffichees.join(' · ')}
            {raisonsRestantes > 0 && <span className="text-[hsl(217,4%,55%)]"> (+{raisonsRestantes} autre{raisonsRestantes > 1 ? 's' : ''})</span>}
          </p>
        )}

        <p className="text-[hsl(217,4%,46%)] italic leading-snug">
          <span className="font-semibold not-italic">À confirmer : </span>
          {incertitudesMessage(dossier.enrichissement.statut)}
        </p>
      </div>
    </div>
  )
}
