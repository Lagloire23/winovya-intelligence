import { X, Paperclip, User, ExternalLink, MapPin, Calendar, Building2 } from 'lucide-react'
import type { AlerteWithRelations } from '../lib/types'
import { LinkedinLink } from './LinkedinLink'

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

function fmtMontant(m: number | null) {
  if (m === null || m === undefined) return null
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(m)
}

export function AlertDetail({ alerte, onClose }: { alerte: AlerteWithRelations; onClose: () => void }) {
  const montant = fmtMontant(alerte.montant)

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl animate-in slide-in-from-right">
        <div className="sticky top-0 bg-white border-b border-[hsl(217,6%,90%)] px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            {alerte.priorite && (
              <span className={`badge mb-2 ${prioriteColor[alerte.priorite] || ''}`}>{alerte.priorite}</span>
            )}
            <h2 className="text-lg font-heading font-bold leading-snug">{alerte.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-brand-neutral shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-3 text-sm text-[hsl(217,4%,46%)]">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {[alerte.commune_collectivite, alerte.departement, alerte.pays].filter(Boolean).join(' · ')}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {fmtDate(alerte.date_publication)}
            </span>
            {alerte.categorie_veille && (
              <span className="flex items-center gap-1.5">
                <Building2 size={14} />
                {alerte.categorie_veille}
              </span>
            )}
          </div>

          {alerte.resume && (
            <div>
              <h3 className="text-sm font-heading font-bold mb-1.5">Résumé</h3>
              <p className="text-sm leading-relaxed text-[hsl(240,10%,20%)] whitespace-pre-line">{alerte.resume}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            {alerte.acteur_entite && (
              <div>
                <p className="text-[hsl(217,4%,46%)] text-xs mb-0.5">Acteur / Entité</p>
                <p className="font-medium">{alerte.acteur_entite}</p>
              </div>
            )}
            {montant && (
              <div>
                <p className="text-[hsl(217,4%,46%)] text-xs mb-0.5">Montant</p>
                <p className="font-medium">{montant}</p>
              </div>
            )}
            {alerte.reference_officielle && (
              <div>
                <p className="text-[hsl(217,4%,46%)] text-xs mb-0.5">Référence</p>
                <p className="font-medium">{alerte.reference_officielle}</p>
              </div>
            )}
            {alerte.echeance_date_limite && (
              <div>
                <p className="text-[hsl(217,4%,46%)] text-xs mb-0.5">Échéance</p>
                <p className="font-medium">{fmtDate(alerte.echeance_date_limite)}</p>
              </div>
            )}
          </div>

          {alerte.lien_source_url && (
            <a
              href={alerte.lien_source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-brand-primary hover:underline"
            >
              <ExternalLink size={14} />
              Voir la source
            </a>
          )}

          {alerte.mots_cles && alerte.mots_cles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {alerte.mots_cles.map((m) => (
                <span key={m} className="badge">
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Pertinence par entreprise */}
          {alerte.pertinence_entreprise.length > 0 && (
            <div>
              <h3 className="text-sm font-heading font-bold mb-2">Pertinence par entreprise</h3>
              <div className="space-y-3">
                {alerte.pertinence_entreprise.map((p) => (
                  <div key={p.id} className="card-winovya p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm">{p.entreprises?.name}</span>
                      {p.score_pertinence && (
                        <span className={`badge ${scoreColor[p.score_pertinence] || ''}`}>{p.score_pertinence}</span>
                      )}
                    </div>
                    {p.lien_business && (
                      <p className="text-sm text-[hsl(240,10%,20%)] leading-relaxed">{p.lien_business}</p>
                    )}
                    {p.donneur_ordre_deja_client && (
                      <p className="text-xs text-[hsl(217,4%,46%)] mt-1.5">
                        Statut client : {p.donneur_ordre_deja_client}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact décideur direct */}
          {alerte.contact_decideur_nom && (
            <div>
              <h3 className="text-sm font-heading font-bold mb-2 flex items-center gap-1.5">
                <User size={15} />
                Contact décideur
              </h3>
              <div className="card-winovya p-3 text-sm space-y-0.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <LinkedinLink url={alerte.contact_decideur_linkedin} size={15} />
                  {alerte.contact_decideur_nom}
                </p>
                {alerte.contact_decideur_fonction && (
                  <p className="text-[hsl(217,4%,46%)]">{alerte.contact_decideur_fonction}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {alerte.contact_decideur_email && (
                    <a href={`mailto:${alerte.contact_decideur_email}`} className="text-brand-primary hover:underline">
                      {alerte.contact_decideur_email}
                    </a>
                  )}
                  {alerte.contact_decideur_telephone && <span>{alerte.contact_decideur_telephone}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Pièces jointes */}
          {alerte.attachments.length > 0 && (
            <div>
              <h3 className="text-sm font-heading font-bold mb-2 flex items-center gap-1.5">
                <Paperclip size={15} />
                Pièces jointes
              </h3>
              <div className="space-y-1.5">
                {alerte.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-brand-primary hover:underline"
                  >
                    <Paperclip size={13} />
                    {a.filename || 'Document'}
                  </a>
                ))}
              </div>
            </div>
          )}

          {alerte.notes && (
            <div>
              <h3 className="text-sm font-heading font-bold mb-1.5">Notes</h3>
              <p className="text-sm text-[hsl(217,4%,46%)] whitespace-pre-line leading-relaxed">{alerte.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
