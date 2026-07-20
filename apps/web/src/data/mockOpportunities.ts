import { Opportunity, ActivityLog } from '../types/opportunity'

export const mockOpportunities: Opportunity[] = [
  {
    id: 'opp-001',
    titre: 'Nouvelle usine de batteries - Bourges',
    entreprise: 'MBDA',
    entite_cible: 'Ministère de la Défense',
    type_opportunite: 'Nouvelle usine',
    secteur: 'Aéronautique & Défense',
    geographie: 'Bourges, Centre',
    budget_estime: 45000000,
    statut: 'PROSPECT',
    score: {
      adequation: 85,
      convergence: 78,
      anticipation: 90,
      priorite_commerciale: 83
    },
    nombre_signaux: 4,
    date_detection: '2026-03-15',
    date_dernier_signal: '2026-07-18',
    derniere_evolution_metier_at: '2026-07-18',
    etape_projet: 'ETUDE',
    confidence: 'high',
    assigned_to: 'user-001',
    lien_source_url: 'https://example.com/alerts/001',
    description: 'Projet stratégique de développement manufacturier avec forte probabilité'
  },
  {
    id: 'opp-002',
    titre: 'Infrastructure routière régionale',
    entreprise: 'Thales Infrastructure',
    entite_cible: 'Conseil Régional Nouvelle-Aquitaine',
    type_opportunite: 'Appel d\'offres public',
    secteur: 'Infrastructures',
    geographie: 'Nouvelle-Aquitaine',
    budget_estime: 25000000,
    statut: 'NEGOTIATION',
    score: {
      adequation: 72,
      convergence: 65,
      anticipation: 40,
      priorite_commerciale: 60
    },
    nombre_signaux: 2,
    date_detection: '2026-05-10',
    date_dernier_signal: '2026-07-12',
    derniere_evolution_metier_at: '2026-07-12',
    etape_projet: 'APPEL_OFFRES',
    confidence: 'medium',
    lien_source_url: 'https://example.com/alerts/002'
  },
  {
    id: 'opp-003',
    titre: 'Centre R&D pharmaceutique - Paris',
    entreprise: 'Sanofi',
    entite_cible: 'Direction de R&D',
    type_opportunite: 'Construction facility',
    secteur: 'Pharmaceutique',
    geographie: 'Île-de-France',
    budget_estime: 120000000,
    statut: 'PROSPECT',
    score: {
      adequation: 92,
      convergence: 88,
      anticipation: 75,
      priorite_commerciale: 86
    },
    nombre_signaux: 5,
    date_detection: '2026-02-20',
    date_dernier_signal: '2026-07-19',
    derniere_evolution_metier_at: '2026-07-19',
    etape_projet: 'FONCIER',
    confidence: 'high',
    assigned_to: 'user-002',
    lien_source_url: 'https://example.com/alerts/003'
  },
  {
    id: 'opp-004',
    titre: 'Parc éolien offshore - Bretagne',
    entreprise: 'EDF Renewables',
    entite_cible: 'Direction Énergie Marine',
    type_opportunite: 'Projet énergétique',
    secteur: 'Énergies renouvelables',
    geographie: 'Bretagne',
    budget_estime: 380000000,
    statut: 'PROSPECT',
    score: {
      adequation: 78,
      convergence: 82,
      anticipation: 85,
      priorite_commerciale: 81
    },
    nombre_signaux: 3,
    date_detection: '2026-04-05',
    date_dernier_signal: '2026-07-11',
    derniere_evolution_metier_at: '2026-07-11',
    etape_projet: 'INTENTION',
    confidence: 'high',
    assigned_to: 'user-001',
    lien_source_url: 'https://example.com/alerts/004'
  },
  {
    id: 'opp-005',
    titre: 'Campus universitaire rénové - Lyon',
    entreprise: 'Université Claude Bernard',
    entite_cible: 'Direction Immobilier',
    type_opportunite: 'Rénovation édifice',
    secteur: 'Éducation',
    geographie: 'Rhône-Alpes',
    budget_estime: 85000000,
    statut: 'WON',
    score: {
      adequation: 88,
      convergence: 90,
      anticipation: 60,
      priorite_commerciale: 80
    },
    nombre_signaux: 6,
    date_detection: '2025-11-10',
    date_dernier_signal: '2026-06-30',
    derniere_evolution_metier_at: '2026-06-30',
    etape_projet: 'CONSULTATION',
    confidence: 'high',
    lien_source_url: 'https://example.com/alerts/005'
  },
  {
    id: 'opp-006',
    titre: 'Autoroute intelligente - Provence',
    entreprise: 'VINCI Autoroutes',
    entite_cible: 'Direction Stratégique',
    type_opportunite: 'Projet mobilité',
    secteur: 'Transport & Mobilité',
    geographie: 'Provence-Alpes-Côte d\'Azur',
    budget_estime: 250000000,
    statut: 'PROSPECT',
    score: {
      adequation: 65,
      convergence: 70,
      anticipation: 55,
      priorite_commerciale: 65
    },
    nombre_signaux: 2,
    date_detection: '2026-06-01',
    date_dernier_signal: '2026-07-05',
    derniere_evolution_metier_at: '2026-07-05',
    etape_projet: 'INTENTION',
    confidence: 'low',
    lien_source_url: 'https://example.com/alerts/006'
  }
]

export const mockActivityLog: ActivityLog[] = [
  {
    id: 'log-001',
    opportunite_id: 'opp-001',
    action: 'scored',
    changed_by: 'system',
    details: 'Scoring engine updated indicators',
    timestamp: '2026-07-19T14:30:00Z'
  },
  {
    id: 'log-002',
    opportunite_id: 'opp-003',
    action: 'created',
    changed_by: 'user-002',
    details: 'Opportunity created from alert',
    timestamp: '2026-07-18T10:15:00Z'
  },
  {
    id: 'log-003',
    opportunite_id: 'opp-002',
    action: 'status_changed',
    changed_by: 'user-001',
    details: 'Status changed from PROSPECT to NEGOTIATION',
    timestamp: '2026-07-17T16:45:00Z'
  },
  {
    id: 'log-004',
    opportunite_id: 'opp-004',
    action: 'assigned',
    changed_by: 'admin',
    details: 'Assigned to user-001',
    timestamp: '2026-07-16T09:20:00Z'
  },
  {
    id: 'log-005',
    opportunite_id: 'opp-005',
    action: 'status_changed',
    changed_by: 'user-002',
    details: 'Status changed to WON',
    timestamp: '2026-07-10T11:00:00Z'
  }
]
