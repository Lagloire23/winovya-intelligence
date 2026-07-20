-- Sprint 8 — Stabilisation MVP. Phase 2 : suppression du N+1
-- d'assignation dans la liste des opportunités (Sprint 7).
--
-- Le Sprint 7 résolvait l'assignation ligne par ligne côté Frontend
-- (jusqu'à 20 appels réseau supplémentaires par page de 20 dossiers,
-- via CommercialService.getAssignment(id) appelé en Promise.all). Ce
-- fichier étend, de façon strictement additive, veille.opportunite_dossier
-- (vue Sprint 4 + Sprint 5) avec les 2 colonnes assigned_to/assigned_at
-- déjà présentes sur veille.opportunites depuis le Sprint 6 (colonnes
-- inchangées, aucune nouvelle donnée, aucune nouvelle règle métier) afin
-- que la liste les obtienne dans l'unique requête déjà exécutée par
-- OpportuniteQueryRepository.list().
--
-- CREATE OR REPLACE VIEW : toutes les colonnes Sprint 4/5 restent
-- identiques, dans le même ordre ; les 2 nouvelles colonnes sont
-- ajoutées à la fin. security_invoker = true conservé : la RLS de
-- veille.opportunites ("authenticated read opportunites", using (true))
-- s'applique normalement — un utilisateur authentifié pouvait déjà lire
-- assigned_to en interrogeant opportunites directement (ou via
-- CommercialService.getAssignment, Sprint 6, inchangé) ; cette
-- extension de vue n'élargit donc AUCUN accès, elle évite seulement 20
-- requêtes redondantes pour obtenir une donnée déjà lisible.
--
-- Aucune résolution de nom d'utilisateur ici (la RLS veille.profiles,
-- Sprint 6, reste inchangée et continue de limiter la lecture du profil
-- d'un tiers aux administrateurs) : seul l'identifiant assigned_to est
-- exposé, jamais un nom fabriqué ou une jointure sur profiles qui
-- échouerait silencieusement pour un non-admin.

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
  ) as texte_recherche,
  o.assigned_to,
  o.assigned_at
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
  'Sprint 4 (champs métier) + Sprint 5 (derniere_evolution_metier_at, niveau_confiance_rang, texte_recherche) + Sprint 8 (assigned_to, assigned_at : évite le N+1 de la liste Sprint 7, aucune nouvelle règle métier, colonnes Sprint 6 inchangées). Vue pure, aucune écriture, aucune donnée dupliquée en dur. security_invoker = true : RLS des tables sources appliquée normalement.';

revoke all on veille.opportunite_dossier from public;
grant select on veille.opportunite_dossier to authenticated, service_role;
