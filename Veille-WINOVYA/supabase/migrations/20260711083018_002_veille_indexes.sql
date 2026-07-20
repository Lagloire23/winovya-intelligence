
create index idx_alertes_statut on veille.alertes(statut);
create index idx_alertes_date_detection on veille.alertes(date_detection desc);
create index idx_alertes_reference on veille.alertes(reference_officielle);
create index idx_alertes_lien_source on veille.alertes(lien_source_url);
create index idx_alertes_departement on veille.alertes(departement);
create index idx_pertinence_entreprise_id on veille.pertinence_entreprise(entreprise_id);
create index idx_pertinence_alerte_id on veille.pertinence_entreprise(alerte_id);
create index idx_alerte_decideurs_alerte on veille.alerte_decideurs(alerte_id);
create index idx_alerte_decideurs_decideur on veille.alerte_decideurs(decideur_id);
create index idx_attachments_alerte on veille.attachments(alerte_id);
