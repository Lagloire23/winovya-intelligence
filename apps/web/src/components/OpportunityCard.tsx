import React from 'react'
import { Opportunity } from '../types/opportunity'

interface OpportunityCardProps {
  opportunity: Opportunity
}

const statusColors: Record<string, string> = {
  PROSPECT: 'bg-blue-100 text-blue-800',
  NEGOTIATION: 'bg-yellow-100 text-yellow-800',
  WON: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800'
}

const confidenceColors: Record<string, string> = {
  high: 'text-green-600',
  medium: 'text-yellow-600',
  low: 'text-red-600'
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{opportunity.titre}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {opportunity.entreprise} → {opportunity.entite_cible}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[opportunity.statut]}`}>
          {opportunity.statut}
        </span>
      </div>

      {/* Key Info */}
      <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-gray-200">
        <div>
          <p className="text-xs text-gray-500 uppercase">Secteur</p>
          <p className="text-sm font-semibold text-gray-900">{opportunity.secteur}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Géographie</p>
          <p className="text-sm font-semibold text-gray-900">{opportunity.geographie}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Budget estimé</p>
          <p className="text-sm font-semibold text-gray-900">
            {opportunity.budget_estime ? `€${(opportunity.budget_estime / 1000000).toFixed(1)}M` : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Signaux</p>
          <p className="text-sm font-semibold text-gray-900">{opportunity.nombre_signaux}</p>
        </div>
      </div>

      {/* Scores */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase mb-2">Scores</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-blue-50 p-2 rounded">
            <p className="text-xs text-gray-600">Adéquation</p>
            <p className="text-lg font-bold text-blue-600">{opportunity.score.adequation}</p>
          </div>
          <div className="bg-purple-50 p-2 rounded">
            <p className="text-xs text-gray-600">Convergence</p>
            <p className="text-lg font-bold text-purple-600">{opportunity.score.convergence}</p>
          </div>
          <div className="bg-orange-50 p-2 rounded">
            <p className="text-xs text-gray-600">Anticipation</p>
            <p className="text-lg font-bold text-orange-600">{opportunity.score.anticipation}</p>
          </div>
          <div className="bg-green-50 p-2 rounded">
            <p className="text-xs text-gray-600">Priorité</p>
            <p className="text-lg font-bold text-green-600">{opportunity.score.priorite_commerciale}</p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${confidenceColors[opportunity.confidence]}`}></span>
          <span className="capitalize">{opportunity.confidence} confidence</span>
        </div>
        <span>Dernière mise à jour: {new Date(opportunity.date_dernier_signal).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  )
}
