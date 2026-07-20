-- Sprint 5 — API métier de consultation des dossiers d'opportunité.
--
-- Ce fichier n'ajoute AUCUNE nouvelle règle métier : les colonnes
-- veille.opportunites (Sprint 4), process_alert_opportunity, le moteur de
-- corrélation (Sprint 2.1) et les triggers automatiques (Sprint 3) restent
-- strictement inchangés. Il étend uniquement, de façon additive,
-- veille.opportunite_dossier (vue de lecture créée au Sprint 4) avec 3
-- colonnes calculées, toutes au service exclusif de la couche de
-- consultation Sprint 5 :
--
--   1. derniere_evolution_metier_at — nécessaire à la Phase 3 (stratégie
--      de consolidation à la lecture) : la plus récente des dates
--      pertinentes (opportunites.updated_at, dernière preuve liée, dernier
--      décideur lié, dernière alerte liée). Sans cette colonne, comparer
--      "la dernière consolidation" à "la dernière évolution métier"
--      nécessiterait 3 requêtes supplémentaires PAR dossier (N+1, Phase 10) :
--      updated_at seul est insuffisant car AUCUN trigger ne le met à jour
--      quand une preuve/un décideur est rattaché directement (vérifié par
--      audit : aucun trigger sur opportunite_preuves/opportunite_decideurs/
--      opportunite_alertes).
--   2. niveau_confiance_rang — traduction numérique de la valeur textuelle
--      niveau_confiance (Sprint 4, INCHANGÉE) en un rang ordonnable
--      (Élevé=3, Moyen=2, Faible=1, absent=0), utilisée uniquement pour le
--      tri (Phase 7). Ne redéfinit pas la règle de classification
--      elle-même (toujours calculée exclusivement par
--      DossierEnrichmentService.computeNiveauConfiance, Sprint 4).
--   3. texte_recherche — concaténation en minuscules des champs
--      recherchables (titre, entité cible, type, géographie, résumé,
--      raisons), pour une recherche libre en un seul filtre ILIKE plutôt
--      qu'une combinaison de OR sur plusieurs colonnes + une syntaxe jsonb
--      dédiée pour les raisons (Phase 5).
--
-- CREATE OR REPLACE VIEW : les colonnes existantes du Sprint 4 restent
-- identiques, dans le même ordre ; les 3 nouvelles colonnes sont ajoutées
-- à la fin. Aucun impact sur un éventuel consommateur déjà branché sur la
-- vue Sprint 4 (aucun à ce jour : Sprint 5 est le premier consommateur).

create or replace view veille.opportunite_dossier
  with (security_invoker = true) as
select
  o.id as opportunite_id,
  o.entreprise_id,
  o.titre,
  o.resume as resume_metier,
  o.statut as statut_opportunite,
  o.type_opportunite,
  o.entite_cible,
  o.geographie,
  o.secteur,
  o.phase_projet,
  o.budget_identifie,
  o.budget_source,
  o.budget_fiabilite,
  o.budget_estime,
  o.niveau_confiance,
  o.statut_enrichissement,
  o.raisons,
  o.nombre_signaux,
  o.date_premier_signal,
  o.date_dernier_signal,
  o.derniere_consolidation_at,
  o.updated_at,
  coalesce(pv.nombre_preuves, 0) as nombre_preuves,
  coalesce(dv.nombre_decideurs, 0) as nombre_decideurs,
  o.created_at,
  case o.niveau_confiance
    when 'Élevé' then 3
    when 'Moyen' then 2
    when 'Faible' then 1
    else 0
  end as niveau_confiance_rang,
  greatest(
    o.updated_at,
    coalesce(pv.derniere_preuve_at, o.updated_at),
    coalesce(dv.dernier_decideur_at, o.updated_at),
    coalesce(av.derniere_alerte_liee_at, o.updated_at)
  ) as derniere_evolution_metier_at,
  lower(
    coalesce(o.titre, '') || ' ' ||
    coalesce(o.entite_cible, '') || ' ' ||
    coalesce(o.type_opportunite, '') || ' ' ||
    coalesce(o.geographie, '') || ' ' ||
    coalesce(o.resume, '') || ' ' ||
    coalesce(o.raisons::text, '')
  ) as texte_recherche
from veille.opportunites o
left join (
  select opportunite_id, count(*) as nombre_preuves, max(created_at) as derniere_preuve_at
  from veille.opportunite_preuves
  group by opportunite_id
) pv on pv.opportunite_id = o.id
left join (
  select opportunite_id, count(*) as nombre_decideurs, max(created_at) as dernier_decideur_at
  from veille.opportunite_decideurs
  group by opportunite_id
) dv on dv.opportunite_id = o.id
left join (
  select opportunite_id, max(created_at) as derniere_alerte_liee_at
  from veille.opportunite_alertes
  group by opportunite_id
) av on av.opportunite_id = o.id;

comment on view veille.opportunite_dossier is
  'Sprint 4 (champs métier) + Sprint 5 (derniere_evolution_metier_at, niveau_confiance_rang, texte_recherche : lecture/tri/recherche uniquement, aucune règle métier redéfinie). Vue pure, aucune écriture, aucune donnée dupliquée en dur. security_invoker = true : RLS des tables sources appliquée normalement.';

revoke all on veille.opportunite_dossier from public;
grant select on veille.opportunite_dossier to authenticated, service_role;
