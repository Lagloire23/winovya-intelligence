-- Sprint 9 — Phase 16 : extension du jeu de données de démonstration
-- "SPRINT8-DEMO" (voir scripts/sprint8-demo-seed.sql) pour couvrir les
-- scénarios spécifiques au cockpit (admin + utilisateur). Réservé à
-- Staging (gcitqpgucepgroermzti). Ne JAMAIS exécuter sur Production.
--
-- Règles identiques au jeu Sprint 8 : préfixe d'id fixe
-- 'a0000000-8888-4000-8000-%' (3 nouvelles opportunités, ids ...013 à
-- ...015), idempotent (UUID fixes + `on conflict (id) do update`),
-- entièrement fictif, nettoyé par le MÊME script
-- scripts/sprint8-demo-cleanup.sql (celui-ci nettoie par préfixe, pas par
-- id individuel — aucun nouveau script de nettoyage nécessaire).
--
-- Couvre les exigences minimales Sprint 9 (Phase 16) côté utilisateur
-- (profil fictif user.staging@example.com, Sprint 0B, id
-- d0ecec03-7ec1-4700-a836-b1dcace0b919) :
--   - >= 3 opportunités assignées à user.staging (ici : 3, ids 013/014/015)
--   - plusieurs statuts (QUALIFYING, PROPOSAL, NEW)
--   - 1 opportunité prioritaire (confiance élevée + budget + signal récent : 013)
--   - 1 opportunité obsolète / "stale" (aucune évolution depuis > 30 jours : 014,
--     via updated_at explicitement antidaté — voir note ci-dessous)
--   - 1 activité récente (le trigger Sprint 6 `log_opportunite_activity`
--     journalise automatiquement l'évènement "assigned" à l'exécution de
--     ce script, horodaté à l'instant présent)
--
-- Note technique (staleness) : veille.opportunite_dossier.derniere_evolution_metier_at
-- (Sprint 5) = greatest(opportunites.updated_at, dernière preuve, dernier
-- décideur, dernière alerte liée). Aucun trigger ne met à jour
-- `updated_at` automatiquement (vérifié Sprint 5) : ce script fixe donc
-- explicitement `updated_at` sur l'opportunité 014 à une date passée pour
-- simuler une réelle absence d'évolution, sans quoi une insertion fictive
-- "aujourd'hui" ne pourrait jamais démontrer l'état "obsolète" du cockpit.

begin;

insert into veille.opportunites (
  id, titre, resume, statut, entreprise_id, entite_cible, type_opportunite,
  secteur, geographie, nombre_signaux, date_premier_signal, date_dernier_signal,
  phase_projet, budget_identifie, budget_source, budget_fiabilite, niveau_confiance,
  statut_enrichissement, raisons, derniere_consolidation_at, assigned_to, assigned_at,
  updated_at
) values
  -- 013 — Assignée à user.staging, confiance élevée + budget + signal récent : doit
  -- apparaître dans "Mes priorités" (cockpit utilisateur) et dans les priorités admin.
  ('a0000000-8888-4000-8000-000000000013',
   'SPRINT9-DEMO — Rénovation thermique lycée régional', 'Rénovation thermique complète, budget régional voté, dossier suivi personnellement.',
   'QUALIFYING', 'a0000000-8888-4000-8000-000000000001', 'Région Démo', 'Travaux', 'Bâtiment', 'Normandie',
   4, now() - interval '9 days', now() - interval '2 days', 'CONSULTATION',
   540000, 'BOAMP', 'Officiel', 'Élevé', 'ready',
   '["Budget régional voté", "Quatre signaux convergents"]'::jsonb, now(),
   'd0ecec03-7ec1-4700-a836-b1dcace0b919', now(), now() - interval '2 days'),

  -- 014 — Assignée à user.staging, AUCUNE évolution depuis > 30 jours (updated_at
  -- explicitement antidaté) : doit apparaître dans "Mes actions attendues" (staleness)
  -- ET dans les actions requises / la synthèse admin.
  ('a0000000-8888-4000-8000-000000000014',
   'SPRINT9-DEMO — Proposition réhabilitation gare routière', 'Proposition envoyée, aucune relance depuis plus d''un mois.',
   'PROPOSAL', 'a0000000-8888-4000-8000-000000000001', 'Communauté de communes Démo', 'Travaux', 'Transport', 'Bourgogne-Franche-Comté',
   2, now() - interval '75 days', now() - interval '50 days', 'CONSULTATION',
   210000, 'Presse locale', 'Probable', 'Moyen', 'ready',
   '["Proposition transmise, en attente de retour"]'::jsonb, now() - interval '50 days',
   'd0ecec03-7ec1-4700-a836-b1dcace0b919', now(), now() - interval '45 days'),

  -- 015 — Assignée à user.staging, statut NEW (3e statut distinct parmi les 3
  -- opportunités personnelles, pour la variété exigée par la Phase 16).
  ('a0000000-8888-4000-8000-000000000015',
   'SPRINT9-DEMO — Signal récent extension crèche municipale', 'Nouveau signal, dossier tout juste assigné pour qualification.',
   'NEW', 'a0000000-8888-4000-8000-000000000001', 'Mairie de Démoville', 'Travaux', 'Petite enfance', 'Pays de la Loire',
   1, now() - interval '3 days', now() - interval '3 days', 'ETUDE',
   null, null, null, 'Faible', 'partial',
   '["Signal unique, qualification à confirmer"]'::jsonb, now() - interval '3 days',
   'd0ecec03-7ec1-4700-a836-b1dcace0b919', now(), now())

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
  assigned_at = excluded.assigned_at,
  updated_at = excluded.updated_at;

commit;

-- Vérification suggérée (à exécuter séparément) :
-- select opportunite_id, titre, statut_opportunite, assigned_to, derniere_evolution_metier_at
-- from veille.opportunite_dossier
-- where opportunite_id::text like 'a0000000-8888-4000-8000-0000000001%'
-- order by opportunite_id;
