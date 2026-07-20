-- Sprint 8 — Phase 8 : nettoyage du jeu de données de démonstration
-- "SPRINT8-DEMO" (voir sprint8-demo-seed.sql). Réservé à Staging.
--
-- Supprime UNIQUEMENT les lignes créées par ce jeu de démonstration
-- (préfixe d'id fixe 'a0000000-8888-4000-8000-%'), jamais une donnée
-- réelle. Les suppressions en cascade (opportunite_preuves,
-- opportunite_decideurs, opportunite_alertes, opportunite_notes,
-- opportunite_activity_log) sont gérées par les contraintes FK
-- `on delete cascade` déjà en place (Sprint 6/1) — ce script supprime
-- seulement les lignes racines (opportunites, decideurs, alertes,
-- entreprises) dans le bon ordre pour respecter les FK sans cascade
-- explicite ailleurs.
--
-- Le profil admin.staging@example.com utilisé pour le scénario
-- "assignée" n'est PAS touché : il préexiste depuis le Sprint 0B et
-- n'appartient pas au jeu de démonstration.

begin;

delete from veille.opportunite_alertes where alerte_id::text like 'a0000000-8888-4000-8000-%';
delete from veille.opportunite_decideurs where decideur_id::text like 'a0000000-8888-4000-8000-%';
delete from veille.opportunite_preuves where opportunite_id::text like 'a0000000-8888-4000-8000-%';
delete from veille.opportunites where id::text like 'a0000000-8888-4000-8000-%';
delete from veille.decideurs where id::text like 'a0000000-8888-4000-8000-%';
delete from veille.alertes where id::text like 'a0000000-8888-4000-8000-%';
delete from veille.entreprises where id::text like 'a0000000-8888-4000-8000-%';

commit;

-- Vérification post-nettoyage (à exécuter séparément) :
-- select count(*) from veille.opportunites where id::text like 'a0000000-8888-4000-8000-%';
-- select count(*) from veille.entreprises where id::text like 'a0000000-8888-4000-8000-%';
-- Les deux doivent renvoyer 0.
