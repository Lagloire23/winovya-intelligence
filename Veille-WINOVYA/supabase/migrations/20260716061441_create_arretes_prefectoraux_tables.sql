
-- Création de la table principale pour les arrêtés préfectoraux
CREATE TABLE IF NOT EXISTS public.arretes_prefectoraux (
  id SERIAL PRIMARY KEY,
  run_id INTEGER,
  numero_raa VARCHAR(255) NOT NULL,
  date_publication TIMESTAMP WITH TIME ZONE NOT NULL,
  date_signature TIMESTAMP WITH TIME ZONE,
  type_arrete VARCHAR(100) NOT NULL,
  titre TEXT NOT NULL,
  resume TEXT,
  secteur VARCHAR(100),
  localisation_commune VARCHAR(255),
  localisation_departement VARCHAR(100),
  localisation_region VARCHAR(100),
  nature_mesure TEXT,
  prefet_signataire VARCHAR(255),
  structure_responsable VARCHAR(255),
  url_source TEXT,
  url_pdf TEXT,
  contenu_pdf TEXT,
  score_pertinence VARCHAR(20),
  impact_business VARCHAR(50),
  fenetre_temporelle VARCHAR(50),
  status_traitement VARCHAR(50) DEFAULT 'nouveau',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  geographie JSONB
);

-- Création de la table de liaison pour les entreprises concernées
CREATE TABLE IF NOT EXISTS public.arretes_entreprises_concernees (
  id SERIAL PRIMARY KEY,
  arrete_id INTEGER NOT NULL REFERENCES public.arretes_prefectoraux(id) ON DELETE CASCADE,
  nom_entreprise VARCHAR(255) NOT NULL,
  siret VARCHAR(20),
  secteur_activite VARCHAR(100),
  commune VARCHAR(255),
  type_structure VARCHAR(50),
  impact_conformite TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour tracker les runs de collecte RAA
CREATE TABLE IF NOT EXISTS public.veille_raa_runs (
  id SERIAL PRIMARY KEY,
  run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fenetre_temporelle VARCHAR(50) NOT NULL,
  departements_prospectes INTEGER,
  arretes_detectes INTEGER,
  alertes_creees INTEGER,
  status VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_arretes_date_publication ON public.arretes_prefectoraux(date_publication DESC);
CREATE INDEX IF NOT EXISTS idx_arretes_secteur ON public.arretes_prefectoraux(secteur);
CREATE INDEX IF NOT EXISTS idx_arretes_departement ON public.arretes_prefectoraux(localisation_departement);
CREATE INDEX IF NOT EXISTS idx_arretes_type ON public.arretes_prefectoraux(type_arrete);
CREATE INDEX IF NOT EXISTS idx_entreprises_arrete ON public.arretes_entreprises_concernees(arrete_id);
