-- Sprint 11A — Rôle de chaque alerte dans la corrélation d'une opportunité
-- (P11.1 §5.3 : declencheur / confirmant / contextuel / hors_sujet).
--
-- Ce sprint N'IMPLEMENTE PAS le moteur de coherence des regroupements
-- (Sprint 12) : il ajoute uniquement la capacite de STOCKER et
-- D'AFFICHER un role, une justification, une source et une date
-- d'attribution sur un lien alerte-opportunite deja existant
-- (veille.opportunite_alertes, Sprint 1, inchange par ailleurs).
--
-- Aucune valeur n'est inventee pour les donnees historiques : les liens
-- deja existants (35 aujourd'hui) restent role_correlation = NULL tant
-- qu'aucun calcul reel (Sprint 12+) ne les a evalues. NULL signifie
-- "jamais evalue" ; 'non_classe' (valeur autorisee mais non utilisee par
-- ce sprint) signifiera plus tard "evalue mais aucun role clair
-- identifie" — voir P11.1 §3.2 bis / §5.3 / §6. Ne jamais utiliser
-- 'confirmant' comme valeur par defaut trompeuse.
--
-- Additif uniquement : aucune colonne supprimee, aucune contrainte
-- existante modifiee, aucune donnee reecrite, aucune policy RLS
-- modifiee (les policies existantes sur opportunite_alertes couvrent
-- deja ces nouvelles colonnes, meme table).
--
-- Champ volontairement NON ajouté dans ce sprint : role_attribue_par.
-- Ce sprint n'introduit aucune attribution manuelle (source_role reste
-- 'moteur' uniquement quand il sera utilisé à partir du Sprint 12) ; la
-- traçabilité d'une correction humaine (qui, quand, pourquoi) relève du
-- Sprint 11B/11C et, conformément à P11.1 §13.6, doit réutiliser le
-- patron d'historique append-only déjà existant
-- (veille.opportunite_activity_log), pas un nouveau champ sur ce lien
-- qui disparaîtrait avec le lien en cas de retrait (voir P11.1 §10.4).

alter table veille.opportunite_alertes
  add column if not exists role_correlation text,
  add column if not exists raison_correlation text,
  add column if not exists source_role text,
  add column if not exists role_attribue_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_role_correlation_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_role_correlation_check
      check (role_correlation is null or role_correlation in (
        'declencheur', 'confirmant', 'contextuel', 'hors_sujet', 'non_classe'
      ));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_source_role_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_source_role_check
      check (source_role is null or source_role in ('moteur', 'manuel'));
  end if;
end $$;

-- Cohérence minimale : on ne renseigne raison/source/date que si un rôle
-- est effectivement attribué (jamais de métadonnée orpheline).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'opportunite_alertes_role_coherence_check'
  ) then
    alter table veille.opportunite_alertes
      add constraint opportunite_alertes_role_coherence_check
      check (
        (role_correlation is null and raison_correlation is null and source_role is null and role_attribue_at is null)
        or (role_correlation is not null)
      );
  end if;
end $$;

comment on column veille.opportunite_alertes.role_correlation is
  'Sprint 11A (P11.1 §5.3) : role de cette alerte dans la correlation de l''opportunite. declencheur | confirmant | contextuel | hors_sujet | non_classe. NULL = jamais evalue (donnee historique ou pas encore traitee par le moteur de coherence, Sprint 12). Ne jamais utiliser "confirmant" comme valeur par defaut trompeuse.';
comment on column veille.opportunite_alertes.raison_correlation is
  'Sprint 11A : justification textuelle courte et factuelle du role attribue (ex: "premier signal ayant fait emerger l''hypothese"). NULL tant qu''aucun role n''a ete attribue.';
comment on column veille.opportunite_alertes.source_role is
  'Sprint 11A : origine de l''attribution du role. moteur = calcule automatiquement (Sprint 12+) ; manuel = correction humaine (Sprint 11B+). NULL tant qu''aucun role n''a ete attribue.';
comment on column veille.opportunite_alertes.role_attribue_at is
  'Sprint 11A : horodatage de la derniere attribution/recalcul du role. NULL tant qu''aucun role n''a ete attribue.';

create index if not exists idx_opportunite_alertes_role_correlation on veille.opportunite_alertes(role_correlation);
