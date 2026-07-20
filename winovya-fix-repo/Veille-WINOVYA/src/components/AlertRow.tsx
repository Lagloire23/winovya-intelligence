import { useState } from 'react'
import {
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Factory,
  ClipboardList,
  Newspaper,
  Gavel,
  Landmark,
  FileWarning,
  TrendingUp,
  Mail,
  Phone,
  Paperclip,
  Lightbulb,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { AlerteWithRelations, StatutAlerte, ScorePertinence, Entreprise } from '../lib/types'
import { SCORE_BADGE_STYLE, SCORE_NUMERIC, SCORE_ORDER, STATUT_BADGE_STYLE, formatDate } from '../lib/displayHelpers'
import { LinkedinLink } from './LinkedinLink'
import { DecideurEnrichButton } from './DecideurEnrichButton'
import { ContactFinder } from './ContactFinder'
import { AlertAssistant } from './AlertAssistant'
import { AssignAlertModal } from './AssignAlertModal'

const CATEGORY_ICON: Record<string, LucideIcon> = {
  '7. ICPE': Factory,
  '5. Marchés publics & renouvellements': ClipboardList,
  '2. Presse locale': Newspaper,
  '6. Délibérations': Gavel,
  '3. Maîtrise foncière': Landmark,
  '1. Documents administratifs': FileText,
  '9. Arrêtés préfectoraux': FileWarning,
  '12. Budgets collectivités / investissements': TrendingUp,
}

interface Props {
  alerte: AlerteWithRelations
  entrepriseId: string // can be '__all' to show every company this alerte is relevant to
  entreprises: Entreprise[]
  index: number
  expanded: boolean
  onToggle: () => void
  onChanged: (id: string, patch: Partial<AlerteWithRelations>) => void
}

export function AlertRow({ alerte, entrepriseId, entreprises, index, expanded, onToggle, onChanged }: Props) {
  const perts =
    entrepriseId === '__all'
      ? alerte.pertinence_entreprise
      : alerte.pertinence_entreprise.filter((p) => p.entreprise_id === entrepriseId)
  // Best (highest-ranked) score across the relevant companies, used for the collapsed row badge.
  const score: ScorePertinence = perts.reduce<ScorePertinence>((best, p) => {
    const s = p.score_pertinence || 'À confirmer'
    return SCORE_ORDER.indexOf(s) < SCORE_ORDER.indexOf(best) ? s : best
  }, 'À confirmer')
  const Icon = CATEGORY_ICON[alerte.categorie_veille || ''] || FileText

  // Contexte "pourquoi cette alerte est pertinente pour telle entreprise
  // cliente" — transmis a l'Assistant IA (RAG) pour qu'il puisse repondre a
  // des questions comme "en quoi est-ce interessant pour Cetim ?" sans
  // inventer : ces donnees viennent reellement des tables pertinence_entreprise
  // et entreprises, pas d'une supposition du modele.
  const pertinences = perts.map((p) => {
    const ent = entreprises.find((e) => e.id === p.entreprise_id)
    return {
      entrepriseName: p.entreprises?.name || ent?.name || null,
      scorePertinence: p.score_pertinence,
      typeOpportunite: p.type_opportunite,
      lienBusiness: p.lien_business,
      donneurOrdreDejaClient: p.donneur_ordre_deja_client,
      competences: ent?.competences || null,
      secteursIntervention: ent?.secteurs_intervention || null,
      descriptionCourte: ent?.description_courte || null,
      motsClesMetiers: ent?.mots_cles_metiers || null,
    }
  })

  const [notes, setNotes] = useState(alerte.notes_equipe || '')
  const [saved, setSaved] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  async function updateField(patch: Record<string, unknown>) {
    const { error } = await supabase.from('alertes').update(patch).eq('id', alerte.id)
    if (!error) onChanged(alerte.id, patch as Partial<AlerteWithRelations>)
  }

  async function saveNotes() {
    setSaving(true)
    await updateField({ notes_equipe: notes })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div id={`alerte-${alerte.id}`} className="card-winovya overflow-hidden scroll-mt-4">
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-neutral/40 transition cursor-pointer"
      >
        <span className="text-xs text-[hsl(217,4%,60%)] w-5 shrink-0">{index}</span>
        <Icon size={18} className="text-brand-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-navy truncate">{alerte.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[hsl(217,4%,46%)]">
            <select
              value={alerte.statut}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation()
                updateField({ statut: e.target.value as StatutAlerte })
              }}
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer ${STATUT_BADGE_STYLE[alerte.statut]}`}
            >
              <option value="NOUVEAU">Nouveau</option>
              <option value="ASSIGNE">Assigné</option>
              <option value="TRAITE">Traité</option>
              <option value="ARCHIVE">Archivé</option>
            </select>
            {alerte.statut === 'ASSIGNE' && alerte.assigne_email && (
              <span className="inline-flex items-center gap-1">
                <Mail size={11} className="text-brand-primary" /> {alerte.assigne_email}
              </span>
            )}
            {alerte.commune_collectivite && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} />
                {alerte.commune_collectivite}
              </span>
            )}
            {alerte.region?.[0] && <span>{alerte.region[0]}</span>}
            {alerte.date_publication && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {formatDate(alerte.date_publication)}
              </span>
            )}
          </div>
        </div>
        {entrepriseId !== '__all' && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md border shrink-0 ${SCORE_BADGE_STYLE[score]}`}>
            {SCORE_NUMERIC[score].toFixed(1)}
          </span>
        )}
        {expanded ? (
          <ChevronUp size={16} className="text-[hsl(217,4%,60%)] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[hsl(217,4%,60%)] shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-[hsl(217,6%,90%)] grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          {/* Main detail column */}
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-brand-primary uppercase tracking-wide mb-2">Analyse</p>
              <dl className="text-sm space-y-1">
                {alerte.date_publication && (
                  <div className="flex gap-2">
                    <dt className="font-semibold shrink-0">Date de publication :</dt>
                    <dd>{formatDate(alerte.date_publication)}</dd>
                  </div>
                )}
                {alerte.reference_officielle && (
                  <div className="flex gap-2">
                    <dt className="font-semibold shrink-0">Référence :</dt>
                    <dd>{alerte.reference_officielle}</dd>
                  </div>
                )}
                {alerte.acteur_entite && (
                  <div className="flex gap-2">
                    <dt className="font-semibold shrink-0">Acteur concerné :</dt>
                    <dd>{alerte.acteur_entite}</dd>
                  </div>
                )}
              </dl>
            </div>

            {entrepriseId !== '__all' && perts.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-lg bg-brand-green-light/10 border border-brand-green-light/30 p-4">
                  <p className="text-sm font-semibold text-brand-navy mb-2">
                    Opportunité : Pertinence {perts[0].entreprises?.name} : {perts[0].score_pertinence || 'À confirmer'}.
                  </p>
                  {perts[0].lien_business && (
                    <p className="text-sm text-[hsl(217,10%,25%)] leading-relaxed flex gap-2">
                      <Lightbulb size={16} className="text-brand-green-deep shrink-0 mt-0.5" />
                      <span>{perts[0].lien_business}</span>
                    </p>
                  )}
                </div>
                {perts[0].type_opportunite && perts[0].type_opportunite.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {perts[0].type_opportunite.map((t) => (
                      <span
                        key={t}
                        className="badge !bg-brand-green-light/10 !text-brand-green-deep !border-brand-green-light/30"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {alerte.resume && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-brand-navy">Résumé</summary>
                <p className="mt-2 text-sm text-[hsl(217,10%,25%)] leading-relaxed">{alerte.resume}</p>
              </details>
            )}

            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-brand-navy">
                Localisation &amp; mots-clés
              </summary>
              <div className="mt-2 text-sm space-y-1">
                {alerte.region?.[0] && (
                  <p>
                    <span className="font-semibold">Région :</span> {alerte.region[0]}
                  </p>
                )}
                {alerte.departement && (
                  <p>
                    <span className="font-semibold">Département :</span> {alerte.departement}
                  </p>
                )}
                {alerte.commune_collectivite && (
                  <p>
                    <span className="font-semibold">Commune / Collectivité :</span> {alerte.commune_collectivite}
                  </p>
                )}
                {alerte.mots_cles && alerte.mots_cles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {alerte.mots_cles.map((m) => (
                      <span key={m} className="badge">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </details>

            {(alerte.lien_source_url || alerte.attachments.length > 0) && (
              <div>
                <p className="text-sm font-semibold text-brand-navy mb-2">Sources</p>
                <div className="flex flex-wrap gap-2">
                  {alerte.lien_source_url && (
                    <a
                      href={alerte.lien_source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      <ExternalLink size={13} />
                      {(() => {
                        try {
                          return new URL(alerte.lien_source_url).hostname.replace('www.', '')
                        } catch {
                          return 'Source'
                        }
                      })()}
                    </a>
                  )}
                  {alerte.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary !py-1.5 !px-3 text-xs"
                    >
                      <Paperclip size={13} />
                      {att.filename || 'Document'}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <AlertAssistant alerte={alerte} pertinences={pertinences} />
          </div>

          {/* Contacts + notes sidebar */}
          <div className="border-t lg:border-t-0 lg:border-l border-[hsl(217,6%,90%)] p-5 space-y-4 bg-brand-neutral/30">
            <div>
              <p className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-2">
                Contacts ({alerte.decideurs.length})
              </p>
              {alerte.decideurs.length === 0 ? (
                <ContactFinder alerte={alerte} onChanged={onChanged} />
              ) : (
                <div className="space-y-3">
                  {alerte.decideurs.map((d) => (
                    <div key={d.id} className="text-sm">
                      <p className="font-semibold text-brand-navy flex items-center gap-1.5">
                        {[d.prenom_personne, d.nom_personne].filter(Boolean).join(' ') || d.nom}
                        <LinkedinLink url={d.linkedin} />
                      </p>
                      {d.fonction_poste && (
                        <p className="text-xs text-[hsl(217,4%,46%)]">{d.fonction_poste}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {d.email ? (
                          <a
                            href={`mailto:${d.email}`}
                            className="text-xs inline-flex items-center gap-1 text-brand-primary"
                          >
                            <Mail size={12} /> {d.email}
                          </a>
                        ) : (
                          <DecideurEnrichButton decideur={d} field="email" />
                        )}
                        {d.telephone ? (
                          <a
                            href={`tel:${d.telephone}`}
                            className="text-xs inline-flex items-center gap-1 text-brand-primary"
                          >
                            <Phone size={12} /> {d.telephone}
                          </a>
                        ) : (
                          <DecideurEnrichButton decideur={d} field="phone" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                Assigné à un(e) collègue
              </label>
              <button
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary hover:underline"
              >
                <UserPlus size={13} />
                {alerte.assigne_email ? 'Réassigner' : 'Assigner'}
              </button>
              {assignOpen && (
                <AssignAlertModal
                  alerte={alerte}
                  onClose={() => setAssignOpen(false)}
                  onAssigned={(email) => onChanged(alerte.id, { assigne_email: email, statut: 'ASSIGNE' })}
                />
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  setSaved(false)
                }}
                placeholder="Ajouter une note de suivi…"
                rows={3}
                className="input-winovya text-xs resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <button onClick={saveNotes} disabled={saving || saved} className="btn-primary !py-1 !px-3 text-xs">
                  {saving ? 'Enregistrement…' : 'Valider'}
                </button>
                {saved && <span className="text-xs text-brand-green-deep">✓ Enregistré</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
