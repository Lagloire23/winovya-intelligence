// Sprint 2.1 — Repository de lecture pour le contexte d'une alerte,
// distinct de OpportunityRepository (dont le périmètre documenté reste
// les 4 tables "opportunités" du Sprint 1). Ce repository ne lit QUE
// des tables hors périmètre opportunité (alertes, entreprises,
// pertinence_entreprise, alerte_decideurs) : le séparer évite de
// mélanger deux domaines de données dans un seul repository, et évite
// tout aussi bien d'ajouter de la logique métier à OpportunityRepository
// (Phase 4, revue d'architecture — "le Repository ne doit jamais
// contenir de logique métier").
//
// Pure I/O : aucun calcul, aucune décision, aucune validation métier —
// uniquement des lectures directes, mappées vers des types simples.

import { supabase as defaultSupabase } from '../../supabase'

type AppSupabaseClient = typeof defaultSupabase

export interface AlerteContextRow {
  id: string
  acteurEntite: string | null
  typeOpportunite: string[]
  communeCollectivite: string | null
  departement: string | null
  region: string[]
  pays: string | null
  dateDetection: string
  lienSourceUrl: string | null
  resume: string | null
  referenceOfficielle: string | null
  name: string | null
}

export class AlertContextRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  async getAlerte(alerteId: string): Promise<AlerteContextRow | null> {
    const { data, error } = await this.client
      .from('alertes')
      .select(
        'id, acteur_entite, type_opportunite, commune_collectivite, departement, region, pays, date_detection, lien_source_url, resume, reference_officielle, name'
      )
      .eq('id', alerteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      id: String(data.id),
      acteurEntite: (data.acteur_entite as string | null) ?? null,
      typeOpportunite: Array.isArray(data.type_opportunite) ? (data.type_opportunite as string[]) : [],
      communeCollectivite: (data.commune_collectivite as string | null) ?? null,
      departement: (data.departement as string | null) ?? null,
      region: Array.isArray(data.region) ? (data.region as string[]) : [],
      pays: (data.pays as string | null) ?? null,
      dateDetection: String(data.date_detection),
      lienSourceUrl: (data.lien_source_url as string | null) ?? null,
      resume: (data.resume as string | null) ?? null,
      referenceOfficielle: (data.reference_officielle as string | null) ?? null,
      name: (data.name as string | null) ?? null,
    }
  }

  async entrepriseExists(entrepriseId: string): Promise<boolean> {
    const { data, error } = await this.client.from('entreprises').select('id').eq('id', entrepriseId).maybeSingle()
    if (error) throw error
    return Boolean(data)
  }

  async isAlerteRelevantForEntreprise(alerteId: string, entrepriseId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('pertinence_entreprise')
      .select('id, statut')
      .eq('alerte_id', alerteId)
      .eq('entreprise_id', entrepriseId)
      .maybeSingle()
    if (error) throw error
    return Boolean(data) && data?.statut === 'Actif'
  }

  async listDecideurIdsForAlerte(alerteId: string): Promise<string[]> {
    const { data, error } = await this.client.from('alerte_decideurs').select('decideur_id').eq('alerte_id', alerteId)
    if (error) throw error
    return (data ?? []).map((d) => d.decideur_id as string)
  }

  /** Lecture minimale post-RPC pour le calcul de cohérence (Phase 4, convergence). */
  async getOpportuniteCorrelationFields(opportuniteId: string): Promise<{ entiteCible: string | null; geographie: string | null } | null> {
    const { data, error } = await this.client
      .from('opportunites')
      .select('entite_cible, geographie')
      .eq('id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      entiteCible: (data.entite_cible as string | null) ?? null,
      geographie: (data.geographie as string | null) ?? null,
    }
  }
}
