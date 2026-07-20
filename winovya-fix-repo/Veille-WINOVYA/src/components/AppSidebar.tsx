import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  LayoutDashboard,
  Inbox,
  UserCheck,
  CheckCircle2,
  Archive,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Target,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { useDashboardNav } from '../contexts/DashboardNavContext'

interface MenuItem {
  key: string
  label: string
  icon: LucideIcon
  kind: 'bucket' | 'categorie' | 'link'
  value: string
}

const INTELLIGENCE_ITEMS: MenuItem[] = [
  { key: 'NOUVEAU', label: 'Boîte de réception', icon: Inbox, kind: 'bucket', value: 'NOUVEAU' },
  { key: 'ASSIGNE', label: 'Assigné', icon: UserCheck, kind: 'bucket', value: 'ASSIGNE' },
  { key: 'TRAITE', label: 'Traité', icon: CheckCircle2, kind: 'bucket', value: 'TRAITE' },
  { key: 'ARCHIVE', label: 'Archivé', icon: Archive, kind: 'bucket', value: 'ARCHIVE' },
  { key: 'DELIBERATIONS', label: 'Délibérations', icon: FileText, kind: 'categorie', value: '6. Délibérations' },
  {
    key: 'RENOUVELLEMENTS',
    label: 'Renouvellements',
    icon: RefreshCw,
    kind: 'categorie',
    value: '5. Marchés publics & renouvellements',
  },
  {
    key: 'CRITERES_OPPORTUNITES',
    label: 'Critères',
    icon: SlidersHorizontal,
    kind: 'link',
    value: '/dashboard/criteres-opportunites',
  },
  {
    key: 'OPPORTUNITES',
    label: 'Opportunités',
    icon: Target,
    kind: 'link',
    value: '/dashboard/opportunites',
  },
]

export function AppSidebar() {
  const { bucket, categorie, bucketCounts, categorieCounts, selectBucket, selectCategorie, reset } = useDashboardNav()
  const navigate = useNavigate()
  const location = useLocation()
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const isHome = bucket === '__all' && categorie === '__all'

  return (
    <div className="space-y-6">
      {/* Sprint 9 (Phase 6/7) : "Tableau de bord" — le cockpit devient la
          destination par défaut après connexion (voir App.tsx : wildcard
          + redirections post-login/onboarding). "Accueil" (alertes,
          inchangé) reste accessible séparément juste en-dessous. */}
      <button
        onClick={() => navigate('/dashboard/cockpit')}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition ${
          location.pathname === '/dashboard/cockpit'
            ? 'bg-brand-neutral text-brand-primary'
            : 'text-brand-navy hover:bg-brand-neutral/60'
        }`}
      >
        <LayoutDashboard size={16} />
        Tableau de bord
      </button>

      <button
        onClick={() => {
          reset()
          navigate('/dashboard')
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold transition ${
          isHome ? 'bg-brand-neutral text-brand-primary' : 'text-brand-navy hover:bg-brand-neutral/60'
        }`}
      >
        <Home size={16} />
        Accueil
      </button>

      <div>
        <button
          onClick={() => setSubmenuOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 mb-1 text-xs font-bold uppercase tracking-wide text-brand-navy hover:text-brand-primary transition"
        >
          Intelligence marché
          {submenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {submenuOpen && (
          <div className="space-y-1">
            {INTELLIGENCE_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive =
                item.kind === 'bucket'
                  ? bucket === item.value && categorie === '__all'
                  : item.kind === 'categorie'
                    ? categorie === item.value
                    : location.pathname === item.value
              const count = item.kind === 'link' ? null : item.kind === 'bucket' ? bucketCounts[item.value] ?? 0 : categorieCounts[item.key] ?? 0
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    if (item.kind === 'bucket') {
                      selectBucket(item.value)
                      navigate('/dashboard')
                    } else if (item.kind === 'categorie') {
                      selectCategorie(item.value)
                      navigate('/dashboard')
                    } else {
                      navigate(item.value)
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition ${
                    isActive
                      ? 'bg-brand-neutral text-brand-primary font-semibold'
                      : 'text-[hsl(217,10%,25%)] hover:bg-brand-neutral/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={15} />
                    {item.label}
                  </span>
                  {count !== null && <span className="text-xs text-[hsl(217,4%,46%)]">{count}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <a
          href="https://attributions.winovya.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-navy hover:text-brand-primary transition"
        >
          Marchés attribués
        </a>
      </div>

      <div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[hsl(217,4%,60%)]">Mes marchés</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-neutral text-[hsl(217,4%,46%)] shrink-0">
            Coming soon
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-[hsl(217,4%,60%)]">Mes réponses</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-neutral text-[hsl(217,4%,46%)] shrink-0">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  )
}
