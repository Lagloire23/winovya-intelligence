# Sprint 1 — Fondations du moteur d'Opportunités — Rapport final

## 1. Résumé

Objectif atteint. Uniquement les fondations structurelles ont été posées : aucune intelligence métier, aucun calcul, aucune IA, aucun scoring, aucune corrélation, aucune détection. Aucun outillage ajouté (pas d'ESLint, Vitest, Jest, Cypress, Playwright, Storybook, Prettier, Husky). `package.json`/`package-lock.json` non modifiés. `comptes_strategiques` non créée.

Note : une première version de ce sprint avait été livrée sur `feature/sprint-1-opportunity-engine` avec un périmètre plus large (5 tables dont `comptes_strategiques`, scoring, ESLint, Vitest). Suite à ce cahier des charges resserré, cette branche est abandonnée et remplacée par le travail ci-dessous, sur une branche neuve et un schéma Staging nettoyé.

## 2. Git

- Branche : `feature/sprint-1-foundations`, créée depuis le dernier commit confirmé réel de `staging` (`24d28d9`).
- Commits :
  1. `68ff522` — `feat(db): sprint 1 foundations schema (4 tables)`
  2. `22255ca` — `feat(api): opportunity types, mapper and CRUD repository`
  3. `d7c7382` — `feat(front): add empty Opportunités page, route and nav entry`
- Merge-base : `git merge-base feature/sprint-1-foundations staging-remote-24d28d9` → `24d28d9496a46c1d68acc30f8309ad60e595ce91` (exact).
- Fichiers modifiés/créés (9) : 2 migrations SQL, `types.ts`, `OpportunityMapper.ts`, `OpportunityRepository.ts`, `index.ts`, `OpportunitesPage.tsx`, `App.tsx`, `AppSidebar.tsx`.
- Rien poussé, rien fusionné. `staging`/`main` intouchées.

## 3. Base de données

**Migrations créées** : `20260716204750_sprint1_foundations_schema.sql`, `20260716204805_sprint1_foundations_rls.sql` — appliquées et vérifiées sur Supabase Staging (`gcitqpgucepgroermzti`) uniquement.

**Tables créées** (schéma `veille`, 4 seulement) :
- `opportunites` (id, titre, resume, description, statut, entreprise_id, created_at, updated_at)
- `opportunite_alertes` (opportunite_id, alerte_id, created_at)
- `opportunite_decideurs` (opportunite_id, decideur_id, created_at)
- `opportunite_preuves` (id, opportunite_id, source, citation, url, created_at)

Plus l'enum `veille.statut_opportunite`.

**Index** : un index sur chaque colonne de clé étrangère (`entreprise_id`, `statut`, `opportunite_id`/`alerte_id` sur les deux tables N-N, `opportunite_id` sur `opportunite_preuves`).

**Contraintes** : clés primaires (`uuid`, `gen_random_uuid()`), clés primaires composites sur les deux tables N-N, 4 foreign keys en cascade (`opportunites.entreprise_id → entreprises`, `opportunite_alertes.*`, `opportunite_decideurs.*`, `opportunite_preuves.opportunite_id`).

**Policies (RLS)** : RLS activée sur les 4 tables. Lecture ouverte à `authenticated` (`using (true)`), écriture réservée aux admins — pattern identique à `entreprises`/`decideurs` (migration existante `20260711083032_003`). Grants explicites (`select/insert/update/delete/truncate/references/trigger`) pour `anon/authenticated/service_role`, cohérents avec le reste du schéma.

## 4. TypeScript

**Types créés** (`src/lib/opportunities/types.ts`) : `StatutOpportunite`, `Opportunite`, `OpportuniteInput`, `OpportuniteUpdate`, `OpportuniteAlerte`, `OpportuniteDecideur`, `OpportunitePreuve`, `OpportunitePreuveInput` — exactement les colonnes créées, rien d'anticipé.

**Repository créé** (`OpportunityRepository.ts`) : CRUD pur — `listOpportunites`, `getOpportunite`, `createOpportunite`, `updateOpportunite`, `deleteOpportunite`, plus lecture/liaison/déliaison pour les deux tables N-N et lecture/création/suppression pour `opportunite_preuves`. Aucune logique métier, aucun calcul, aucun score.

**Mapper créé** (`OpportunityMapper.ts`) : conversion ligne Supabase → objet TypeScript typé, mapping direct des champs, aucune transformation.

## 5. Frontend

**Route ajoutée** : `/dashboard/opportunites` (même groupe `Layout`/sidebar que les autres pages).

**Composant créé** : `OpportunitesPage.tsx` — page volontairement vide : « Opportunités / Sprint 1 / Fondations en place. » Pas de tableau, filtre, recherche, graphique ni statistique.

**Navigation** : entrée « Opportunités » ajoutée dans le menu principal (sidebar), à côté de « Critères ».

## 6. Vérifications

| Vérification | Résultat |
|---|---|
| Build (`vite build`) | **PASS** — bundle produit, 18,5 s |
| TypeScript (`tsc --noEmit`, projet entier) | **PASS** — 0 erreur |
| Migrations sur Staging | **PASS** — les 2 migrations appliquées sans erreur (`apply_migration`), tables/index/policies confirmés via `list_tables` |
| RLS | **PASS** — vérifié en conditions réelles par changement de rôle Postgres (`set role authenticated` / `anon`) : lecture autorisée pour `authenticated`, écriture rejetée pour un `authenticated` non-admin (`insufficient_privilege`), cohérent avec le reste du schéma |
| Tests manuels (CRUD/FK) | **PASS** — insert/update/count sur `opportunites`, rejet FK sur `entreprise_id` inexistant (`foreign_key_violation`), liens N-N et `opportunite_preuves` créés et lus avec succès. Données fictives, nettoyées ensuite (tous les compteurs revérifiés à 0) |
| Audit de sécurité Supabase (`get_advisors`) | **PASS** — aucune des 4 nouvelles tables n'apparaît dans les signalements ; les seuls éléments listés sont hérités et sans lien avec ce sprint |

## 7. Impact

- **Aucune modification de la Production** (`mhsbwabrvcqnxnwamvwc`) : confirmé, toutes les actions ont ciblé exclusivement le projet Supabase Staging.
- **Aucun changement de comportement des modules existants** : Alertes, Dashboard, Entreprises, Décideurs, Auth, Onboarding, Storage, Edge Functions, pipeline — aucun fichier ni table associés n'a été touché (vérifié par le diff Git, limité aux fichiers listés au point 2).
- **Aucune régression** : build et vérification de types passent sur l'ensemble du projet, pas seulement le nouveau code.

## 8. Diff Git

```
9 files changed, 411 insertions(+), 0 deletions(-)
```

`package.json` / `package-lock.json` : 0 ligne modifiée (confirmé par `git diff staging-remote-24d28d9 feature/sprint-1-foundations -- package.json package-lock.json` → vide).

Bundle livré : `sprint-1-foundations.bundle` (contient uniquement `refs/heads/feature/sprint-1-foundations`, vérifié valide via `git bundle verify`).
