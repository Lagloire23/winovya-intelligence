-- Sprint 11B — Retrait manuel (logique, jamais physique) d'une alerte
-- mal rattachée à une opportunité (P11.1 §10).
--
-- Principe : le lien (veille.opportunite_alertes, Sprint 1 + rôles
-- Sprint 11A) n'est jamais supprimé. Il passe à l'état inactif
-- (is_active = false) et conserve, de façon durable, qui a retiré
-- l'alerte, quand, pour quel motif, avec quel commentaire éventuel.
-- L'alerte globale (veille.alertes) n'est jamais touchée par cette
-- migration.
--
-- Additif uniquement : aucune colonne/table supprimée, aucune donnée
-- réécrite. Les 35 liens existants (Sprint 10/11A) restent
-- is_active = true par défaut — comportement inchangé pour l'existant.
--
-- Ce sprint N'IMPLEMENTE PAS le recalcul métier complet de
-- l'opportunité (Sprint 11C) : voir requestOpportunityRecalculation
-- (TypeScript) qui se contente de marquer statut_enrichissement =
-- 'pending', réutilisant le flag Sprint 4 existant.

-- ---------------------------------------------------------------------
-- 1. Colonnes additives sur veille.opportunite_alertes
-- ---------------------------------------------------------------------

alter table veille.opportunite_alertes
  add column if not exists is_active boolean not null default true,
  add column if not exists retire_at timestamptz,
  add column if not exists retire_par uuid references veille.profiles(id),
  add column if not exists motif_retrait text,
  add column if not exists commentaire_retrait text;

-- Taxonomie fermée des motifs (P11.1 §11), extensible plus tard par une
-- migration additive (même convention que opportunite_activity_log.event_type).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_motif_retrait_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_motif_retrait_check
      check (motif_retrait is null or motif_retrait in (
        'hors_sujet', 'mauvaise_entite', 'mauvais_projet', 'doublon',
        'temporalite_incoherente', 'mauvaise_localisation',
        'mauvais_rapprochement_semantique', 'autre'
      ));
  end if;
end $$;

-- Cohérence : un lien actif ne porte aucune métadonnée de retrait ; un
-- lien inactif porte obligatoirement date + auteur + motif (le
-- commentaire reste libre, sauf pour 'autre' — contrainte suivante).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_retrait_coherence_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_retrait_coherence_check
      check (
        (is_active = true and retire_at is null and retire_par is null and motif_retrait is null and commentaire_retrait is null)
        or
        (is_active = false and retire_at is not null and retire_par is not null and motif_retrait is not null)
      );
  end if;
end $$;

-- Motif 'autre' : commentaire explicatif obligatoire et non vide.
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_motif_autre_commentaire_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_motif_autre_commentaire_check
      check (motif_retrait is distinct from 'autre' or (commentaire_retrait is not null and char_length(trim(both from commentaire_retrait)) > 0));
  end if;
end $$;

comment on column veille.opportunite_alertes.is_active is
  'Sprint 11B : true = lien actif (compte dans les lectures/calculs actifs), false = retiré logiquement (jamais supprimé). Défaut true : tous les liens historiques (Sprint 1/10/11A) restent actifs sans backfill.';
comment on column veille.opportunite_alertes.retire_at is
  'Sprint 11B : horodatage du retrait. NULL si le lien est actif.';
comment on column veille.opportunite_alertes.retire_par is
  'Sprint 11B : utilisateur (veille.profiles) ayant effectué le retrait. NULL si le lien est actif. Écriture soumise à la policy RLS existante "admin write opportunite_alertes" (Sprint 1, inchangée) : aucune nouvelle policy introduite.';
comment on column veille.opportunite_alertes.motif_retrait is
  'Sprint 11B : motif structuré et obligatoire du retrait (taxonomie fermée, voir contrainte CHECK). NULL si le lien est actif.';
comment on column veille.opportunite_alertes.commentaire_retrait is
  'Sprint 11B : commentaire libre, obligatoire uniquement si motif_retrait = ''autre''. NULL si le lien est actif.';

create index if not exists idx_opportunite_alertes_is_active on veille.opportunite_alertes(is_active);

-- ---------------------------------------------------------------------
-- 2. Journal d'activité : deux nouveaux types d'événement, append-only
--    (Sprint 6, réutilisé — P11.1 §10.4/§13.6 : jamais une trace
--    stockée sur une ligne qui pourrait être modifiée/supprimée plus
--    tard).
-- ---------------------------------------------------------------------

alter table veille.opportunite_activity_log
  drop constraint if exists opportunite_activity_log_event_type_check;

alter table veille.opportunite_activity_log
  add constraint opportunite_activity_log_event_type_check
  check (event_type in (
    'created', 'status_changed', 'assigned', 'unassigned',
    'note_added', 'note_updated', 'note_deleted',
    'alerte_retiree', 'alerte_reintegree'
  ));

comment on table veille.opportunite_activity_log is
  'Sprint 6 (étendu Sprint 11B) : historique métier append-only. Aucune ligne n''est jamais modifiée ni supprimée physiquement (aucune policy RLS UPDATE/DELETE ; seules les fonctions trigger SECURITY DEFINER de ce fichier et de la migration Sprint 11B y écrivent, jamais le code applicatif directement). event_type est une liste fermée mais extensible par migration additive.';

-- ---------------------------------------------------------------------
-- 3. Trigger de journalisation automatique du retrait/réintégration
--    (additif, jamais appelé par le moteur de corrélation ni par
--    process_alert_opportunity).
-- ---------------------------------------------------------------------

create or replace function veille.log_opportunite_alerte_retrait_activity()
returns trigger
language plpgsql
security definer
set search_path = veille, pg_catalog, pg_temp
as $$
declare
  v_niveau_confiance text;
  v_statut text;
begin
  if old.is_active is not distinct from new.is_active then
    return new;
  end if;

  select niveau_confiance, statut into v_niveau_confiance, v_statut
  from veille.opportunites where id = new.opportunite_id;

  if new.is_active = false then
    insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
    values (
      new.opportunite_id,
      'alerte_retiree',
      new.retire_par,
      jsonb_build_object(
        'alerte_id', new.alerte_id,
        'motif', new.motif_retrait,
        'commentaire', new.commentaire_retrait,
        'role_correlation_avant', old.role_correlation,
        'niveau_confiance_avant', v_niveau_confiance,
        'statut_avant', v_statut
      )
    );
  else
    insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
    values (
      new.opportunite_id,
      'alerte_reintegree',
      auth.uid(),
      jsonb_build_object(
        'alerte_id', new.alerte_id,
        'motif_retrait_original', old.motif_retrait,
        'commentaire_retrait_original', old.commentaire_retrait,
        'retire_par_original', old.retire_par,
        'retire_at_original', old.retire_at,
        'role_correlation_restaure', new.role_correlation,
        'niveau_confiance_au_moment_reintegration', v_niveau_confiance,
        'statut_au_moment_reintegration', v_statut
      )
    );
  end if;

  return new;
end;
$$;

comment on function veille.log_opportunite_alerte_retrait_activity() is
  'Sprint 11B : journalisation automatique et additive (alerte_retiree/alerte_reintegree) sur veille.opportunite_alertes. Capture systématiquement le rôle de corrélation, la confiance et le statut de l''opportunité AU MOMENT de l''événement (jamais recalculés a posteriori). SECURITY DEFINER pour écrire dans opportunite_activity_log quel que soit l''appelant (même principe que les triggers Sprint 6).';

drop trigger if exists trg_log_opportunite_alerte_retrait_activity on veille.opportunite_alertes;
create trigger trg_log_opportunite_alerte_retrait_activity
  after update of is_active on veille.opportunite_alertes
  for each row execute function veille.log_opportunite_alerte_retrait_activity();
