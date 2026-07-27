-- Migration: Create veille_v2 schema with all required tables
-- V2 early opportunity detection system
-- Created: 2026-07-27

CREATE SCHEMA IF NOT EXISTS veille_v2;

-- Enumerated types for V2
CREATE TYPE veille_v2.collection_status AS ENUM ('pending', 'processing', 'success', 'error', 'incomplete');
CREATE TYPE veille_v2.candidate_destination AS ENUM ('reprise_doublon', 'contexte_transversal', 'signal_isole', 'rattache_dossier', 'nouveau_dossier', 'contradiction_dossier', 'consultation_tardive', 'a_revoir_humainement');
CREATE TYPE veille_v2.fact_certainty AS ENUM ('observé', 'déduit', 'inconnu');
CREATE TYPE veille_v2.document_extraction_status AS ENUM ('texte_natif_extrait', 'ocr_extrait', 'ocr_qualite_insuffisante', 'document_inaccessible', 'document_non_correspondant', 'document_a_retraiter');
CREATE TYPE veille_v2.opportunity_status AS ENUM ('signal_isole', 'dossier_de_signaux', 'opportunite_candidate', 'validation_proposee', 'confirmation_proposee');
CREATE TYPE veille_v2.project_phase AS ENUM ('intention_stratégique', 'étude_faisabilité', 'recherche_foncière', 'programmation_financement', 'autorisations_permitting', 'conception_préparation', 'consultation_imminente', 'consultation_publiée', 'attribution', 'exécution', 'extension_phase_suivante');
CREATE TYPE veille_v2.commercial_window AS ENUM ('très_précoce', 'précoce', 'intermédiaire', 'imminente', 'tardive');

-- System Configuration
CREATE TABLE IF NOT EXISTS veille_v2.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  status text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Collection management
CREATE TABLE IF NOT EXISTS veille_v2.collecte_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code text,
  run_status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  candidates_count integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  summary jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.collecte_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES veille_v2.collecte_runs(id),
  agent_code text NOT NULL,
  source_url text,
  canonical_url text UNIQUE,
  source_domain text,
  source_title text,
  source_publisher text,
  source_type text,
  publication_date date,
  detection_date timestamptz,
  retrieved_at timestamptz,
  actor_raw text,
  site_raw text,
  country text,
  region_raw text,
  department_raw text,
  city_raw text,
  project_nature_raw text,
  technical_object_raw text,
  summary_raw text,
  source_reference text UNIQUE,
  document_urls text[],
  content_hash text,
  raw_content text,
  collection_status veille_v2.collection_status DEFAULT 'pending',
  collection_errors text[],
  destination veille_v2.candidate_destination,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Documents & Text Extraction
CREATE TABLE IF NOT EXISTS veille_v2.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url text,
  filename text,
  content_hash text UNIQUE NOT NULL,
  file_size_bytes integer,
  mime_type text,
  page_count integer,
  extraction_status veille_v2.document_extraction_status DEFAULT 'document_a_retraiter',
  extraction_method text,
  extraction_quality_score numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.document_textes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES veille_v2.documents(id),
  full_text text,
  text_quality_score numeric,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.documents_hash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text UNIQUE,
  document_id uuid REFERENCES veille_v2.documents(id),
  first_seen_at timestamptz DEFAULT now()
);

-- Entity & Normalization
CREATE TABLE IF NOT EXISTS veille_v2.entites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_raw text NOT NULL,
  name_normalized text,
  entity_type text,
  siren text,
  siret text,
  aiot text,
  official_website text,
  group_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.etablissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entite_id uuid NOT NULL REFERENCES veille_v2.entites(id),
  name text,
  address text,
  postal_code text,
  city text,
  siret text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid REFERENCES veille_v2.etablissements(id),
  name text,
  address text,
  postal_code text,
  city text,
  department text,
  region text,
  country text,
  gps_coordinates geometry,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.identifiants_projet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(identifier_type, identifier_value)
);

-- Facts & Evidence
CREATE TABLE IF NOT EXISTS veille_v2.faits_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid,
  source_text text NOT NULL,
  fact_statement text NOT NULL,
  certainty_level veille_v2.fact_certainty DEFAULT 'inconnu',
  original_producer text,
  producer_type text,
  fact_category text,
  associated_identifiers uuid[],
  actor_id uuid REFERENCES veille_v2.entites(id),
  site_id uuid REFERENCES veille_v2.sites(id),
  quantitative_value numeric,
  quantitative_unit text,
  associated_date date,
  causal_relationships jsonb,
  contradictions_noted text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.fait_source_publications (
  fait_id uuid NOT NULL REFERENCES veille_v2.faits_sources(id),
  document_id uuid NOT NULL REFERENCES veille_v2.documents(id),
  passage_excerpt text,
  PRIMARY KEY (fait_id, document_id)
);

CREATE TABLE IF NOT EXISTS veille_v2.source_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_producer text NOT NULL,
  producer_type text,
  publication_date date,
  independent_count integer DEFAULT 1,
  reprints_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.contradictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid,
  fact_1_id uuid REFERENCES veille_v2.faits_sources(id),
  fact_2_id uuid REFERENCES veille_v2.faits_sources(id),
  contradiction_type text,
  resolution_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Dossiers & Signals
CREATE TABLE IF NOT EXISTS veille_v2.dossiers_signaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_identifier text,
  actor_id uuid REFERENCES veille_v2.entites(id),
  main_site_id uuid REFERENCES veille_v2.sites(id),
  project_nature text,
  technical_object text,
  project_phase veille_v2.project_phase,
  convergence_score integer DEFAULT 0,
  convergence_details jsonb,
  status veille_v2.opportunity_status DEFAULT 'signal_isole',
  estimated_consultation_date_min date,
  estimated_consultation_date_max date,
  commercial_window veille_v2.commercial_window,
  first_signal_date date,
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.dossier_faits (
  dossier_id uuid NOT NULL REFERENCES veille_v2.dossiers_signaux(id),
  fait_id uuid NOT NULL REFERENCES veille_v2.faits_sources(id),
  PRIMARY KEY (dossier_id, fait_id)
);

CREATE TABLE IF NOT EXISTS veille_v2.dossier_alertes (
  dossier_id uuid NOT NULL REFERENCES veille_v2.dossiers_signaux(id),
  alerte_id uuid NOT NULL,
  PRIMARY KEY (dossier_id, alerte_id)
);

-- Opportunities
CREATE TABLE IF NOT EXISTS veille_v2.opportunites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES veille_v2.dossiers_signaux(id),
  name text NOT NULL,
  description text,
  status veille_v2.opportunity_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.opportunite_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id uuid NOT NULL REFERENCES veille_v2.opportunites(id),
  convergence_score integer,
  convergence_details jsonb,
  score_timestamp timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.opportunite_score_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id uuid NOT NULL REFERENCES veille_v2.opportunite_scores(id),
  criteria text,
  points_awarded integer,
  max_points integer,
  justification text
);

CREATE TABLE IF NOT EXISTS veille_v2.opportunite_evenements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id uuid NOT NULL REFERENCES veille_v2.opportunites(id),
  event_type text,
  event_date date,
  event_description text,
  created_at timestamptz DEFAULT now()
);

-- Company Match & Adequacy
CREATE TABLE IF NOT EXISTS veille_v2.opportunite_entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id uuid NOT NULL REFERENCES veille_v2.opportunites(id),
  entreprise_id uuid NOT NULL,
  adequacy_score integer,
  adequacy_details jsonb,
  visibility_granted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(opportunite_id, entreprise_id)
);

CREATE TABLE IF NOT EXISTS veille_v2.score_adequation_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_entreprise_id uuid NOT NULL REFERENCES veille_v2.opportunite_entreprises(id),
  criteria text,
  points_awarded integer,
  max_points integer,
  company_profile_element text,
  project_fact text,
  justification text
);

-- Decision-makers
CREATE TABLE IF NOT EXISTS veille_v2.opportunite_decideurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id uuid NOT NULL REFERENCES veille_v2.opportunites(id),
  nom_personne text,
  prenom_personne text,
  fonction_poste text,
  email text,
  telephone text,
  linkedin text,
  source_url text,
  verification_date date,
  confidence_level text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Commercial Actions & Validation
CREATE TABLE IF NOT EXISTS veille_v2.actions_commerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_entreprise_id uuid NOT NULL REFERENCES veille_v2.opportunite_entreprises(id),
  probable_need text,
  solutions_offered text,
  competency_mobilized text,
  comparable_reference text,
  urgency_reasoning text,
  recommended_action text,
  target_role text,
  qualification_questions text[],
  missing_information text,
  risks_and_reservations text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veille_v2.validations_humaines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  validation_reason text,
  status text DEFAULT 'pending',
  assigned_to text,
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_collecte_candidates_run_id ON veille_v2.collecte_candidates(run_id);
CREATE INDEX IF NOT EXISTS idx_collecte_candidates_canonical_url ON veille_v2.collecte_candidates(canonical_url);
CREATE INDEX IF NOT EXISTS idx_collecte_candidates_destination ON veille_v2.collecte_candidates(destination);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON veille_v2.documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_faits_sources_dossier_id ON veille_v2.faits_sources(dossier_id);
CREATE INDEX IF NOT EXISTS idx_faits_sources_actor_id ON veille_v2.faits_sources(actor_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_signaux_status ON veille_v2.dossiers_signaux(status);
CREATE INDEX IF NOT EXISTS idx_dossiers_signaux_convergence ON veille_v2.dossiers_signaux(convergence_score);
CREATE INDEX IF NOT EXISTS idx_opportunites_status ON veille_v2.opportunites(status);
CREATE INDEX IF NOT EXISTS idx_opportunite_entreprises_visibility ON veille_v2.opportunite_entreprises(visibility_granted);

-- Enable RLS
ALTER TABLE veille_v2.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.collecte_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.collecte_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.document_textes ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.faits_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.fait_source_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.dossiers_signaux ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.opportunites ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.opportunite_entreprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.opportunite_decideurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.actions_commerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE veille_v2.validations_humaines ENABLE ROW LEVEL SECURITY;
