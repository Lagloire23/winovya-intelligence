import { MapPin, Calendar, Paperclip } from 'lucide-react'
import type { AlerteWithRelations } from '../lib/types'

const scoreColor: Record<string, string> = {
  'Très Haute': 'bg-brand-green-deep text-white',
  Haute: 'bg-brand-green-light/20 text-brand-green-deep border border-brand-green-light/40',
  Moyenne: 'bg-amber-100 text-amber-800 border border-amber-200',
  Basse: 'bg-[hsl(217,5%,96%)] text-[hsl(217,4%,46%)] border border-[hsl(217,6%,90%)]',
  'À confirmer': 'bg-[hsl(217,5%,96%)] text-[hsl(217,4%,46%)] border border-[hsl(217,6%,90%)]',
}

const prioriteColor: Record<string, string> = {
  Haute: 'bg-red-50 text-red-700 border border-red-200',
  Moyenne: 'bg-amber-50 text-amber-700 border border-amber-200',
  Basse: 'bg-[hsl(217,5%,96%)] text-[hsl(217,4%,46%)] border border-[hsl(217,6%,90%)]',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return d
  }
}

export function AlertCard({ alerte, onClick }: { alerte: AlerteWithRelations; onClick: () => void }) {
  const bestScore = alerte.pertinence_entreprise
    .map((p) => p.score_pertinence)
    .sort((a, b) => {
      const order = ['Très Haute', 'Haute', 'Moyenne', 'Basse', 'À confirmer']
      return order.indexOf(a || '') - order.indexOf(b || '')
    })[0]

  return (
    <button
      onClick={onClick}
      className="card-winovya w-full text-left p-4 hover:shadow-md hover:border-brand-primary/30 transition"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap gap-1.5">
          {alerte.priorite && (
            <span className={`badge ${prioriteColor[alerte.priorite] || ''}`}>{alerte.priorite}</span>
          )}
          {bestScore && <span className={`badge ${scoreColor[bestScore] || ''}`}>{bestScore}</span>}
        </div>
        {alerte.attachments.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-[hsl(217,4%,46%)] shrink-0">
            <Paperclip size={12} />
            {alerte.attachments.length}
          </span>
        )}
      </div>
      <h3 className="font-heading font-bold text-sm leading-snug mb-1.5 line-clamp-2">{alerte.name}</h3>
      {alerte.resume && (
        <p className="text-xs text-[hsl(217,4%,46%)] line-clamp-2 mb-2 leading-relaxed">{alerte.resume}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(217,4%,46%)]">
        <span className="flex items-center gap-1">
          <MapPin size={12} />
          {[alerte.commune_collectivite || alerte.departement, alerte.pays !== 'France' ? alerte.pays : null]
            .filter(Boolean)
            .join(', ') || '—'}
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {fmtDate(alerte.date_publication)}
        </span>
      </div>
      {alerte.pertinence_entreprise.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {alerte.pertinence_entreprise.map((p) => (
            <span key={p.id} className="text-[10px] font-semibold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded-sm">
              {p.entreprises?.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
