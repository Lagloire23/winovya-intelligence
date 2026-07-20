-- Sprint 6 (suite) — colonnes d'assignation, tables notes/journal,
-- triggers de journalisation automatique, RLS. Voir l'en-tête de
-- 20260717000500_sprint6_commercial_domain.sql pour le contexte complet
-- et le détail de l'audit. Cette partie est appliquée séparément car
-- 'QUALIFYING'/'PROPOSAL' (ajoutées dans l'autre migration) ne peuvent
-- pas être utilisées dans la même transaction que leur ALTER TYPE — ce
-- fichier ne les référence d'ailleurs pas en DML, seulement le code
-- applicatif TypeScript (lifecycle.ts) après coup.

-- 2. Colonnes d'assignation (additives) sur veille.opportunites -----------
alter table veille.opportunites
  add column if not exists assigned_to uuid references veille.profiles(id),
  add column if not exists assigned_at timestamptz;

comment on column veille.opportunites.assigned_to is
  'Sprint 6 : utilisateur (veille.profiles) auquel cette opportunité est assignée. NULL = non assignée. Écriture soumise à la policy RLS existante "admin write opportunites" (Sprint 1, inchangée) : aucune nouvelle policy de write introduite sur cette table.';
comment on column veille.opportunites.assigned_at is
  'Sprint 6 : date de la dernière assignation/désassignation. Historisée automatiquement dans veille.opportunite_activity_log (trigger trg_log_opportunite_activity), jamais recalculée côté application.';

-- 3. Notes internes (Phase 4) ----------------------------------------------
create table if not exists veille.opportunite_notes (
  id uuid primary key default gen_random_uuid(),
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  auteur_id uuid not null references veille.profiles(id),
  contenu text not null check (char_length(trim(both from contenu)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table veille.opportunite_notes is
  'Sprint 6 : notes internes librement rédigées par les utilisateurs sur une opportunité. Jamais modifiées automatiquement (seul un utilisateur, via updated_at, ou une suppression logique via deleted_at, change une note). CRUD complet côté application ; aucune suppression physique.';
comment on column veille.opportunite_notes.deleted_at is
  'Suppression logique (Phase 4) : une note avec deleted_at renseigné est masquée par défaut par OpportuniteCommercialRepository, jamais supprimée physiquement.';

create index if not exists idx_opportunite_notes_opportunite_id on veille.opportunite_notes(opportunite_id);
create index if not exists idx_opportunite_notes_auteur_id on veille.opportunite_notes(auteur_id);

-- 4. Journal d'activité (Phase 5) — append-only, extensible ---------------
create table if not exists veille.opportunite_activity_log (
  id uuid primary key default gen_random_uuid(),
  opportunite_id uuid not null references veille.opportunites(id) on delete cascade,
  event_type text not null check (event_type in (
    'created', 'status_changed', 'assigned', 'unassigned',
    'note_added', 'note_updated', 'note_deleted'
  )),
  acteur_id uuid references veille.profiles(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table veille.opportunite_activity_log is
  'Sprint 6 : historique métier append-only (Phase 5). Aucune ligne n''est jamais modifiée ni supprimée physiquement (aucune policy RLS UPDATE/DELETE ; seules les fonctions trigger SECURITY DEFINER de ce fichier y écrivent, jamais le code applicatif directement). event_type est une liste fermée mais peut être étendue par une future migration additive (nouvelle valeur CHECK) sans rien casser.';
comment on column veille.opportunite_activity_log.acteur_id is
  'NULL quand l''événement provient du pipeline automatique (Sprint 3, aucun utilisateur humain dans le contexte) ; renseigné à auth.uid() sinon.';
comment on column veille.opportunite_activity_log.details is
  'Structure libre par event_type (ex: {"from":"NEW","to":"QUALIFIED"} pour status_changed). Extensible sans migration.';

create index if not exists idx_opportunite_activity_log_opportunite_id on veille.opportunite_activity_log(opportunite_id, created_at desc);

-- 5. Row Level Security ------------------------------------------------------

alter table veille.opportunite_notes enable row level security;
alter table veille.opportunite_activity_log enable row level security;

-- Notes : lecture partagée (même principe que le reste du schéma :
-- visibilité partagée au sein de l'organisation), écriture réservée à
-- l'auteur (ou à un admin, is_admin() déjà existant, Sprint 0B/1).
create policy "authenticated read opportunite_notes"
  on veille.opportunite_notes for select
  to authenticated
  using (true);

create policy "authenticated insert own note"
  on veille.opportunite_notes for insert
  to authenticated
  with check (auteur_id = auth.uid());

create policy "author or admin update note"
  on veille.opportunite_notes for update
  to authenticated
  using (auteur_id = auth.uid() or veille.is_admin())
  with check (auteur_id = auth.uid() or veille.is_admin());

-- Aucune policy DELETE : la suppression est toujours logique (deleted_at
-- via UPDATE), jamais physique (Phase 4/5).

-- Journal d'activité : lecture partagée. AUCUNE policy INSERT/UPDATE/DELETE
-- pour authenticated/anon : seules les fonctions trigger SECURITY DEFINER
-- ci-dessous y écrivent (elles s'exécutent avec les droits du
-- propriétaire de la fonction, qui contourne RLS comme le fait déjà le
-- trigger Sprint 3 sur veille.opportunites/opportunite_alertes/
-- opportunite_decideurs/opportunite_preuves). Ceci garantit que le
-- journal ne peut jamais être falsifié depuis le Frontend (anon-key) :
-- il ne peut refléter que des changements réellement survenus sur les
-- tables sources.
create policy "authenticated read opportunite_activity_log"
  on veille.opportunite_activity_log for select
  to authenticated
  using (true);

-- 6. Triggers de journalisation automatique (additifs, jamais appelés par
--    process_alert_opportunity ni par le moteur de corrélation) ----------

create or replace function veille.log_opportunite_activity()
returns trigger
language plpgsql
security definer
set search_path = veille, pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
    values (new.id, 'created', auth.uid(), jsonb_build_object('statut', new.statut));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.statut is distinct from new.statut then
      insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
      values (new.id, 'status_changed', auth.uid(), jsonb_build_object('from', old.statut, 'to', new.statut));
    end if;

    if old.assigned_to is distinct from new.assigned_to then
      if new.assigned_to is not null then
        insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
        values (new.id, 'assigned', auth.uid(), jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
      else
        insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
        values (new.id, 'unassigned', auth.uid(), jsonb_build_object('from', old.assigned_to));
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

comment on function veille.log_opportunite_activity() is
  'Sprint 6 : journalisation automatique et additive (created/status_changed/assigned/unassigned) sur veille.opportunites. N''appelle jamais process_alert_opportunity ni le moteur de corrélation ; ne modifie aucune colonne de la ligne déclenchante (retourne NEW inchangé). SECURITY DEFINER pour pouvoir écrire dans opportunite_activity_log quel que soit l''appelant (même principe que le trigger Sprint 3).';

drop trigger if exists trg_log_opportunite_activity_insert on veille.opportunites;
create trigger trg_log_opportunite_activity_insert
  after insert on veille.opportunites
  for each row execute function veille.log_opportunite_activity();

drop trigger if exists trg_log_opportunite_activity_update on veille.opportunites;
create trigger trg_log_opportunite_activity_update
  after update of statut, assigned_to on veille.opportunites
  for each row execute function veille.log_opportunite_activity();

create or replace function veille.log_opportunite_note_activity()
returns trigger
language plpgsql
security definer
set search_path = veille, pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
    values (new.opportunite_id, 'note_added', auth.uid(), jsonb_build_object('note_id', new.id));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
      values (new.opportunite_id, 'note_deleted', auth.uid(), jsonb_build_object('note_id', new.id));
    elsif old.contenu is distinct from new.contenu then
      insert into veille.opportunite_activity_log (opportunite_id, event_type, acteur_id, details)
      values (new.opportunite_id, 'note_updated', auth.uid(), jsonb_build_object('note_id', new.id));
    end if;
    return new;
  end if;

  return new;
end;
$$;

comment on function veille.log_opportunite_note_activity() is
  'Sprint 6 : journalisation automatique et additive (note_added/note_updated/note_deleted) sur veille.opportunite_notes. SECURITY DEFINER pour écrire dans opportunite_activity_log quel que soit l''auteur de la note.';

drop trigger if exists trg_log_opportunite_note_activity_insert on veille.opportunite_notes;
create trigger trg_log_opportunite_note_activity_insert
  after insert on veille.opportunite_notes
  for each row execute function veille.log_opportunite_note_activity();

drop trigger if exists trg_log_opportunite_note_activity_update on veille.opportunite_notes;
create trigger trg_log_opportunite_note_activity_update
  after update of contenu, deleted_at on veille.opportunite_notes
  for each row execute function veille.log_opportunite_note_activity();

revoke all on veille.opportunite_notes from public;
grant select, insert, update on veille.opportunite_notes to authenticated;
grant select on veille.opportunite_notes to service_role;

revoke all on veille.opportunite_activity_log from public;
grant select on veille.opportunite_activity_log to authenticated;
grant select on veille.opportunite_activity_log to service_role;
