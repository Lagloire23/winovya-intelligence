/**
 * Types pour le moteur d'opportunités WINOVYA Intelligence
 * Basé sur Sprint 2/2.1 (Backend) + Sprint 9 (Dashboard)
 */

export type OpportunityStatus = 'PROSPECT' | 'IN_PROGRESS' | 'NEGOTIATION' | 'WON' | 'LOST' | 'ARCHIVED'

export type ConfidenceLevel = 'low' | 'medium' | 'high'

export type ProjectPhase = 'INTENTION' | 'ETUDE' | 'FONCIER' | 'AUTORISATION' | 'RECRUTEMENT' | 'CONSULTATION' | 'ANNONCE' | 'APPEL_OFFRES'

export interface ScoringIndicators {
  adequation: number // 0-100
  convergence: number // 0-100
  anticipation: number // 0-100
  priorite_commerciale: number // 0-100
}

export interface Opportunity {
  id: string
  titre: string
  entreprise: string
  entite_cible: string
  type_opportunite: string
  secteur: string
  geographie: string
  budget_estime?: number
  statut: OpportunityStatus
  score: ScoringIndicators
  nombre_signaux: number
  date_detection: string
  date_dernier_signal: string
  derniere_evolution_metier_at: string
  etape_projet: ProjectPhase
  confidence: ConfidenceLevel
  assigned_to?: string
  lien_source_url?: string
  description?: string
}

export interface ActivityLog {
  id: string
  opportunite_id: string
  action: 'created' | 'updated' | 'status_changed' | 'assigned' | 'scored'
  changed_by: string
  details: string
  timestamp: string
}

export interface DashboardStats {
  total_opportunities: number
  opportunities_by_status: Record<OpportunityStatus, number>
  avg_confidence: number
  avg_priority_score: number
}

export interface UserRole {
  type: 'admin' | 'user'
  userId?: string
}
