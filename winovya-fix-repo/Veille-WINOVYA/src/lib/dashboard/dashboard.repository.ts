// Sprint 9 — Repository de lecture pour le cockpit (Phase 8/9). Pure I/O
// (aucun calcul métier ici, voir dashboard.helpers.ts pour les règles et
// dashboard.service.ts pour l'orchestration).
//
// Ne lit QUE :
//   - veille.opportunite_dossier (vue Sprint 4/5/8, inchangée par ce
//     sprint) — mêmes colonnes que le module Query (Sprint 5), lues
//     indépendamment ici pour ne pas dépendre d'un type "interne" d'un
//     autre module (voir OpportuniteQueryRepository.ts, RawDossierRow).
//   - veille.opportunite_activity_log (Sprint 6, inchangée).
// Stratégie de requêtes (Phase 9, Option B documentée dans
// docs/dashboard-architecture.md) : lots bornés + agrégation TypeScript.
// Aucune nouvelle vue, aucun nouveau RPC, aucune migration requise pour
// ce module. Au plus 2 requêtes par appel (dossiers + journal), jamais de
// N+1 (jamais de requête à l'intérieur d'une boucle sur les lignes).

import { supabase as defaultSupabase } from '../supabase'

type AppSupabaseClient = typeof defaultSupabase

/** Ligne minimale du cockpit — sous-ensemble de veille.opportunite_dossier utile aux agrégats (Phase 9 : "DTO dédiés minimisant les requêtes"). */
export interface DashboardOpportuniteRow {
  id: string
  titre: string
  statutOpportunite: string
  niveauConfiance: string | null
  niveauConfianceRang: number
  budgetIdentifie: number | null
  nombreSignaux: number
  dateDernierSignal: string | null
  derniereEvolutionMetierAt: string | null
  createdAt: string
  updatedAt: string
  assignedTo: string | null
  assignedAt: string | null
}

export interface DashboardActivityRow {
  id: string
  opportuniteId: string
  eventType: string
  details: Record<string, unknown>
  createdAt: string
}

function mapDossierRow(d: Record<string, unknown>): DashboardOpportuniteRow {
  return {
    id: String(d.opportunite_id),
    titre: String(d.titre),
    statutOpportunite: String(d.statut_opportunite),
    niveauConfiance: (d.niveau_confiance as string | null) ?? null,
    niveauConfianceRang: Number(d.niveau_confiance_rang ?? 0),
    budgetIdentifie: (d.budget_identifie as number | null) ?? null,
    nombreSignaux: Number(d.nombre_signaux ?? 0),
    dateDernierSignal: (d.date_dernier_signal as string | null) ?? null,
    derniereEvolutionMetierAt: (d.derniere_evolution_metier_at as string | null) ?? null,
    createdAt: String(d.created_at),
    updatedAt: String(d.updated_at),
    assignedTo: (d.assigned_to as string | null) ?? null,
    assignedAt: (d.assigned_at as string | null) ?? null,
  }
}

const DOSSIER_COLUMNS =
  'opportunite_id, titre, statut_opportunite, niveau_confiance, niveau_confiance_rang, budget_identifie, nombre_signaux, date_dernier_signal, derniere_evolution_metier_at, created_at, updated_at, assigned_to, assigned_at'

export class DashboardRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /**
   * Admin (Phase 9) : TOUTES les opportunités (tous statuts, y compris
   * WON/LOST/ARCHIVED/IN_PROGRESS — le filtrage par statut est une
   * décision d'agrégation, pas de lecture, voir dashboard.helpers.ts),
   * bornée et triée par activité la plus récente. Une seule requête,
   * réutilisée pour les KPI, le pipeline, les priorités, les
   * distributions ET la résolution des titres dans le flux d'activité
   * (évite une requête séparée).
   */
  async fetchAllDossiers(limit = 1000): Promise<DashboardOpportuniteRow[]> {
    const { data, error } = await this.client
      .from('opportunite_dossier')
      .select(DOSSIER_COLUMNS)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapDossierRow)
  }

  /** Utilisateur (Phase 9) : uniquement les opportunités qui lui sont assignées — jamais un filtre par nom/email (Phase 5 : "assigned_to = utilisateur courant"). */
  async fetchDossiersForUser(userId: string, limit = 500): Promise<DashboardOpportuniteRow[]> {
    const { data, error } = await this.client
      .from('opportunite_dossier')
      .select(DOSSIER_COLUMNS)
      .eq('assigned_to', userId)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapDossierRow)
  }

  /** Admin : journal d'activité toutes opportunités confondues, borné (RLS `authenticated read opportunite_activity_log`, inchangée). */
  async fetchRecentActivity(limit = 50): Promise<DashboardActivityRow[]> {
    const { data, error } = await this.client
      .from('opportunite_activity_log')
      .select('id, opportunite_id, event_type, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((e) => ({
      id: String(e.id),
      opportuniteId: String(e.opportunite_id),
      eventType: String(e.event_type),
      details: (e.details as Record<string, unknown>) ?? {},
      createdAt: String(e.created_at),
    }))
  }

  /** Utilisateur : journal d'activité restreint aux opportunités assignées (jamais un contournement de la RLS — même table, même policy, filtre applicatif en plus). */
  async fetchRecentActivityForOpportunites(opportuniteIds: string[], limit = 50): Promise<DashboardActivityRow[]> {
    if (opportuniteIds.length === 0) return []
    const { data, error } = await this.client
      .from('opportunite_activity_log')
      .select('id, opportunite_id, event_type, details, created_at')
      .in('opportunite_id', opportuniteIds)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((e) => ({
      id: String(e.id),
      opportuniteId: String(e.opportunite_id),
      eventType: String(e.event_type),
      details: (e.details as Record<string, unknown>) ?? {},
      createdAt: String(e.created_at),
    }))
  }
}
