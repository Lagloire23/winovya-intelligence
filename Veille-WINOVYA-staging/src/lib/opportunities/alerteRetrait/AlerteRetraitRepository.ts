// Sprint 11B — Repository I/O pur pour le retrait/réintégration logique
// d'une alerte liée à une opportunité. Suit exactement le même patron
// que CommercialRepository.ts (Sprint 6) : aucune logique métier ici
// (voir AlerteRetraitService.ts), et l'isolation par entreprise n'est
// JAMAIS dupliquée ici — elle est déléguée entièrement à la RLS
// existante ("admin write opportunite_alertes", Sprint 1, inchangée).
//
// Point d'attention (voir AlerteRetraitService.ts) : une écriture
// bloquée par RLS ne remonte PAS d'erreur PostgREST — elle retourne
// simplement 0 ligne affectée. Chaque méthode de mutation ici renvoie
// donc le nombre de lignes réellement modifiées (via .select()), afin
// que le Service puisse distinguer un succès réel d'un refus silencieux.

import { supabase as defaultSupabase } from '../../supabase'
import type { MotifRetrait } from './types'

type AppSupabaseClient = typeof defaultSupabase

export interface LienAlerteOpportuniteRow {
  opportuniteId: string
  alerteId: string
  isActive: boolean
  roleCorrelation: string | null
}

export class AlerteRetraitRepository {
  constructor(private readonly client: AppSupabaseClient = defaultSupabase) {}

  /** Vérifie l'existence de l'opportunité (jamais fabriqué : lecture directe). */
  async opportuniteExiste(opportuniteId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('opportunites')
      .select('id')
      .eq('id', opportuniteId)
      .maybeSingle()
    if (error) throw error
    return data !== null
  }

  /** État courant du lien (actif/inactif, rôle courant) — utilisé pour les pré-vérifications côté Service. */
  async getLien(opportuniteId: string, alerteId: string): Promise<LienAlerteOpportuniteRow | null> {
    const { data, error } = await this.client
      .from('opportunite_alertes')
      .select('opportunite_id, alerte_id, is_active, role_correlation')
      .eq('opportunite_id', opportuniteId)
      .eq('alerte_id', alerteId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return {
      opportuniteId: String(data.opportunite_id),
      alerteId: String(data.alerte_id),
      isActive: Boolean(data.is_active),
      roleCorrelation: (data.role_correlation as string | null) ?? null,
    }
  }

  /**
   * Retrait logique : is_active=true -> false, plus les métadonnées de
   * retrait. Garde défensive supplémentaire au niveau de la requête
   * (.eq('is_active', true)) : si la ligne était déjà inactive entre la
   * pré-vérification du Service et cet appel, 0 ligne est affectée.
   * Retourne le nombre de lignes réellement modifiées.
   */
  async retirer(
    opportuniteId: string,
    alerteId: string,
    actorId: string,
    motif: MotifRetrait,
    commentaire: string | null
  ): Promise<number> {
    const { data, error } = await this.client
      .from('opportunite_alertes')
      .update({
        is_active: false,
        retire_at: new Date().toISOString(),
        retire_par: actorId,
        motif_retrait: motif,
        commentaire_retrait: commentaire,
      })
      .eq('opportunite_id', opportuniteId)
      .eq('alerte_id', alerteId)
      .eq('is_active', true)
      .select('opportunite_id')
    if (error) throw error
    return (data ?? []).length
  }

  /**
   * Réintégration : is_active=false -> true, et les métadonnées de
   * retrait sont nettoyées (l'historique complet reste dans
   * veille.opportunite_activity_log, append-only, jamais ici). Retourne
   * le nombre de lignes réellement modifiées.
   */
  async reintegrer(opportuniteId: string, alerteId: string): Promise<number> {
    const { data, error } = await this.client
      .from('opportunite_alertes')
      .update({
        is_active: true,
        retire_at: null,
        retire_par: null,
        motif_retrait: null,
        commentaire_retrait: null,
      })
      .eq('opportunite_id', opportuniteId)
      .eq('alerte_id', alerteId)
      .eq('is_active', false)
      .select('opportunite_id')
    if (error) throw error
    return (data ?? []).length
  }
}
