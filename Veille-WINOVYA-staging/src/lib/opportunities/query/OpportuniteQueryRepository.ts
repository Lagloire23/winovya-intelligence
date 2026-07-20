// Sprint 5 — Repository de lecture pour la consultation des dossiers
// d'opportunité. Pure I/O (aucun calcul métier ici, voir
// OpportuniteQueryService.ts pour l'orchestration et le mapping DTO).
//
// Ne lit QUE :
//   - veille.opportunite_dossier (vue Sprint 4 + extension Sprint 5) pour
//     tout ce qui est liste/recherche/filtre/tri/détail ;
//   - veille.alertes / opportunite_alertes, veille.opportunite_preuves,
//     veille.decideurs / opportunite_decideurs pour les sous-ressources
//     d'un dossier précis (jamais en boucle par ligne de liste : Phase 10).
// N'écrit jamais rien directement — la seule écriture possible transite
// par OpportunityDossierService.consolidateDossier (Sprint 4, inchangé),
// invoquée par OpportuniteQueryService (Phase 3), jamais par ce fichier.

import { supabase as defaultSupabase } from '../../supabase'
import { sanitizeRoleCorrelation, sanitizeSourceRole } from '../dossier/roleCorrelation'
import { sanitizeMotifRetrait } from '../alerteRetrait/types'
import type { OpportuniteFilters, OpportuniteListQuery, SortField } from './types'

type AppSupabaseClient = typeof defaultSupabase

/** Ligne brute de veille.opportunite_dossier (Sprint 4 + colonnes Sprint 5). Type interne : jamais exposé hors de ce module et de OpportuniteQueryService. */
export interface RawDossierRow {
  opportuniteId: string
  entrepriseId: string
  titre: string
  resumeMetier: string | null
  statutOpportunite: string
  typeOpportunite: string | null
  entiteCible: string | null
  geographie: string | null
  secteur: string | null
  phaseProjet: string | null
  budgetIdentifie: number | null
  budgetSource: string | null
  budgetFiabilite: string | null
  budgetEstime: number | null
  niveauConfiance: string | null
  statutEnrichissement: string
  raisons: string[]
  nombreSignaux: number
  datePremierSignal: string | null
  dateDernierSignal: string | null
  derniereConsolidationAt: string | null
  updatedAt: string
  nombrePreuves: number
  nombreDecideurs: number
  createdAt: string
  niveauConfianceRang: number
  derniereEvolutionMetierAt: string
  /** Sprint 8 (Phase 2) : colonnes assigned_to/assigned_at de veille.opportunites
   * (Sprint 6, inchangées), exposées par la vue pour éviter le N+1 de la liste. */
  assignedTo: string | null
  assignedAt: string | null
}

export interface RawAlerteLieeRow {
  id: string
  name: string
  categorieVeille: string | null
  montant: number | null
  dateDetection: string
  datePublication: string | null
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  resume: string | null
  /** Sprint 11A : colonnes additives de veille.opportunite_alertes (P11.1 §5.3). Toujours lues via sanitizeRoleCorrelation/sanitizeSourceRole : jamais une valeur hors taxonomie. */
  roleCorrelation: string | null
  raisonCorrelation: string | null
  sourceRole: string | null
  roleAttribueAt: string | null
}

/** Ligne brute d'une alerte retirée logiquement d'une opportunité (Sprint 11B). Jamais fabriquée : reflète exactement l'état retrait courant de la liaison. */
export interface RawAlerteEcarteeRow {
  id: string
  name: string
  categorieVeille: string | null
  montant: number | null
  dateDetection: string
  /** Sprint 11C : mêmes champs source/résumé que RawAlerteLieeRow, pour un rendu uniforme dans le fil unifié qu'une alerte soit active ou écartée. */
  datePublication: string | null
  referenceOfficielle: string | null
  lienSourceUrl: string | null
  resume: string | null
  roleCorrelationAvant: string | null
  motifRetrait: string | null
  commentaireRetrait: string | null
  retirePar: string | null
  retireAt: string | null
}

export interface RawPreuveRow {
  id: string
  source: string | null
  citation: string | null
  url: string | null
  createdAt: string
  /** Sprint 11C : alerte a laquelle cette preuve est explicitement rattachee. NULL = rattachee seulement a l'opportunite (jamais une association fabriquee). */
  alerteId: string | null
}

export interface RawDecideurLieRow {
  id: string
  nom: string | null
  nomPersonne: string | null
  prenomPersonne: string | null
  fonctionPoste: string | null
  email: string | null
  telephone: string | null
  linkedin: string | null
  roleAchat: string | null
  /** Date de rattachement à l'opportunité (opportunite_decideurs.created_at) — jamais une date fabriquée. */
  dateLiaison: string
}

function mapRow(data: Record<string, unknown>): RawDossierRow {
  return {
    opportuniteId: String(data.opportunite_id),
    entrepriseId: String(data.entreprise_id),
    titre: String(data.titre),
    resumeMetier: (data.resume_metier as string | null) ?? null,
    statutOpportunite: String(data.statut_opportunite),
    typeOpportunite: (data.type_opportunite as string | null) ?? null,
    entiteCible: (data.entite_cible as string | null) ?? null,
    geographie: (data.geographie as string | null) ?? null,
    secteur: (data.secteur as string | null) ?? null,
    phaseProjet: (data.phase_projet as string | null) ?? null,
    budgetIdentifie: (data.budget_identifie as number | null) ?? null,
    budgetSource: (data.budget_source as string | null) ?? null,
    budgetFiabilite: (data.budget_fiabilite as string | null) ?? null,
    budgetEstime: (data.budget_estime as number | null) ?? null,
    niveauConfiance: (data.niveau_confiance as string | null) ?? null,
    statutEnrichissement: String(data.statut_enrichissement),
    raisons: Array.isArray(data.raisons) ? (data.raisons as string[]) : [],
    nombreSignaux: Number(data.nombre_signaux ?? 0),
    datePremierSignal: (data.date_premier_signal as string | null) ?? null,
    dateDernierSignal: (data.date_dernier_signal as string | null) ?? null,
    derniereConsolidationAt: (data.derniere_consolidation_at as string | null) ?? null,
    updatedAt: String(data.updated_at),
    nombrePreuves: Number(data.nombre_preuves ?? 0),
    nombreDecideurs: Number(data.nombre_decideurs ?? 0),
    createdAt: String(data.created_at),
    niveauConfianceRang: Number(data.niveau_confiance_rang ?? 0),
    derniereEvolutionMetierAt: String(data.derniere_evolution_metier_at),
    assignedTo: (data.assigned_to as string | null) ?? null,
    assignedAt: (data.assigned_at as string | null) ?? null,
  }
}

/** Colonne de tri réelle (vue) pour chaque SortField public (Phase 7). */
const SORT_COLUMN: Record<SortField, string> = {
  dernierSignal: 'date_dernier_signal',
  premierSignal: 'date_premier_signal',
  dateCreation: 'created_at',
  confiance: 'niveau_confiance_rang',
  nombreSignaux: 'nombre_signaux',
  budgetIdentifie: 'budget_identifie',
  alphabetique: 'titre',
}

export class OpportuniteQueryRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /**
   * Construit la requête filtrée (sans pagination/tri) — factorisé pour
   * être réutilisé par list() (avec range) et par getStats() (sans range,
   * mêmes filtres). Une seule requête à la vue, jamais de sous-requête
   * par ligne (Phase 10).
   */
  private applyFilters(
    query: ReturnType<AppSupabaseClient['from']>,
    search: string | undefined,
    filters: OpportuniteFilters | undefined
  ) {
    let q = query as any
    if (search && search.trim().length > 0) {
      q = q.ilike('texte_recherche', `%${search.trim().toLowerCase()}%`)
    }
    if (filters) {
      if (filters.statutOpportunite?.length) q = q.in('statut_opportunite', filters.statutOpportunite)
      if (filters.statutEnrichissement?.length) q = q.in('statut_enrichissement', filters.statutEnrichissement)
      if (filters.niveauConfiance?.length) q = q.in('niveau_confiance', filters.niveauConfiance)
      if (filters.phaseProjet?.length) q = q.in('phase_projet', filters.phaseProjet)
      if (filters.typeOpportunite?.length) q = q.in('type_opportunite', filters.typeOpportunite)
      if (filters.geographie?.length) q = q.in('geographie', filters.geographie)
      if (filters.dateDebut) q = q.gte('date_dernier_signal', filters.dateDebut)
      if (filters.dateFin) q = q.lte('date_dernier_signal', filters.dateFin)
      if (typeof filters.nombreSignauxMin === 'number') q = q.gte('nombre_signaux', filters.nombreSignauxMin)
      if (typeof filters.nombreDecideursMin === 'number') q = q.gte('nombre_decideurs', filters.nombreDecideursMin)
      if (typeof filters.nombrePreuvesMin === 'number') q = q.gte('nombre_preuves', filters.nombrePreuvesMin)
    }
    return q
  }

  /** Liste paginée avec recherche/filtres/tri (Phases 4-7). Une seule requête SQL (count exact inclus). */
  async list(params: OpportuniteListQuery): Promise<{ rows: RawDossierRow[]; total: number }> {
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20))
    const sort = params.sort ?? 'dernierSignal'
    const direction = params.sortDirection ?? 'desc'
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let q = this.client.from('opportunite_dossier').select('*', { count: 'exact' }) as any
    q = this.applyFilters(q, params.search, params.filters)
    q = q.order(SORT_COLUMN[sort], { ascending: direction === 'asc' }).range(from, to)

    const { data, error, count } = await q
    if (error) throw error
    return { rows: (data ?? []).map(mapRow), total: count ?? 0 }
  }

  /** Toutes les lignes correspondant aux filtres (sans pagination), réservé au calcul de statistiques (Phase 4). */
  async listAllForStats(search: string | undefined, filters: OpportuniteFilters | undefined): Promise<RawDossierRow[]> {
    let q = this.client
      .from('opportunite_dossier')
      .select('statut_enrichissement, niveau_confiance, budget_identifie') as any
    q = this.applyFilters(q, search, filters)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map((d: Record<string, unknown>) => ({
      statutEnrichissement: String(d.statut_enrichissement),
      niveauConfiance: (d.niveau_confiance as string | null) ?? null,
      budgetIdentifie: (d.budget_identifie as number | null) ?? null,
    })) as unknown as RawDossierRow[]
  }

  async fetchRowById(opportuniteId: string): Promise<RawDossierRow | null> {
    const { data, error } = await this.client
      .from('opportunite_dossier')
      .select('*')
      .eq('opportunite_id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return mapRow(data)
  }

  /**
   * Alertes liées à une opportunité (une seule opportunité : détail,
   * jamais en boucle sur une liste). Sprint 11A : lit désormais aussi le
   * rôle de corrélation directement sur la ligne de liaison
   * (opportunite_alertes), une seule requête supplémentaire sur la table
   * de liaison déjà interrogée ci-dessous — aucune requête N+1 ajoutée.
   */
  async fetchAlertesLiees(opportuniteId: string): Promise<RawAlerteLieeRow[]> {
    // Sprint 11B : une alerte retirée logiquement (is_active = false) ne
    // doit plus jamais apparaître dans les lectures "actives" — elle
    // n'est visible que via fetchAlertesEcartees ci-dessous. Filtre
    // ajouté ici (et nulle part ailleurs qui lirait cette même table :
    // voir aussi DossierRepository.getConsolidationInput, corrigé de la
    // même façon).
    const { data: links, error: linksError } = await this.client
      .from('opportunite_alertes')
      .select('alerte_id, role_correlation, raison_correlation, source_role, role_attribue_at')
      .eq('opportunite_id', opportuniteId)
      .eq('is_active', true)
    if (linksError) throw linksError
    const rows = links ?? []
    const ids = rows.map((l) => l.alerte_id as string)
    if (ids.length === 0) return []

    const roleByAlerteId = new Map<
      string,
      { roleCorrelation: string | null; raisonCorrelation: string | null; sourceRole: string | null; roleAttribueAt: string | null }
    >()
    for (const l of rows) {
      roleByAlerteId.set(String(l.alerte_id), {
        roleCorrelation: sanitizeRoleCorrelation(l.role_correlation),
        raisonCorrelation: (l.raison_correlation as string | null) ?? null,
        sourceRole: sanitizeSourceRole(l.source_role),
        roleAttribueAt: (l.role_attribue_at as string | null) ?? null,
      })
    }

    const { data, error } = await this.client
      .from('alertes')
      .select('id, name, categorie_veille, montant, date_detection, date_publication, reference_officielle, lien_source_url, resume')
      .in('id', ids)
    if (error) throw error
    return (data ?? []).map((a) => {
      const role = roleByAlerteId.get(String(a.id))
      return {
        id: String(a.id),
        name: String(a.name ?? ''),
        categorieVeille: (a.categorie_veille as string | null) ?? null,
        montant: (a.montant as number | null) ?? null,
        dateDetection: String(a.date_detection),
        datePublication: (a.date_publication as string | null) ?? null,
        referenceOfficielle: (a.reference_officielle as string | null) ?? null,
        lienSourceUrl: (a.lien_source_url as string | null) ?? null,
        resume: (a.resume as string | null) ?? null,
        roleCorrelation: role?.roleCorrelation ?? null,
        raisonCorrelation: role?.raisonCorrelation ?? null,
        sourceRole: role?.sourceRole ?? null,
        roleAttribueAt: role?.roleAttribueAt ?? null,
      }
    })
  }

  /**
   * Alertes écartées (retirées logiquement) d'une opportunité (Sprint
   * 11B). Lit exactement les mêmes colonnes de retrait posées par la
   * migration 20260719000000 ; jamais recalculé, jamais fabriqué.
   */
  async fetchAlertesEcartees(opportuniteId: string): Promise<RawAlerteEcarteeRow[]> {
    const { data: links, error: linksError } = await this.client
      .from('opportunite_alertes')
      .select('alerte_id, role_correlation, motif_retrait, commentaire_retrait, retire_par, retire_at')
      .eq('opportunite_id', opportuniteId)
      .eq('is_active', false)
    if (linksError) throw linksError
    const rows = links ?? []
    const ids = rows.map((l) => l.alerte_id as string)
    if (ids.length === 0) return []

    const retraitByAlerteId = new Map<
      string,
      { roleCorrelationAvant: string | null; motifRetrait: string | null; commentaireRetrait: string | null; retirePar: string | null; retireAt: string | null }
    >()
    for (const l of rows) {
      retraitByAlerteId.set(String(l.alerte_id), {
        roleCorrelationAvant: sanitizeRoleCorrelation(l.role_correlation),
        motifRetrait: sanitizeMotifRetrait(l.motif_retrait),
        commentaireRetrait: (l.commentaire_retrait as string | null) ?? null,
        retirePar: (l.retire_par as string | null) ?? null,
        retireAt: (l.retire_at as string | null) ?? null,
      })
    }

    const { data, error } = await this.client
      .from('alertes')
      .select('id, name, categorie_veille, montant, date_detection, date_publication, reference_officielle, lien_source_url, resume')
      .in('id', ids)
    if (error) throw error
    return (data ?? []).map((a) => {
      const retrait = retraitByAlerteId.get(String(a.id))
      return {
        id: String(a.id),
        name: String(a.name ?? ''),
        categorieVeille: (a.categorie_veille as string | null) ?? null,
        montant: (a.montant as number | null) ?? null,
        dateDetection: String(a.date_detection),
        datePublication: (a.date_publication as string | null) ?? null,
        referenceOfficielle: (a.reference_officielle as string | null) ?? null,
        lienSourceUrl: (a.lien_source_url as string | null) ?? null,
        resume: (a.resume as string | null) ?? null,
        roleCorrelationAvant: retrait?.roleCorrelationAvant ?? null,
        motifRetrait: retrait?.motifRetrait ?? null,
        commentaireRetrait: retrait?.commentaireRetrait ?? null,
        retirePar: retrait?.retirePar ?? null,
        retireAt: retrait?.retireAt ?? null,
      }
    })
  }

  async fetchPreuves(opportuniteId: string): Promise<RawPreuveRow[]> {
    const { data, error } = await this.client
      .from('opportunite_preuves')
      .select('id, source, citation, url, created_at, alerte_id')
      .eq('opportunite_id', opportuniteId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((p) => ({
      id: String(p.id),
      source: (p.source as string | null) ?? null,
      citation: (p.citation as string | null) ?? null,
      url: (p.url as string | null) ?? null,
      createdAt: String(p.created_at),
      alerteId: (p.alerte_id as string | null) ?? null,
    }))
  }

  async fetchDecideursLies(opportuniteId: string): Promise<RawDecideurLieRow[]> {
    const { data: links, error: linksError } = await this.client
      .from('opportunite_decideurs')
      .select('decideur_id, created_at')
      .eq('opportunite_id', opportuniteId)
    if (linksError) throw linksError
    const linkedAtByDecideurId = new Map<string, string>()
    for (const l of links ?? []) {
      linkedAtByDecideurId.set(l.decideur_id as string, String(l.created_at))
    }
    const ids = [...linkedAtByDecideurId.keys()]
    if (ids.length === 0) return []

    const { data, error } = await this.client
      .from('decideurs')
      .select('id, nom, nom_personne, prenom_personne, fonction_poste, email, telephone, linkedin, role_achat')
      .in('id', ids)
    if (error) throw error
    return (data ?? []).map((d) => ({
      id: String(d.id),
      nom: (d.nom as string | null) ?? null,
      nomPersonne: (d.nom_personne as string | null) ?? null,
      prenomPersonne: (d.prenom_personne as string | null) ?? null,
      fonctionPoste: (d.fonction_poste as string | null) ?? null,
      email: (d.email as string | null) ?? null,
      telephone: (d.telephone as string | null) ?? null,
      linkedin: (d.linkedin as string | null) ?? null,
      roleAchat: (d.role_achat as string | null) ?? null,
      dateLiaison: linkedAtByDecideurId.get(String(d.id)) ?? '',
    }))
  }
}
