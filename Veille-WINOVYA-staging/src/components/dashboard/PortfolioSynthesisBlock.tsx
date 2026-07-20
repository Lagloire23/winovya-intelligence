// Sprint 9 (Phase 4/15) — Bloc de synthèse de portefeuille. Texte
// 100% déterministe (voir dashboard.helpers.ts:buildPortfolioSynthesis).
// C'est le point d'extension explicite prévu pour le Sprint 10 : un
// futur générateur IA produirait le même `PortfolioSynthesisDto`
// (source: 'ai') sans que ce composant n'ait à changer. Aucun appel
// externe, aucune donnée fabriquée ici.
import { Sparkles } from 'lucide-react'
import type { PortfolioSynthesisDto } from '../../lib/dashboard'

export function PortfolioSynthesisBlock({ synthese }: { synthese: PortfolioSynthesisDto }) {
  return (
    <div className="card-winovya p-4 flex items-start gap-3">
      <div className="h-8 w-8 rounded-full bg-brand-primary/10 flex items-center justify-center shrink-0">
        <Sparkles size={16} className="text-brand-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold text-brand-navy dark:text-white mb-1">Synthèse du portefeuille</p>
        <p className="text-sm text-[hsl(217,10%,25%)] dark:text-gray-300">{synthese.text}</p>
        <p className="text-[10px] text-[hsl(217,4%,60%)] mt-1">Synthèse calculée automatiquement à partir de règles déterministes.</p>
      </div>
    </div>
  )
}
