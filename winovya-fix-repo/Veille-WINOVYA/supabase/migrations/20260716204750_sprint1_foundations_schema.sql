
-- Sprint 1 — Fondations du moteur d'Opportunités (version réduite)
--
-- Uniquement les structures nécessaires au futur moteur : aucune
-- intelligence métier, aucun calcul, aucune corrélation, aucune
-- détection. Additif uniquement, rien d'existant n'est modifié.
--
-- 4 tables seulement, conformément au périmètre validé :
--   opportunites, opportunite_alertes, opportunite_decideurs,
--   opportunite_preuves.
-- (comptes_strategiques est explicitement hors périmètre de ce sprint.)

create type veille.statut_opportunite as enum (
  'NEW',
  'QUALIFIED',
  'IN_PROGRESS',
  'WON',
  'LOST',
  'ARCHIVED'
);

-- 1. opportunites ----------------------------------------------------------

create table veille.opportunites (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  resume text,
  description text,
  statut veille.statut_opportunite not null default 'NEW',
  entreprise_id uuid not null references veille.entreprises(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table veille.opportunites is
  'Sprint 1 foundation: structural table only. No scoring, no correlation logic yet.';

-- 2. opportunite_alertes (N-N) ----------------------------------------------

create table veille.opportunite_alertes (
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  alerte_id uuid not null references veille.alertes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunite_id, alerte_id)
);

comment on table veille.opportunite_alertes is
  'N-N link: which alertes are attached to a given opportunite.';

-- 3. opportunite_decideurs (N-N) ---------------------------------------------

create table veille.opportunite_decideurs (
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  decideur_id uuid not null references veille.decideurs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (opportunite_id, decideur_id)
);

comment on table veille.opportunite_decideurs is
  'N-N link: which decideurs are attached to a given opportunite.';

-- 4. opportunite_preuves -------------------------------------------------------

create table veille.opportunite_preuves (
  id uuid primary key default gen_random_uuid(),
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  source text,
  citation text,
  url text,
  created_at timestamptz not null default now()
);

comment on table veille.opportunite_preuves is
  'Evidence trail for an opportunite (structural only, Sprint 1).';

-- Indexes ------------------------------------------------------------------

create index idx_opportunites_entreprise on veille.opportunites(entreprise_id);
create index idx_opportunites_statut on veille.opportunites(statut);

create index idx_opportunite_alertes_opportunite on veille.opportunite_alertes(opportunite_id);
create index idx_opportunite_alertes_alerte on veille.opportunite_alertes(alerte_id);

create index idx_opportunite_decideurs_opportunite on veille.opportunite_decideurs(opportunite_id);
create index idx_opportunite_decideurs_decideur on veille.opportunite_decideurs(decideur_id);

create index idx_opportunite_preuves_opportunite on veille.opportunite_preuves(opportunite_id);
