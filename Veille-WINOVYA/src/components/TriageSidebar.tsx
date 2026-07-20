import { Inbox, Layers, UserCheck, CheckCircle2, Archive, type LucideIcon } from 'lucide-react'

const BUCKETS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: '__all', label: 'Toutes', icon: Layers },
  { key: 'NOUVEAU', label: 'Boîte de réception', icon: Inbox },
  { key: 'ASSIGNE', label: 'Assigné', icon: UserCheck },
  { key: 'TRAITE', label: 'Traité', icon: CheckCircle2 },
  { key: 'ARCHIVE', label: 'Archivé', icon: Archive },
]

interface Props {
  counts: Record<string, number>
  active: string
  onChange: (key: string) => void
}

export function TriageSidebar({ counts, active, onChange }: Props) {
  return (
    <div className="w-full lg:w-52 shrink-0 space-y-1">
      {BUCKETS.map((b) => {
        const Icon = b.icon
        const isActive = active === b.key
        return (
          <button
            key={b.key}
            onClick={() => onChange(b.key)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition ${
              isActive
                ? 'bg-brand-neutral text-brand-primary font-semibold'
                : 'text-[hsl(217,10%,25%)] hover:bg-brand-neutral/60'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icon size={15} />
              {b.label}
            </span>
            <span className="text-xs text-[hsl(217,4%,46%)]">{counts[b.key] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}
