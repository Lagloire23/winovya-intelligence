// Sprint 9 (Phase 4/5) — Grille de cartes KPI (max 4-6, imposé par
// l'appelant). Purement présentationnel : les valeurs arrivent déjà
// formatées (KpiCardDto.value est une string), aucun calcul ici.
import type { KpiCardDto } from '../../lib/dashboard'

export function KpiCardGrid({ items }: { items: KpiCardDto[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((k) => (
        <div key={k.key} className="card-winovya p-3">
          <p className="text-2xl font-heading font-bold text-brand-navy dark:text-white">{k.value}</p>
          <p className="text-xs text-[hsl(217,4%,46%)]">{k.label}</p>
          {k.hint && <p className="text-[10px] text-[hsl(217,4%,60%)] mt-0.5">{k.hint}</p>}
        </div>
      ))}
    </div>
  )
}
