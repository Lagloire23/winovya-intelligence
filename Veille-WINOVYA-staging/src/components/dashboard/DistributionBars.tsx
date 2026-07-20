// Sprint 9 (Phase 4) — Répartitions (max 2, imposé par l'appelant).
// Mêmes principes que PipelineOverview.tsx : barres CSS, "Non renseigné"
// systématique pour les valeurs manquantes (jamais une case vide muette).
import type { DistributionDto } from '../../lib/dashboard'

export function DistributionBars({ distribution }: { distribution: DistributionDto }) {
  const total = distribution.buckets.reduce((s, b) => s + b.count, 0)
  const max = Math.max(1, ...distribution.buckets.map((b) => b.count))
  return (
    <div>
      <p className="text-xs font-semibold text-brand-navy dark:text-white mb-2">{distribution.title}</p>
      {total === 0 ? (
        <p className="text-xs text-[hsl(217,4%,46%)]">Aucune donnée pour l'instant.</p>
      ) : (
        <div className="space-y-1.5">
          {distribution.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11px] text-[hsl(217,10%,25%)] dark:text-gray-300 truncate" title={b.label}>
                {b.label}
              </span>
              <div className="flex-1 h-3 rounded bg-brand-neutral/60 dark:bg-white/5 overflow-hidden">
                <div className="h-full rounded bg-brand-primary/70" style={{ width: `${(b.count / max) * 100}%` }} />
              </div>
              <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-brand-navy dark:text-white">{b.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
