
alter table veille.entreprises enable row level security;
alter table veille.alertes enable row level security;
alter table veille.pertinence_entreprise enable row level security;
alter table veille.decideurs enable row level security;
alter table veille.alerte_decideurs enable row level security;
alter table veille.attachments enable row level security;
alter table veille.abonnements_alertes enable row level security;
alter table veille.profiles enable row level security;

-- Lecture ouverte à tout utilisateur WINOVYA authentifié (staff interne, pas de portail client pour l'instant)
create policy "authenticated read alertes" on veille.alertes for select to authenticated using (true);
create policy "authenticated read entreprises" on veille.entreprises for select to authenticated using (true);
create policy "authenticated read pertinence" on veille.pertinence_entreprise for select to authenticated using (true);
create policy "authenticated read decideurs" on veille.decideurs for select to authenticated using (true);
create policy "authenticated read alerte_decideurs" on veille.alerte_decideurs for select to authenticated using (true);
create policy "authenticated read attachments" on veille.attachments for select to authenticated using (true);
create policy "authenticated read abonnements" on veille.abonnements_alertes for select to authenticated using (true);

-- Écritures opérationnelles (statut, notes, assignation) ouvertes à tout authentifié, comme le dashboard actuel
create policy "authenticated update alertes" on veille.alertes for update to authenticated using (true) with check (true);
create policy "authenticated update pertinence" on veille.pertinence_entreprise for update to authenticated using (true) with check (true);
create policy "authenticated insert abonnements" on veille.abonnements_alertes for insert to authenticated with check (true);

-- Données maîtres (fiches Entreprises, Décideurs) et gestion des rôles : réservées aux admins WINOVYA
create policy "admin write entreprises" on veille.entreprises for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin write decideurs" on veille.decideurs for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admin manage profiles" on veille.profiles for all to authenticated
  using (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "read own profile" on veille.profiles for select to authenticated
  using (id = auth.uid());

-- Auto-création d'une fiche profil (rôle "member" par défaut) à chaque nouvelle inscription
create or replace function veille.handle_new_user()
returns trigger as $$
begin
  insert into veille.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = veille, public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function veille.handle_new_user();
