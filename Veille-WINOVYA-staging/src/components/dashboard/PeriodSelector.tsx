// Sprint 9 (Phase 2) — Sélecteur de période 7/30/90 jours, défaut 30.
// Purement présentationnel : la fenêtre est appliquée par
// DashboardService (calcul déterministe, dashboard.helpers.ts), jamais
// recalculée ici.
import { DASHBOARD_PERIODS, type DashboardPeriodDays } from '../../lib/dashboard'

export function PeriodSelector({
  value,
  onChange,
}: {
  value: DashboardPeriodDays
  onChange: (period: DashboardPeriodDays) => void
}) {
  return (
    <div
      role="group"
      aria-label="Période d'observation du cockpit"
      className="inline-flex items-center gap-1 bg-brand-neutral/60 rounded-lg p-1"
    >
      {DASHBOARD_PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={value === p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            value === p
              ? 'bg-white text-brand-primary shadow-sm dark:bg-brand-navy'
              : 'text-[hsl(217,4%,46%)] hover:text-brand-navy'
          }`}
        >
          {p} j
        </button>
      ))}
    </div>
  )
}
