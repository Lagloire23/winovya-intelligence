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
import type { RoleCorrelation, SourceRole } from '../dossier/roleCorrelation'
import type { MotifRetrait } from '../alerteRetrait/types'

export type { BudgetFiabilite, NiveauConfiance, PhaseProjet, StatutEnrichissement }
export type { RoleCorrelation, SourceRole }
export type { MotifRetrait }

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
  /**
   * Sprint 11A (P11.1 §5.3) : rôle de cette alerte dans la corrélation de
   * l'opportunité. `null` = jamais évalué (donnée historique, ou pas
   * encore traitée par le moteur de cohérence des regroupements —
   * Sprint 12). Ce sprint n'écrit aucune valeur : il expose uniquement la
   * colonne, quelle que soit sa valeur actuelle en base.
   */
  roleCorrelation: RoleCorrelation | null
  /** Justification factuelle courte du rôle attribué. `null` tant qu'aucun rôle n'a été attribué. */
  raisonCorrelation: string | null
  /** Origine de l'attribution : moteur (Sprint 12+) ou manuel (Sprint 11B+). `null` tant qu'aucun rôle n'a été attribué. */
  sourceRole: SourceRole | null
  /** Horodatage de la dernière attribution/recalcul du rôle. `null` tant qu'aucun rôle n'a été attribué. */
  roleAttribueAt: string | null
}

/**
 * Alerte écartée (retirée logiquement) d'une opportunité (Sprint 11B,
 * P11.1 §retrait). L'alerte globale n'est jamais supprimée : ce DTO
 * expose uniquement l'état du RETRAIT (motif, auteur, date), jamais une
 * donnée métier recalculée.
 */
export interface AlerteEcarteeDto {
  id: string
  titre: string
  categorieVeille: string | null
  montant: number | null
  dateDetection: string
  /** Sprint 11C : mêmes champs que AlerteLieeDto, pour un rendu uniforme dans le fil unifié. */
  datePublication: string | null
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  resume: string | null
  /** Rôle de corrélation tel qu'il était juste avant le retrait (pour affichage informatif uniquement, jamais recalculé). */
  roleCorrelationAvant: RoleCorrelation | null
  motifRetrait: MotifRetrait | null
  commentaireRetrait: string | null
  /** Identifiant du profil ayant retiré l'alerte (veille.profiles.id). */
  retirePar: string | null
  retireAt: string | null
}

export interface PreuveDto {
  id: string
  source: string | null
  citation: string | null
  url: string | null
  createdAt: string
  /** Sprint 11C : alerte a laquelle cette preuve est explicitement rattachee, si connue. NULL = rattachee seulement a l'opportunite. */
  alerteId: string | null
}

/**
 * Sprint 11C — élément du fil chronologique unifié "Signaux et alertes
 * liés" (remplace les anciens panneaux séparés Alertes liées / Alertes
 * écartées / Preuves / Chronologie). Une seule ligne par alerte
 * rattachée à l'opportunité, qu'elle soit active ou écartée, avec ses
 * preuves explicitement associées imbriquées. Aucune donnée recalculée
 * ici : pure composition de AlerteLieeDto / AlerteEcarteeDto / PreuveDto
 * déjà exposés par ailleurs.
 */
export interface SignalTimelineEntryDto {
  alerteId: string
  titre: string
  categorieVeille: string | null
  montant: number | null
  dateDetection: string
  datePublication: string | null
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  resume: string | null
  roleCorrelation: RoleCorrelation | null
  raisonCorrelation: string | null
  sourceRole: SourceRole | null
  roleAttribueAt: string | null
  /** true = alerte active (fil principal) ; false = alerte écartée (retrait logique, Sprint 11B). */
  isActive: boolean
  motifRetrait: MotifRetrait | null
  commentaireRetrait: string | null
  retirePar: string | null
  retireAt: string | null
  /** Preuves explicitement rattachées à cette alerte (Sprint 11C, opportunite_preuves.alerte_id). Jamais les preuves rattachées seulement à l'opportunité (voir preuvesNonRattachees, OpportuniteDetailDto). */
  preuves: PreuveDto[]
}

/**
 * Résultat complet du fil chronologique unifié (Sprint 11C) : les
 * alertes actives ET écartées (une seule liste, `isActive` distingue),
 * plus les preuves qui ne sont rattachées à aucune alerte précise
 * (preuve historique, ou transverse à l'opportunité entière).
 */
export interface SignalTimelineResultDto {
  entries: SignalTimelineEntryDto[]
  preuvesNonRattachees: PreuveDto[]
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
