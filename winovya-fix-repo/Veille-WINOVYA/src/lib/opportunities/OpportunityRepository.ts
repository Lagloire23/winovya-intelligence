// Pure CRUD data-access layer over the Sprint 1 foundation tables. No
// business logic, no validation, no computation — just read / create /
// update / delete, exactly as scoped for this sprint. Every method takes
// an injectable Supabase client (defaulting to the app's shared client).
//
// Sprint 2 / 2.1 extension: two thin data-access methods were added
// (processAlertOpportunityRpc, updateOpportunityScores) so that
// OpportunityEngineService never talks to Supabase directly (Phase 4,
// architecture review). Both remain pure I/O wrappers — no scoring, no
// correlation logic, no validation beyond what Postgres itself enforces
// (CHECK constraints, the RPC's own exceptions).

import { supabase as defaultSupabase } from '../supabase'
import { OpportunityMapper } from './OpportunityMapper'
import type {
  Opportunite,
  OpportuniteInput,
  OpportuniteUpdate,
  OpportuniteAlerte,
  OpportuniteDecideur,
  OpportunitePreuve,
  OpportunitePreuveInput,
} from './types'
import type { OpportunityIndicators } from './engine/types'

// Typed against the app's actual shared client (pinned to the `veille`
// schema) rather than the generic SupabaseClient type, so the schema
// generic always lines up with what ../supabase.ts actually exports.
type AppSupabaseClient = typeof defaultSupabase

export class OpportunityRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  // -- opportunites (CRUD) ---------------------------------------------

  async listOpportunites(): Promise<Opportunite[]> {
    const { data, error } = await this.client.from('opportunites').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return OpportunityMapper.toOpportunites(data ?? [])
  }

  async getOpportunite(id: string): Promise<Opportunite | null> {
    const { data, error } = await this.client.from('opportunites').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? OpportunityMapper.toOpportunite(data) : null
  }

  async createOpportunite(input: OpportuniteInput): Promise<Opportunite> {
    const { data, error } = await this.client.from('opportunites').insert(input).select('*').single()
    if (error) throw error
    return OpportunityMapper.toOpportunite(data)
  }

  async updateOpportunite(id: string, patch: OpportuniteUpdate): Promise<Opportunite> {
    const { data, error } = await this.client.from('opportunites').update(patch).eq('id', id).select('*').single()
    if (error) throw error
    return OpportunityMapper.toOpportunite(data)
  }

  async deleteOpportunite(id: string): Promise<void> {
    const { error } = await this.client.from('opportunites').delete().eq('id', id)
    if (error) throw error
  }

  // -- opportunite_alertes (CRUD) ---------------------------------------

  async listAlertesForOpportunite(opportuniteId: string): Promise<OpportuniteAlerte[]> {
    const { data, error } = await this.client.from('opportunite_alertes').select('*').eq('opportunite_id', opportuniteId)
    if (error) throw error
    return (data ?? []).map((r) => OpportunityMapper.toOpportuniteAlerte(r))
  }

  async linkAlerte(opportuniteId: string, alerteId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunite_alertes')
      .insert({ opportunite_id: opportuniteId, alerte_id: alerteId })
    if (error) throw error
  }

  async unlinkAlerte(opportuniteId: string, alerteId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunite_alertes')
      .delete()
      .eq('opportunite_id', opportuniteId)
      .eq('alerte_id', alerteId)
    if (error) throw error
  }

  // -- opportunite_decideurs (CRUD) --------------------------------------

  async listDecideursForOpportunite(opportuniteId: string): Promise<OpportuniteDecideur[]> {
    const { data, error } = await this.client
      .from('opportunite_decideurs')
      .select('*')
      .eq('opportunite_id', opportuniteId)
    if (error) throw error
    return (data ?? []).map((r) => OpportunityMapper.toOpportuniteDecideur(r))
  }

  async linkDecideur(opportuniteId: string, decideurId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunite_decideurs')
      .insert({ opportunite_id: opportuniteId, decideur_id: decideurId })
    if (error) throw error
  }

  async unlinkDecideur(opportuniteId: string, decideurId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunite_decideurs')
      .delete()
      .eq('opportunite_id', opportuniteId)
      .eq('decideur_id', decideurId)
    if (error) throw error
  }

  // -- opportunite_preuves (CRUD) ------------------------------------------

  async listPreuves(opportuniteId: string): Promise<OpportunitePreuve[]> {
    const { data, error } = await this.client
      .from('opportunite_preuves')
      .select('*')
      .eq('opportunite_id', opportuniteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => OpportunityMapper.toOpportunitePreuve(r))
  }

  async addPreuve(input: OpportunitePreuveInput): Promise<OpportunitePreuve> {
    const { data, error } = await this.client.from('opportunite_preuves').insert(input).select('*').single()
    if (error) throw error
    return OpportunityMapper.toOpportunitePreuve(data)
  }

  async deletePreuve(id: string): Promise<void> {
    const { error } = await this.client.from('opportunite_preuves').delete().eq('id', id)
    if (error) throw error
  }

  // -- Sprint 2 / 2.1: idempotent processing RPC + score persistence -------

  /**
   * Thin wrapper around the `veille.process_alert_opportunity` Postgres
   * function (service_role only). Pure I/O: no scoring, no correlation
   * logic here — those live in ScoreEngine/CorrelationEngine.
   */
  async processAlertOpportunityRpc(params: {
    alerteId: string
    entrepriseId: string
    correlationKey: string
    titre: string
    entiteCible: string | null
    typeOpportunite: string | null
    secteur: string | null
    geographie: string | null
    decideurIds: string[]
    preuveSource: string | null
    preuveCitation: string | null
    preuveUrl: string | null
  }): Promise<{
    opportuniteId: string
    action: 'created' | 'updated' | 'already_processed'
    nombreSignaux: number
    distinctCategories: number
    datePremierSignal: string | null
    dateDernierSignal: string | null
  }> {
    const { data, error } = await this.client.rpc('process_alert_opportunity', {
      p_alerte_id: params.alerteId,
      p_entreprise_id: params.entrepriseId,
      p_correlation_key: params.correlationKey,
      p_titre: params.titre,
      p_entite_cible: params.entiteCible,
      p_type_opportunite: params.typeOpportunite,
      p_secteur: params.secteur,
      p_geographie: params.geographie,
      p_decideur_ids: params.decideurIds,
      p_preuve_source: params.preuveSource,
      p_preuve_citation: params.preuveCitation,
      p_preuve_url: params.preuveUrl,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('process_alert_opportunity a renvoyé un résultat vide')
    return {
      opportuniteId: row.opportunite_id as string,
      action: row.action as 'created' | 'updated' | 'already_processed',
      nombreSignaux: row.nombre_signaux as number,
      distinctCategories: row.distinct_categories as number,
      datePremierSignal: (row.date_premier_signal as string | null) ?? null,
      dateDernierSignal: (row.date_dernier_signal as string | null) ?? null,
    }
  }

  /**
   * Persists the 4 already-computed indicators onto an existing
   * opportunité. Pure I/O — the values themselves come from ScoreEngine,
   * never computed here.
   */
  async updateOpportunityScores(opportuniteId: string, indicators: OpportunityIndicators): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({
        adequation_score: indicators.adequationScore,
        convergence_score: indicators.convergenceScore,
        anticipation_score: indicators.anticipationScore,
        priorite_score: indicators.prioriteScore,
        score_details: indicators.scoreDetails,
        score_version: indicators.scoreVersion,
      })
      .eq('id', opportuniteId)
    if (error) throw error
  }
}
