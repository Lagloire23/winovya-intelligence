// Sprint 6 — Repository I/O pur du domaine commercial (statut,
// assignation, notes, journal). Aucun calcul métier ici (voir
// lifecycle.ts). N'importe et ne modifie jamais rien du Sprint 5
// (query/) ni des Sprints 2-4 (moteur, pipeline, dossier) : ce module
// lit/écrit exclusivement veille.opportunites (colonnes Sprint 6 :
// statut, assigned_to, assigned_at), veille.opportunite_notes et
// veille.opportunite_activity_log (tables Sprint 6).
//
// Écriture de opportunites.statut/assigned_to/assigned_at soumise à la
// policy RLS existante "admin write opportunites" (Sprint 1, inchangée) :
// ce repository n'ajoute et ne contourne aucune policy sur cette table.
// Le journal d'activité (opportunite_activity_log) n'est JAMAIS écrit
// directement par ce repository : il est alimenté uniquement par les
// triggers SQL SECURITY DEFINER de la migration Sprint 6 — ce repository
// ne fait que le LIRE.

import { supabase as defaultSupabase } from '../../supabase'
import type { ActivityEventType, ActivityLogEntryDto, NoteDto, StatutOpportunite } from './types'

type AppSupabaseClient = typeof defaultSupabase

export class CommercialRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /** Lecture minimale et dédiée (une seule colonne) : ne réutilise pas le Repository Sprint 5, qui reste intouché et non importé ici. */
  async getStatut(opportuniteId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from('opportunites')
      .select('statut')
      .eq('id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    return data ? String(data.statut) : null
  }

  async updateStatut(opportuniteId: string, statut: StatutOpportunite): Promise<void> {
    const { error } = await this.client.from('opportunites').update({ statut }).eq('id', opportuniteId)
    if (error) throw error
  }

  async getAssignment(opportuniteId: string): Promise<{ assignedTo: string | null; assignedAt: string | null } | null> {
    const { data, error } = await this.client
      .from('opportunites')
      .select('assigned_to, assigned_at')
      .eq('id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      assignedTo: (data.assigned_to as string | null) ?? null,
      assignedAt: (data.assigned_at as string | null) ?? null,
    }
  }

  async assign(opportuniteId: string, profileId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({ assigned_to: profileId, assigned_at: new Date().toISOString() })
      .eq('id', opportuniteId)
    if (error) throw error
  }

  async unassign(opportuniteId: string): Promise<void> {
    const { error } = await this.client
      .from('opportunites')
      .update({ assigned_to: null, assigned_at: new Date().toISOString() })
      .eq('id', opportuniteId)
    if (error) throw error
  }

  private mapNote(n: Record<string, unknown>): NoteDto {
    return {
      id: String(n.id),
      opportuniteId: String(n.opportunite_id),
      auteurId: String(n.auteur_id),
      contenu: String(n.contenu),
      createdAt: String(n.created_at),
      updatedAt: String(n.updated_at),
      deletedAt: (n.deleted_at as string | null) ?? null,
    }
  }

  /** Notes actives (non supprimées logiquement) d'une opportunité, les plus récentes d'abord. */
  async listNotes(opportuniteId: string, options: { includeDeleted?: boolean } = {}): Promise<NoteDto[]> {
    let query = this.client
      .from('opportunite_notes')
      .select('*')
      .eq('opportunite_id', opportuniteId)
      .order('created_at', { ascending: false })
    if (!options.includeDeleted) {
      query = query.is('deleted_at', null)
    }
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((n) => this.mapNote(n))
  }

  async getNote(noteId: string): Promise<NoteDto | null> {
    const { data, error } = await this.client.from('opportunite_notes').select('*').eq('id', noteId).maybeSingle()
    if (error) throw error
    return data ? this.mapNote(data) : null
  }

  async createNote(opportuniteId: string, auteurId: string, contenu: string): Promise<NoteDto> {
    const { data, error } = await this.client
      .from('opportunite_notes')
      .insert({ opportunite_id: opportuniteId, auteur_id: auteurId, contenu })
      .select('*')
      .single()
    if (error) throw error
    return this.mapNote(data)
  }

  async updateNote(noteId: string, contenu: string): Promise<NoteDto> {
    const { data, error } = await this.client
      .from('opportunite_notes')
      .update({ contenu, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select('*')
      .single()
    if (error) throw error
    return this.mapNote(data)
  }

  /** Suppression logique uniquement (Phase 4/5) : jamais de DELETE physique. */
  async softDeleteNote(noteId: string): Promise<NoteDto> {
    const { data, error } = await this.client
      .from('opportunite_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
      .select('*')
      .single()
    if (error) throw error
    return this.mapNote(data)
  }

  /** Lecture du journal (Phase 5/6) — jamais d'écriture depuis ce repository (voir en-tête du fichier). */
  async getActivityLog(opportuniteId: string): Promise<ActivityLogEntryDto[]> {
    const { data, error } = await this.client
      .from('opportunite_activity_log')
      .select('*')
      .eq('opportunite_id', opportuniteId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((e) => ({
      id: String(e.id),
      opportuniteId: String(e.opportunite_id),
      eventType: e.event_type as ActivityEventType,
      acteurId: (e.acteur_id as string | null) ?? null,
      details: (e.details as Record<string, unknown>) ?? {},
      createdAt: String(e.created_at),
    }))
  }
}
