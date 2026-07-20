
-- Colonnes de traçabilité vers les IDs Airtable d'origine (recXXXXXXXXXXXXXX), utilisées
-- uniquement pour la migration (résolution des clés étrangères par jointure) et conservées
-- ensuite comme piste d'audit vers la source historique.
alter table veille.entreprises add column airtable_id text unique;
alter table veille.decideurs add column airtable_id text unique;
alter table veille.alertes add column airtable_id text unique;
alter table veille.pertinence_entreprise add column airtable_id text unique;
alter table veille.abonnements_alertes add column airtable_id text unique;
