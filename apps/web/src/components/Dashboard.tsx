import React, { useState, useMemo } from 'react'
import { Opportunity, OpportunityStatus } from '../types/opportunity'
import { OpportunityCard } from './OpportunityCard'

interface DashboardProps {
  opportunities: Opportunity[]
  userRole: 'admin' | 'user'
  userId?: string
}

export const Dashboard: React.FC<DashboardProps> = ({ opportunities, userRole, userId }) => {
  const [selectedStatus, setSelectedStatus] = useState<OpportunityStatus | 'ALL'>('ALL')
  const [sortBy, setSortBy] = useState<'priority' | 'confidence' | 'date' | 'budget'>('priority')
  const [searchTerm, setSearchTerm] = useState('')

  // Filter opportunities based on role
  const filteredByRole = useMemo(() => {
    if (userRole === 'user' && userId) {
      return opportunities.filter(opp => opp.assigned_to === userId)
    }
    return opportunities
  }, [opportunities, userRole, userId])

  // Filter by status
  const filteredByStatus = useMemo(() => {
    if (selectedStatus === 'ALL') return filteredByRole
    return filteredByRole.filter(opp => opp.statut === selectedStatus)
  }, [filteredByRole, selectedStatus])

  // Filter by search
  const filtered = useMemo(() => {
    return filteredByStatus.filter(opp =>
      opp.titre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.entreprise.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.secteur.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [filteredByStatus, searchTerm])

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered]
    switch (sortBy) {
      case 'priority':
        return copy.sort((a, b) => b.score.priorite_commerciale - a.score.priorite_commerciale)
      case 'confidence':
        return copy.sort((a, b) => {
          const confMap = { high: 3, medium: 2, low: 1 }
          return confMap[b.confidence] - confMap[a.confidence]
        })
      case 'date':
        return copy.sort((a, b) => new Date(b.date_dernier_signal).getTime() - new Date(a.date_dernier_signal).getTime())
      case 'budget':
        return copy.sort((a, b) => (b.budget_estime || 0) - (a.budget_estime || 0))
      default:
        return copy
    }
  }, [filtered, sortBy])

  // Statistics
  const stats = useMemo(() => {
    return {
      total: filteredByRole.length,
      by_status: {
        PROSPECT: filteredByRole.filter(o => o.statut === 'PROSPECT').length,
        NEGOTIATION: filteredByRole.filter(o => o.statut === 'NEGOTIATION').length,
        WON: filteredByRole.filter(o => o.statut === 'WON').length,
        LOST: filteredByRole.filter(o => o.statut === 'LOST').length,
        ARCHIVED: filteredByRole.filter(o => o.statut === 'ARCHIVED').length,
      },
      avg_priority: Math.round(filteredByRole.reduce((sum, o) => sum + o.score.priorite_commerciale, 0) / filteredByRole.length),
      total_budget: filteredByRole.reduce((sum, o) => sum + (o.budget_estime || 0), 0)
    }
  }, [filteredByRole])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎯 Cockpit d'Opportunités WINOVYA
          </h1>
          <p className="text-gray-600">
            {userRole === 'admin' ? 'Vue administration - Toutes les opportunités' : 'Vos opportunités assignées'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 uppercase">Total d'opportunités</p>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 uppercase">Score moyen</p>
            <p className="text-3xl font-bold text-green-600">{stats.avg_priority}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 uppercase">Budget total</p>
            <p className="text-3xl font-bold text-purple-600">€{(stats.total_budget / 1000000000).toFixed(1)}B</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 uppercase">Gagnées</p>
            <p className="text-3xl font-bold text-orange-600">{stats.by_status.WON}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Recherche</label>
              <input
                type="text"
                placeholder="Titre, entreprise, secteur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Statut</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as OpportunityStatus | 'ALL')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tous</option>
                <option value="PROSPECT">Prospect</option>
                <option value="NEGOTIATION">Négociation</option>
                <option value="WON">Gagnée</option>
                <option value="LOST">Perdue</option>
                <option value="ARCHIVED">Archivée</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tri</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="priority">Par priorité commerciale ↓</option>
                <option value="confidence">Par confiance ↓</option>
                <option value="date">Par date récente ↓</option>
                <option value="budget">Par budget ↓</option>
              </select>
            </div>
          </div>

          {/* Status Badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            {['PROSPECT', 'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'].map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status as OpportunityStatus)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status} ({stats.by_status[status as OpportunityStatus]})
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {sorted.length} opportunité{sorted.length !== 1 ? 's' : ''} trouvée{sorted.length !== 1 ? 's' : ''}
          </h2>

          {sorted.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <p className="text-gray-500 text-lg">Aucune opportunité ne correspond à vos filtres</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {sorted.map(opportunity => (
                <OpportunityCard key={opportunity.id} opportunity={opportunity} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
