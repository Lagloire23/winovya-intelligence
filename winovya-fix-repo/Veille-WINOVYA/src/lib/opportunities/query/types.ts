// Sprint 5 — Contrats publics (DTO) de l'API métier de consultation des
// dossiers d'opportunité.
//
// Règle absolue : ces types sont la SEULE forme que le Frontend (ou tout
// futur consommateur : Dashboard, exports, Assistant IA, intégrations
// CRM) doit connaître. Aucun consommateur ne doit jamais lire directement
// veille.opportunites / veille.opportunite_dossier / les tables de
// liaison : tout passe par OpportuniteQueryService (voir
// OpportuniteQueryService.ts). Ces DTO sont volontairement DÉCOUPLÉS de la
// forme des lignes SQL (voir OpportuniteQueryRepository.ts pour le
// mapping) afin que la vue ou les tables puissent évoluer sans casser les
// consommateurs.
//
// Aucune nouvelle règle métier ici : les valeurs proviennent uniquement
// de veille.opportunite_dossier (Sprint 4 + extension Sprint 5) et de
// DossierEnrichmentService (Sprint 4, inchangé).

import type {
  BudgetFiabilite,
  NiveauConfiance,
  PhaseProjet,
  StatutEnrichissement,
} from '../dossier/types'

export type { BudgetFiabilite, NiveauConfiance, PhaseProjet, StatutEnrichissement }

/** Élément de liste — champs volontairement réduits (pas de raisons/résumé long : voir OpportuniteDetailDto). */
export interface OpportuniteListItemDto {
  id: string
  entrepriseId: string
  titre: string
  statutOpportunite: string
  classification: {
    typeOpportunite: string | null
    entiteCible: string | null
    geographie: string | null
    secteur: string | null
    phaseProjet: PhaseProjet | null
  }
  budget: {
    identifie: number | null
    fiabilite: BudgetFiabilite | null
  }
  confiance: NiveauConfiance | null
  enrichissement: {
    statut: StatutEnrichissement
  }
  signaux: {
    nombre: number
    datePremier: string | null
    dateDernier: string | null
  }
  compteurs: {
    preuves: number
    decideurs: number
  }
  /** Sprint 8 (Phase 2) : expose assigned_to/assigned_at (colonnes Sprint 6,
   * inchangées) directement sur la vue afin d'éviter le N+1 réseau du
   * Sprint 7 (un appel CommercialService.getAssignment(id) par ligne
   * visible). Seul l'identifiant est exposé : la résolution d'un nom
   * d'utilisateur reste limitée par la RLS veille.profiles (Sprint 6,
   * inchangée) et n'est jamais recalculée ici. */
  assignation: {
    profilId: string | null
    depuis: string | null
  }
  createdAt: string
  updatedAt: string
}

/** Vue détaillée — surclasse la liste avec les champs complets (budget, raisons, résumé). */
export interface OpportuniteDetailDto extends Omit<OpportuniteListItemDto, 'budget' | 'enrichissement'> {
  resumeMetier: string | null
  budget: {
    identifie: number | null
    source: string | null
    fiabilite: BudgetFiabilite | null
    estime: number | null
  }
  enrichissement: {
    statut: StatutEnrichissement
    raisons: string[]
    derniereConsolidationAt: string | null
  }
}

/** Signal (alerte) rattaché — sous-ensemble métier de veille.alertes, jamais la ligne brute. */
export interface AlerteLieeDto {
  id: string
  titre: string
  categorieVeille: string | null
  montant: number | null
  dateDetection: string
  datePublication: string | null
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  resume: string | null
}

export interface PreuveDto {
  id: string
  source: string | null
  citation: string | null
  url: string | null
  createdAt: string
}

/** Décideur rattaché — sous-ensemble métier de veille.decideurs. */
export interface DecideurLieDto {
  id: string
  nom: string | null
  nomPersonne: string | null
  prenomPersonne: string | null
  fonctionPoste: string | null
  email: string | null
  telephone: string | null
  linkedin: string | null
  roleAchat: string | null
  /** Date de rattachement à l'opportunité (opportunite_decideurs.created_at). */
  dateLiaison: string
}

export type ChronologieEntryType = 'signal' | 'preuve' | 'decideur_lie'

/** Une entrée de chronologie fusionnée (signaux + preuves + décideurs), triée par date. */
export interface ChronologieEntryDto {
  type: ChronologieEntryType
  date: string
  label: string
  refId: string
}

/** Statistiques simples sur un ensemble de dossiers (mêmes filtres que la liste). */
export interface OpportuniteStatsDto {
  total: number
  parStatutEnrichissement: Record<string, number>
  parNiveauConfiance: Record<string, number>
  budgetIdentifieTotalConnu: number
  nombreAvecBudgetIdentifie: number
}

export interface PageResult<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SortField =
  | 'dernierSignal'
  | 'premierSignal'
  | 'dateCreation'
  | 'confiance'
  | 'nombreSignaux'
  | 'budgetIdentifie'
  | 'alphabetique'

export type SortDirection = 'asc' | 'desc'

/**
 * Filtres combinables (Phase 6). Toute combinaison de champs doit
 * fonctionner : chaque filtre est appliqué indépendamment (ET logique
 * entre filtres, OR logique à l'intérieur d'un même filtre à valeurs
 * multiples).
 */
export interface OpportuniteFilters {
  statutOpportunite?: string[]
  statutEnrichissement?: StatutEnrichissement[]
  niveauConfiance?: NiveauConfiance[]
  phaseProjet?: PhaseProjet[]
  typeOpportunite?: string[]
  geographie?: string[]
  /** Filtre sur date_dernier_signal (activité la plus récente) — voir docs §consolidation/filtres pour la justification du choix de ce champ. */
  dateDebut?: string
  dateFin?: string
  nombreSignauxMin?: number
  nombreDecideursMin?: number
  nombrePreuvesMin?: number
}

export interface OpportuniteListQuery {
  page?: number
  pageSize?: number
  /** Recherche libre : titre, entité cible, type, géographie, résumé, raisons (voir texte_recherche, migration Sprint 5). */
  search?: string
  filters?: OpportuniteFilters
  sort?: SortField
  sortDirection?: SortDirection
}
