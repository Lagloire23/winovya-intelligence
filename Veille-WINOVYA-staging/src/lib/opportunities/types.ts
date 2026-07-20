// Row types mirroring the Sprint 1 foundation tables exactly (see
// supabase/migrations/20260716204750_sprint1_foundations_schema.sql).
// Hand-written, same convention as ../types.ts. No scoring/correlation
// fields: those are out of scope for this sprint.

export type StatutOpportunite =
  | 'NEW'
  | 'QUALIFIED'
  | 'IN_PROGRESS'
  | 'WON'
  | 'LOST'
  | 'ARCHIVED'

export interface Opportunite {
  id: string
  titre: string
  resume: string | null
  description: string | null
  statut: StatutOpportunite
  entreprise_id: string
  created_at: string
  updated_at: string
}

export interface OpportuniteInput {
  titre: string
  resume?: string | null
  description?: string | null
  statut?: StatutOpportunite
  entreprise_id: string
}

export type OpportuniteUpdate = Partial<OpportuniteInput>

export interface OpportuniteAlerte {
  opportunite_id: string
  alerte_id: string
  created_at: string
}

export interface OpportuniteDecideur {
  opportunite_id: string
  decideur_id: string
  created_at: string
}

export interface OpportunitePreuve {
  id: string
  opportunite_id: string
  source: string | null
  citation: string | null
  url: string | null
  created_at: string
}

export interface OpportunitePreuveInput {
  opportunite_id: string
  source?: string | null
  citation?: string | null
  url?: string | null
}
