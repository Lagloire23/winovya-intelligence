-- Sprint 3 — Raccordement automatique du pipeline de veille.
--
-- Objectif : toute nouvelle ligne pertinente dans veille.pertinence_entreprise
-- (créée par le pipeline de collecte/analyse EXISTANT, inchangé) déclenche
-- automatiquement le moteur d'opportunités déterministe du Sprint 2 / 2.1,
-- SANS modifier ni réécrire ce pipeline.
--
-- Ce fichier n'ajoute :
--   - aucune IA, aucune API, aucun framework, aucune dépendance npm ;
--   - aucune modification du pipeline de collecte/analyse existant ;
--   - aucune modification de veille.process_alert_opportunity (Sprint 2/2.1,
--     inchangée, réutilisée telle quelle) ;
--   - aucune modification des Edge Functions de production.
--
-- Il ajoute uniquement :
--   1. veille.engine_settings       — coupe-circuit dédié au déclenchement
--                                      automatique (Phase 4 / Phase 7).
--   2. veille.normalize_for_correlation / veille.generate_correlation_key
--                                    — miroir SQL, strictement équivalent,
--                                      de src/lib/opportunities/engine/
--                                      CorrelationEngine.ts (Strategie B,
--                                      Sprint 2.1 : pas de fenêtre
--                                      temporelle). Toute évolution de
--                                      l'algorithme côté TypeScript doit
--                                      être répercutée ici et revalidée
--                                      par le test de cohérence TS/SQL
--                                      (voir scripts/sprint3-*).
--   3. veille.trg_process_pertinence_to_opportunity()
--                                    — fonction déclenchée automatiquement,
--                                      qui appelle UNIQUEMENT la RPC
--                                      existante process_alert_opportunity
--                                      (aucun calcul de score : les 4
--                                      indicateurs restent NULL après un
--                                      traitement automatique, exactement
--                                      comme le prévoit la Phase 9 de la
--                                      spécification Sprint 3, qui s'arrête
--                                      à "Opportunité créée -> Décideurs
--                                      liés -> Preuves liées", sans mention
--                                      de scores calculés).
--   4. Deux triggers AFTER sur veille.pertinence_entreprise (INSERT, et
--      UPDATE OF statut lors d'une transition vers 'Actif').

-- ---------------------------------------------------------------------
-- 1. Coupe-circuit dédié au chemin automatique (Phase 4 / Phase 7).
--
-- Distinct et indépendant de la variable d'environnement Deno
-- OPPORTUNITY_ENGINE_ENABLED (qui gouverne le chemin MANUEL, via la
-- Edge Function process-alert-opportunity). Un trigger Postgres ne peut
-- pas lire une variable d'environnement Deno : ce commutateur côté base
-- est donc nécessaire pour que le chemin AUTOMATIQUE reste, lui aussi,
-- désactivable instantanément (une seule UPDATE, effective dès la
-- prochaine invocation du trigger, sans redéploiement ni redémarrage).
-- Désactivé par défaut (false), comme le commutateur Edge Function.
-- ---------------------------------------------------------------------
create table if not exists veille.engine_settings (
  id smallint primary key default 1,
  opportunity_engine_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint engine_settings_singleton check (id = 1)
);

comment on table veille.engine_settings is
  'Sprint 3 : coupe-circuit du declenchement automatique du moteur d''opportunites (trigger sur pertinence_entreprise). Independant de OPPORTUNITY_ENGINE_ENABLED (Edge Function, chemin manuel).';

insert into veille.engine_settings (id, opportunity_engine_enabled)
values (1, false)
on conflict (id) do nothing;

alter table veille.engine_settings enable row level security;

drop policy if exists engine_settings_service_role_all on veille.engine_settings;
create policy engine_settings_service_role_all
  on veille.engine_settings
  for all
  to service_role
  using (true)
  with check (true);

revoke all on veille.engine_settings from public, anon, authenticated;
grant select, update on veille.engine_settings to service_role;

-- ---------------------------------------------------------------------
-- 2. Miroir SQL de normalizeForCorrelation (CorrelationEngine.ts).
--
-- NFD + suppression des diacritiques n'est pas disponible nativement en
-- SQL sans l'extension "unaccent" (non installee sur ce projet a ce
-- jour). Plutot que d'installer une nouvelle extension pour un besoin
-- couvert par une simple table de translitteration (les caracteres
-- accentues rencontres dans ce jeu de donnees sont les diacritiques
-- latins courants du francais/UE), on utilise translate() : resultat
-- strictement equivalent a la version TypeScript pour toutes les
-- entrees reelles observees (noms d'entites, communes, regions
-- francaises et europeennes).
-- ---------------------------------------------------------------------
create or replace function veille.normalize_for_correlation(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select trim(both '-' from
    regexp_replace(
      lower(
        translate(
          coalesce(p_text, ''),
          'àâäáãåÀÂÄÁÃÅèéêëÈÉÊËìíîïÌÍÎÏòóôöõÒÓÔÖÕùúûüÙÚÛÜçÇñÑýÿÝ',
          'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  )
$$;

revoke all on function veille.normalize_for_correlation(text) from public, anon, authenticated;
grant execute on function veille.normalize_for_correlation(text) to postgres, service_role;

-- ---------------------------------------------------------------------
-- 3. Miroir SQL de generateCorrelationKey (CorrelationEngine.ts,
-- strategie B — Sprint 2.1, aucune fenetre temporelle). Retourne
-- uniquement la cle (le niveau de confiance n'est pas necessaire cote
-- SQL : la RPC process_alert_opportunity ne prend que la cle en entree).
-- ---------------------------------------------------------------------
create or replace function veille.generate_correlation_key(
  p_entreprise_id uuid,
  p_alerte_id uuid,
  p_entite_cible text,
  p_type_opportunite text,
  p_geographie text
) returns text
language plpgsql
immutable
set search_path = veille, pg_catalog, pg_temp
as $$
declare
  v_entite text := veille.normalize_for_correlation(p_entite_cible);
  v_type text := veille.normalize_for_correlation(p_type_opportunite);
  v_geo text := veille.normalize_for_correlation(p_geographie);
begin
  if length(v_entite) > 0 and length(v_type) > 0 and length(v_geo) > 0 then
    return p_entreprise_id::text || '|' || v_entite || '|' || v_type || '|' || v_geo;
  end if;

  return p_entreprise_id::text || '|alerte-' || p_alerte_id::text;
end;
$$;

revoke all on function veille.generate_correlation_key(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function veille.generate_correlation_key(uuid, uuid, text, text, text) to postgres, service_role;

-- ---------------------------------------------------------------------
-- 4. Fonction trigger : point d'integration automatique (Phase 2/3).
--
-- SECURITY DEFINER (justification Phase 7) : le pipeline de
-- collecte/analyse existant, EXTERNE a ce depot, ecrit directement dans
-- veille.pertinence_entreprise (aucun trigger ni Edge Function ne
-- realisait jusqu'ici cette connexion — verifie par audit, Phase 1).
-- Le role utilise par ce pipeline pour ecrire n'a et ne doit pas avoir
-- besoin du privilege EXECUTE sur process_alert_opportunity (reserve a
-- service_role/postgres, Sprint 2.1). SECURITY DEFINER permet au
-- trigger de s'executer avec les privileges de son proprietaire
-- (postgres, proprietaire de toutes les migrations) uniquement pour
-- cette action precise, sans jamais accorder ce privilege plus
-- largement et sans jamais exposer la cle service_role au frontend
-- (aucun changement frontend dans ce sprint). search_path fixe
-- explicitement (obligatoire pour toute fonction SECURITY DEFINER).
-- ---------------------------------------------------------------------
create or replace function veille.trg_process_pertinence_to_opportunity()
returns trigger
language plpgsql
security definer
set search_path = veille, pg_catalog, pg_temp
as $$
declare
  v_enabled boolean;
  v_alerte veille.alertes%rowtype;
  v_entite_cible text;
  v_type_opportunite text;
  v_geographie text;
  v_titre text;
  v_correlation_key text;
  v_decideur_ids uuid[];
begin
  -- Phase 4 : ne jamais traiter si le coupe-circuit automatique est
  -- desactive (par defaut : desactive).
  select opportunity_engine_enabled into v_enabled
  from veille.engine_settings where id = 1;

  if v_enabled is not true then
    return new;
  end if;

  -- Phase 4 : ne jamais traiter si la pertinence n'est pas (ou plus)
  -- "Actif" pour cette ligne au moment de l'evenement.
  if new.statut is distinct from 'Actif' then
    return new;
  end if;

  -- Phase 6 : le pipeline ne doit jamais etre interrompu. Toute
  -- exception rencontree pendant le traitement du moteur est journalisee
  -- (RAISE WARNING -> logs Postgres/Supabase existants, voir Phase 6 du
  -- rapport) SANS etre relevee : l'INSERT/UPDATE sur pertinence_entreprise
  -- aboutit toujours, quel que soit l'etat du moteur d'opportunites.
  begin
    -- Phase 4 : ne jamais traiter si l'alerte ou l'entreprise n'existent
    -- pas reellement (garde-fou supplementaire ; process_alert_opportunity
    -- l'impose deja, mais on evite ici un calcul de cle inutile).
    select * into v_alerte from veille.alertes where id = new.alerte_id;
    if not found then
      raise warning 'opportunity_engine: alerte % introuvable, traitement automatique ignore', new.alerte_id;
      return new;
    end if;

    if not exists (select 1 from veille.entreprises e where e.id = new.entreprise_id) then
      raise warning 'opportunity_engine: entreprise % introuvable, traitement automatique ignore', new.entreprise_id;
      return new;
    end if;

    -- Derivation des champs de correlation : identique, champ pour champ,
    -- a OpportunityEngineService.processAlertOpportunity (chemin manuel).
    v_entite_cible := nullif(trim(v_alerte.acteur_entite), '');
    v_type_opportunite := nullif(trim(coalesce(v_alerte.type_opportunite[1], '')), '');
    v_geographie := coalesce(
      nullif(trim(v_alerte.commune_collectivite), ''),
      nullif(trim(v_alerte.departement), ''),
      nullif(trim(v_alerte.region[1]), ''),
      nullif(trim(v_alerte.pays), '')
    );
    v_titre := coalesce(
      nullif(trim(v_alerte.name), ''),
      nullif(trim(v_alerte.resume), ''),
      nullif(trim(v_alerte.reference_officielle), ''),
      'Opportunité — ' || new.alerte_id::text
    );

    v_correlation_key := veille.generate_correlation_key(
      new.entreprise_id, new.alerte_id, v_entite_cible, v_type_opportunite, v_geographie
    );

    select coalesce(array_agg(ad.decideur_id), '{}')
    into v_decideur_ids
    from veille.alerte_decideurs ad
    where ad.alerte_id = new.alerte_id;

    -- Phase 3 / 5 : appel de l'UNIQUE mecanisme existant (Sprint 2),
    -- deja idempotent (contrainte unique entreprise_id+correlation_key +
    -- upsert). Aucun nouveau mecanisme d'idempotence cree.
    -- Phase 9 : ce chemin automatique s'arrete a "Opportunite creee ->
    -- Decideurs lies -> Preuves liees" : aucun sous-score d'adequation
    -- (7 dimensions, Sprint 2) n'est disponible automatiquement a partir
    -- des seules donnees du pipeline existant (score_pertinence est un
    -- jugement global, pas 7 dimensions distinctes) ; les 4 indicateurs
    -- (adequation/convergence/anticipation/priorite) restent donc NULL
    -- apres ce traitement automatique, a completer ensuite via le chemin
    -- manuel existant (Edge Function process-alert-opportunity,
    -- inchangee) des lors que de vrais sous-scores sont disponibles.
    perform veille.process_alert_opportunity(
      p_alerte_id => new.alerte_id,
      p_entreprise_id => new.entreprise_id,
      p_correlation_key => v_correlation_key,
      p_titre => v_titre,
      p_entite_cible => v_entite_cible,
      p_type_opportunite => v_type_opportunite,
      p_secteur => null,
      p_geographie => v_geographie,
      p_decideur_ids => v_decideur_ids,
      p_preuve_source => nullif(trim(v_alerte.reference_officielle), ''),
      p_preuve_citation => nullif(trim(v_alerte.resume), ''),
      p_preuve_url => nullif(trim(v_alerte.lien_source_url), '')
    );

  exception when others then
    -- Reprise ulterieure possible sans nouvelle infrastructure : la RPC
    -- appelee est idempotente (Sprint 2) ; un retraitement peut etre
    -- obtenu soit par un appel manuel identique a process_alert_opportunity,
    -- soit en repassant statut a une autre valeur puis de nouveau a
    -- 'Actif' (refait passer par ce meme trigger).
    raise warning 'opportunity_engine: echec traitement automatique alerte=% entreprise=% sqlstate=% erreur=%',
      new.alerte_id, new.entreprise_id, sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function veille.trg_process_pertinence_to_opportunity() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Declenchement automatique (Phase 3) : deux triggers AFTER, sans
-- aucune etape manuelle. Se declenchent exactement au moment ou
-- "l'alerte existe ET la pertinence entreprise est disponible" devient
-- vrai (Phase 2), quelle que soit la maniere dont la ligne est ecrite
-- (script du pipeline existant, ecriture manuelle, futur outil) :
--   - AFTER INSERT : nouvelle ligne de pertinence directement Actif.
--   - AFTER UPDATE OF statut : transition vers Actif (ex: ligne creee
--     Ecarte puis requalifiee Actif ensuite).
-- ---------------------------------------------------------------------
drop trigger if exists trg_pertinence_insert_process_opportunity on veille.pertinence_entreprise;
create trigger trg_pertinence_insert_process_opportunity
  after insert on veille.pertinence_entreprise
  for each row
  when (new.statut = 'Actif')
  execute function veille.trg_process_pertinence_to_opportunity();

drop trigger if exists trg_pertinence_update_process_opportunity on veille.pertinence_entreprise;
create trigger trg_pertinence_update_process_opportunity
  after update of statut on veille.pertinence_entreprise
  for each row
  when (new.statut = 'Actif' and old.statut is distinct from new.statut)
  execute function veille.trg_process_pertinence_to_opportunity();
