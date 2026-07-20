-- Sprint 2 — Backend déterministe du moteur d'opportunités
-- Migration additive uniquement : complète veille.opportunites avec les
-- champs de corrélation et de scoring. Aucune colonne Sprint 1 modifiée
-- ou supprimée. Aucune autre table touchée par cette migration.
--
-- Mapping des champs sources (audit Phase 1, schéma réel Staging) :
--   - entite_cible      <- veille.alertes.acteur_entite (fallback: metadata explicite fournie à l'appel)
--   - type_opportunite  <- veille.alertes.type_opportunite (text[], réduit à une valeur canonique)
--   - secteur           <- fourni explicitement par l'appelant (aucune colonne "secteur" sur alertes ;
--                          categorie_veille n'est pas un proxy fiable, donc pas d'auto-dérivation)
--   - geographie        <- veille.alertes.commune_collectivite / departement / region / pays (1er non nul)
--   - date du signal    <- veille.alertes.date_detection (not null, toujours fiable, contrairement à date_publication)
--   - lien source       <- veille.alertes.lien_source_url
--   - niveau de pertinence <- veille.pertinence_entreprise.score_pertinence (couple alerte_id/entreprise_id)
--   - décideurs associés   <- veille.alerte_decideurs (table de liaison déjà existante)
--
-- Aucun champ indispensable manquant identifié : tout ce qui est nécessaire
-- existe déjà sur alertes/entreprises/decideurs/pertinence_entreprise.
-- Aucune migration additive sur ces tables n'est donc nécessaire.

alter table veille.opportunites
  add column correlation_key text,
  add column entite_cible text,
  add column type_opportunite text,
  add column secteur text,
  add column geographie text,
  add column adequation_score numeric,
  add column convergence_score numeric,
  add column anticipation_score numeric,
  add column priorite_score numeric,
  add column score_details jsonb,
  add column score_version text,
  add column nombre_signaux integer not null default 0,
  add column date_premier_signal timestamptz,
  add column date_dernier_signal timestamptz,
  add column last_processed_at timestamptz;

comment on column veille.opportunites.correlation_key is
  'Clé déterministe de corrélation (Sprint 2). Toujours générée par le moteur ; jamais NULL en pratique, mais colonne nullable par prudence de schéma.';
comment on column veille.opportunites.score_details is
  'Détail JSON des 7 sous-scores d''adéquation + métadonnées de corrélation (score_version, confidence). Voir docs/opportunity-engine.md.';
comment on column veille.opportunites.nombre_signaux is
  'Recalculé depuis le COUNT réel de opportunite_alertes à chaque traitement — jamais incrémenté manuellement.';

-- Contraintes : scores bornés 0-100, compteur non négatif.
alter table veille.opportunites
  add constraint opportunites_adequation_score_range
    check (adequation_score is null or (adequation_score >= 0 and adequation_score <= 100)),
  add constraint opportunites_convergence_score_range
    check (convergence_score is null or (convergence_score >= 0 and convergence_score <= 100)),
  add constraint opportunites_anticipation_score_range
    check (anticipation_score is null or (anticipation_score >= 0 and anticipation_score <= 100)),
  add constraint opportunites_priorite_score_range
    check (priorite_score is null or (priorite_score >= 0 and priorite_score <= 100)),
  add constraint opportunites_nombre_signaux_non_negative
    check (nombre_signaux >= 0);

-- Unicité partielle : une seule opportunité par (entreprise, correlation_key)
-- quand la clé est renseignée. Permet ON CONFLICT ciblé depuis la fonction
-- de traitement (Sprint 2, phase 7 - idempotence).
create unique index opportunites_entreprise_correlation_key_key
  on veille.opportunites (entreprise_id, correlation_key)
  where correlation_key is not null;

-- Index de consultation / tri
create index idx_opportunites_correlation_key on veille.opportunites (correlation_key);
create index idx_opportunites_priorite_score on veille.opportunites (priorite_score desc nulls last);
create index idx_opportunites_date_dernier_signal on veille.opportunites (date_dernier_signal desc nulls last);
