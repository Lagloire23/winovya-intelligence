// Sprint 9 — Page cockpit (Phase 4/5/6/13). Point d'entrée unique :
// détermine le rôle à afficher UNIQUEMENT depuis le profil authentifié
// (AuthContext, chargé après connexion Supabase réelle, protégé par la
// RLS `read own profile` / `admin manage profiles` — Sprint 6, inchangée)
// et délègue à DashboardService.getDashboard (jamais de rôle fourni par
// un paramètre d'URL ou une prop non fiable).
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { createDashboardService } from '../lib/dashboard'
import type { AdminDashboardDto, DashboardPeriodDays, UserDashboardDto } from '../lib/dashboard'
import { DEFAULT_DASHBOARD_PERIOD } from '../lib/dashboard'
import { translateError } from '../lib/dashboard'
import { logDevError } from '../lib/opportunities/devLog'
import { LoadingState, ErrorState } from '../components/common/States'
import { AppSidebar } from '../components/AppSidebar'
import { PeriodSelector } from '../components/dashboard/PeriodSelector'
import { AdminCockpitView } from '../components/dashboard/AdminCockpitView'
import { UserCockpitView } from '../components/dashboard/UserCockpitView'

const dashboardService = createDashboardService()

type CockpitResult =
  | { role: 'admin'; data: AdminDashboardDto }
  | { role: 'member'; data: UserDashboardDto }

export function CockpitPage() {
  const { profile } = useAuth()
  const [period, setPeriod] = useState<DashboardPeriodDays>(DEFAULT_DASHBOARD_PERIOD)
  const [result, setResult] = useState<CockpitResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await dashboardService.getDashboard({ userId: profile.id, role: profile.role }, period)
      setResult(res)
    } catch (e) {
      logDevError({ screen: 'CockpitPage', operation: 'getDashboard' }, e)
      setErrorMsg(translateError(e, "Impossible de charger le cockpit pour le moment."))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role, period])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      {/* Sprint 9.1 (Phase 2) : repli de navigation sous `lg`, identique au
          bloc déjà présent dans DashboardPage.tsx — AppSidebar réutilisé tel
          quel, aucune nouvelle logique de navigation. */}
      <div className="lg:hidden mb-5 card-winovya p-3">
        <AppSidebar />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-heading font-bold text-brand-navy dark:text-white mb-1">Tableau de bord</h1>
          <p className="text-sm text-[hsl(217,4%,46%)]">
            {profile?.role === 'admin'
              ? "Vue d'ensemble de l'organisation."
              : 'Vue personnelle de vos opportunités.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Rafraîchir le cockpit"
            className="btn-secondary !p-2"
            title="Rafraîchir"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {loading ? 'Chargement du cockpit en cours.' : errorMsg ? errorMsg : 'Cockpit à jour.'}
      </div>

      {loading && !result ? (
        <LoadingState label="Chargement du cockpit…" />
      ) : errorMsg ? (
        <ErrorState message={errorMsg} onRetry={load} />
      ) : result?.role === 'admin' ? (
        <AdminCockpitView data={result.data} />
      ) : result?.role === 'member' ? (
        <UserCockpitView data={result.data} />
      ) : null}
    </div>
  )
}
