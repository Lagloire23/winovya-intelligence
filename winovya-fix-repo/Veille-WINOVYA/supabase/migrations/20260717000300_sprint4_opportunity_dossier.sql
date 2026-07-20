-- Sprint 4 — Enrichissement métier des dossiers d'opportunité.
--
-- Objectif : transformer une opportunité "technique" (Sprint 1-3 : titre,
-- correlation_key, scores, agrégats) en un dossier exploitable par un
-- commercial, sans toucher au moteur de corrélation ni à la RPC
-- transactionnelle existante.
--
-- Ce fichier n'ajoute :
--   - aucune IA, aucune API externe, aucun framework, aucune dépendance npm ;
--   - aucune modification de veille.process_alert_opportunity (Sprint 2/2.1) ;
--   - aucune modification de la clé de corrélation ni des triggers Sprint 3 ;
--   - aucune écriture dans opportunite_preuves / opportunite_decideurs
--     (ce sprint LIT ces tables pour les consolider, il n'y écrit jamais —
--     donc aucun risque de duplication de preuve/décideur).
--
-- Il ajoute uniquement :
--   1. Des colonnes additives sur veille.opportunites (dossier métier).
--   2. Une vue de lecture veille.opportunite_dossier (comptages live des
--      preuves/décideurs, jamais stockés en double).
--
-- Toute la LOGIQUE de calcul (fiabilité du budget, niveau de confiance,
-- raisons factuelles, résumé métier, statut d'enrichissement) vit côté
-- TypeScript pur (src/lib/opportunities/dossier/DossierEnrichmentService.ts),
-- pas en PL/pgSQL : contrairement au Sprint 2 (qui exigeait une garantie
-- transactionnelle d'atomicité pour un find-or-create concurrent), la
-- consolidation du dossier est une simple mise à jour d'une ligne déjà
-- existante, sans concurrence critique à arbitrer — écrire une nouvelle
-- fonction PL/pgSQL ici aurait ajouté un mirroir de logique métier sans
-- nécessité démontrée.

-- ---------------------------------------------------------------------
-- 1. Colonnes additives sur veille.opportunites
-- ---------------------------------------------------------------------

alter table veille.opportunites
  add column if not exists phase_projet text,
  add column if not exists budget_identifie numeric,
  add column if not exists budget_source text,
  add column if not exists budget_fiabilite text,
  add column if not exists budget_estime numeric,
  add column if not exists niveau_confiance text,
  add column if not exists statut_enrichissement text not null default 'pending',
  add column if not exists raisons jsonb not null default '[]'::jsonb,
  add column if not exists derniere_consolidation_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_phase_projet_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_phase_projet_check
      check (phase_projet is null or phase_projet in (
        'INTENTION', 'ETUDE', 'FONCIER', 'AUTORISATION',
        'RECRUTEMENT', 'CONSULTATION', 'ANNONCE', 'APPEL_OFFRES'
      ));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_budget_fiabilite_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_budget_fiabilite_check
      check (budget_fiabilite is null or budget_fiabilite in ('Officiel', 'Probable', 'À vérifier'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_niveau_confiance_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_niveau_confiance_check
      check (niveau_confiance is null or niveau_confiance in ('Élevé', 'Moyen', 'Faible'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_statut_enrichissement_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_statut_enrichissement_check
      check (statut_enrichissement in ('pending', 'partial', 'ready', 'failed'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_budget_identifie_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_budget_identifie_check
      check (budget_identifie is null or budget_identifie >= 0);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunites_budget_estime_check'
  ) then
    alter table veille.opportunites
      add constraint opportunites_budget_estime_check
      check (budget_estime is null or budget_estime >= 0);
  end if;
end $$;

comment on column veille.opportunites.phase_projet is
  'Sprint 4 : phase du projet (même vocabulaire que EtapeProjet côté TS). Peuplé UNIQUEMENT depuis score_details.anticipation.etapeProjet quand un scoring manuel a déjà eu lieu (Sprint 2). NULL sinon (donnée indisponible, jamais déduite par heuristique) — voir docs/opportunity-dossier.md §3.';
comment on column veille.opportunites.budget_identifie is
  'Sprint 4 : montant observé (alertes.montant) le plus récent parmi les alertes rattachées à cette opportunité qui en portent un. Donnée OBSERVÉE, jamais estimée.';
comment on column veille.opportunites.budget_source is
  'Sprint 4 : référence de l''alerte source du budget_identifie (reference_officielle, ou lien_source_url, ou name à défaut).';
comment on column veille.opportunites.budget_fiabilite is
  'Sprint 4 : fiabilité DÉDUITE du budget_identifie à partir de categorie_veille de son alerte source (voir docs/opportunity-dossier.md §3 pour la table de correspondance). NULL si aucun budget identifié.';
comment on column veille.opportunites.budget_estime is
  'Sprint 4 : réservé pour une estimation future (méthodologie non définie à ce jour). JAMAIS peuplé automatiquement par ce sprint — voir docs/opportunity-dossier.md §8 (aucun résumé/estimation fabriqué sans donnée réelle).';
comment on column veille.opportunites.niveau_confiance is
  'Sprint 4 : niveau de confiance global DÉDUIT de la confiance de corrélation (score_details.correlation.confidence, Sprint 2.1) et du nombre de signaux. Voir docs/opportunity-dossier.md §3.';
comment on column veille.opportunites.statut_enrichissement is
  'Sprint 4 : pending | partial | ready | failed. Règles de transition documentées dans docs/opportunity-dossier.md §4.';
comment on column veille.opportunites.raisons is
  'Sprint 4 : liste de raisons EXCLUSIVEMENT factuelles (jsonb array de strings), générées par des règles déterministes à partir de données déjà connues. Jamais de texte marketing, jamais de génération IA.';
comment on column veille.opportunites.derniere_consolidation_at is
  'Sprint 4 : horodatage du dernier passage du consolidateur de dossier (src/lib/opportunities/dossier). NULL tant qu''aucune consolidation n''a eu lieu (statut_enrichissement = pending).';

create index if not exists idx_opportunites_statut_enrichissement on veille.opportunites(statut_enrichissement);

-- ---------------------------------------------------------------------
-- 2. Vue de lecture consolidée : veille.opportunite_dossier
--
-- Pure lecture, aucune donnée stockée en double : nombre_preuves et
-- nombre_decideurs sont comptés à la volée depuis les tables de liaison
-- existantes (jamais un nouveau compteur stocké qui pourrait diverger).
-- security_invoker = true (PG >= 15) : la vue s'exécute avec les
-- privilèges de l'appelant, donc les policies RLS déjà en place sur
-- veille.opportunites / opportunite_preuves / opportunite_decideurs
-- s'appliquent normalement, sans bypass via le propriétaire de la vue.
-- ---------------------------------------------------------------------

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
  coalesce(dv.nombre_decideurs, 0) as nombre_decideurs
from veille.opportunites o
left join (
  select opportunite_id, count(*) as nombre_preuves
  from veille.opportunite_preuves
  group by opportunite_id
) pv on pv.opportunite_id = o.id
left join (
  select opportunite_id, count(*) as nombre_decideurs
  from veille.opportunite_decideurs
  group by opportunite_id
) dv on dv.opportunite_id = o.id;

comment on view veille.opportunite_dossier is
  'Sprint 4 : lecture consolidée du dossier d''opportunité (champs métier + comptages live de preuves/décideurs). Vue pure, aucune écriture, aucune donnée dupliquée. security_invoker = true : RLS des tables sources appliquée normalement.';

revoke all on veille.opportunite_dossier from public;
grant select on veille.opportunite_dossier to authenticated, service_role;
