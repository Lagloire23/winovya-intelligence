import { SlidersHorizontal } from 'lucide-react'
import { EntrepriseProfileForm } from '../components/EntrepriseProfileForm'

// Accessible depuis le sous-menu "Critères" (sous Délibérations, dans
// Intelligence marché). Réutilise exactement le même formulaire que l'étape
// 3 de l'onboarding, pré-rempli avec le profil de l'entreprise actuellement
// sélectionnée dans le sélecteur "Entreprise" du tableau de bord — permet de
// relire/corriger le profil et les filtres de veille (pays, régions,
// départements, types d'opportunité) à tout moment, sans repasser par le
// mini-formulaire ni l'extraction IA du site.
export function CriteresOpportunitesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-brand-navy mb-1 flex items-center gap-2">
          <SlidersHorizontal size={22} /> Critères
        </h1>
        <p className="text-sm text-[hsl(217,4%,46%)]">
          Profil entreprise et filtres de veille — modifiez-les à tout moment, ils déterminent ce qui remonte dans
          votre veille d'opportunités.
        </p>
      </div>

      <div className="max-w-2xl">
        <EntrepriseProfileForm submitLabel="Enregistrer" />
      </div>
    </div>
  )
}
