
-- Sprint 1 — Fondations: RLS, suivant exactement le pattern déjà en place
-- pour entreprises/decideurs/alertes (migration 20260711083032_003).
-- Lecture ouverte aux utilisateurs authentifiés (comme le reste du
-- schéma), écriture réservée aux admins tant qu'aucune surface produit
-- n'écrit encore dans ces tables.

alter table veille.opportunites enable row level security;
alter table veille.opportunite_alertes enable row level security;
alter table veille.opportunite_decideurs enable row level security;
alter table veille.opportunite_preuves enable row level security;

create policy "authenticated read opportunites" on veille.opportunites
  for select to authenticated using (true);

create policy "authenticated read opportunite_alertes" on veille.opportunite_alertes
  for select to authenticated using (true);

create policy "authenticated read opportunite_decideurs" on veille.opportunite_decideurs
  for select to authenticated using (true);

create policy "authenticated read opportunite_preuves" on veille.opportunite_preuves
  for select to authenticated using (true);

create policy "admin write opportunites" on veille.opportunites for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin write opportunite_alertes" on veille.opportunite_alertes for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin write opportunite_decideurs" on veille.opportunite_decideurs for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin write opportunite_preuves" on veille.opportunite_preuves for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Grants explicites, identiques aux 8 tables veille pré-existantes
-- (RLS reste le vrai contrôle d'accès ; ces grants permettent juste au
-- rôle d'être évalué par PostgREST). Les futures tables du schéma veille
-- héritent déjà de ce même jeu de privilèges par défaut (ALTER DEFAULT
-- PRIVILEGES configuré lors du Sprint 0B), donc ceci est uniquement pour
-- que ces 4 tables (créées avant que ce mécanisme existe) soient
-- immédiatement cohérentes.
grant select, insert, update, delete, truncate, references, trigger
  on veille.opportunites, veille.opportunite_alertes, veille.opportunite_decideurs, veille.opportunite_preuves
  to anon, authenticated, service_role;
