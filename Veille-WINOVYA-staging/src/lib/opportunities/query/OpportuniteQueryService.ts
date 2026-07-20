// Sprint 5 — Service métier de consultation des dossiers d'opportunité.
//
// Point d'entrée UNIQUE recommandé pour tout consommateur (Dashboard
// Opportunités, Frontend React, futurs tableaux de bord, exports,
// Assistant IA, intégrations CRM). Compose OpportuniteQueryRepository
// (I/O pur) + OpportunityDossierService (Sprint 4, consolidation,
// inchangé) + mapping vers DTO publics (types.ts). Ne redéfinit AUCUNE
// règle métier : la classification (niveau_confiance, statut_enrichissement,
// raisons, résumé) reste calculée exclusivement par
// DossierEnrichmentService.consolidate (Sprint 4).
//
// --- Stratégie de consolidation à la lecture (Phase 3) ---
// Appliquée UNIQUEMENT à la lecture d'un dossier précis (getDossier), pas
// à la liste (list) : reconsolider potentiellement chacune des lignes
// d'une page de résultats à chaque appel serait coûteux (Phase 10 :
// "limiter les requêtes SQL, éviter le N+1") et sans bénéfice pour un
// simple survol ; la liste peut afficher un statut "pending"/"partial" à
// jour de la dernière consolidation connue. Dès qu'un consommateur ouvre
// un dossier précis (getDossier), la fraîcheur est garantie :
//
//   consolidation nécessaire  <=>  statut_enrichissement = 'pending'
//                              OU  derniere_consolidation_at IS NULL
//                              OU  derniere_consolidation_at < derniere_evolution_metier_at
//
// derniere_evolution_metier_at (colonne de vue, Sprint 5) résume la plus
// récente évolution métier pertinente (opportunites.updated_at, dernière
// preuve, dernier décideur, dernière alerte liée) — nécessaire car aucun
// trigger ne met à jour updated_at quand une preuve/un décideur est
// rattaché directement (audit Phase 1, voir docs/opportunity-query-api.md).
// Si consolidation nécessaire : un seul appel à
// OpportunityDossierService.consolidateDossier(id) (Sprint 4, jamais
// recopié), puis relecture de la ligne. Sinon : la ligne déjà lue est
// retournée telle quelle, sans recalcul (Phase 11 : "dossier déjà
// consolidé, pas de recalcul inutile").

// Imports de TYPES uniquement (`import type`) : ces déclarations sont
// entièrement effacées à la compilation, donc n'exécutent jamais le
// module (et sa dépendance transitive vers src/lib/supabase.ts) au
// chargement. Cela permet de tester ce fichier (needsConsolidation,
// mapping, orchestration avec doubles de test) sans environnement
// Supabase réel — voir scripts/sprint5-query-tests.ts. La construction
// réelle (avec les vraies classes I/O) se fait exclusivement dans
// createOpportuniteQueryService() (index.ts), jamais ici.
import type { OpportunityDossierService } from '../dossier/DossierRepository'
import type {
  OpportuniteQueryRepository,
  RawAlerteEcarteeRow,
  RawAlerteLieeRow,
  RawDecideurLieRow,
  RawDossierRow,
  RawPreuveRow,
} from './OpportuniteQueryRepository'
import type {
  AlerteEcarteeDto,
  AlerteLieeDto,
  ChronologieEntryDto,
  DecideurLieDto,
  NiveauConfiance,
  OpportuniteDetailDto,
  OpportuniteFilters,
  OpportuniteListItemDto,
  OpportuniteListQuery,
  OpportuniteStatsDto,
  PageResult,
  PreuveDto,
  RoleCorrelation,
  SignalTimelineEntryDto,
  SignalTimelineResultDto,
  StatutEnrichissement,
} from './types'

export function needsConsolidation(row: RawDossierRow): boolean {
  if (row.statutEnrichissement === 'pending') return true
  if (!row.derniereConsolidationAt) return true
  return new Date(row.derniereConsolidationAt).getTime() < new Date(row.derniereEvolutionMetierAt).getTime()
}

export function mapToListItemDto(row: RawDossierRow): OpportuniteListItemDto {
  return {
    id: row.opportuniteId,
    entrepriseId: row.entrepriseId,
    titre: row.titre,
    statutOpportunite: row.statutOpportunite,
    classification: {
      typeOpportunite: row.typeOpportunite,
      entiteCible: row.entiteCible,
      geographie: row.geographie,
      secteur: row.secteur,
      phaseProjet: row.phaseProjet as OpportuniteListItemDto['classification']['phaseProjet'],
    },
    budget: {
      identifie: row.budgetIdentifie,
      fiabilite: row.budgetFiabilite as OpportuniteListItemDto['budget']['fiabilite'],
    },
    confiance: row.niveauConfiance as NiveauConfiance | null,
    enrichissement: {
      statut: row.statutEnrichissement as StatutEnrichissement,
    },
    signaux: {
      nombre: row.nombreSignaux,
      datePremier: row.datePremierSignal,
      dateDernier: row.dateDernierSignal,
    },
    compteurs: {
      preuves: row.nombrePreuves,
      decideurs: row.nombreDecideurs,
    },
    assignation: {
      profilId: row.assignedTo,
      depuis: row.assignedAt,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function mapToDetailDto(row: RawDossierRow): OpportuniteDetailDto {
  const base = mapToListItemDto(row)
  return {
    ...base,
    resumeMetier: row.resumeMetier,
    budget: {
      identifie: row.budgetIdentifie,
      source: row.budgetSource,
      fiabilite: row.budgetFiabilite as OpportuniteDetailDto['budget']['fiabilite'],
      estime: row.budgetEstime,
    },
    enrichissement: {
      statut: row.statutEnrichissement as StatutEnrichissement,
      raisons: row.raisons,
      derniereConsolidationAt: row.derniereConsolidationAt,
    },
  }
}

export function mapAlerteDto(a: RawAlerteLieeRow): AlerteLieeDto {
  return {
    id: a.id,
    titre: a.name,
    categorieVeille: a.categorieVeille,
    montant: a.montant,
    dateDetection: a.dateDetection,
    datePublication: a.datePublication,
    referenceOfficielle: a.referenceOfficielle,
    lienSourceUrl: a.lienSourceUrl,
    resume: a.resume,
    // Sprint 11A (P11.1 §5.3) : la ligne brute a déjà été assainie par
    // sanitizeRoleCorrelation/sanitizeSourceRole (OpportuniteQueryRepository) ;
    // ce mapping ne fait que la recopier sous le type public du DTO.
    roleCorrelation: a.roleCorrelation as AlerteLieeDto['roleCorrelation'],
    raisonCorrelation: a.raisonCorrelation,
    sourceRole: a.sourceRole as AlerteLieeDto['sourceRole'],
    roleAttribueAt: a.roleAttribueAt,
  }
}

export function mapAlerteEcarteeDto(a: RawAlerteEcarteeRow): AlerteEcarteeDto {
  return {
    id: a.id,
    titre: a.name,
    categorieVeille: a.categorieVeille,
    montant: a.montant,
    dateDetection: a.dateDetection,
    datePublication: a.datePublication,
    referenceOfficielle: a.referenceOfficielle,
    lienSourceUrl: a.lienSourceUrl,
    resume: a.resume,
    roleCorrelationAvant: a.roleCorrelationAvant as RoleCorrelation | null,
    motifRetrait: a.motifRetrait as AlerteEcarteeDto['motifRetrait'],
    commentaireRetrait: a.commentaireRetrait,
    retirePar: a.retirePar,
    retireAt: a.retireAt,
  }
}

export function mapPreuveDto(p: RawPreuveRow): PreuveDto {
  return { id: p.id, source: p.source, citation: p.citation, url: p.url, createdAt: p.createdAt, alerteId: p.alerteId }
}

export function mapDecideurDto(d: RawDecideurLieRow): DecideurLieDto {
  return {
    id: d.id,
    nom: d.nom,
    nomPersonne: d.nomPersonne,
    prenomPersonne: d.prenomPersonne,
    fonctionPoste: d.fonctionPoste,
    email: d.email,
    telephone: d.telephone,
    linkedin: d.linkedin,
    roleAchat: d.roleAchat,
    dateLiaison: d.dateLiaison,
  }
}

export class OpportuniteQueryService {
  /**
   * Dépendances TOUJOURS explicites (aucune valeur par défaut ici) :
   * construire une instance avec les vraies classes I/O se fait via
   * createOpportuniteQueryService() (index.ts) ; les tests passent des
   * doubles de test qui respectent la même interface structurelle.
   */
  constructor(
    private readonly repository: OpportuniteQueryRepository,
    private readonly dossierService: OpportunityDossierService
  ) {}

  /** Liste paginée, recherche, filtres, tri (Phases 4-7). Aucune consolidation déclenchée ici (voir stratégie ci-dessus). */
  async listDossiers(query: OpportuniteListQuery = {}): Promise<PageResult<OpportuniteListItemDto>> {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
    const { rows, total } = await this.repository.list({ ...query, page, pageSize })
    return {
      items: rows.map(mapToListItemDto),
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    }
  }

  /**
   * Détail d'un dossier (Phase 4) : consolidation à la demande si
   * nécessaire (Phase 3), sinon retour direct sans recalcul.
   * Retourne null si l'opportunité n'existe pas (jamais une erreur pour ce cas).
   */
  async getDossier(opportuniteId: string): Promise<OpportuniteDetailDto | null> {
    let row = await this.repository.fetchRowById(opportuniteId)
    if (!row) return null
    if (needsConsolidation(row)) {
      await this.dossierService.consolidateDossier(opportuniteId)
      row = await this.repository.fetchRowById(opportuniteId)
      if (!row) return null
    }
    return mapToDetailDto(row)
  }

  async getAlertesLiees(opportuniteId: string): Promise<AlerteLieeDto[]> {
    const rows = await this.repository.fetchAlertesLiees(opportuniteId)
    return rows.map(mapAlerteDto)
  }

  /** Sprint 11B : alertes écartées (retirées logiquement) d'une opportunité — jamais mélangées aux alertes actives. */
  async getAlertesEcartees(opportuniteId: string): Promise<AlerteEcarteeDto[]> {
    const rows = await this.repository.fetchAlertesEcartees(opportuniteId)
    return rows.map(mapAlerteEcarteeDto)
  }

  async getPreuves(opportuniteId: string): Promise<PreuveDto[]> {
    const rows = await this.repository.fetchPreuves(opportuniteId)
    return rows.map(mapPreuveDto)
  }

  /**
   * Sprint 11C — fil chronologique unifié "Signaux et alertes liés"
   * (remplace les anciens panneaux Alertes liées / Alertes écartées /
   * Preuves / Chronologie). Composition pure de 3 lectures déjà
   * existantes (fetchAlertesLiees, fetchAlertesEcartees, fetchPreuves),
   * jamais de nouvelle règle métier, jamais de recalcul : le rôle de
   * corrélation (Sprint 11A) et l'état actif/écarté (Sprint 11B) sont
   * recopiés tels quels. Les preuves sont regroupées sous l'alerte à
   * laquelle elles sont explicitement rattachées (opportunite_preuves.
   * alerte_id, Sprint 11C) ; celles sans rattachement précis sont
   * renvoyées à part (preuvesNonRattachees), jamais fabriquées vers une
   * alerte au hasard.
   */
  async getSignauxTimeline(opportuniteId: string): Promise<SignalTimelineResultDto> {
    const [actives, ecartees, preuves] = await Promise.all([
      this.repository.fetchAlertesLiees(opportuniteId),
      this.repository.fetchAlertesEcartees(opportuniteId),
      this.repository.fetchPreuves(opportuniteId),
    ])

    const preuvesParAlerteId = new Map<string, PreuveDto[]>()
    const preuvesNonRattachees: PreuveDto[] = []
    for (const p of preuves) {
      const dto = mapPreuveDto(p)
      if (dto.alerteId) {
        const liste = preuvesParAlerteId.get(dto.alerteId) ?? []
        liste.push(dto)
        preuvesParAlerteId.set(dto.alerteId, liste)
      } else {
        preuvesNonRattachees.push(dto)
      }
    }

    const entries: SignalTimelineEntryDto[] = []

    for (const a of actives) {
      const alerte = mapAlerteDto(a)
      entries.push({
        alerteId: alerte.id,
        titre: alerte.titre,
        categorieVeille: alerte.categorieVeille,
        montant: alerte.montant,
        dateDetection: alerte.dateDetection,
        datePublication: alerte.datePublication,
        referenceOfficielle: alerte.referenceOfficielle,
        lienSourceUrl: alerte.lienSourceUrl,
        resume: alerte.resume,
        roleCorrelation: alerte.roleCorrelation,
        raisonCorrelation: alerte.raisonCorrelation,
        sourceRole: alerte.sourceRole,
        roleAttribueAt: alerte.roleAttribueAt,
        isActive: true,
        motifRetrait: null,
        commentaireRetrait: null,
        retirePar: null,
        retireAt: null,
        preuves: preuvesParAlerteId.get(alerte.id) ?? [],
      })
    }

    for (const a of ecartees) {
      const alerte = mapAlerteEcarteeDto(a)
      entries.push({
        alerteId: alerte.id,
        titre: alerte.titre,
        categorieVeille: alerte.categorieVeille,
        montant: alerte.montant,
        dateDetection: alerte.dateDetection,
        datePublication: alerte.datePublication,
        referenceOfficielle: alerte.referenceOfficielle,
        lienSourceUrl: alerte.lienSourceUrl,
        resume: alerte.resume,
        roleCorrelation: alerte.roleCorrelationAvant,
        raisonCorrelation: null,
        sourceRole: null,
        roleAttribueAt: null,
        isActive: false,
        motifRetrait: alerte.motifRetrait,
        commentaireRetrait: alerte.commentaireRetrait,
        retirePar: alerte.retirePar,
        retireAt: alerte.retireAt,
        preuves: preuvesParAlerteId.get(alerte.id) ?? [],
      })
    }

    entries.sort((x, y) => new Date(y.dateDetection).getTime() - new Date(x.dateDetection).getTime())

    return { entries, preuvesNonRattachees }
  }

  async getDecideursLies(opportuniteId: string): Promise<DecideurLieDto[]> {
    const rows = await this.repository.fetchDecideursLies(opportuniteId)
    return rows.map(mapDecideurDto)
  }

  /** Chronologie fusionnée signaux + preuves + décideurs liés, triée par date décroissante (Phase 4). 3 requêtes batch, jamais de boucle. */
  async getChronologie(opportuniteId: string): Promise<ChronologieEntryDto[]> {
    const [alertes, preuves, decideurs] = await Promise.all([
      this.repository.fetchAlertesLiees(opportuniteId),
      this.repository.fetchPreuves(opportuniteId),
      this.repository.fetchDecideursLies(opportuniteId),
    ])
    const entries: ChronologieEntryDto[] = []
    for (const a of alertes) {
      entries.push({ type: 'signal', date: a.dateDetection, label: a.name, refId: a.id })
    }
    for (const p of preuves) {
      entries.push({ type: 'preuve', date: p.createdAt, label: p.source ?? p.citation ?? 'Preuve', refId: p.id })
    }
    for (const d of decideurs) {
      const label = [d.prenomPersonne, d.nomPersonne].filter(Boolean).join(' ') || d.nom || 'Décideur'
      entries.push({ type: 'decideur_lie', date: d.dateLiaison, label, refId: d.id })
    }
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /** Statistiques simples sur un ensemble filtré (Phase 4), une seule requête, calcul en mémoire (volume MVP). */
  async getStats(search?: string, filters?: OpportuniteFilters): Promise<OpportuniteStatsDto> {
    const rows = await this.repository.listAllForStats(search, filters)
    const parStatutEnrichissement: Record<string, number> = {}
    const parNiveauConfiance: Record<string, number> = {}
    let budgetIdentifieTotalConnu = 0
    let nombreAvecBudgetIdentifie = 0
    for (const r of rows as unknown as { statutEnrichissement: string; niveauConfiance: string | null; budgetIdentifie: number | null }[]) {
      parStatutEnrichissement[r.statutEnrichissement] = (parStatutEnrichissement[r.statutEnrichissement] ?? 0) + 1
      const conf = r.niveauConfiance ?? 'Non évalué'
      parNiveauConfiance[conf] = (parNiveauConfiance[conf] ?? 0) + 1
      if (typeof r.budgetIdentifie === 'number') {
        budgetIdentifieTotalConnu += r.budgetIdentifie
        nombreAvecBudgetIdentifie += 1
      }
    }
    return {
      total: rows.length,
      parStatutEnrichissement,
      parNiveauConfiance,
      budgetIdentifieTotalConnu,
      nombreAvecBudgetIdentifie,
    }
  }
}
