-- Sprint 8 — Phase 8 : jeu de données de démonstration Staging
-- ("SPRINT8-DEMO"), strictement réservé à Staging (gcitqpgucepgroermzti).
--
-- RÈGLES ABSOLUES :
--   - Ne JAMAIS exécuter ce script sur Production (mhsbwabrvcqnxnwamvwc).
--   - Données entièrement fictives, préfixées "SPRINT8-DEMO" (titres et
--     nom d'entreprise) pour être identifiables et supprimables sans
--     ambiguïté (voir sprint8-demo-cleanup.sql).
--   - Aucune donnée personnelle réelle : le "décideur" fictif utilise un
--     nom, un email et un téléphone inventés, sans rapport avec une
--     personne réelle.
--   - IDEMPOTENT : ce script utilise des UUID fixes pour l'entreprise et
--     les opportunités (upsert via `on conflict (id) do update`) et
--     recrée les sous-ressources (preuves, décideurs liés, alertes
--     liées) par un delete+insert scopé à ces mêmes UUID fixes — le
--     relancer plusieurs fois ne duplique jamais rien et resynchronise
--     l'état à chaque exécution.
--   - N'écrit QUE dans des lignes dont l'id commence par le préfixe
--     'a0000000-8888-4000-8000-' : ne touche jamais une donnée réelle.
--   - N'assigne QUE le profil fictif admin.staging@example.com (Sprint 0B,
--     préexistant, jamais créé/modifié par ce script).
--
-- Couvre les 10 scénarios minimums demandés par le Sprint 8 (Phase 8),
-- plus 1 scénario bonus (LOST) :
--   1. Nouvelle opportunité, forte confiance
--   2. Partiellement enrichie
--   3. Sans budget identifié
--   4. Plusieurs signaux (+ 1 alerte liée, pour Chronologie/AlertesLiées)
--   5. Avec preuves et décideurs
--   6. Assignée (à admin.staging@example.com)
--   7. Qualifiée
--   8. Gagnée (WON)
--   8b. Perdue (LOST) — bonus
--   9. Archivée
--   10. Dossier sans aucune sous-ressource liée (état "vide" complet)

begin;

-- 1. Entreprise fictive unique, support de toutes les opportunités de démo.
insert into veille.entreprises (id, name, status, pays, onboarding_complete)
values ('a0000000-8888-4000-8000-000000000001', 'SPRINT8-DEMO Entreprise Cliente', 'active', array['France'], true)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  pays = excluded.pays,
  onboarding_complete = excluded.onboarding_complete;

-- 2. Les 11 opportunités de démonstration (upsert par id fixe).
insert into veille.opportunites (
  id, titre, resume, statut, entreprise_id, entite_cible, type_opportunite,
  secteur, geographie, nombre_signaux, date_premier_signal, date_dernier_signal,
  phase_projet, budget_identifie, budget_source, budget_fiabilite, niveau_confiance,
  statut_enrichissement, raisons, derniere_consolidation_at, assigned_to, assigned_at
) values
  -- 1. Nouvelle, forte confiance
  ('a0000000-8888-4000-8000-000000000002',
   'SPRINT8-DEMO — Rénovation énergétique groupe scolaire', 'Rénovation énergétique complète d''un groupe scolaire, budget voté.',
   'NEW', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Bâtiment', 'Île-de-France',
   3, now() - interval '12 days', now() - interval '1 day', 'CONSULTATION',
   680000, 'BOAMP', 'Officiel', 'Élevé', 'ready',
   '["Budget voté en conseil municipal", "Trois signaux convergents sur 12 jours"]'::jsonb, now(), null, null),

  -- 2. Partiellement enrichie
  ('a0000000-8888-4000-8000-000000000003',
   'SPRINT8-DEMO — Extension médiathèque intercommunale', 'Extension partiellement documentée, enrichissement en cours.',
   'QUALIFYING', 'a0000000-8888-4000-8000-000000000001', 'Communauté de communes Démo', 'Travaux', 'Bâtiment', 'Occitanie',
   1, now() - interval '4 days', now() - interval '4 days', 'ETUDE',
   null, null, null, 'Moyen', 'partial',
   '["Un seul signal détecté, enrichissement partiel"]'::jsonb, now() - interval '4 days', null, null),

  -- 3. Sans budget identifié
  ('a0000000-8888-4000-8000-000000000004',
   'SPRINT8-DEMO — Aménagement voirie centre-bourg', 'Aménagement de voirie sans budget public communiqué à ce stade.',
   'QUALIFIED', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Voirie', 'Nouvelle-Aquitaine',
   2, now() - interval '20 days', now() - interval '6 days', 'ANNONCE',
   null, null, null, 'Faible', 'ready',
   '["Aucun montant communiqué dans les documents disponibles"]'::jsonb, now(), null, null),

  -- 4. Plusieurs signaux
  ('a0000000-8888-4000-8000-000000000005',
   'SPRINT8-DEMO — Construction gymnase intercommunal', 'Projet suivi depuis deux mois, six signaux convergents.',
   'NEW', 'a0000000-8888-4000-8000-000000000001', 'Communauté de communes Démo', 'Construction', 'Sport', 'Grand Est',
   6, now() - interval '60 days', now() - interval '2 days', 'AUTORISATION',
   1200000, 'Presse locale', 'Probable', 'Élevé', 'ready',
   '["Six signaux distincts sur 60 jours", "Autorisation d''urbanisme accordée"]'::jsonb, now(), null, null),

  -- 5. Avec preuves et décideurs (liés plus bas)
  ('a0000000-8888-4000-8000-000000000006',
   'SPRINT8-DEMO — Réhabilitation piscine municipale', 'Décideurs identifiés et preuves documentaires rattachées.',
   'QUALIFIED', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Sport', 'Auvergne-Rhône-Alpes',
   2, now() - interval '15 days', now() - interval '3 days', 'CONSULTATION',
   410000, 'Délibération', 'Officiel', 'Moyen', 'ready',
   '["Décideur budgétaire identifié", "Deux preuves documentaires rattachées"]'::jsonb, now(), null, null),

  -- 6. Assignée (admin.staging@example.com, profil fictif Sprint 0B)
  ('a0000000-8888-4000-8000-000000000007',
   'SPRINT8-DEMO — Modernisation éclairage public', 'Dossier suivi par l''équipe commerciale.',
   'QUALIFYING', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Voirie', 'Bretagne',
   2, now() - interval '10 days', now() - interval '5 days', 'ETUDE',
   150000, 'Presse locale', 'Probable', 'Moyen', 'ready',
   '["Assigné pour qualification commerciale"]'::jsonb, now(), '82231ff5-8a5c-4521-aead-aca8b2063770', now() - interval '3 days'),

  -- 7. Qualifiée
  ('a0000000-8888-4000-8000-000000000008',
   'SPRINT8-DEMO — Rénovation toiture collège', 'Dossier qualifié, en cours de préparation de proposition.',
   'QUALIFIED', 'a0000000-8888-4000-8000-000000000001', 'Département Démo', 'Travaux', 'Bâtiment', 'Hauts-de-France',
   3, now() - interval '25 days', now() - interval '7 days', 'CONSULTATION',
   320000, 'BOAMP', 'Officiel', 'Élevé', 'ready',
   '["Qualification commerciale confirmée"]'::jsonb, now(), null, null),

  -- 8. Gagnée
  ('a0000000-8888-4000-8000-000000000009',
   'SPRINT8-DEMO — Signalétique numérique mairie', 'Marché remporté.',
   'WON', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Fournitures', 'Numérique', 'Île-de-France',
   4, now() - interval '90 days', now() - interval '30 days', 'APPEL_OFFRES',
   45000, 'Notification', 'Officiel', 'Élevé', 'ready',
   '["Marché notifié gagné"]'::jsonb, now(), null, null),

  -- 8b. Perdue (bonus)
  ('a0000000-8888-4000-8000-000000000010',
   'SPRINT8-DEMO — Rénovation parking mairie', 'Marché perdu au profit d''un concurrent.',
   'LOST', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Voirie', 'Pays de la Loire',
   2, now() - interval '50 days', now() - interval '20 days', 'APPEL_OFFRES',
   90000, 'Notification', 'Officiel', 'Moyen', 'ready',
   '["Marché notifié perdu"]'::jsonb, now(), null, null),

  -- 9. Archivée
  ('a0000000-8888-4000-8000-000000000011',
   'SPRINT8-DEMO — Étude faisabilité médiathèque', 'Dossier archivé, projet abandonné par la collectivité.',
   'ARCHIVED', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Étude', 'Bâtiment', 'Centre-Val de Loire',
   1, now() - interval '120 days', now() - interval '100 days', 'INTENTION',
   null, null, null, 'Faible', 'ready',
   '["Projet abandonné par la collectivité"]'::jsonb, now(), null, null),

  -- 10. Dossier vide (aucune sous-ressource, aucun budget, aucune raison)
  ('a0000000-8888-4000-8000-000000000012',
   'SPRINT8-DEMO — Signal isolé sans enrichissement', 'Signal unique, aucune information complémentaire disponible.',
   'NEW', 'a0000000-8888-4000-8000-000000000001', null, null, null, null,
   1, now() - interval '1 day', now() - interval '1 day', null,
   null, null, null, null, 'pending',
   '[]'::jsonb, null, null, null)

on conflict (id) do update set
  titre = excluded.titre,
  resume = excluded.resume,
  statut = excluded.statut,
  entreprise_id = excluded.entreprise_id,
  entite_cible = excluded.entite_cible,
  type_opportunite = excluded.type_opportunite,
  secteur = excluded.secteur,
  geographie = excluded.geographie,
  nombre_signaux = excluded.nombre_signaux,
  date_premier_signal = excluded.date_premier_signal,
  date_dernier_signal = excluded.date_dernier_signal,
  phase_projet = excluded.phase_projet,
  budget_identifie = excluded.budget_identifie,
  budget_source = excluded.budget_source,
  budget_fiabilite = excluded.budget_fiabilite,
  niveau_confiance = excluded.niveau_confiance,
  statut_enrichissement = excluded.statut_enrichissement,
  raisons = excluded.raisons,
  derniere_consolidation_at = excluded.derniere_consolidation_at,
  assigned_to = excluded.assigned_to,
  assigned_at = excluded.assigned_at;

-- 3. Décideur fictif (scénario 5) — nom/coordonnées entièrement inventés.
insert into veille.decideurs (
  id, nom, nature, nom_personne, prenom_personne, fonction_poste, email, telephone, linkedin, role_achat, statut
) values (
  'a0000000-8888-4000-8000-000000000090',
  'SPRINT8-DEMO Mairie de Démoville', 'Public', 'Untel', 'Jean',
  'Directeur des services techniques', 'jean.untel@demo-fictif.exemple', '+33 1 00 00 00 00',
  null, 'Décideur budgétaire (DAF/DSI/élu rapporteur)', 'À jour'
)
on conflict (id) do update set
  nom = excluded.nom,
  nature = excluded.nature,
  nom_personne = excluded.nom_personne,
  prenom_personne = excluded.prenom_personne,
  fonction_poste = excluded.fonction_poste,
  email = excluded.email,
  telephone = excluded.telephone,
  role_achat = excluded.role_achat,
  statut = excluded.statut;

-- 4. Alerte fictive (scénario 4) — rattachée à l'opportunité "plusieurs signaux".
insert into veille.alertes (
  id, name, categorie_veille, pays, date_detection, date_publication, montant,
  reference_officielle, lien_source_url, resume, statut
) values (
  'a0000000-8888-4000-8000-000000000091',
  'SPRINT8-DEMO — Autorisation d''urbanisme gymnase intercommunal',
  '4. Urbanisme (compatibilité)', 'France', now() - interval '10 days', (now() - interval '10 days')::date,
  1200000, 'DEMO-URBA-001', null,
  'Autorisation d''urbanisme accordée pour la construction du gymnase intercommunal (donnée fictive).',
  'TRAITE'
)
on conflict (id) do update set
  name = excluded.name,
  categorie_veille = excluded.categorie_veille,
  date_detection = excluded.date_detection,
  montant = excluded.montant,
  reference_officielle = excluded.reference_officielle,
  resume = excluded.resume,
  statut = excluded.statut;

-- 5. Sous-ressources liées : recréées à chaque exécution (idempotent),
--    scopées strictement aux opportunités de démo ci-dessus.
delete from veille.opportunite_preuves where opportunite_id in (
  'a0000000-8888-4000-8000-000000000006'
);
insert into veille.opportunite_preuves (opportunite_id, source, citation, url) values
  ('a0000000-8888-4000-8000-000000000006', 'Délibération du conseil municipal (fictive)', 'Le conseil municipal approuve la réhabilitation de la piscine pour un montant de 410 000 €.', null),
  ('a0000000-8888-4000-8000-000000000006', 'Presse locale (fictive)', 'Le journal local (fictif) confirme le lancement des travaux au T2.', null);

delete from veille.opportunite_decideurs where opportunite_id in (
  'a0000000-8888-4000-8000-000000000006'
);
insert into veille.opportunite_decideurs (opportunite_id, decideur_id) values
  ('a0000000-8888-4000-8000-000000000006', 'a0000000-8888-4000-8000-000000000090');

delete from veille.opportunite_alertes where opportunite_id in (
  'a0000000-8888-4000-8000-000000000005'
);
insert into veille.opportunite_alertes (opportunite_id, alerte_id) values
  ('a0000000-8888-4000-8000-000000000005', 'a0000000-8888-4000-8000-000000000091');

commit;
