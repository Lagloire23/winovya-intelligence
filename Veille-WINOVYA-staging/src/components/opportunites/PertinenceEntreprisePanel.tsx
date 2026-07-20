// Sprint 11C.1 — Encadré "Pertinence pour votre entreprise" (brief §3).
//
// Emplacement volontairement préparé pour une future analyse de
// personnalisation (profil entreprise : secteur, taille, offres...),
// qui n'existe pas encore dans le modèle de données actuel
// (OpportuniteDetailDto n'expose aucun champ de ce type, et ce sprint
// interdit explicitement toute nouvelle migration ou nouveau calcul).
//
// Tant qu'aucune donnée de profil entreprise n'est disponible, ce
// composant affiche donc systématiquement le message d'attente
// ci-dessous plutôt que d'inventer une analyse — conforme à "ne rien
// inventer, préparer simplement l'emplacement".

import { Building2 } from 'lucide-react'

export function PertinenceEntreprisePanel() {
  return (
    <div className="card-winovya p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-navy dark:text-white mb-2 flex items-center gap-2">
        <Building2 size={15} className="text-brand-primary" /> Pourquoi cette opportunité est pertinente pour votre entreprise
      </h2>
      <p className="text-sm text-[hsl(217,4%,55%)] italic">
        Analyse personnalisée disponible après configuration du profil entreprise.
      </p>
    </div>
  )
}
