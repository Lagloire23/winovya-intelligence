import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { SecteurClients } from '../lib/types'
import { EntrepriseProfileForm, EMPTY_FORM, type FullForm } from '../components/EntrepriseProfileForm'
import logoFull from '../assets/logo-full.png'

// Page d'onboarding, affichée une seule fois par entreprise (tant que
// entreprises.onboarding_complete = false) juste après la connexion, à la
// place du tableau de bord — cf. ProtectedRoute.
//
// Étape 1 : mini-formulaire (4 champs clés + site web).
// Étape 2 : si un site web est fourni, l'IA va le lire et pré-remplit le
//           formulaire complet (extract-entreprise-from-website).
// Étape 3 : formulaire complet éditable (profil entreprise + filtres de
//           veille), rendu par le composant partagé EntrepriseProfileForm
//           (aussi utilisé par la page "Critères d'opportunités" du menu,
//           pour relire/corriger le profil à tout moment par la suite).

type Step = 'form' | 'extracting' | 'review'

export function OnboardingPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('form')
  const [miniForm, setMiniForm] = useState<Pick<FullForm, 'name' | 'competences' | 'effectif_taille' | 'zone_geographique' | 'site_web'>>({
    name: EMPTY_FORM.name,
    competences: EMPTY_FORM.competences,
    effectif_taille: EMPTY_FORM.effectif_taille,
    zone_geographique: EMPTY_FORM.zone_geographique,
    site_web: EMPTY_FORM.site_web,
  })
  const [reviewOverrides, setReviewOverrides] = useState<Partial<FullForm>>({})
  const [extractError, setExtractError] = useState<string | null>(null)

  function field<K extends keyof typeof miniForm>(key: K, value: (typeof miniForm)[K]) {
    setMiniForm((f) => ({ ...f, [key]: value }))
  }

  async function handleMiniFormSubmit(e: FormEvent) {
    e.preventDefault()
    setExtractError(null)

    if (!miniForm.site_web.trim()) {
      setReviewOverrides({ ...miniForm })
      setStep('review')
      return
    }

    setStep('extracting')
    let overrides: Partial<FullForm> = { ...miniForm }
    try {
      const { data, error } = await supabase.functions.invoke('extract-entreprise-from-website', {
        body: { siteUrl: miniForm.site_web.trim() },
      })
      if (error || data?.status !== 'OK') {
        setExtractError(data?.message || "L'analyse du site a échoué — vous pouvez continuer et compléter à la main.")
      } else {
        const d = data.data || {}
        overrides = {
          ...miniForm,
          name: miniForm.name || d.name || '',
          competences: d.competences || miniForm.competences,
          references_clients: d.references_clients || undefined,
          description_courte: d.description_courte || undefined,
          secteurs_intervention: d.secteurs_intervention || undefined,
          zone_geographique: miniForm.zone_geographique || d.zone_geographique || '',
          mots_cles_metiers: d.mots_cles_metiers || undefined,
          effectif_taille: miniForm.effectif_taille || d.effectif_taille || '',
          secteur_clients: (d.secteur_clients as SecteurClients) || undefined,
        }
      }
    } catch {
      setExtractError("L'analyse du site a échoué — vous pouvez continuer et compléter à la main.")
    }
    setReviewOverrides(overrides)
    setStep('review')
  }

  return (
    <div className="min-h-screen bg-brand-neutral/50 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-center mb-8">
          <img src={logoFull} alt="WINOVYA Market Intelligence" className="h-11 w-auto mb-4" />
          <h1 className="text-xl font-heading font-bold text-brand-navy text-center">Bienvenue sur WINOVYA Market Intelligence</h1>
          <p className="text-sm text-[hsl(217,4%,46%)] text-center mt-1 max-w-md">
            Quelques informations sur votre entreprise pour personnaliser votre veille d'opportunités.
          </p>
        </div>

        {step === 'form' && (
          <form onSubmit={handleMiniFormSubmit} className="card-winovya p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Nom de l'entreprise *
                </label>
                <input
                  required
                  value={miniForm.name}
                  onChange={(e) => field('name', e.target.value)}
                  className="input-winovya"
                  placeholder="Ex. Cetim"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Secteur d'activité
                </label>
                <input
                  value={miniForm.competences}
                  onChange={(e) => field('competences', e.target.value)}
                  className="input-winovya"
                  placeholder="Ex. Ingénierie mécanique"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Effectif
                </label>
                <input
                  value={miniForm.effectif_taille}
                  onChange={(e) => field('effectif_taille', e.target.value)}
                  className="input-winovya"
                  placeholder="Ex. 50-100 salariés"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                  Zone géographique
                </label>
                <input
                  value={miniForm.zone_geographique}
                  onChange={(e) => field('zone_geographique', e.target.value)}
                  className="input-winovya"
                  placeholder="Ex. France entière"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-brand-navy uppercase tracking-wide mb-1.5 block">
                Site internet de l'entreprise
              </label>
              <input
                value={miniForm.site_web}
                onChange={(e) => field('site_web', e.target.value)}
                className="input-winovya"
                placeholder="www.entreprise.fr"
              />
              <p className="text-[11px] text-[hsl(217,4%,46%)] mt-1 flex items-center gap-1">
                <Sparkles size={11} />
                Si renseigné, l'IA analysera le site pour pré-remplir automatiquement le reste du profil.
              </p>
            </div>

            <button type="submit" className="btn-primary w-full">
              Continuer
            </button>
          </form>
        )}

        {step === 'extracting' && (
          <div className="card-winovya p-10 flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-brand-primary" size={28} />
            <p className="text-sm text-[hsl(217,4%,46%)]">Analyse du site en cours…</p>
          </div>
        )}

        {step === 'review' && (
          <EntrepriseProfileForm
            initialOverrides={reviewOverrides}
            noticeMessage={extractError}
            submitLabel="Valider"
            onSaved={() => navigate('/dashboard/cockpit', { replace: true })}
          />
        )}
      </div>
    </div>
  )
}
