
-- Table d'historique des runs de veille
CREATE TABLE IF NOT EXISTS veille_ofgl_runs (
  id SERIAL PRIMARY KEY,
  run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_run_date TIMESTAMP WITH TIME ZONE,
  collectivites_prospectees INT DEFAULT 0,
  postes_detectes INT DEFAULT 0,
  alertes_creees INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'running',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des collectivités détectées
CREATE TABLE IF NOT EXISTS collectivites_detectees (
  id SERIAL PRIMARY KEY,
  veille_run_id INT REFERENCES veille_ofgl_runs(id),
  code_insee VARCHAR(50) UNIQUE,
  nom_collectivite VARCHAR(255) NOT NULL,
  type_collectivite VARCHAR(100),
  region VARCHAR(100),
  geographie JSONB,
  budget_total NUMERIC(15,2),
  budget_secteur NUMERIC(15,2),
  annee_budget INT,
  source_donnees VARCHAR(255),
  url_source TEXT,
  date_detection TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des postes budgétaires identifiés
CREATE TABLE IF NOT EXISTS postes_budgetaires (
  id SERIAL PRIMARY KEY,
  collectivite_id INT REFERENCES collectivites_detectees(id),
  veille_run_id INT REFERENCES veille_ofgl_runs(id),
  secteur VARCHAR(100) NOT NULL,
  type_investissement VARCHAR(100),
  description TEXT,
  montant NUMERIC(15,2),
  type_depense VARCHAR(50),
  calendrier_previsionnel TEXT,
  details_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des alertes et scoring de pertinence
CREATE TABLE IF NOT EXISTS alertes_opportunites (
  id SERIAL PRIMARY KEY,
  poste_id INT REFERENCES postes_budgetaires(id),
  collectivite_id INT REFERENCES collectivites_detectees(id),
  veille_run_id INT REFERENCES veille_ofgl_runs(id),
  type_opportunite VARCHAR(100),
  probabilite_appel_offres VARCHAR(50),
  score_pertinence DECIMAL(3,1),
  descriptif_alerte TEXT,
  contact_deciseur VARCHAR(255),
  fonction_deciseur VARCHAR(100),
  date_alerte TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  statut_suivi VARCHAR(50),
  notes_suivi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_collectivites_region ON collectivites_detectees(region);
CREATE INDEX idx_collectivites_type ON collectivites_detectees(type_collectivite);
CREATE INDEX idx_postes_secteur ON postes_budgetaires(secteur);
CREATE INDEX idx_alertes_pertinence ON alertes_opportunites(score_pertinence DESC);
CREATE INDEX idx_veille_runs_date ON veille_ofgl_runs(run_date DESC);
