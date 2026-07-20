-- Sprint 11C — Refonte de la page detail "Dossier opportunite" (UI).
--
-- Constat d'audit : veille.opportunite_preuves est rattachee uniquement
-- a l'opportunite (aucune colonne vers une alerte precise depuis le
-- Sprint 1). Le nouveau fil chronologique unifie "Alertes liees" +
-- "Preuves" + "Chronologie" en un seul bloc et doit pouvoir associer
-- chaque preuve a l'alerte concernee quand cette information existe.
--
-- Migration strictement additive et retrocompatible :
--   - nouvelle colonne nullable alerte_id (aucune valeur par defaut
--     fabriquee : les preuves existantes restent alerte_id = NULL,
--     ce qui signifie honnetement "rattachee a l'opportunite, jamais
--     associee explicitement a une alerte precise" -- jamais une
--     fabrication d'un lien qui n'a jamais existe) ;
--   - aucune ligne supprimee, aucune contrainte NOT NULL ajoutee ;
--   - la RLS existante ("admin write opportunite_preuves", Sprint 1,
--     ALL) couvre deja l'ecriture de cette nouvelle colonne : aucune
--     nouvelle policy necessaire.

alter table veille.opportunite_preuves
  add column if not exists alerte_id uuid references veille.alertes(id);

comment on column veille.opportunite_preuves.alerte_id is
  'Sprint 11C : alerte a laquelle cette preuve est explicitement rattachee, si connue. NULL = preuve rattachee seulement a l''opportunite (donnee historique ou preuve transverse a plusieurs signaux) -- jamais une association fabriquee a posteriori.';

create index if not exists idx_opportunite_preuves_alerte_id on veille.opportunite_preuves(alerte_id);
