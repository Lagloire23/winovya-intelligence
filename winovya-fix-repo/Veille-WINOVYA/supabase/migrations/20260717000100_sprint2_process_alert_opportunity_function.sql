-- Sprint 2 — Fonction transactionnelle d'idempotence pour le traitement
-- d'une alerte en opportunité.
--
-- Objectif (phase 7 du sprint) : garantir dans UNE seule transaction
-- Postgres, sans lecture-puis-écriture applicative racée :
--   - aucune opportunité dupliquée pour un même (entreprise_id, correlation_key)
--   - aucun lien opportunite_alertes dupliqué
--   - aucun lien opportunite_decideurs dupliqué
--   - aucune preuve dupliquée pour la même alerte + même source
--
-- Cette fonction ne calcule PAS les scores (adéquation/convergence/
-- anticipation/priorité) : ces calculs restent des fonctions TypeScript
-- pures et testables (voir src/lib/opportunities/engine/scoring.ts).
-- Elle gère uniquement la partie critique en concurrence : recherche/
-- création de l'opportunité, liaison alerte/décideurs/preuve, et
-- recalcul des agrégats réels (nombre_signaux, dates, diversité des
-- sources) qui servent ensuite de données d'entrée au calcul du score
-- de convergence côté TypeScript (mise à jour en second temps via un
-- UPDATE dédié, cf. OpportunityEngineService).
--
-- Sécurité : exécutée uniquement via le rôle service_role (appelée
-- depuis l'Edge Function process-alert-opportunity, jamais directement
-- depuis le frontend). EXECUTE est explicitement retiré à anon et
-- authenticated : la fonction n'est PAS security definer, donc RLS
-- s'applique déjà avec le rôle appelant, mais le REVOKE ajoute une
-- deuxième barrière indépendante de RLS (défense en profondeur).

create or replace function veille.process_alert_opportunity(
  p_alerte_id uuid,
  p_entreprise_id uuid,
  p_correlation_key text,
  p_titre text,
  p_entite_cible text,
  p_type_opportunite text,
  p_secteur text,
  p_geographie text,
  p_decideur_ids uuid[] default '{}',
  p_preuve_source text default null,
  p_preuve_citation text default null,
  p_preuve_url text default null
)
returns table (
  opportunite_id uuid,
  action text,
  nombre_signaux integer,
  distinct_categories integer,
  date_premier_signal timestamptz,
  date_dernier_signal timestamptz
)
language plpgsql
set search_path = veille, pg_temp
as $$
declare
  v_opportunite_id uuid;
  v_was_inserted boolean;
  v_already_linked boolean;
  v_action text;
  v_nombre_signaux integer;
  v_distinct_categories integer;
  v_date_premier timestamptz;
  v_date_dernier timestamptz;
  v_decideur_id uuid;
begin
  if not exists (select 1 from veille.alertes where id = p_alerte_id) then
    raise exception 'ALERTE_NOT_FOUND: %', p_alerte_id;
  end if;

  if not exists (select 1 from veille.entreprises where id = p_entreprise_id) then
    raise exception 'ENTREPRISE_NOT_FOUND: %', p_entreprise_id;
  end if;

  if not exists (
    select 1 from veille.pertinence_entreprise
    where alerte_id = p_alerte_id
      and entreprise_id = p_entreprise_id
      and statut = 'Actif'
  ) then
    raise exception 'ALERTE_NOT_RELEVANT_FOR_ENTREPRISE: alerte=% entreprise=%', p_alerte_id, p_entreprise_id;
  end if;

  -- Détection préalable : cette alerte est-elle déjà rattachée à
  -- l'opportunité ciblée par cette correlation_key pour cette entreprise ?
  select true into v_already_linked
  from veille.opportunite_alertes oa
  join veille.opportunites o on o.id = oa.opportunite_id
  where oa.alerte_id = p_alerte_id
    and o.entreprise_id = p_entreprise_id
    and o.correlation_key = p_correlation_key
  limit 1;

  -- Find-or-create atomique sur (entreprise_id, correlation_key).
  insert into veille.opportunites (
    titre, entreprise_id, correlation_key, entite_cible, type_opportunite,
    secteur, geographie, date_premier_signal, date_dernier_signal, last_processed_at
  )
  values (
    p_titre, p_entreprise_id, p_correlation_key, p_entite_cible, p_type_opportunite,
    p_secteur, p_geographie, now(), now(), now()
  )
  on conflict (entreprise_id, correlation_key) where correlation_key is not null
  do update set
    last_processed_at = now(),
    updated_at = now()
  returning id, (xmax = 0) into v_opportunite_id, v_was_inserted;

  -- Lien alerte <-> opportunité, idempotent.
  insert into veille.opportunite_alertes (opportunite_id, alerte_id)
  values (v_opportunite_id, p_alerte_id)
  on conflict do nothing;

  if v_was_inserted then
    v_action := 'created';
  elsif v_already_linked then
    v_action := 'already_processed';
  else
    v_action := 'updated';
  end if;

  -- Liens décideurs, idempotents.
  if p_decideur_ids is not null then
    foreach v_decideur_id in array p_decideur_ids loop
      insert into veille.opportunite_decideurs (opportunite_id, decideur_id)
      values (v_opportunite_id, v_decideur_id)
      on conflict do nothing;
    end loop;
  end if;

  -- Preuve issue de la source de l'alerte, si disponible et pas déjà enregistrée
  -- pour cette opportunité + cette source + cette url (vérifié via NOT EXISTS ;
  -- sûr ici car les appels concurrents pour la même correlation_key sont
  -- sérialisés par le conflit d'unicité ci-dessus sur la même ligne opportunites).
  if p_preuve_url is not null or p_preuve_source is not null then
    insert into veille.opportunite_preuves (opportunite_id, source, citation, url)
    select v_opportunite_id, p_preuve_source, p_preuve_citation, p_preuve_url
    where not exists (
      select 1 from veille.opportunite_preuves op
      where op.opportunite_id = v_opportunite_id
        and coalesce(op.source, '') = coalesce(p_preuve_source, '')
        and coalesce(op.url, '') = coalesce(p_preuve_url, '')
    );
  end if;

  -- Recalcul des agrégats réels depuis les relations (jamais incrémenté).
  select
    count(*)::int,
    count(distinct a.categorie_veille)::int,
    min(a.date_detection),
    max(a.date_detection)
  into v_nombre_signaux, v_distinct_categories, v_date_premier, v_date_dernier
  from veille.opportunite_alertes oa
  join veille.alertes a on a.id = oa.alerte_id
  where oa.opportunite_id = v_opportunite_id;

  update veille.opportunites o
  set
    nombre_signaux = v_nombre_signaux,
    date_premier_signal = v_date_premier,
    date_dernier_signal = v_date_dernier
  where o.id = v_opportunite_id;

  return query select
    v_opportunite_id,
    v_action,
    v_nombre_signaux,
    v_distinct_categories,
    v_date_premier,
    v_date_dernier;
end;
$$;

comment on function veille.process_alert_opportunity is
  'Sprint 2 — traitement atomique et idempotent d''une alerte pour une entreprise donnée : find-or-create de l''opportunité, liaison alerte/décideurs/preuve, recalcul des agrégats réels. Ne calcule aucun score (fait côté TypeScript, cf. scoring.ts). Appelée uniquement depuis l''Edge Function process-alert-opportunity via service_role.';

revoke execute on function veille.process_alert_opportunity(
  uuid, uuid, text, text, text, text, text, text, uuid[], text, text, text
) from public;
revoke execute on function veille.process_alert_opportunity(
  uuid, uuid, text, text, text, text, text, text, uuid[], text, text, text
) from anon, authenticated;
grant execute on function veille.process_alert_opportunity(
  uuid, uuid, text, text, text, text, text, text, uuid[], text, text, text
) to service_role;
