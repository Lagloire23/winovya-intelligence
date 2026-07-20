
create schema if not exists veille;

create type veille.secteur_clients as enum ('Majoritairement privé','Majoritairement public','Mixte (public et privé)');

create type veille.categorie_veille as enum (
  '1. Documents administratifs','2. Presse locale','3. Maîtrise foncière','4. Urbanisme (compatibilité)',
  '5. Marchés publics & renouvellements','6. Délibérations','7. ICPE','8. Actualisation de données',
  '9. Arrêtés préfectoraux','10. Articles associations','11. Élus locaux','12. Budgets collectivités / investissements'
);

create type veille.priorite as enum ('Haute','Moyenne','Basse');
create type veille.score_pertinence as enum ('Très Haute','Haute','Moyenne','Basse','À confirmer');
create type veille.statut_alerte as enum ('NOUVEAU','ASSIGNE','TRAITE','ARCHIVE');
create type veille.statut_pertinence as enum ('Actif','Écarté');
create type veille.statut_client as enum ('Oui - client actif','Oui - client / référence passée','Non - prospect nouveau','À vérifier');
create type veille.nature_decideur as enum ('Public','Privé');
create type veille.statut_decideur as enum ('À jour','À revérifier','Introuvable sur le site officiel');
create type veille.role_achat as enum ('Utilisateur final / terrain','Décideur budgétaire (DAF/DSI/élu rapporteur)','Service marchés / achats','Dirigeant / représentant légal','Non catégorisé');
create type veille.profile_role as enum ('admin','member');

create table veille.entreprises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  competences text,
  references_clients text,
  status text not null default 'Actif',
  site_web text,
  description_courte text,
  secteurs_intervention text,
  zone_geographique text,
  mots_cles_metiers text,
  effectif_taille text,
  secteur_clients veille.secteur_clients,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table veille.decideurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table veille.alertes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  categorie_veille veille.categorie_veille,
  pays text not null default 'France',
  departement text,
  region text[],
  commune_collectivite text,
  date_publication date,
  date_detection timestamptz not null default now(),
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
  statut veille.statut_alerte not null default 'NOUVEAU',
  decideur_id uuid references veille.decideurs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table veille.alerte_decideurs (
  alerte_id uuid references veille.alertes(id) on delete cascade,
  decideur_id uuid references veille.decideurs(id) on delete cascade,
  primary key (alerte_id, decideur_id)
);

create table veille.attachments (
  id uuid primary key default gen_random_uuid(),
  alerte_id uuid references veille.alertes(id) on delete cascade,
  filename text,
  storage_path text,
  url text,
  created_at timestamptz not null default now()
);

create table veille.pertinence_entreprise (
  id uuid primary key default gen_random_uuid(),
  nom text,
  alerte_id uuid not null references veille.alertes(id) on delete cascade,
  entreprise_id uuid not null references veille.entreprises(id) on delete cascade,
  score_pertinence veille.score_pertinence,
  type_opportunite text[],
  lien_business text,
  statut veille.statut_pertinence not null default 'Actif',
  donneur_ordre_deja_client veille.statut_client,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alerte_id, entreprise_id)
);

create table veille.abonnements_alertes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nom text,
  entreprises_suivies uuid[],
  score_minimum veille.score_pertinence,
  types_opportunite_suivis text[],
  departements text[],
  regions text[],
  epci_suivis text[],
  communes_suivies text[],
  categories_veille_suivies text[],
  statut text not null default 'Actif',
  token_desinscription text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

create table veille.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role veille.profile_role not null default 'member',
  entreprise_id uuid references veille.entreprises(id),
  created_at timestamptz not null default now()
);
