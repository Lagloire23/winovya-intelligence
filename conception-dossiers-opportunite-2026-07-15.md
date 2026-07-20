# Conception — Couche « Dossiers d'opportunité » (veille.opportunites)

**Statut : document de conception uniquement. Aucun SQL n'a été exécuté, aucun fichier frontend n'a été modifié, aucune edge function n'a été déployée, aucune politique RLS n'a été appliquée.** Tout le SQL ci-dessous est proposé, à valider puis exécuter manuellement (ou via une future demande explicite) — rien n'est actif.

Fondé sur l'audit du 15/07/2026 (`audit-schema-veille-2026-07-15.md`). Reprend l'architecture existante sans la modifier : `veille.alertes` reste le fait neutre, `veille.pertinence_entreprise` reste la source de vérité du couple alerte/entreprise, toute la logique métier continue de vivre dans des edge functions Deno (aucune fonction SQL métier n'est ajoutée, à l'exception d'un unique trigger de cohérence justifié en section 3).

---

## Table des matières

1. Modèle de données cible (diagramme)
2. SQL de migration proposé (tables, contraintes, index) — non exécuté
3. Cohérence `opportunite_alertes` : justification du choix trigger vs CHECK vs edge function
4. Politiques RLS proposées — non appliquées
5. Edge functions à créer / corriger
6. Modifications frontend prévues (documentées, non appliquées)
7. Scoring de pertinence personnalisé — formule
8. Probabilité de projet — formule et garde-fous
9. Priorité commerciale — formule et recommandations
10. Règles de création et de rattachement automatique
11. Stratégie de migration en 4 phases
12. Plan de tests
13. Plan de retour arrière
14. Risques
15. Décisions nécessitant une validation humaine

---

## 1. Modèle de données cible

```
veille.entreprises ──────────────────────────────────────────────┐
   │  1                                                            │ 1
   │                                                                │
   │ N                                                              │ N
veille.profiles                                          veille.comptes_strategiques
                                                           (config par entreprise, remplace
                                                            le codage en dur MBDA/Thales)

veille.alertes (fait neutre, INCHANGÉ)
   │ 1
   │ N
veille.pertinence_entreprise (couple alerte×entreprise, INCHANGÉ + colonnes additives)
   │ N                                    │
   │                                      │ (0..1 rattachement)
   │ 1                                    ▼
veille.entreprises              veille.opportunite_alertes ──────► veille.opportunites
                                       │ N                    N        │ 1
                                       │ 1                             │ N
                                 veille.alertes                veille.entreprises
                                                                        │
                                                                        │ N
                                                        ┌───────────────┼───────────────┐
                                                        ▼ N                             ▼ N
                                          veille.opportunite_decideurs         veille.opportunite_historique
                                                        │ N                              │ N (référence optionnelle)
                                                        │ 1                               ▼
                                                 veille.decideurs                  veille.alertes (alerte_id, nullable)

Tables de référence (nouvelles, additives, sans enum PostgreSQL) :
veille.ref_opportunite_statut, veille.ref_opportunite_maturite, veille.ref_niveau_confiance,
veille.ref_statut_validation, veille.ref_type_signal, veille.ref_mode_rattachement,
veille.ref_role_dans_opportunite, veille.ref_statut_contact, veille.ref_niveau_priorite,
veille.ref_recommandation_commerciale, veille.ref_type_evenement_historique
```

Relations clés :

- `opportunites.entreprise_id → entreprises.id` : **1 opportunité appartient à exactement 1 entreprise** (jamais de dossier partagé).
- `opportunite_alertes` est la table pivot qui relie une opportunité aux `pertinence_entreprise` (et donc aux `alertes`) qui la justifient — elle porte la mécanique de scoring de probabilité par signal.
- `opportunite_decideurs` réutilise `veille.decideurs` (aucune duplication de personnes) mais qualifie la relation dans le contexte commercial du dossier — **coexiste** avec `alerte_decideurs`, ne le remplace pas (rôles différents, cf. section 5.4).
- `opportunite_historique` trace tout événement, y compris ceux qui ne touchent aucune alerte (`alerte_id` nullable).
- `comptes_strategiques` externalise la configuration par entreprise (ex. Ekium → MBDA) qui était auparavant codée en dur dans un prompt.

---

## 2. SQL de migration proposé — **non exécuté**

L'ensemble ci-dessous est purement additif : aucun `DROP`, `ALTER COLUMN ... DROP`, `RENAME` ni changement de type sur l'existant. Découpé en fichiers de migration numérotés pour permettre une application incrémentale et un rollback fichier par fichier (cf. section 13).

### 2.1 — `001_ref_tables.sql` — Tables de référence (remplacent les enums pour les statuts évolutifs)

```sql
-- Toutes ces tables sont volontairement de simples tables de référence
-- (code text en PK) et non des enums PostgreSQL : ajouter une valeur ne
-- nécessite qu'un INSERT, jamais un ALTER TYPE (qui verrouille la table le
-- temps de la validation en PostgreSQL < 12, et reste une opération DDL
-- risquée même au-delà).

create table if not exists veille.ref_opportunite_statut (
  code text primary key,
  label text not null,
  ordre int not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table veille.ref_opportunite_statut is
  'Cycle de vie du dossier d''opportunité. Valeurs de départ : voir seed ci-dessous — extensible par simple INSERT.';

create table if not exists veille.ref_opportunite_maturite (
  code text primary key,
  label text not null,
  ordre int not null,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists veille.ref_niveau_confiance (
  code text primary key,
  label text not null,
  ordre int not null,
  actif boolean not null default true
);
comment on table veille.ref_niveau_confiance is
  'Échelle de confiance réutilisée par opportunites.niveau_confiance, '
  'opportunite_alertes.confiance_rattachement (par plage) et '
  'pertinence_entreprise.rattachement_opportunite_confiance.';

create table if not exists veille.ref_statut_validation (
  code text primary key,
  label text not null,
  ordre int not null
);

create table if not exists veille.ref_type_signal (
  code text primary key,
  label text not null,
  famille text not null,  -- regroupe les signaux qui ne doivent pas compter comme indépendants s'ils relatent le même fait (cf. section 9)
  actif boolean not null default true
);

create table if not exists veille.ref_mode_rattachement (
  code text primary key,
  label text not null
);

create table if not exists veille.ref_role_dans_opportunite (
  code text primary key,
  label text not null,
  ordre int not null
);

create table if not exists veille.ref_statut_contact (
  code text primary key,
  label text not null,
  ordre int not null
);

create table if not exists veille.ref_niveau_priorite (
  code text primary key,
  label text not null,
  ordre int not null
);

create table if not exists veille.ref_recommandation_commerciale (
  code text primary key,
  label text not null,
  ordre int not null
);

create table if not exists veille.ref_type_evenement_historique (
  code text primary key,
  label text not null
);

-- Seed indicatif (à valider avec Hope avant exécution — cf. section 15) :

insert into veille.ref_opportunite_statut (code, label, ordre) values
  ('DETECTEE', 'Détectée', 1),
  ('QUALIFICATION', 'En qualification', 2),
  ('ACTIVE', 'Active', 3),
  ('EN_PAUSE', 'En pause', 4),
  ('GAGNEE', 'Gagnée', 5),
  ('PERDUE', 'Perdue', 6),
  ('ABANDONNEE', 'Abandonnée', 7),
  ('FUSIONNEE', 'Fusionnée dans une autre opportunité', 8)
on conflict (code) do nothing;

insert into veille.ref_opportunite_maturite (code, label, ordre) values
  ('SIGNAL_FAIBLE', 'Signal faible', 1),
  ('EMERGENTE', 'Émergente', 2),
  ('CONFIRMEE', 'Confirmée', 3),
  ('ENGAGEE', 'Engagée', 4),
  ('DECISION_IMMINENTE', 'Décision imminente', 5)
on conflict (code) do nothing;

insert into veille.ref_niveau_confiance (code, label, ordre) values
  ('FAIBLE', 'Faible', 1),
  ('MODERE', 'Modéré', 2),
  ('ELEVE', 'Élevé', 3),
  ('TRES_ELEVE', 'Très élevé', 4)
on conflict (code) do nothing;

insert into veille.ref_statut_validation (code, label, ordre) values
  ('NON_VALIDE', 'Non validé', 1),
  ('VALIDE_AUTO', 'Validé automatiquement', 2),
  ('VALIDE_MANUEL', 'Validé manuellement', 3),
  ('CORRIGE_MANUEL', 'Corrigé manuellement', 4),
  ('REJETE', 'Rejeté', 5)
on conflict (code) do nothing;

insert into veille.ref_type_signal (code, label, famille) values
  ('PERMIS_AUTORISATION', 'Permis / autorisation officielle', 'ADMINISTRATIF'),
  ('ARTICLE_PRESSE', 'Article de presse', 'PRESSE'),
  ('RECRUTEMENT', 'Recrutement', 'RH'),
  ('DELIBERATION', 'Délibération', 'ADMINISTRATIF'),
  ('MARCHE_PREPARATOIRE', 'Marché préparatoire', 'MARCHE_PUBLIC'),
  ('INVESTISSEMENT_ANNONCE', 'Investissement annoncé', 'PRESSE'),
  ('PUBLICATION_OFFICIELLE', 'Publication officielle', 'ADMINISTRATIF'),
  ('DOSSIER_ICPE', 'Dossier ICPE', 'ADMINISTRATIF'),
  ('ACQUISITION_FONCIERE', 'Acquisition foncière', 'FONCIER'),
  ('COMMUNIQUE_OFFICIEL', 'Communiqué officiel de l''entreprise/collectivité', 'PRESSE')
on conflict (code) do nothing;

insert into veille.ref_mode_rattachement (code, label) values
  ('AUTOMATIQUE', 'Rattachement automatique'),
  ('PROPOSE_A_CONFIRMER', 'Proposé, à confirmer'),
  ('MANUEL', 'Rattachement manuel')
on conflict (code) do nothing;

insert into veille.ref_role_dans_opportunite (code, label, ordre) values
  ('SPONSOR', 'Sponsor du projet', 1),
  ('DECIDEUR_BUDGETAIRE', 'Décideur budgétaire', 2),
  ('PRESCRIPTEUR', 'Prescripteur technique', 3),
  ('UTILISATEUR_FINAL', 'Utilisateur final', 4),
  ('BLOQUEUR_POTENTIEL', 'Bloqueur potentiel', 5),
  ('CONTACT_IDENTIFIE', 'Contact identifié, rôle non qualifié', 6)
on conflict (code) do nothing;

insert into veille.ref_statut_contact (code, label, ordre) values
  ('A_CONTACTER', 'À contacter', 1),
  ('CONTACTE', 'Contacté', 2),
  ('EN_DISCUSSION', 'En discussion', 3),
  ('INJOIGNABLE', 'Injoignable', 4),
  ('REFUS', 'Refus', 5),
  ('CONVERTI', 'Converti en interlocuteur actif', 6)
on conflict (code) do nothing;

insert into veille.ref_niveau_priorite (code, label, ordre) values
  ('FAIBLE', 'Faible', 1),
  ('MOYEN', 'Moyen', 2),
  ('ELEVE', 'Élevé', 3),
  ('CRITIQUE', 'Critique', 4)
on conflict (code) do nothing;

insert into veille.ref_recommandation_commerciale (code, label, ordre) values
  ('SURVEILLER', 'Surveiller', 1),
  ('QUALIFIER', 'Qualifier', 2),
  ('CONTACTER', 'Contacter', 3),
  ('PRIORITE_HAUTE', 'Priorité haute', 4),
  ('ECARTER', 'Écarter', 5)
on conflict (code) do nothing;

insert into veille.ref_type_evenement_historique (code, label) values
  ('CREATION', 'Création du dossier'),
  ('AJOUT_SIGNAL', 'Ajout d''un signal'),
  ('RETRAIT_SIGNAL', 'Retrait d''un signal'),
  ('MAJ_PROBABILITE', 'Modification de la probabilité'),
  ('MAJ_MATURITE', 'Modification de la maturité'),
  ('MAJ_ADEQUATION', 'Modification du score d''adéquation'),
  ('MAJ_PRIORITE', 'Modification de la priorité commerciale'),
  ('AJOUT_DECIDEUR', 'Ajout d''un décideur'),
  ('VALIDATION_MANUELLE', 'Validation manuelle'),
  ('CORRECTION_MANUELLE', 'Correction manuelle'),
  ('FUSION', 'Fusion de dossiers'),
  ('SEPARATION', 'Séparation de dossiers'),
  ('CHANGEMENT_STATUT', 'Changement de statut')
on conflict (code) do nothing;
```

### 2.2 — `002_veille_opportunites.sql`

```sql
create table if not exists veille.opportunites (
  id uuid primary key default gen_random_uuid(),

  -- Identification et propriété
  entreprise_id uuid not null references veille.entreprises(id) on delete cascade,
  titre text not null,
  acteur_principal text,
  acteur_normalise text,
  filiale text,
  site_concerne text,
  programme_projet text,

  -- Géographie (mêmes conventions que veille.alertes : pays en text simple,
  -- region en tableau pour permettre un projet à cheval sur plusieurs régions)
  pays text not null default 'France',
  region text[],
  departement text,
  commune_collectivite text,

  -- Qualification du dossier (tables de référence, pas d'enum)
  type_opportunite text[],
  hypothese text,
  description_opportunite text,
  statut text not null default 'DETECTEE' references veille.ref_opportunite_statut(code),
  maturite text references veille.ref_opportunite_maturite(code),
  niveau_confiance text references veille.ref_niveau_confiance(code),

  -- Scores séparés (jamais fusionnés)
  probabilite_projet int not null default 0
    constraint chk_opp_probabilite check (probabilite_projet between 0 and 100),
  adequation_client int not null default 0
    constraint chk_opp_adequation check (adequation_client between 0 and 100),
  priorite_commerciale int not null default 0
    constraint chk_opp_priorite check (priorite_commerciale between 0 and 100),

  -- Recommandation dérivée (section 10) — ajout non listé explicitement par
  -- le brief mais nécessaire pour stocker le résultat + son explication
  -- plutôt que de le recalculer à la volée à chaque affichage.
  recommandation_commerciale text references veille.ref_recommandation_commerciale(code),
  recommandation_explication text,
  priorite_commerciale_detail jsonb, -- décomposition pondérée (35/35/10/10/10), pour audit/affichage

  -- Personnalisation client
  competences_matchees text[],
  references_matchees text[],
  secteurs_matchees text[],
  criteres_onboarding_matchees jsonb,
  besoins_probables text[],
  lien_business text,
  justification_adequation text,

  -- Analyse du projet
  justification_probabilite text,
  signaux_manquants text[],
  signaux_contradictoires text[],
  horizon_min_mois int constraint chk_opp_horizon_min check (horizon_min_mois is null or horizon_min_mois >= 0),
  horizon_max_mois int constraint chk_opp_horizon_max check (horizon_max_mois is null or horizon_max_mois >= 0),
  constraint chk_opp_horizon_ordre check (
    horizon_min_mois is null or horizon_max_mois is null or horizon_max_mois >= horizon_min_mois
  ),
  montant_estime_min numeric constraint chk_opp_montant_min check (montant_estime_min is null or montant_estime_min >= 0),
  montant_estime_max numeric constraint chk_opp_montant_max check (montant_estime_max is null or montant_estime_max >= 0),
  constraint chk_opp_montant_ordre check (
    montant_estime_min is null or montant_estime_max is null or montant_estime_max >= montant_estime_min
  ),
  devise text default 'EUR' constraint chk_opp_devise check (devise ~ '^[A-Z]{3}$'),
  montant_estime_source text,

  -- Exploitation commerciale
  prochaine_action text,
  date_prochaine_action date,
  assigne_email text,
  notes_equipe text,

  -- Gouvernance des modifications
  statut_validation text references veille.ref_statut_validation(code),
  valide_par uuid references auth.users(id),
  date_validation timestamptz,
  verrouille_manuellement boolean not null default false,
  champs_verrouilles text[],

  -- Dates
  date_premier_signal date,
  date_dernier_signal date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table veille.opportunites is
  'Dossier d''opportunité commerciale, STRICTEMENT propre à une entreprise cliente '
  '(entreprise_id non nul, jamais partagé). Regroupe des veille.pertinence_entreprise '
  'via veille.opportunite_alertes. N''est jamais la source de vérité du fait brut '
  '(reste veille.alertes) ni du score de pertinence par couple alerte/entreprise '
  '(reste veille.pertinence_entreprise).';
```

### 2.3 — `003_veille_opportunite_alertes.sql`

```sql
create table if not exists veille.opportunite_alertes (
  id uuid primary key default gen_random_uuid(),

  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  alerte_id uuid not null references veille.alertes(id) on delete cascade,
  entreprise_id uuid not null references veille.entreprises(id) on delete cascade,
  pertinence_entreprise_id uuid not null references veille.pertinence_entreprise(id) on delete cascade,

  type_signal text references veille.ref_type_signal(code),
  force_signal int constraint chk_oa_force check (force_signal between 0 and 100),
  fiabilite_source numeric(4,3) constraint chk_oa_fiabilite check (fiabilite_source between 0 and 1),
  coefficient_fraicheur numeric(4,3) constraint chk_oa_fraicheur check (coefficient_fraicheur between 0 and 1),
  coefficient_independance numeric(4,3) constraint chk_oa_independance check (coefficient_independance between 0 and 1),
  coherence_geographique numeric(4,3) constraint chk_oa_geo check (coherence_geographique between 0 and 1),
  coherence_temporelle numeric(4,3) constraint chk_oa_temp check (coherence_temporelle between 0 and 1),
  sens_signal text constraint chk_oa_sens check (sens_signal in ('positif', 'negatif', 'neutre')),
  contribution_probabilite numeric(5,4) constraint chk_oa_contrib check (contribution_probabilite between 0 and 1),
  confiance_rattachement int constraint chk_oa_confiance check (confiance_rattachement between 0 and 100),
  mode_rattachement text references veille.ref_mode_rattachement(code),
  justification_rattachement text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_opportunite_alerte unique (opportunite_id, alerte_id)
);

comment on table veille.opportunite_alertes is
  'Lie une opportunité aux pertinence_entreprise (donc aux alertes) qui la '
  'justifient, avec les coefficients servant au calcul de probabilité '
  '(section 9 du brief). La cohérence entreprise_id/pertinence_entreprise_id '
  'est vérifiée par trigger, cf. section 3 du document de conception '
  '(un CHECK simple ne peut pas référencer une autre table).';
```

### 2.4 — `004_veille_opportunite_decideurs.sql`

```sql
create table if not exists veille.opportunite_decideurs (
  id uuid primary key default gen_random_uuid(),

  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  decideur_id uuid not null references veille.decideurs(id) on delete cascade,

  role_dans_opportunite text references veille.ref_role_dans_opportunite(code),
  role_achat veille.role_achat, -- réutilise l'enum existant (snapshot au moment du rattachement)
  niveau_priorite text references veille.ref_niveau_priorite(code),
  raison_ciblage text,
  action_recommandee text,
  statut_contact text references veille.ref_statut_contact(code),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_opportunite_decideur unique (opportunite_id, decideur_id)
);

comment on table veille.opportunite_decideurs is
  'Qualifie un décideur DANS LE CONTEXTE COMMERCIAL d''un dossier '
  '(qui contacter, pourquoi, avec quelle priorité). Ne remplace PAS '
  'veille.alerte_decideurs : alerte_decideurs relie une personne à un '
  'fait/document, opportunite_decideurs identifie les personnes à '
  'contacter pour faire avancer une opportunité commerciale. Un même '
  'decideur_id peut donc apparaître dans les deux tables avec des sens '
  'différents et sans lien de dépendance entre elles.';
```

### 2.5 — `005_veille_opportunite_historique.sql`

```sql
create table if not exists veille.opportunite_historique (
  id uuid primary key default gen_random_uuid(),
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  type_evenement text not null references veille.ref_type_evenement_historique(code),
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  motif text,
  alerte_id uuid references veille.alertes(id) on delete set null,
  effectue_par uuid references auth.users(id),
  origine text not null constraint chk_hist_origine check (
    origine in ('pipeline_automatique', 'interface_utilisateur', 'administrateur', 'migration_historique')
  ),
  created_at timestamptz not null default now()
);

comment on table veille.opportunite_historique is
  'Journal d''audit append-only (aucun UPDATE/DELETE prévu applicativement) '
  'de tout événement affectant un dossier. alerte_id est ON DELETE SET NULL '
  '(et non CASCADE) : on veut garder la trace historique même si l''alerte '
  'source est un jour supprimée en amont.';

-- Journal append-only : aucune UPDATE/DELETE attendue depuis l'application.
-- Proposé mais non exécuté : revoke update, delete on veille.opportunite_historique from authenticated;
```

### 2.6 — `006_veille_comptes_strategiques.sql`

```sql
create table if not exists veille.comptes_strategiques (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references veille.entreprises(id) on delete cascade,
  nom_compte text not null,
  aliases text[],
  site_web text,
  pays_suivis text[],
  regions_suivies text[],
  sites_connus text[],
  types_opportunite_suivis text[],
  mots_cles_specifiques text[],
  instructions_specifiques text,
  niveau_priorite text references veille.ref_niveau_priorite(code),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_compte_strategique_par_entreprise unique (entreprise_id, nom_compte)
);

comment on table veille.comptes_strategiques is
  'Remplace le codage en dur (ex. Ekium -> MBDA/Thales) par une '
  'configuration déclarative par entreprise cliente. Exemple de ligne : '
  'entreprise_id = <Ekium>, nom_compte = ''MBDA'', '
  'types_opportunite_suivis = {implantation industrielle, construction usine, '
  'extension de site, nouveau bâtiment de production}, '
  'pays_suivis = {France, International}. Le même mécanisme sert '
  'n''importe quelle autre entreprise cliente sans modification de code.';
```

### 2.7 — `007_pertinence_entreprise_additive.sql`

```sql
-- Additif uniquement : aucune colonne existante n'est renommée, retypée ni supprimée.
alter table veille.pertinence_entreprise
  add column if not exists score_numerique int
    constraint chk_pe_score_num check (score_numerique is null or score_numerique between 0 and 100),
  add column if not exists score_competences int
    constraint chk_pe_score_comp check (score_competences is null or score_competences between 0 and 100),
  add column if not exists score_references int
    constraint chk_pe_score_ref check (score_references is null or score_references between 0 and 100),
  add column if not exists score_secteurs int
    constraint chk_pe_score_sect check (score_secteurs is null or score_secteurs between 0 and 100),
  add column if not exists score_geographie int
    constraint chk_pe_score_geo check (score_geographie is null or score_geographie between 0 and 100),
  add column if not exists score_type_opportunite int
    constraint chk_pe_score_type check (score_type_opportunite is null or score_type_opportunite between 0 and 100),
  add column if not exists score_mots_cles int
    constraint chk_pe_score_mots check (score_mots_cles is null or score_mots_cles between 0 and 100),
  add column if not exists score_compte_strategique int
    constraint chk_pe_score_compte check (score_compte_strategique is null or score_compte_strategique between 0 and 100),
  add column if not exists score_timing int
    constraint chk_pe_score_timing check (score_timing is null or score_timing between 0 and 100),
  add column if not exists competences_matchees text[],
  add column if not exists references_matchees text[],
  add column if not exists criteres_matchees jsonb,
  add column if not exists criteres_non_matchees jsonb,
  add column if not exists explication_score jsonb,
  add column if not exists rattachement_opportunite_statut text references veille.ref_mode_rattachement(code),
  add column if not exists rattachement_opportunite_confiance text references veille.ref_niveau_confiance(code);

comment on column veille.pertinence_entreprise.score_numerique is
  'Score 0-100 calculé par score-alert-for-company. score_pertinence (existant, '
  'qualitatif) reste affiché en priorité dans l''UI actuelle et est dérivé de '
  'score_numerique via la table de correspondance de la section 7 — les deux '
  'colonnes coexistent, aucune des deux ne remplace l''autre.';
```

### 2.8 — `008_indexes.sql`

```sql
-- Existant, non couvert par l'audit initial mais nécessaire dès le mode miroir :
create index if not exists idx_profiles_entreprise_id on veille.profiles (entreprise_id);
create index if not exists idx_pertinence_entreprise_entreprise_id_statut on veille.pertinence_entreprise (entreprise_id, statut);

-- Nouvelles tables :
create index if not exists idx_opportunites_entreprise_id on veille.opportunites (entreprise_id);
create index if not exists idx_opportunites_statut on veille.opportunites (statut);
create index if not exists idx_opportunites_priorite_commerciale on veille.opportunites (priorite_commerciale desc);
create index if not exists idx_opportunites_probabilite_projet on veille.opportunites (probabilite_projet desc);
create index if not exists idx_opportunites_updated_at on veille.opportunites (updated_at desc);

create index if not exists idx_opportunite_alertes_alerte_id on veille.opportunite_alertes (alerte_id);
create index if not exists idx_opportunite_alertes_opportunite_id on veille.opportunite_alertes (opportunite_id);
create index if not exists idx_opportunite_alertes_entreprise_id on veille.opportunite_alertes (entreprise_id);

create index if not exists idx_opportunite_decideurs_opportunite_id on veille.opportunite_decideurs (opportunite_id);
create index if not exists idx_opportunite_decideurs_decideur_id on veille.opportunite_decideurs (decideur_id);

create index if not exists idx_opportunite_historique_opportunite_id on veille.opportunite_historique (opportunite_id, created_at desc);

create index if not exists idx_comptes_strategiques_entreprise_id on veille.comptes_strategiques (entreprise_id);

-- Index GIN pour les colonnes text[] et jsonb très interrogées (filtres, recherche) :
create index if not exists idx_opportunites_type_opportunite_gin on veille.opportunites using gin (type_opportunite);
create index if not exists idx_opportunites_criteres_onboarding_gin on veille.opportunites using gin (criteres_onboarding_matchees);
create index if not exists idx_pertinence_entreprise_criteres_matchees_gin on veille.pertinence_entreprise using gin (criteres_matchees);
create index if not exists idx_pertinence_entreprise_criteres_non_matchees_gin on veille.pertinence_entreprise using gin (criteres_non_matchees);
create index if not exists idx_comptes_strategiques_types_opp_gin on veille.comptes_strategiques using gin (types_opportunite_suivis);
```

**Note de dimensionnement** : aux volumes actuels (295 alertes, 337 pertinences, 3 entreprises), aucun de ces index n'est urgent en performance pure — ils sont proposés par anticipation, cohérents avec l'échelle visée (plusieurs dizaines d'entreprises clientes, dizaines de milliers d'alertes). Un `EXPLAIN ANALYZE` sur les requêtes réelles du dashboard/bêta Opportunités avant activation en production est recommandé plutôt que de les créer aveuglément (cf. section 12).

---

## 3. Cohérence `opportunite_alertes` : trigger, CHECK ou edge function ?

Le brief demande de vérifier deux cohérences :

1. `opportunite_alertes.entreprise_id` doit correspondre à `opportunite_alertes.opportunite_id → opportunites.entreprise_id`.
2. `opportunite_alertes.pertinence_entreprise_id` doit correspondre au même couple `(alerte_id, entreprise_id)` que la ligne `opportunite_alertes` elle-même.

**Un simple `CHECK` est impossible** : une contrainte `CHECK` en PostgreSQL ne peut évaluer que les colonnes de la ligne courante, elle ne peut pas faire de sous-requête vers une autre table (`opportunites`, `pertinence_entreprise`). Il reste donc deux options réelles :

- **Edge function uniquement** : la fonction `create-or-update-opportunity` (service role) valide la cohérence avant d'écrire. Rapide à mettre en œuvre, mais **ne protège pas contre une écriture directe** (script d'administration, futur outil interne, correction manuelle en base) qui contournerait l'edge function.
- **Trigger `BEFORE INSERT OR UPDATE`** : validé au niveau PostgreSQL, donc valable quel que soit le chemin d'écriture (edge function aujourd'hui, admin console demain, migration de données plus tard). Coût négligeable (deux lookups par PK/index déjà créés).

**Choix retenu : le trigger**, en complément de la validation faite dans l'edge function (qui reste la première ligne de défense pour donner un message d'erreur clair à l'utilisateur — le trigger ne sert qu'à garantir l'intégrité en dernier recours, pas à produire un message UX). C'est cohérent avec la seule fonction SQL métier déjà présente dans le schéma (`is_admin()`, utilisée par les RLS) : une garantie d'intégrité vaut la peine d'être posée au niveau base plutôt que reposer uniquement sur la discipline applicative.

```sql
-- 003b_trigger_coherence_opportunite_alertes.sql — PROPOSÉ, NON EXÉCUTÉ

create or replace function veille.check_opportunite_alerte_consistency()
returns trigger
language plpgsql
security definer
set search_path to 'veille', 'pg_temp'
as $$
declare
  v_opp_entreprise_id uuid;
  v_pe_alerte_id uuid;
  v_pe_entreprise_id uuid;
begin
  select entreprise_id into v_opp_entreprise_id
  from veille.opportunites where id = new.opportunite_id;

  if v_opp_entreprise_id is null then
    raise exception 'opportunite_alertes: opportunite_id % introuvable', new.opportunite_id;
  end if;

  if v_opp_entreprise_id != new.entreprise_id then
    raise exception 'opportunite_alertes: entreprise_id (%) ne correspond pas à l''entreprise du dossier (%)',
      new.entreprise_id, v_opp_entreprise_id;
  end if;

  select alerte_id, entreprise_id into v_pe_alerte_id, v_pe_entreprise_id
  from veille.pertinence_entreprise where id = new.pertinence_entreprise_id;

  if v_pe_alerte_id is null then
    raise exception 'opportunite_alertes: pertinence_entreprise_id % introuvable', new.pertinence_entreprise_id;
  end if;

  if v_pe_alerte_id != new.alerte_id or v_pe_entreprise_id != new.entreprise_id then
    raise exception
      'opportunite_alertes: pertinence_entreprise_id % ne correspond pas au couple (alerte_id=%, entreprise_id=%)',
      new.pertinence_entreprise_id, new.alerte_id, new.entreprise_id;
  end if;

  return new;
end;
$$;

create trigger trg_check_opportunite_alerte_consistency
  before insert or update on veille.opportunite_alertes
  for each row execute function veille.check_opportunite_alerte_consistency();
```

---

## 4. Politiques RLS proposées — **non appliquées**

### 4.1 Nouvelles tables (isolation stricte par entreprise)

```sql
-- PROPOSÉ, NON EXÉCUTÉ.
alter table veille.opportunites enable row level security;
alter table veille.opportunite_alertes enable row level security;
alter table veille.opportunite_decideurs enable row level security;
alter table veille.opportunite_historique enable row level security;
alter table veille.comptes_strategiques enable row level security;

-- Lecture : un membre voit uniquement les dossiers de SA propre entreprise ;
-- un admin voit tout.
create policy "read own entreprise opportunites" on veille.opportunites
  for select to authenticated
  using (
    veille.is_admin()
    or entreprise_id = (select p.entreprise_id from veille.profiles p where p.id = auth.uid())
  );

-- Écriture directe interdite à tous les non-admins : toute création/mise à
-- jour passe par les edge functions service-role listées en section 5, qui
-- appliquent elles-mêmes les règles de verrouillage (champs_verrouilles,
-- verrouille_manuellement). Un admin garde un accès direct pour le support.
create policy "admin write opportunites" on veille.opportunites
  for all to authenticated
  using (veille.is_admin())
  with check (veille.is_admin());

-- opportunite_alertes / opportunite_decideurs / opportunite_historique :
-- même schéma (lecture scoping par entreprise via jointure, écriture admin
-- uniquement — le service role des edge functions n'est de toute façon pas
-- soumis à RLS).
create policy "read own entreprise opportunite_alertes" on veille.opportunite_alertes
  for select to authenticated
  using (
    veille.is_admin()
    or entreprise_id = (select p.entreprise_id from veille.profiles p where p.id = auth.uid())
  );

create policy "admin write opportunite_alertes" on veille.opportunite_alertes
  for all to authenticated
  using (veille.is_admin())
  with check (veille.is_admin());

create policy "read own entreprise opportunite_decideurs" on veille.opportunite_decideurs
  for select to authenticated
  using (
    veille.is_admin()
    or exists (
      select 1 from veille.opportunites o
      join veille.profiles p on p.entreprise_id = o.entreprise_id
      where o.id = opportunite_decideurs.opportunite_id and p.id = auth.uid()
    )
  );

create policy "admin write opportunite_decideurs" on veille.opportunite_decideurs
  for all to authenticated
  using (veille.is_admin())
  with check (veille.is_admin());

create policy "read own entreprise opportunite_historique" on veille.opportunite_historique
  for select to authenticated
  using (
    veille.is_admin()
    or exists (
      select 1 from veille.opportunites o
      join veille.profiles p on p.entreprise_id = o.entreprise_id
      where o.id = opportunite_historique.opportunite_id and p.id = auth.uid()
    )
  );

create policy "admin write opportunite_historique" on veille.opportunite_historique
  for all to authenticated
  using (veille.is_admin())
  with check (veille.is_admin());

-- comptes_strategiques : configuration jugée sensible (dévoile la stratégie
-- commerciale ciblée) — lecture ET écriture réservées à l'admin par défaut ;
-- à ouvrir en lecture aux membres de l'entreprise concernée si Hope le
-- souhaite (cf. section 15, décision à valider).
create policy "admin manage comptes_strategiques" on veille.comptes_strategiques
  for all to authenticated
  using (veille.is_admin())
  with check (veille.is_admin());
```

### 4.2 Correctifs proposés sur les tables existantes (à ne pas appliquer avant la Phase C/D, cf. section 11)

Ces changements modifient un comportement déjà utilisé par le frontend actuel — **ils ne doivent pas être appliqués avant que le frontend correspondant soit prêt** (principe non négociable : le système actuel doit rester fonctionnel pendant toute la migration).

```sql
-- PROPOSÉ — à activer uniquement après migration du frontend (Phase C/D).

-- 1) entreprises : un membre ne doit plus lire toutes les entreprises,
--    seulement la sienne. Remplace "authenticated read entreprises" (qual: true).
drop policy if exists "authenticated read entreprises" on veille.entreprises; -- PROPOSÉ, PAS EXÉCUTÉ
create policy "read own entreprise or admin" on veille.entreprises
  for select to authenticated
  using (
    veille.is_admin()
    or id = (select p.entreprise_id from veille.profiles p where p.id = auth.uid())
  );

-- 2) pertinence_entreprise : idem, un membre ne voit que les pertinences de
--    sa propre entreprise. Remplace "authenticated read pertinence" (qual: true).
drop policy if exists "authenticated read pertinence" on veille.pertinence_entreprise; -- PROPOSÉ, PAS EXÉCUTÉ
create policy "read own entreprise pertinence or admin" on veille.pertinence_entreprise
  for select to authenticated
  using (
    veille.is_admin()
    or entreprise_id = (select p.entreprise_id from veille.profiles p where p.id = auth.uid())
  );

-- 3) alertes : le FAIT reste partagé (principe 1.1 du brief — alerte
--    factuelle commune, pas de notion de "propriétaire"), donc la lecture
--    globale ("authenticated read alertes", qual: true) N'EST PAS remise en
--    cause. En revanche l'écriture globale ("authenticated update alertes",
--    qual/with_check: true) l'est : aujourd'hui n'importe quel membre peut
--    modifier le statut/les notes de N'IMPORTE QUELLE alerte, même sans
--    lien avec son entreprise. Remplacée par : accès restreint aux seules
--    alertes ayant une pertinence active pour l'entreprise du membre, ET
--    routage recommandé via l'edge function update-alert-workflow (section
--    5.10) plutôt que l'update direct actuel d'AlertRow.tsx.
drop policy if exists "authenticated update alertes" on veille.alertes; -- PROPOSÉ, PAS EXÉCUTÉ
create policy "update alertes with active pertinence or admin" on veille.alertes
  for update to authenticated
  using (
    veille.is_admin()
    or exists (
      select 1 from veille.pertinence_entreprise pe
      join veille.profiles p on p.entreprise_id = pe.entreprise_id
      where pe.alerte_id = alertes.id and p.id = auth.uid() and pe.statut = 'Actif'
    )
  )
  with check (
    veille.is_admin()
    or exists (
      select 1 from veille.pertinence_entreprise pe
      join veille.profiles p on p.entreprise_id = pe.entreprise_id
      where pe.alerte_id = alertes.id and p.id = auth.uid() and pe.statut = 'Actif'
    )
  );

-- 4) decideurs / alerte_decideurs : ContactFinder.tsx insère aujourd'hui
--    directement avec la clé anon dans des tables où seule la lecture est
--    ouverte aux non-admins (INSERT bloqué par RLS pour un membre). Plutôt
--    que d'ouvrir largement l'écriture (ce qui exposerait la base de
--    décideurs à des écritures non contrôlées), la correction recommandée
--    est de RETIRER cette possibilité d'écriture directe côté client et de
--    router exclusivement via l'edge function attach-decideur-to-signal
--    (service role, section 5.11) — donc AUCUN changement RLS nécessaire
--    ici, la policy "admin write decideurs" existante reste correcte, c'est
--    le frontend qui doit changer de chemin d'écriture (cf. section 6.3).
```

---

## 5. Edge functions à créer / corriger

Toutes suivent la convention déjà en place (Deno + `@supabase/supabase-js`, clé service role injectée automatiquement côté Supabase, jamais exposée au bundle, CORS headers identiques à `assign-alert`/`onboarding-save`).

### 5.1 `score-alert-for-company`

- **Entrée** : `{ alerteId: string, entrepriseId?: string }` (si `entrepriseId` omis : calcule pour toutes les entreprises actives ayant `onboarding_complete = true`).
- **Tables lues** : `alertes` (par id), `entreprises` (competences, references_clients, secteurs_intervention, zone_geographique, mots_cles_metiers, secteur_clients, pays, regions_suivies, departements_suivis, types_opportunite_suivis), `comptes_strategiques` (filtré par entreprise_id).
- **Tables écrites** : `pertinence_entreprise` (upsert par `(alerte_id, entreprise_id)` — colonnes `score_numerique`, `score_pertinence` dérivé via la table de correspondance section 7, `score_competences`, `score_references`, `score_secteurs`, `score_geographie`, `score_type_opportunite`, `score_mots_cles`, `score_compte_strategique`, `competences_matchees`, `references_matchees`, `criteres_matchees`, `criteres_non_matchees`, `explication_score`).
- **Authentification** : `verify_jwt: true` ; appelée soit par le pipeline de collecte (compte de service dédié), soit en tâche de fond après insertion d'une nouvelle alerte — jamais directement par un membre depuis l'UI (pas de bouton "recalculer" exposé aux membres dans un premier temps, cf. section 6).
- **Service role** : oui, nécessaire pour lire `entreprises`/`comptes_strategiques` de toutes les entreprises et écrire `pertinence_entreprise` indépendamment du RLS restreint du membre appelant.
- **Idempotence** : `upsert` sur la contrainte unique `(alerte_id, entreprise_id)` déjà existante — un second appel avec les mêmes entrées recalcule et écrase le même score, jamais de duplication de ligne.
- **Erreurs** : retour `{ status: 'ERROR', message }` si `alerteId` introuvable ou aucune entreprise active ; ne bloque jamais la collecte amont (best-effort, erreurs journalisées mais non fatales pour l'appelant).
- **Logs** : `console.log` structuré (alerteId, entrepriseId, score_numerique calculé) — Supabase capture automatiquement les logs de function, consultable via `get_logs`.
- **Anti-doublon** : garanti par la contrainte unique existante `(alerte_id, entreprise_id)` sur `pertinence_entreprise`.

### 5.2 `find-matching-opportunity`

- **Entrée** : `{ alerteId, entrepriseId }`.
- **Tables lues** : `pertinence_entreprise` (ligne du couple), `opportunites` (celles actives de l'entreprise), `opportunite_alertes` (pour comparer acteur/site/type/période), `comptes_strategiques`.
- **Tables écrites** : aucune — fonction de lecture/scoring pure, retourne des candidats.
- **Sortie** : `{ status: 'MATCH_FOUND' | 'NO_MATCH', candidates: [{ opportuniteId, score, detail: { memeActeur: 30|0, memeSite: 25|0, memeType: 20|0, memeProgramme: 10|0, temporalite: 10|0, vocabulaire: 5|0 } }] }` triés par score décroissant, en appliquant le barème et les seuils de la section 10 (≥85 rattachement automatique proposé, 65-84 proposition à confirmer, <65 aucun candidat retourné).
- **Authentification** : `verify_jwt: true`, appelée par `create-or-update-opportunity` en interne (pas d'appel direct depuis le frontend membre dans un premier temps).
- **Service role** : oui (lecture cross-entreprise potentielle si un jour on veut détecter des doublons — mais le filtrage `entrepriseId` reste systématique pour respecter le principe 1.3).
- **Idempotence** : totale, fonction pure sans écriture.
- **Erreurs** : `{ status: 'ERROR' }` sur échec, jamais d'exception non gérée.
- **Anti-doublon** : c'est la fonction elle-même qui EST le mécanisme anti-doublon pour la couche opportunités.

### 5.3 `create-or-update-opportunity`

- **Entrée** : `{ alerteId, entrepriseId, forcerNouveauDossier?: boolean, opportuniteIdCible?: string }`.
- **Tables lues** : `pertinence_entreprise`, `alertes`, `entreprises`, `comptes_strategiques`.
- **Tables écrites** : `opportunites` (insert ou update selon le résultat de `find-matching-opportunity`), `opportunite_alertes` (insert d'une nouvelle ligne de rattachement, déclenche le trigger de cohérence de la section 3), `opportunite_historique` (événement `CREATION` ou `AJOUT_SIGNAL`).
- **Logique** : applique les règles de création automatique de la section 10 (pertinence ≥ 70, acteur identifiable, type identifiable, zone/site suffisamment précis, OU signal intrinsèquement fort, OU convergence de plusieurs signaux) ; sinon retourne `{ status: 'NO_CREATION', reason }` sans écrire.
- **Authentification** : `verify_jwt: true` ; appelée par le pipeline automatique (Phase B) et, plus tard, par un bouton admin/membre "créer un dossier" en Phase D.
- **Service role** : oui.
- **Idempotence** : garantie par la contrainte unique `(opportunite_id, alerte_id)` sur `opportunite_alertes` — un second appel avec la même alerte/entreprise retrouve la ligne existante via `find-matching-opportunity` plutôt que d'en recréer une.
- **Erreurs** : validation stricte des seuils avant toute écriture ; toute violation du trigger de cohérence (section 3) remonte une erreur 500 explicite plutôt que d'être avalée.
- **Logs** : trace complète de la décision (candidats évalués, score de rattachement, seuil appliqué) pour permettre un audit a posteriori des créations automatiques.
- **Anti-doublon** : délègue à `find-matching-opportunity` avant toute création.

### 5.4 `recalculate-opportunity-probability`

- **Entrée** : `{ opportuniteId }`.
- **Tables lues** : `opportunite_alertes` (toutes les lignes du dossier, avec leurs coefficients).
- **Tables écrites** : `opportunites.probabilite_projet`, `opportunites.justification_probabilite`, `opportunites.signaux_manquants`, `opportunites.signaux_contradictoires`, `opportunites.date_dernier_signal` ; `opportunite_historique` (événement `MAJ_PROBABILITE` avec ancienne/nouvelle valeur).
- **Logique** : implémente la formule de la section 9 (produit des coefficients par signal, agrégation `P = 1 - Π(1 - contribution_normalisee)`, garde-fous métier — un seul signal RH ne suffit pas, réduction si `sens_signal = 'negatif'`, déduplication des signaux de même famille relatant le même fait via `coefficient_independance`).
- **Déclenchement** : appelée automatiquement par `create-or-update-opportunity` et `link-opportunity-decision-maker` après toute modification du panier de signaux ; jamais appelée directement par le frontend.
- **Service role** : oui.
- **Idempotence** : totale (recalcul déterministe à partir de l'état actuel de `opportunite_alertes`, jamais d'incrément cumulatif).
- **Erreurs** : si `opportuniteId` n'a aucun `opportunite_alertes`, retourne probabilité 0 avec justification explicite plutôt qu'une erreur.

### 5.5 `recalculate-opportunity-fit` (adéquation client)

- **Entrée** : `{ opportuniteId }`.
- **Tables lues** : `opportunites`, `pertinence_entreprise` (via `opportunite_alertes`), `entreprises`.
- **Tables écrites** : `opportunites.adequation_client`, `justification_adequation`, `competences_matchees`, `references_matchees`, `secteurs_matchees` ; `opportunite_historique` (`MAJ_ADEQUATION`).
- **Logique** : agrège (moyenne pondérée ou max, à valider — cf. section 15) les `score_numerique`/`score_competences`/`score_references`/`score_secteurs` des `pertinence_entreprise` rattachées au dossier.
- **Service role** : oui. **Idempotence** : totale.

### 5.6 `recalculate-commercial-priority`

- **Entrée** : `{ opportuniteId }`.
- **Tables lues** : `opportunites` (probabilite_projet, adequation_client, maturite), `opportunite_decideurs` (accès aux décideurs).
- **Tables écrites** : `opportunites.priorite_commerciale`, `priorite_commerciale_detail`, `recommandation_commerciale`, `recommandation_explication` ; `opportunite_historique` (`MAJ_PRIORITE`).
- **Logique** : formule de la section 10 (35 % probabilité + 35 % adéquation + 10 % maturité + 10 % accès décideurs + 10 % urgence commerciale), puis mapping vers une recommandation (`Surveiller`/`Qualifier`/`Contacter`/`Priorité haute`/`Écarter`) avec l'explication textuelle obligatoire.
- **Déclenchement** : appelée après chaque `recalculate-opportunity-probability`/`recalculate-opportunity-fit`, ou manuellement par un admin.
- **Service role** : oui. **Idempotence** : totale.

### 5.7 `generate-opportunity-actions`

- **Entrée** : `{ opportuniteId }`.
- **Tables lues** : `opportunites`, `opportunite_decideurs`, `opportunite_alertes`.
- **Tables écrites** : `opportunites.prochaine_action`, `date_prochaine_action` (proposition, jamais imposée — reste modifiable manuellement ensuite) ; `opportunite_historique` si le champ change.
- **Logique** : appel Claude Haiku (même convention que `alert-assistant`/`extract-entreprise-from-website`, clé API stockée côté serveur), prompt strictement borné au contenu du dossier (pas de connaissance externe), génère une action commerciale suivante suggérée + échéance indicative.
- **Authentification** : `verify_jwt: true`. **Service role** : oui (lecture cross-table). **Idempotence** : chaque appel régénère une proposition (pas cumulatif) ; ne s'exécute pas si `verrouille_manuellement = true` sur le champ concerné.
- **Erreurs** : en cas d'échec de l'appel IA, ne touche pas aux champs existants (fail-safe, pas d'écrasement par une valeur vide).

### 5.8 `link-opportunity-decision-maker`

- **Entrée** : `{ opportuniteId, decideurId, roleDansOpportunite?, roleAchat?, niveauPriorite?, raisonCiblage?, actionRecommandee? }`.
- **Tables lues** : `opportunites` (vérifie l'entreprise du dossier), `decideurs`.
- **Tables écrites** : `opportunite_decideurs` (upsert sur la contrainte unique `(opportunite_id, decideur_id)`) ; `opportunite_historique` (`AJOUT_DECIDEUR`).
- **Authentification** : `verify_jwt: true`, vérifie que l'appelant est admin OU que son `profiles.entreprise_id` correspond à `opportunites.entreprise_id` (même schéma de vérification que `onboarding-save`).
- **Service role** : oui (pour écrire malgré la policy RLS admin-only sur `opportunite_decideurs`, après validation applicative de l'appartenance).
- **Idempotence** : garantie par la contrainte unique.
- **Anti-doublon** : la contrainte unique `(opportunite_id, decideur_id)` empêche toute duplication ; un second appel devient une mise à jour.

### 5.9 `correct-opportunity-grouping`

- **Entrée** : `{ action: 'fusionner' | 'separer', opportuniteIdSource: string, opportuniteIdCible?: string, alerteIdsASeparer?: string[], motif: string }`.
- **Tables lues** : `opportunites`, `opportunite_alertes`, `opportunite_decideurs`.
- **Tables écrites** :
  - Fusion : déplace les lignes `opportunite_alertes`/`opportunite_decideurs` de la source vers la cible (en respectant la contrainte unique — ignore les doublons déjà présents), passe `opportunites.statut` de la source à `'FUSIONNEE'` (jamais de `DELETE`, traçabilité conservée), écrit `opportunite_historique` (`FUSION`) sur les deux dossiers.
  - Séparation : crée une nouvelle ligne `opportunites` pour les alertes désignées, déplace les `opportunite_alertes` correspondantes, écrit `opportunite_historique` (`SEPARATION`).
- **Authentification** : réservée aux admins (`is_admin()` vérifié côté fonction, en plus du RLS) — correction de regroupement jugée sensible, jamais automatique.
- **Service role** : oui. **Idempotence** : partielle par construction (une fusion déjà faite ne recrée pas de doublon grâce aux contraintes uniques, mais rejouer une séparation identique créerait un second dossier séparé — à documenter comme non-idempotent et à protéger côté UI par une confirmation explicite).
- **Erreurs** : rejette explicitement toute tentative de fusionner deux opportunités n'appartenant pas à la même `entreprise_id` (jamais de dossier partagé, principe 1.3).

### 5.10 `update-alert-workflow` (edge function corrective, hors liste initiale — répond à la section 14)

- **Objectif** : remplacer l'update direct `supabase.from('alertes').update(patch)` fait aujourd'hui par `AlertRow.tsx` (`statut`, `notes_equipe`).
- **Entrée** : `{ alerteId, statut?, notesEquipe? }`.
- **Tables lues** : `pertinence_entreprise` (vérifie que l'entreprise de l'appelant a une ligne active pour cette alerte), `profiles`.
- **Tables écrites** : `alertes` (statut, notes_equipe uniquement — jamais les autres colonnes).
- **Authentification** : `verify_jwt: true` ; autorise si `is_admin()` ou si une `pertinence_entreprise` active existe pour `(alerteId, profile.entreprise_id)`.
- **Service role** : oui (nécessaire une fois la policy `authenticated update alertes` durcie en section 4.2).
- **Idempotence** : totale (simple update par id). **Anti-doublon** : sans objet (pas de création de ligne).

### 5.11 `attach-decideur-to-signal` (edge function corrective — répond à la section 14, corrige `ContactFinder.tsx`)

- **Entrée** : `{ alerteId, contact: { prenom, nom, fonction, email, telephone, source } }` (même forme que l'objet `FoundContact` actuel de `ContactFinder.tsx`).
- **Tables écrites** : `decideurs` (insert), `alerte_decideurs` (insert), en une seule transaction logique côté fonction (les deux inserts réussissent ou aucun — actuellement fait en deux appels client séparés, non atomique).
- **Authentification** : `verify_jwt: true`, tout utilisateur authentifié (pas besoin d'admin ici, l'ajout d'un contact trouvé sur une alerte qu'on regarde est une action normale de veille).
- **Service role** : oui (contourne la policy `admin write decideurs` de façon contrôlée, uniquement pour ce cas d'usage précis, avec validation stricte du format des champs côté fonction).
- **Idempotence** : recherche d'abord un décideur existant avec le même `(nom_personne, prenom_personne, structure_entreprise)` avant d'insérer, pour limiter les doublons (non garanti par contrainte unique en base, donc best-effort applicatif — à surveiller).

### 5.12 `persist-enrichment-result` (edge function corrective — répond à la section 14, corrige `DecideurEnrichButton.tsx`/`EnrichButton`)

- **Entrée** : `{ decideurId, field: 'email' | 'phone', value: string }`.
- **Tables écrites** : `decideurs.email` ou `decideurs.telephone` selon `field`.
- **Authentification** : `verify_jwt: true`, tout utilisateur authentifié.
- **Service role** : oui (contourne `admin write decideurs`, action strictement limitée à 2 colonnes, jamais de création/suppression).
- **Idempotence** : totale (simple update). **Constat actuel** : aujourd'hui le résultat FullEnrich n'est affiché qu'en mémoire React (`useState`) et disparaît au rechargement de la page — cette fonction ferme cette lacune sans changer le comportement visible (le composant appellerait cette fonction juste après avoir reçu `FINISHED` de `fullenrich-lookup`, en plus de mettre à jour son state local).

---

## 6. Modifications frontend prévues (documentées, **non appliquées**)

| Fichier | Changement prévu | Urgence / phase |
|---|---|---|
| `src/lib/types.ts` | Ajouter les interfaces `Opportunite`, `OpportuniteAlerte`, `OpportuniteDecideur`, `OpportuniteHistorique`, `CompteStrategique`, et étendre `PertinenceEntreprise` avec les colonnes additives de la section 2.7. | Phase A (types seuls, aucun effet UI) |
| `src/pages/DashboardPage.tsx` | Remplacer le commentaire "TEMPORAIRE (dev/QA)" par la logique définitive : le sélecteur d'entreprise (`visibleEntreprises`) ne s'affiche que si `profile.role === 'admin'` ; pour un `member`, `activeEntrepriseId` est fixé une fois pour toutes à `profile.entreprise_id` sans possibilité de changer. | Phase C (après durcissement RLS section 4.2) |
| `src/components/AlertRow.tsx` | Remplacer `supabase.from('alertes').update(patch)` par `supabase.functions.invoke('update-alert-workflow', { body: { alerteId, statut, notesEquipe } })`. | Phase C |
| `src/components/ContactFinder.tsx` | Remplacer les deux `insert()` directs par un seul appel `supabase.functions.invoke('attach-decideur-to-signal', ...)`. | Phase A/B (corrige un bug RLS latent, indépendant du reste) |
| `src/components/DecideurEnrichButton.tsx`, `src/pages/ElusPage.tsx` (composant `EnrichButton`) | Après réception d'un résultat `FINISHED` de `fullenrich-lookup`, appeler en plus `supabase.functions.invoke('persist-enrichment-result', ...)`. | Phase A/B |
| `src/pages/AdminPage.tsx` (`EntrepriseEditCard`) | Ajouter les champs manquants (`pays`, `regions_suivies`, `departements_suivis`, `types_opportunite_suivis`, `onboarding_complete`) — ou, alternative plus simple, remplacer ce formulaire par `EntrepriseProfileForm` déjà existant (réutilisation, pas de duplication). Décision à trancher avec Hope (section 15). | Phase C |
| **Nouveau (documenté uniquement, non développé)** `src/pages/OpportunitesPage.tsx` | Page bêta listant les `opportunites` de l'entreprise active, triée par `priorite_commerciale desc`, avec filtre par `statut`/`maturite`, et une vue détail affichant les `opportunite_alertes` (signaux), `opportunite_decideurs` (contacts), `opportunite_historique` (journal). Requête indicative : `supabase.from('opportunites').select('*, opportunite_alertes(*, alertes(*)), opportunite_decideurs(*, decideurs(*))').eq('entreprise_id', activeEntrepriseId).order('priorite_commerciale', { ascending: false })`. | Phase D — **non développée à ce stade**, modèle de données et requête seulement |
| `src/components/AppSidebar.tsx` | Futur lien "Opportunités" (bêta) sous "Renouvellements", masqué derrière un flag tant que la page n'existe pas. | Phase D |
| `src/App.tsx` | Future route `/dashboard/opportunites` pointant vers `OpportunitesPage`. | Phase D |
| Page `Alertes` actuelle (`DashboardPage.tsx` + `AlertRow.tsx`) | **Conservée telle quelle sur le fond** — seuls les points ci-dessus (sélecteur, update alertes) changent, aucune suppression de fonctionnalité. | Toutes phases |

---

## 7. Scoring de pertinence personnalisé

Calculé par `score-alert-for-company`, par couple `(alerte, entreprise)`, jamais globalement.

Pondération proposée (configurable — stockée en dur dans l'edge function au départ, migrable vers une table de configuration si Hope souhaite l'ajuster sans redéploiement) :

| Critère | Poids | Source |
|---|---|---|
| Compétences | 25 % | `entreprises.competences` vs contenu de l'alerte (`resume`, `texte_extrait_document`, `mots_cles`) |
| Type d'opportunité | 20 % | `entreprises.types_opportunite_suivis` vs `alertes.type_opportunite` |
| Secteurs d'intervention | 15 % | `entreprises.secteurs_intervention` |
| Références clients | 15 % | `entreprises.references_clients` (l'acteur de l'alerte apparaît-il comme référence ou secteur proche ?) |
| Géographie | 10 % | `entreprises.pays`/`regions_suivies`/`departements_suivis` vs `alertes.pays`/`region`/`departement` |
| Mots-clés métiers | 5 % | `entreprises.mots_cles_metiers` |
| Compte stratégique | 10 % | présence de l'acteur de l'alerte (ou un de ses `aliases`) dans `comptes_strategiques` de cette entreprise |

Le score n'est **pas** une simple similarité textuelle : chaque sous-score (`score_competences`, `score_references`, etc.) est calculé par un appel Claude Haiku structuré (même famille de prompt que `extract-entreprise-from-website`), qui reçoit le profil entreprise ET le contenu de l'alerte, et doit retourner un JSON strict `{ score: 0-100, critères_correspondants: [...], critères_absents: [...], compétences_détectées: [...], références_mobilisables: [...], incompatibilités_géographiques: [...] }` par dimension — jamais une simple mesure de similarité de vecteurs. Le résultat agrégé (`score_numerique`) est la somme pondérée des sous-scores, stocké avec sa décomposition complète dans `explication_score` (jsonb).

Correspondance `score_numerique` → `score_pertinence` (colonne existante, conservée) :

| Score numérique | Score qualitatif |
|---|---|
| 85–100 | Très Haute |
| 70–84 | Haute |
| 50–69 | Moyenne |
| 25–49 | Basse |
| 0–24 | À confirmer ou Écarté selon le contexte (à confirmer si aucun signal contradictoire, écarté si `statut` manuel passé à `Écarté` par un utilisateur) |

---

## 8. Probabilité du projet

Calculée par `recalculate-opportunity-probability`, au niveau du **dossier**, à partir de tous ses `opportunite_alertes`.

Contribution par signal :

```
contribution = force_signal/100 × fiabilite_source × coefficient_fraicheur
             × coefficient_independance × coherence_geographique × coherence_temporelle
```

Agrégation (ne dépasse jamais 100 % artificiellement, plus de signaux indépendants augmente la confiance sans jamais atteindre la certitude) :

```
P = 1 − Π (1 − contribution_normalisee_i)   pour chaque signal i
```

Garde-fous métier appliqués avant/après l'agrégation :

- Un seul signal de famille `RH` (recrutement générique) ne peut à lui seul faire dépasser `P` au-delà d'un plafond bas (ex. 25 %) — implémenté en plafonnant sa `contribution` si c'est le seul signal présent.
- Un signal de famille `ADMINISTRATIF` (permis, autorisation officielle) a une `force_signal` de référence supérieure (proposé : 80-90 vs 30-50 pour un article de presse) — reflété dans les valeurs par défaut suggérées à `score-alert-for-company`/`create-or-update-opportunity`, pas dans une contrainte SQL.
- Plusieurs signaux de la **même famille** (`ref_type_signal.famille`) relatant manifestement le même fait (même date à ±quelques jours, même source ou reprise évidente d'un communiqué) reçoivent un `coefficient_independance` réduit (proche de 0 pour les copies, proche de 1 pour des sources réellement distinctes) plutôt que d'être comptés comme des signaux pleinement indépendants.
- Un signal `sens_signal = 'negatif'` (projet annulé, permis refusé) réduit `P` — implémenté en le traitant comme une contribution négative dans l'agrégation (`P` recalculé en excluant puis en soustrayant l'effet du signal négatif, formule affinée à valider en Phase A avec des cas réels).
- Un signal de type `COMMUNIQUE_OFFICIEL` confirme mais arrive souvent tard : `coefficient_fraicheur` proposé structurellement plus bas pour cette famille par défaut, pour éviter qu'il ne soit interprété comme un signal précoce à forte valeur prédictive.

Le détail complet (quels signaux, quelles contributions, quels garde-fous appliqués) est stocké dans `opportunites.justification_probabilite` (texte) et reste consultable via `opportunite_historique` (événement `MAJ_PROBABILITE`, `ancienne_valeur`/`nouvelle_valeur`).

---

## 9. Priorité commerciale

Calculée par `recalculate-commercial-priority` :

```
priorite_commerciale = 0.35 × probabilite_projet
                      + 0.35 × adequation_client
                      + 0.10 × score_maturite(maturite)
                      + 0.10 × score_acces_decideurs(opportunite_decideurs)
                      + 0.10 × score_urgence(date_prochaine_action, horizon_min_mois)
```

où `score_maturite`, `score_acces_decideurs` et `score_urgence` sont des fonctions de normalisation 0-100 définies dans l'edge function (ex. `score_acces_decideurs` = proportion de rôles clés — `SPONSOR`/`DECIDEUR_BUDGETAIRE` — déjà identifiés et `statut_contact != 'A_CONTACTER'`).

Mapping vers une recommandation (stockée dans `recommandation_commerciale` + `recommandation_explication`) :

| Plage | Recommandation | Exemple d'explication générée |
|---|---|---|
| ≥ 80 et probabilité ≥ 70 | Priorité haute | "Probabilité élevée (X %), forte adéquation (Y %), décideur clé déjà identifié." |
| ≥ 60 | Contacter | "Adéquation et probabilité suffisantes pour engager un premier contact." |
| ≥ 40 | Qualifier | "Signal intéressant mais probabilité ou adéquation encore incertaine — approfondir." |
| ≥ 20 | Surveiller | "Trop tôt pour agir, à conserver en veille active." |
| < 20 ou `statut = 'Écarté'` sur les pertinences liées | Écarter | "Adéquation ou probabilité insuffisante au regard du profil client." |

---

## 10. Règles de création et de rattachement automatique

### Création automatique d'une opportunité (dans `create-or-update-opportunity`)

Déclenchée uniquement si **au moins une** des conditions suivantes est vraie (jamais une transformation systématique alerte → opportunité) :

- `acteur_entite` (ou `acteur_normalise`) identifiable ET `type_opportunite` identifiable ET zone/site suffisamment précis (departement ou commune renseigné) ET `pertinence_entreprise.score_numerique ≥ 70` ;
- le signal est intrinsèquement fort (`force_signal ≥ 80`, typiquement un permis/autorisation officielle) ;
- plusieurs signaux indépendants convergent (au moins 2 `opportunite_alertes` candidates avec `coefficient_independance ≥ 0.6` chacun, avant même la création formelle du dossier — vérifié par simulation dans `find-matching-opportunity` avant confirmation).

### Rattachement à une opportunité existante

Barème (dans `find-matching-opportunity`) :

| Critère | Points |
|---|---|
| Même acteur ou filiale | 30 |
| Même site ou commune | 25 |
| Même type d'opportunité | 20 |
| Même programme ou installation | 10 |
| Temporalité compatible | 10 |
| Vocabulaire métier cohérent | 5 |

Décision :

- **85–100** : rattachement automatique (`mode_rattachement = 'AUTOMATIQUE'`).
- **65–84** : proposition à confirmer par un utilisateur (`mode_rattachement = 'PROPOSE_A_CONFIRMER'`) — pas d'écriture automatique dans `opportunite_alertes` tant que non confirmé (stocké temporairement côté réponse de fonction, pas en base, jusqu'à confirmation explicite via un futur appel `create-or-update-opportunity` avec `opportuniteIdCible` renseigné).
- **< 65** : aucun rattachement automatique, création d'un nouveau dossier si les critères de création ci-dessus sont remplis, sinon aucune action.

Règle explicite : ne jamais fusionner deux sites uniquement parce qu'ils appartiennent au même groupe — le score de rattachement porte sur le site/commune ET l'acteur, pas sur l'acteur seul (une filiale à Lyon et une filiale à Lille du même groupe restent deux dossiers distincts sauf convergence complémentaire sur le site).

---

## 11. Stratégie de migration en 4 phases

### Phase A — Fondations (invisible pour l'utilisateur)

- Exécution des fichiers SQL 001 à 008 (tables de référence, nouvelles tables, colonnes additives sur `pertinence_entreprise`, index).
- Activation RLS + policies des **nouvelles tables uniquement** (section 4.1) — n'affecte aucune table existante.
- Déploiement des edge functions `score-alert-for-company`, `find-matching-opportunity`, `create-or-update-opportunity`, `recalculate-opportunity-probability`, `recalculate-opportunity-fit`, `recalculate-commercial-priority`, `generate-opportunity-actions`, `link-opportunity-decision-maker`, `correct-opportunity-grouping`, en mode **non appelé** par le frontend existant (aucune modification frontend requise à ce stade).
- Déploiement de `attach-decideur-to-signal` et `persist-enrichment-result`, et mise à jour minimale de `ContactFinder.tsx`/`DecideurEnrichButton.tsx`/`EnrichButton` pour les utiliser (seul changement frontend de cette phase, corrige un bug RLS latent sans changer le comportement visible).
- **Critère de sortie** : toutes les tables/fonctions existent, aucune régression sur le dashboard actuel (vérifié par le plan de tests section 12), zéro appel des nouvelles fonctions de scoring depuis la production.

### Phase B — Mode miroir

- Pour chaque nouvelle alerte insérée par le pipeline de collecte : appel de `score-alert-for-company` (calcule les nouveaux scores en parallèle des scores existants, sans les remplacer) puis, si les seuils sont atteints, `create-or-update-opportunity` en mode `DETECTEE`/`statut_validation = 'VALIDE_AUTO'`.
- Le dashboard actuel (`DashboardPage.tsx`) continue de fonctionner strictement à l'identique — aucune lecture des nouvelles tables par l'UI en production.
- Option de rattrapage historique (à valider, section 15) : exécuter le pipeline sur les 295 alertes existantes pour peupler `opportunites` rétroactivement, en tâche de fond, hors heures de charge.
- **Critère de sortie** : volume d'opportunités créées cohérent avec le volume d'alertes/pertinences, pas d'explosion du nombre de dossiers (surveiller le ratio opportunités/alertes), scores stables sur rejeu (déterminisme).

### Phase C — Validation

- Durcissement RLS sur `entreprises`, `pertinence_entreprise`, `alertes` (section 4.2) — appliqué seulement après que `AlertRow.tsx` utilise `update-alert-workflow` et que `DashboardPage.tsx` masque le sélecteur d'entreprise pour les membres.
- Test obligatoire avec au moins deux entreprises à profils différents (ex. Ekium vs une autre entreprise cliente active) : vérifier qu'une même alerte reçoit des scores différents, est rattachée à une opportunité pour l'une, reste isolée/écartée pour l'autre — critère d'acceptation explicite du brief.
- Revue manuelle par Hope d'un échantillon d'opportunités créées automatiquement (précision du scoring, pertinence des rattachements) avant d'ouvrir l'accès en lecture à qui que ce soit côté produit.
- **Critère de sortie** : cas obligatoire validé, RLS durcie sans régression fonctionnelle observée, échantillon d'opportunités jugé pertinent par Hope.

### Phase D — Interface bêta

- Ajout de la page `OpportunitesPage.tsx` (section 6), du lien sidebar, de la route — sans retirer la page Alertes existante.
- Accès probablement limité au départ (flag ou rôle admin uniquement le temps de valider l'adoption), puis ouverture progressive aux membres.
- **Non développée dans le cadre de cette conception** — modèle de données et requêtes documentés uniquement, comme demandé.

---

## 12. Plan de tests

1. **Non-régression du dashboard actuel** (avant toute Phase B) : rejouer les scénarios existants — filtre par bucket/catégorie/région/type, changement de statut d'une alerte, assignation par email, ajout de note, ouverture de l'assistant IA, ContactFinder, enrichissement FullEnrich — sur un environnement de branche Supabase (`create_branch`) plutôt qu'en production.
2. **Cohérence du trigger** (section 3) : tenter d'insérer une ligne `opportunite_alertes` avec un `entreprise_id` ne correspondant pas à l'opportunité, puis avec un `pertinence_entreprise_id` ne correspondant pas au couple `(alerte_id, entreprise_id)` — vérifier que les deux cas lèvent bien une exception.
3. **Idempotence des edge functions de recalcul** : appeler deux fois de suite `recalculate-opportunity-probability`/`-fit`/`recalculate-commercial-priority` sur le même dossier sans modification entre-temps, vérifier des résultats strictement identiques.
4. **Cas obligatoire multi-entreprise** (section 11, Phase C) : une alerte donnée, deux entreprises de profils différents, vérifier score/rattachement différenciés.
5. **RLS des nouvelles tables** : avec un compte `member` de l'entreprise A, vérifier qu'un `select` sur `opportunites` d'une entreprise B renvoie zéro ligne (pas une erreur — RLS filtre silencieusement, comportement Postgres normal).
6. **RLS durcies (Phase C)** : avec un compte `member`, vérifier qu'un `select` sur `entreprises`/`pertinence_entreprise` d'une autre entreprise renvoie zéro ligne ; vérifier qu'un `update` direct sur une alerte sans pertinence active pour son entreprise échoue.
7. **Non-duplication** : appeler `create-or-update-opportunity` deux fois avec la même alerte/entreprise, vérifier qu'une seule ligne `opportunite_alertes` existe (contrainte unique) et qu'aucun second dossier n'est créé.
8. **Garde-fous de probabilité** : cas synthétique avec un seul signal RH (`force_signal` faible) → vérifier `probabilite_projet` plafonnée basse ; cas avec un signal `sens_signal = 'negatif'` → vérifier la baisse de probabilité.
9. **Fusion/séparation** (`correct-opportunity-grouping`) : vérifier qu'une fusion déplace bien toutes les lignes `opportunite_alertes`/`opportunite_decideurs`, que le dossier source passe en `FUSIONNEE` sans être supprimé, et que `opportunite_historique` trace l'événement sur les deux dossiers.
10. **Volume/performance** : `EXPLAIN ANALYZE` des requêtes prévues pour `OpportunitesPage` (tri par `priorite_commerciale`, filtre par `statut`) avant d'ouvrir la Phase D, sur un jeu de données simulé à l'échelle cible.

---

## 13. Plan de retour arrière

Conçu pour être réversible à chaque phase, sans jamais toucher aux tables existantes :

- **Phase A** : `DROP TABLE` (dans l'ordre inverse des dépendances : `opportunite_historique`, `opportunite_decideurs`, `opportunite_alertes`, `opportunites`, `comptes_strategiques`, puis les tables `ref_*`), `ALTER TABLE veille.pertinence_entreprise DROP COLUMN` pour chaque colonne additive de la section 2.7, suppression des edge functions ajoutées (`deploy_edge_function` avec un stub 410 en attendant un futur outil de suppression, convention déjà utilisée dans ce projet pour les fonctions à usage unique). Aucun impact sur l'existant : rollback total possible à tout moment de cette phase.
- **Phase B** : arrêt de l'appel à `score-alert-for-company`/`create-or-update-opportunity` depuis le pipeline (flag de configuration à désactiver, pas de redéploiement de schéma nécessaire) ; les lignes déjà créées dans `opportunites`/`opportunite_alertes` peuvent être laissées en place (invisibles, aucune UI ne les lit) ou purgées via `TRUNCATE` si un rollback complet est souhaité — décision sans risque puisqu'aucune donnée d'entrée (alertes, pertinences) n'a été modifiée.
- **Phase C** : le rollback RLS est un simple `DROP POLICY` des nouvelles policies durcies suivi de la recréation des policies d'origine (conservées telles quelles dans ce document, section identifiée par leur nom exact `authenticated read entreprises`, `authenticated read pertinence`, `authenticated update alertes`) ; rollback frontend par redéploiement de la version précédente de `DashboardPage.tsx`/`AlertRow.tsx` (le contrôle de version Netlify permet de republier un déploiement antérieur sans递rebuild).
- **Phase D** : suppression de la route/lien, aucun impact sur le reste de l'application (page isolée, aucune donnée existante modifiée par sa simple présence).
- **Principe général** : à aucun moment une opération de rollback ne nécessite de toucher `veille.alertes`, `veille.pertinence_entreprise` (colonnes existantes), `veille.decideurs`, `veille.attachments`, `veille.profiles` ou `veille.abonnements_alertes` dans leur périmètre actuel — seules des colonnes/tables strictement additives sont concernées.

---

## 14. Risques

1. **Volume d'opportunités créées automatiquement en Phase B** : si les seuils (section 10) sont mal calibrés, risque de sur-génération (un dossier par alerte quasiment) ou de sous-génération (peu de dossiers créés, valeur perçue faible) — nécessite un premier calibrage empirique sur données réelles avant ouverture en Phase D.
2. **Coût des appels IA** : `score-alert-for-company` et `generate-opportunity-actions` appellent Claude Haiku par couple alerte/entreprise — à N entreprises actives et un flux d'alertes soutenu, le volume d'appels peut croître rapidement ; prévoir un contrôle de coût/quota avant la Phase B en production.
3. **Séquencement RLS/frontend (Phase C)** : durcir `authenticated update alertes` avant que `AlertRow.tsx` utilise `update-alert-workflow` casserait la fonctionnalité de changement de statut/notes en production — dépendance stricte à respecter dans l'ordre de déploiement.
4. **Non-atomicité actuelle de `ContactFinder.tsx`** (deux inserts séparés) : en attendant le passage à `attach-decideur-to-signal`, un échec du second insert (`alerte_decideurs`) après succès du premier (`decideurs`) laisse un décideur orphelin — risque préexistant, non aggravé par cette conception mais à corriger rapidement (Phase A, priorité haute car indépendant du reste).
5. **`opportunite_historique` sans purge prévue** : table d'audit append-only, croissance illimitée dans le temps — prévoir une politique de rétention/archivage si le volume devient significatif (hors périmètre de cette conception, à anticiper).
6. **Ambiguïté du champ `devise`** : la contrainte `~ '^[A-Z]{3}$'` valide un format mais pas une devise réelle (ex. `ZZZ` passerait) — acceptable en première version, à durcir avec une table de référence des devises si besoin international réel.
7. **Dépendance à la qualité de `acteur_normalise`** : le rattachement automatique (section 10) et la détection de doublons de signaux (section 9) reposent sur la capacité à normaliser un nom d'acteur (filiales, orthographes variables) — aucune normalisation automatique n'est proposée dans ce document (nécessiterait un référentiel d'entreprises tiers, ex. SIREN via Pappers, hors périmètre actuel) ; risque de rattachements manqués ou erronés tant que `acteur_normalise` est renseigné manuellement ou par une heuristique simple.
8. **`comptes_strategiques` mal maintenu** : si Hope ou les admins n'entretiennent pas cette table à jour, le `score_compte_strategique` (10 % du score de pertinence) devient silencieusement toujours nul — risque de dégradation progressive et invisible de la pertinence du scoring.

---

## 15. Décisions nécessitant une validation humaine

1. **Pondérations de scoring** (25/20/15/15/10/5/10 pour la pertinence, 35/35/10/10/10 pour la priorité commerciale) : proposées conformes au brief, à confirmer avec Hope avant tout calibrage réel — ce sont des paramètres produit, pas des choix techniques.
2. **Rattrapage historique en Phase B** : faut-il calculer rétroactivement des opportunités pour les 295 alertes déjà en base, ou ne démarrer que sur les nouvelles alertes à partir de la mise en service ? Impact sur le coût IA immédiat vs valeur perçue dès le lancement.
3. **Agrégation de l'adéquation client** (`recalculate-opportunity-fit`) quand un dossier regroupe plusieurs `pertinence_entreprise` : moyenne, maximum, ou pondération par ancienneté du signal ? Non tranché dans ce document, à décider avant implémentation.
4. **Visibilité de `comptes_strategiques`** : réservée aux admins uniquement (proposé par défaut, section 4.1), ou lisible par les membres de l'entreprise concernée ? Question de confidentialité commerciale interne à trancher avec Hope.
5. **Devenir de `AdminPage.tsx` (onglet Entreprises)** : compléter son formulaire pour couvrir tous les champs d'onboarding, ou le remplacer entièrement par `EntrepriseProfileForm` (réutilisation, moins de code dupliqué) ? Décision produit/UX.
6. **Séquencement exact du durcissement RLS sur `alertes`** (section 4.2, point 3) : accepté tel quel (accès restreint aux alertes ayant une pertinence active), ou une entreprise doit-elle pouvoir continuer à voir/agir sur des alertes historiquement traitées même si leur pertinence est passée à `Écarté` entre-temps ? Nuance métier à confirmer.
7. **Ouverture du sélecteur d'entreprise aux membres** : confirmation explicite que la suppression de cette possibilité (actuellement "TEMPORAIRE dev/QA" dans le code) est bien souhaitée en Phase C, et non plus seulement pour la phase de test QA en cours.
8. **Contrôle de coût des appels IA** (risque 2 ci-dessus) : faut-il un quota/seuil dur avant la mise en production de la Phase B, ou un simple suivi des coûts a posteriori ?
9. **Politique de rétention de `opportunite_historique`** : durée de conservation, ou conservation illimitée assumée dès le départ ?
10. **Format `devise`** : format libre à 3 lettres (proposé) suffisant, ou liste fermée de devises réellement utilisées par WINOVYA (EUR, USD, GBP...) ?

---

**Rappel final : ce document est une proposition de conception. Aucun élément ci-dessus n'a été exécuté, déployé ou appliqué. Toute mise en œuvre nécessite une validation explicite, phase par phase, en particulier sur les points listés en section 15.**
