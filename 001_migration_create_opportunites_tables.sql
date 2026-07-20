-- ============================================================================
-- MIGRATION #001: Créer tables opportunites, phases_projet, pertinence
-- ============================================================================
-- Date: 2026-07-19
-- Purpose: Refonte modèle phases précoces + clustering IA opportunités
-- Description:
--   - Table opportunites: regroupement d'alertes par projet
--   - Table phases_projet: phases détectées (macro→foncier→autorisation→etc)
--   - Table opportunite_pertinence_entreprise: scoring nouveau modèle
--   - Table entreprise_offres: catalogue services chaque entreprise
--   - Column offres_services: JSONB dans entreprises
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ENUMS NOUVEAUX
-- ============================================================================

-- Scoring d'opportunité (remplace probabilité % du modèle ancien)
CREATE TYPE veille.scoring_opportunite AS ENUM (
  'Très haute',
  'Haute',
  'Moyenne',
  'Basse',
  'À confirmer'
);

-- Phase du projet (générique, adaptable)
CREATE TYPE veille.phase_type AS ENUM (
  'Signaux macro/politiques',
  'Intentions stratégiques',
  'Acquisitions foncières',
  'Études/autorisations pré-démarrage',
  'Recrutements clés',
  'Appels d''offres publics',
  'Annonce officielle',
  'Besoin politique identifié',
  'Budget voté/budgétisé',
  'Consultation fournisseurs',
  'Changement signalé ICPE',
  'Dossier déposé/Enquête annoncée',
  'Enquête publique active',
  'Arrêté modifié',
  'Mise en conformité',
  'Appel à projets lancé',
  'Deadline candidature',
  'Sélection annoncée',
  'Partenariat signé',
  'Mise en œuvre',
  'Modernisation annoncée',
  'Études de faisabilité',
  'Autorisations obtenues',
  'Travaux lancés',
  'Mise en service',
  'Obligation réglementaire détectée',
  'Audit/Étude lancée',
  'Plan de conformité',
  'Marché de conformité',
  'À évaluer'
);

-- Pattern de projet (type d'opportunité macro)
CREATE TYPE veille.pattern_type AS ENUM (
  'A_expansion_industrielle',
  'B_marches_publics_collectivites',
  'C_icpe_conformite',
  'D_partenariat_rd_innovation',
  'E_extension_site',
  'F_conformite_transition_ecologique'
);

-- ============================================================================
-- 2. TABLE opportunites (maîtresse)
-- ============================================================================

CREATE TABLE veille.opportunites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiant du projet
  nom TEXT NOT NULL UNIQUE,                        -- ex: "Gigafactory AESC Douai"
  acteur_entite TEXT NOT NULL,                     -- ex: "AESC (Nissan)"
  pattern_type veille.pattern_type NOT NULL,       -- ex: A_expansion_industrielle

  -- Localisation
  commune_collectivite TEXT,
  departement TEXT,
  region TEXT[],
  pays TEXT DEFAULT 'France',

  -- Opportunités liées
  type_opportunite TEXT[] NOT NULL DEFAULT '{}',   -- agrégé des alertes
  mots_cles TEXT[] DEFAULT '{}',

  -- Scoring & Phase
  phase_detectee veille.phase_type,                -- dernière phase observée
  scoring_global veille.scoring_opportunite NOT NULL DEFAULT 'À confirmer',
  justification_scoring TEXT,                      -- ex: "Foncier acquis, permis en cours, recrutements..."

  -- Alertes liées
  alerte_ids UUID[] DEFAULT '{}',                  -- ARRAY des alertes regroupées
  nb_alertes INT DEFAULT 0,                        -- count pour requêtes rapides

  -- Timeline
  date_premiere_alerte DATE,
  date_derniere_alerte DATE,
  date_detection_premiere TIMESTAMP DEFAULT now(),
  date_detection_derniere TIMESTAMP,

  -- Métadonnées
  statut VARCHAR(20) DEFAULT 'NOUVEAU' CHECK (statut IN ('NOUVEAU', 'ASSIGNE', 'TRAITE', 'ARCHIVE')),
  notes TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_project CHECK (
    -- Garantir qu'on n'a pas un doublon (même acteur + localité + pattern)
    (acteur_entite, COALESCE(commune_collectivite, ''), pattern_type) IS NOT NULL
  )
);

CREATE INDEX idx_opportunites_acteur_entite ON veille.opportunites(acteur_entite);
CREATE INDEX idx_opportunites_pattern_type ON veille.opportunites(pattern_type);
CREATE INDEX idx_opportunites_scoring ON veille.opportunites(scoring_global);
CREATE INDEX idx_opportunites_phase ON veille.opportunites(phase_detectee);
CREATE INDEX idx_opportunites_statut ON veille.opportunites(statut);

-- ============================================================================
-- 3. TABLE phases_projet (phases détectées — 1:N avec opportunites)
-- ============================================================================

CREATE TABLE veille.phases_projet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id UUID NOT NULL REFERENCES veille.opportunites(id) ON DELETE CASCADE,

  -- Phase détectée
  phase_type veille.phase_type NOT NULL,
  phase_niveau_maturity INT CHECK (phase_niveau_maturity BETWEEN 1 AND 7),  -- 1=macro...7=annonce

  -- Source de détection
  alerte_id UUID REFERENCES veille.alertes(id) ON DELETE SET NULL,          -- alerte qui a révélé cette phase
  detected_date DATE,

  -- Confiance
  confidence INT CHECK (confidence BETWEEN 0 AND 100),

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),

  -- Contrainte: une seule occurrence par (opportunite, phase)
  CONSTRAINT unique_phase_per_opportunity UNIQUE(opportunite_id, phase_type)
);

CREATE INDEX idx_phases_projet_opportunite_id ON veille.phases_projet(opportunite_id);
CREATE INDEX idx_phases_projet_phase_type ON veille.phases_projet(phase_type);
CREATE INDEX idx_phases_projet_detected_date ON veille.phases_projet(detected_date);

-- ============================================================================
-- 4. TABLE opportunite_pertinence_entreprise (scoring par entreprise)
-- ============================================================================

CREATE TABLE veille.opportunite_pertinence_entreprise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunite_id UUID NOT NULL REFERENCES veille.opportunites(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES veille.entreprises(id) ON DELETE CASCADE,

  -- Identifiant
  nom TEXT,                                        -- "{Entreprise} — {Opportunité}"

  -- Scoring
  score_global veille.scoring_opportunite NOT NULL DEFAULT 'À confirmer',
  phase_maturity INT CHECK (phase_maturity BETWEEN 1 AND 7),               -- stade du projet

  -- Services pertinents
  offres_recommandees TEXT[],                      -- IDs ou noms des services Ekium/Cetim applicables
  lien_business TEXT NOT NULL,                     -- 2-4 phrases: compétence + besoin + client status

  -- Statut client
  donneur_ordre_deja_client veille.statut_client,  -- Oui/Non/À vérifier

  -- Métadonnées
  statut VARCHAR(20) DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Écarté')),
  notes TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_opp_ent UNIQUE(opportunite_id, entreprise_id)
);

CREATE INDEX idx_opp_pertinence_opportunite_id ON veille.opportunite_pertinence_entreprise(opportunite_id);
CREATE INDEX idx_opp_pertinence_entreprise_id ON veille.opportunite_pertinence_entreprise(entreprise_id);
CREATE INDEX idx_opp_pertinence_score ON veille.opportunite_pertinence_entreprise(score_global);

-- ============================================================================
-- 5. TABLE entreprise_offres (catalogue services)
-- ============================================================================

CREATE TABLE veille.entreprise_offres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entreprise_id UUID NOT NULL REFERENCES veille.entreprises(id) ON DELETE CASCADE,

  -- Identifiant unique de l'offre
  code_offre TEXT NOT NULL,                        -- ex: "ekium-engineering-construction"

  -- Description
  nom_offre TEXT NOT NULL,                         -- ex: "Ingénierie construction d'usine"
  description TEXT,
  mots_cles TEXT[],

  -- Mapping opportunités
  type_opportunite_applicables TEXT[] NOT NULL DEFAULT '{}',
  -- ex: ["Nouvelle implantation industrielle", "Extension site existant"]

  -- Prix/Modèle
  modele_tarification TEXT,                        -- ex: "TJM", "Forfait", "Pourcentage investissement"

  -- Métadonnées
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT unique_code_per_entreprise UNIQUE(entreprise_id, code_offre)
);

CREATE INDEX idx_entreprise_offres_entreprise_id ON veille.entreprise_offres(entreprise_id);

-- ============================================================================
-- 6. MODIFIER TABLE entreprises (ajouter colonne offres_services)
-- ============================================================================

ALTER TABLE veille.entreprises
ADD COLUMN IF NOT EXISTS offres_services JSONB COMMENT 'Catalogue services en format JSON {offres: [{id, nom, description, mots_cles, types_opportunite_applicables}]}';

-- ============================================================================
-- 7. TRIGGERS pour updated_at automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION veille.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_opportunites_updated_at BEFORE UPDATE ON veille.opportunites
  FOR EACH ROW EXECUTE FUNCTION veille.update_updated_at_column();

CREATE TRIGGER update_opp_pertinence_updated_at BEFORE UPDATE ON veille.opportunite_pertinence_entreprise
  FOR EACH ROW EXECUTE FUNCTION veille.update_updated_at_column();

CREATE TRIGGER update_entreprise_offres_updated_at BEFORE UPDATE ON veille.entreprise_offres
  FOR EACH ROW EXECUTE FUNCTION veille.update_updated_at_column();

-- ============================================================================
-- 8. FONCTION HELPER: déterminer pattern_type à partir de type_opportunite
-- ============================================================================

CREATE OR REPLACE FUNCTION veille.infer_pattern_type(type_opportunite TEXT[])
RETURNS veille.pattern_type AS $$
DECLARE
  pattern veille.pattern_type;
BEGIN
  -- Pattern A: Construction/Expansion industrielle
  IF type_opportunite && ARRAY['Nouvelle implantation industrielle / construction d''usine', 'Extension site existant / augmentation capacités', 'Ingénierie-maîtrise d''œuvre industrielle']
  THEN pattern := 'A_expansion_industrielle';

  -- Pattern B: Marchés publics collectivités
  ELSIF type_opportunite && ARRAY['Marchés publics & renouvellements', 'Rénovation énergétique bâtiment', 'Audit environnemental obligatoire']
  THEN pattern := 'B_marches_publics_collectivites';

  -- Pattern C: ICPE conformité
  ELSIF type_opportunite && ARRAY['Mise en conformité ICPE', 'Risque environnemental / pollution']
  THEN pattern := 'C_icpe_conformite';

  -- Pattern D: Partenariat R&D
  ELSIF type_opportunite && ARRAY['R&D collaborative-innovation industrielle', 'Appel à projet subventionné']
  THEN pattern := 'D_partenariat_rd_innovation';

  -- Pattern E: Extension/Modernisation
  ELSIF type_opportunite && ARRAY['Modernisation d''installations', 'Extension site existant']
  THEN pattern := 'E_extension_site';

  -- Pattern F: Conformité/Transition
  ELSIF type_opportunite && ARRAY['Transition énergétique-décarbonation', 'Économie circulaire-déchets', 'Biodiversité-compensation écologique']
  THEN pattern := 'F_conformite_transition_ecologique';

  ELSE
    pattern := 'A_expansion_industrielle'::veille.pattern_type;  -- défaut
  END IF;

  RETURN pattern;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- Cette migration crée la structure NOUVELLE du modèle de phases précoces.
--
-- Tables créées:
--   1. opportunites — regroupement d'alertes par projet
--   2. phases_projet — phases détectées + timeline
--   3. opportunite_pertinence_entreprise — scoring nouveau modèle (Très haute/Haute/Moyenne/Basse)
--   4. entreprise_offres — catalogue services
--
-- Colonnes ajoutées:
--   1. entreprises.offres_services (JSONB)
--
-- Enums:
--   1. scoring_opportunite (Très haute/Haute/Moyenne/Basse/À confirmer)
--   2. phase_type (30+ phases couvrant 6 patterns)
--   3. pattern_type (6 patterns génériques)
--
-- Sécurité:
--   - Constraints UNIQUE sur (opportunite_id, phase_type) et (opportunite_id, entreprise_id)
--   - FK avec ON DELETE CASCADE pour cascader les suppressions
--   - CHECK constraints sur scoring et phase_maturity
--
-- Performance:
--   - Indexes sur colonnes fréquemment interrogées (acteur, pattern, scoring, phase, statut)
--   - Colonne dénormalisée nb_alertes pour requêtes rapides sans COUNT
--
-- Flexibilité:
--   - JSONB pour offres_services (extensible sans migration)
--   - TEXT[] pour mots_cles, type_opportunite (adaptable)
--   - Champ notes TEXT (métadonnées libres)
--
-- À faire après migration:
--   1. Créer Edge Functions pour clustering IA (cluster-alerts, detect-phases, score-opportunity, match-offres)
--   2. Populate entreprise_offres avec catalogues Ekium, Cetim, Etamine
--   3. Seed données offres_services en JSON
--   4. Lancer clustering sur les 414 alertes existantes
