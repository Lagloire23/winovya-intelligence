// Converts raw Supabase/PostgREST rows into the typed domain objects in
// ./types.ts. No transformation logic beyond straightforward field
// mapping (no numeric coercion needed: this sprint has no score
// columns).

import type { Opportunite, OpportuniteAlerte, OpportuniteDecideur, OpportunitePreuve } from './types'

function toNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

export const OpportunityMapper = {
  toOpportunite(row: Record<string, unknown>): Opportunite {
    return {
      id: String(row.id),
      titre: String(row.titre),
      resume: toNullableString(row.resume),
      description: toNullableString(row.description),
      statut: row.statut as Opportunite['statut'],
      entreprise_id: String(row.entreprise_id),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }
  },

  toOpportunites(rows: Record<string, unknown>[]): Opportunite[] {
    return rows.map((r) => OpportunityMapper.toOpportunite(r))
  },

  toOpportuniteAlerte(row: Record<string, unknown>): OpportuniteAlerte {
    return {
      opportunite_id: String(row.opportunite_id),
      alerte_id: String(row.alerte_id),
      created_at: String(row.created_at),
    }
  },

  toOpportuniteDecideur(row: Record<string, unknown>): OpportuniteDecideur {
    return {
      opportunite_id: String(row.opportunite_id),
      decideur_id: String(row.decideur_id),
      created_at: String(row.created_at),
    }
  },

  toOpportunitePreuve(row: Record<string, unknown>): OpportunitePreuve {
    return {
      id: String(row.id),
      opportunite_id: String(row.opportunite_id),
      source: toNullableString(row.source),
      citation: toNullableString(row.citation),
      url: toNullableString(row.url),
      created_at: String(row.created_at),
    }
  },
}
