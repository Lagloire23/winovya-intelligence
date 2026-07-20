
alter table veille.entreprises
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists pays text[] not null default '{France}',
  add column if not exists regions_suivies text[],
  add column if not exists departements_suivis text[],
  add column if not exists types_opportunite_suivis text[];

comment on column veille.entreprises.onboarding_complete is 'Passe à true une fois le formulaire d''onboarding (profil entreprise + filtres de veille) validé par un utilisateur de cette entreprise.';
comment on column veille.entreprises.pays is 'Pays suivis par la veille de cette entreprise (ex: France, Union Européenne, Afrique francophone). Renseigné lors de l''onboarding.';
comment on column veille.entreprises.regions_suivies is 'Régions suivies (nom, pas code INSEE) — filtre de veille configuré à l''onboarding.';
comment on column veille.entreprises.departements_suivis is 'Départements suivis (nom) — filtre de veille configuré à l''onboarding.';
comment on column veille.entreprises.types_opportunite_suivis is 'Types d''opportunité que cette entreprise veut voir remonter en veille — liste de base + ajouts libres faits à l''onboarding.';
