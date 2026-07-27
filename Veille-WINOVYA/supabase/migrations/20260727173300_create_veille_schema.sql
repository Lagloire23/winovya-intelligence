-- Migration: Create veille schema with types and tables
-- This migration reproduces the V1 production schema structure into staging
-- Created: 2026-07-27

CREATE SCHEMA IF NOT EXISTS veille;

-- Create ENUM types
CREATE TYPE veille.secteur_clients AS ENUM ('Majoritairement privé', 'Majoritairement public', 'Mixte (public et privé)');
CREATE TYPE veille.nature_decideur AS ENUM ('Public', 'Privé');
CREATE TYPE veille.statut_decideur AS ENUM ('À jour', 'À revérifier', 'Introuvable sur le site officiel');
CREATE TYPE veille.role_achat AS ENUM ('Utilisateur final / terrain', 'Décideur budgétaire (DAF/DSI/élu rapporteur)', 'Service marchés / achats', 'Dirigeant / représentant légal', 'Non catégorisé');
CREATE TYPE veille.categorie_veille AS ENUM ('1. Documents administratifs', '2. Presse locale', '3. Maîtrise foncière', '4. Urbanisme (compatibilité)', '5. Marchés publics & renouvellements', '6. Délibérations', '7. ICPE', '8. Actualisation de données', '9. Arrêtés préfectoraux', '10. Articles associations', '11. Élus locaux', '12. Budgets collectivités / investissements');
CREATE TYPE veille.priorite AS ENUM ('Haute', 'Moyenne', 'Basse');
CREATE TYPE veille.statut_alerte AS ENUM ('NOUVEAU', 'ASSIGNE', 'TRAITE', 'ARCHIVE');
CREATE TYPE veille.score_pertinence AS ENUM ('Très Haute', 'Haute', 'Moyenne', 'Basse', 'À confirmer');
CREATE TYPE veille.statut_pertinence AS ENUM ('Actif', 'Écarté');
CREATE TYPE veille.statut_client AS ENUM ('Oui - client actif', 'Oui - client / référence passée', 'Non - prospect nouveau', 'À vérifier');
CREATE TYPE veille.profile_role AS ENUM ('admin', 'member');

-- Table: entreprises
CREATE TABLE IF NOT EXISTS veille.entreprises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  competences text,
  references_clients text,
  status text NOT NULL DEFAULT 'Actif',
  site_web text,
  description_courte text,
  secteurs_intervention text,
  zone_geographique text,
  mots_cles_metiers text,
  effectif_taille text,
  secteur_clients veille.secteur_clients,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  airtable_id text UNIQUE,
  onboarding_complete boolean DEFAULT false,
  pays text[] DEFAULT '{France}',
  regions_suivies text[],
  departements_suivis text[],
  types_opportunite_suivis text[]
);
ALTER TABLE veille.entreprises ENABLE ROW LEVEL SECURITY;

-- Table: decideurs
CREATE TABLE IF NOT EXISTS veille.decideurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  structure_entreprise text,
  nature veille.nature_decideur,
  type_structure text,
  departement text,
  region text[],
  nom_personne text,
  prenom_personne text,
  fonction_poste text,
  service_direction text,
  email text,
  telephone text,
  linkedin text,
  source_url text,
  date_capture date,
  statut veille.statut_decideur,
  notes text,
  document_organigramme_url text,
  organigramme_page_web text,
  role_achat veille.role_achat,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  airtable_id text UNIQUE
);
ALTER TABLE veille.decideurs ENABLE ROW LEVEL SECURITY;

-- Table: alertes
CREATE TABLE IF NOT EXISTS veille.alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  categorie_veille veille.categorie_veille,
  pays text NOT NULL DEFAULT 'France',
  departement text,
  region text[],
  commune_collectivite text,
  date_publication date,
  date_detection timestamptz NOT NULL DEFAULT now(),
  lien_source_url text,
  resume text,
  acteur_entite text,
  montant numeric,
  reference_officielle text,
  echeance_date_limite date,
  priorite veille.priorite,
  mots_cles text[],
  type_opportunite text[],
  contact_decideur_nom text,
  contact_decideur_fonction text,
  contact_decideur_email text,
  contact_decideur_telephone text,
  contact_decideur_linkedin text,
  notes_equipe text,
  assigne_email text,
  texte_extrait_document text,
  statut veille.statut_alerte NOT NULL DEFAULT 'NOUVEAU',
  decideur_id uuid REFERENCES veille.decideurs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  airtable_id text UNIQUE
);
ALTER TABLE veille.alertes ENABLE ROW LEVEL SECURITY;

-- Table: alerte_decideurs
CREATE TABLE IF NOT EXISTS veille.alerte_decideurs (
  alerte_id uuid NOT NULL REFERENCES veille.alertes(id),
  decideur_id uuid NOT NULL REFERENCES veille.decideurs(id),
  PRIMARY KEY (alerte_id, decideur_id)
);
ALTER TABLE veille.alerte_decideurs ENABLE ROW LEVEL SECURITY;

-- Table: attachments
CREATE TABLE IF NOT EXISTS veille.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerte_id uuid REFERENCES veille.alertes(id),
  filename text,
  storage_path text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE veille.attachments ENABLE ROW LEVEL SECURITY;

-- Table: pertinence_entreprise
CREATE TABLE IF NOT EXISTS veille.pertinence_entreprise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text,
  alerte_id uuid NOT NULL REFERENCES veille.alertes(id),
  entreprise_id uuid NOT NULL REFERENCES veille.entreprises(id),
  score_pertinence veille.score_pertinence,
  type_opportunite text[],
  lien_business text,
  statut veille.statut_pertinence NOT NULL DEFAULT 'Actif',
  donneur_ordre_deja_client veille.statut_client,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  airtable_id text UNIQUE
);
ALTER TABLE veille.pertinence_entreprise ENABLE ROW LEVEL SECURITY;

-- Table: abonnements_alertes
CREATE TABLE IF NOT EXISTS veille.abonnements_alertes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nom text,
  entreprises_suivies uuid[],
  score_minimum veille.score_pertinence,
  types_opportunite_suivis text[],
  departements text[],
  regions text[],
  epci_suivis text[],
  communes_suivies text[],
  categories_veille_suivies text[],
  statut text NOT NULL DEFAULT 'Actif',
  token_desinscription text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  airtable_id text UNIQUE
);
ALTER TABLE veille.abonnements_alertes ENABLE ROW LEVEL SECURITY;

-- Table: profiles
CREATE TABLE IF NOT EXISTS veille.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  role veille.profile_role NOT NULL DEFAULT 'member',
  entreprise_id uuid REFERENCES veille.entreprises(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_admin boolean DEFAULT false
);
ALTER TABLE veille.profiles ENABLE ROW LEVEL SECURITY;

-- Table: documents_urbanisme
CREATE TABLE IF NOT EXISTS veille.documents_urbanisme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_collectivite text NOT NULL,
  code_insee text,
  departement text,
  region text[],
  type_document text,
  reference_officielle text UNIQUE,
  titre_document text,
  date_publication date,
  date_detection timestamptz DEFAULT now(),
  date_approbaison date,
  lien_source_url text,
  source_geoportail boolean DEFAULT true,
  resume text,
  mots_cles text[],
  texte_extrait text,
  alerte_id uuid REFERENCES veille.alertes(id),
  secteurs_industriels text[],
  enjeux_environnementaux text[],
  statut text DEFAULT 'NOUVEAU',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE veille.documents_urbanisme ENABLE ROW LEVEL SECURITY;
