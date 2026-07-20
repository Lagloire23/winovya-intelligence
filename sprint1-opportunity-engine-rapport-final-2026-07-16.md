# Sprint 1 — Opportunity Engine Foundation — Rapport final

Branche `feature/sprint-1-opportunity-engine`, créée depuis le dernier commit confirmé réel de `staging` (`24d28d9`, cf. note sur la base ci-dessous). Rien n'a été poussé, rien n'a été fusionné. Aucune modification sur `main`, sur la production (`mhsbwabrvcqnxnwamvwc`), ni sur le Dashboard Alertes / pipeline existant.

Note sur la base : je n'ai pas d'accès GitHub authentifié depuis ce sandbox (confirmé à nouveau), donc je ne peux pas récupérer l'état actuel exact de `staging` sur GitHub. `24d28d9` reste le dernier commit que tu m'as toi-même fourni et que j'ai vérifié comme étant l'état réel de `staging` (Sprint 0B). Si `staging` a avancé depuis, un rebase de cette branche sera trivial : tout le travail de ce sprint est additif et isolé dans de nouveaux fichiers.

## 1. Architecture créée

```
Sources → Alertes → pertinence_entreprise → Dashboard Alertes        (inchangé)
Alertes → Corrélation → opportunites → Actions commerciales           (nouveau, fondations)
```

Aucune logique de corrélation, aucun algorithme de scoring : uniquement le schéma, les couches API et la page vide, comme demandé.

## 2. Liste complète des nouvelles tables

Toutes dans le schéma `veille` (jamais `public` — cohérent avec le reste du projet, contrairement aux 7 tables `public.*` héritées et déjà documentées comme dette technique) :

1. `veille.opportunites`
2. `veille.opportunite_alertes` (N-N)
3. `veille.opportunite_decideurs` (N-N)
4. `veille.comptes_strategiques`
5. `veille.opportunite_preuves` (obligatoire)

Plus un nouveau type enum : `veille.statut_opportunite`.

## 3. Colonnes

**opportunites** : `id, titre, resume, description, statut, entreprise_id, match_score, confidence_score, anticipation_score, business_priority, global_score, source_principale, date_premier_signal, date_dernier_signal, created_at, updated_at`.

**opportunite_alertes** : `opportunite_id, alerte_id, created_at`.

**opportunite_decideurs** : `opportunite_id, decideur_id, role, importance, created_at`.

**comptes_strategiques** : `id, nom, secteur, description, entreprise_id, statut, created_at, updated_at`.

**opportunite_preuves** : `id, opportunite_id, source, citation, url, piece_jointe, niveau_confiance, created_at` (`niveau_confiance` réutilise l'enum existant `veille.score_pertinence`, pour rester cohérent avec le reste du schéma plutôt que d'inventer un nouveau type).

## 4. Foreign keys

- `opportunites.entreprise_id → entreprises.id` (cascade)
- `opportunite_alertes.opportunite_id → opportunites.id` (cascade), `.alerte_id → alertes.id` (cascade)
- `opportunite_decideurs.opportunite_id → opportunites.id` (cascade), `.decideur_id → decideurs.id` (cascade)
- `comptes_strategiques.entreprise_id → entreprises.id` (cascade)
- `opportunite_preuves.opportunite_id → opportunites.id` (cascade)

Contraintes additionnelles : `check` sur les 5 scores (0–100), `check` sur `importance` (1–5), `unique (nom, entreprise_id)` sur `comptes_strategiques`, clés primaires composites sur les deux tables N-N.

## 5. Indexes

`idx_opportunites_entreprise`, `idx_opportunites_statut`, `idx_opportunites_global_score`, `idx_opportunites_date_dernier_signal`, `idx_opportunite_alertes_opportunite`, `idx_opportunite_alertes_alerte`, `idx_opportunite_decideurs_opportunite`, `idx_opportunite_decideurs_decideur`, `idx_comptes_strategiques_entreprise`, `idx_opportunite_preuves_opportunite` — un index sur chaque colonne de FK, plus les colonnes de tri/filtre évidentes (`statut`, `global_score`, `date_dernier_signal`).

## 6. Policies (RLS)

RLS activée sur les 5 nouvelles tables, suivant exactement le pattern déjà en place pour `entreprises`/`decideurs` (migration `20260711083032_003`) :
- Lecture ouverte à `authenticated` (`using (true)`), comme le reste du schéma.
- Écriture réservée aux admins (`exists (select 1 from veille.profiles p where p.id = auth.uid() and p.role = 'admin')`), puisqu'aucune surface produit n'écrit encore dans ces tables en Sprint 1.

**Découverte et correction proactive** : Staging n'avait pas de `ALTER DEFAULT PRIVILEGES` sur le schéma `veille` (contrairement à la Production), ce qui aurait reproduit silencieusement le bug `PGRST106`/`42501` découvert en Sprint 0B pour chaque future table. J'ai répliqué exactement la configuration de la production (grants explicites sur les 5 nouvelles tables + `ALTER DEFAULT PRIVILEGES` pour les futures). Vérifié : jamais plus large que la production (l'ACL par défaut de Staging est un sous-ensemble strict de celui de la production — il manque seulement `MAINTAIN`, que la production elle-même n'accorde sur aucune table individuelle non plus).

**Vérification via l'audit de sécurité Supabase (`get_advisors`)** : aucune des 5 nouvelles tables n'apparaît dans les résultats — RLS activée et correcte sur les 5. Les seuls signalements existants concernent des éléments hérités déjà documentés (7 tables `public.*` sans RLS, 2 policies `UPDATE`/`INSERT` avec `true`, bucket Storage public listable, fonctions `SECURITY DEFINER`, protection mots de passe compromis désactivée) — aucun n'est lié à Sprint 1.

## 7. Nouvelles routes

- `/dashboard/opportunites` → `OpportunitesPage` (même groupe `Layout`/sidebar que toutes les autres pages fonctionnelles).
- `/opportunites` → redirection vers `/dashboard/opportunites` (respecte le chemin littéral demandé dans le brief tout en restant cohérent avec la convention `/dashboard/*` déjà en place).

Aucune route existante modifiée ou réordonnée.

## 8. Services créés

`src/lib/opportunities/` (nouveau module, isolé) :
- `OpportunityRepository` : accès Supabase brut, une méthode par table/relation, client injectable (testable).
- `OpportunityService` : validations (titre/entreprise_id requis, importance 1–5), helper `archiveOpportunite`, `getGlobalScore()` — un simple pass-through documenté comme tel, **pas un calcul** (aucun algorithme de scoring en Sprint 1, conformément au brief).
- `OpportunityMapper` : normalise les lignes brutes PostgREST, notamment la coercition des colonnes `numeric` (sérialisées en `string` par PostgREST) vers de vrais `number`.

## 9. Types créés

`src/lib/opportunities/types.ts` : `Opportunite`, `OpportuniteInput`, `OpportuniteUpdate`, `OpportuniteAlerte`, `OpportuniteDecideur`, `CompteStrategique`, `CompteStrategiqueInput`, `OpportunitePreuve`, `OpportunitePreuveInput`, `StatutOpportunite` — réutilisent `ScorePertinence` du fichier de types existant plutôt que de le dupliquer.

## 10. Tests exécutés

**TypeScript (vitest, nouvellement configuré — aucun test ni runner n'existait avant ce sprint)** : 19 tests sur 3 fichiers, tous verts.
- `OpportunityMapper.test.ts` (4 tests) : coercition numérique string→number, mapping de listes, décideurs, preuves.
- `OpportunityRepository.test.ts` (6 tests) : CRUD contre un client Supabase factice injectable, propagation d'erreur.
- `OpportunityService.test.ts` (9 tests) : validations (titre/entreprise_id/importance), archivage, `getGlobalScore` pass-through.

**SQL (`supabase/tests/opportunity_engine.test.sql`, exécuté réellement sur Staging le 2026-07-16, données fictives nettoyées ensuite)** : 10 vérifications, toutes passées.

| # | Test | Résultat |
|---|---|---|
| 1 | CRUD (insert/update) sur `opportunites` | PASS |
| 2 | FK — `entreprise_id` inexistant rejeté | PASS (`foreign_key_violation`) |
| 3 | CHECK — score hors 0–100 rejeté | PASS (`check_violation`) |
| 4 | UNIQUE — doublon `(nom, entreprise_id)` rejeté | PASS (`unique_violation`) |
| 5 | Lien N-N `opportunite_alertes` | PASS |
| 6 | CHECK — `importance` hors 1–5 rejeté, puis insert valide | PASS |
| 7 | `opportunite_preuves` (table obligatoire) | PASS |
| 8 | RLS lecture en tant que `authenticated` | PASS (1 ligne visible) |
| 9 | RLS lecture en tant que `anon` | PASS (0 ligne — identique au comportement déjà en place sur `entreprises`, vérifié en parallèle) |
| 10 | RLS écriture rejetée pour `authenticated` non-admin | PASS (`insufficient_privilege`) |

Nettoyage confirmé : tous les compteurs (`opportunites`, `opportunite_alertes`, `opportunite_decideurs`, `comptes_strategiques`, `opportunite_preuves`, `entreprises`, `decideurs`, `alertes`) revenus à `0` après le test.

## 11. Résultat des builds

| Commande | Résultat |
|---|---|
| `npx vitest run` | **PASS** — 19/19 tests, 3 fichiers |
| `npx tsc --noEmit` (vérification de types complète du projet) | **PASS** — 0 erreur |
| `npx vite build` | **PASS** — bundle produit (`dist/assets/index-*.js`, 521 KB), 14,8 s |
| `npm run build` (`tsc -b && vite build`, script officiel du projet) | **NON VÉRIFIÉ TEL QUEL** — voir note ci-dessous |
| `npx eslint .` (nouvellement configuré — aucun script/config n'existait avant ce sprint) | Voir point qualité ci-dessous |

**Note sur `tsc -b`** : la commande officielle `npm run build` enchaîne `tsc -b && vite build`. Le mode `-b` (project references / build composite) de `tsc` n'a pas terminé dans la limite de temps fixe (45 s) de chaque commande shell de ce sandbox, y compris après suppression du cache `.tsbuildinfo` — un comportement que j'ai observé indépendamment de mes changements (probablement lié à la combinaison `noEmit: true` + mode composite dans la config existante, non modifiée par moi). J'ai donc vérifié les deux étapes séparément et avec succès : `tsc --noEmit` (vérification de types stricte, équivalente) passe à 0 erreur, et `vite build` (la vraie étape de bundling) produit un build de production propre. Netlify (environnement non contraint par cette limite de 45 s) exécute déjà `npm run build` avec succès en continu depuis Sprint 0B — rien dans ce sprint ne modifie la configuration `tsconfig`/build. Je signale ce point par transparence plutôt que d'affirmer avoir exécuté la commande exacte que je n'ai pas pu faire tourner de bout en bout ici.

**Qualité (`eslint`)** : aucun script `lint` n'existait dans ce projet avant ce sprint — je l'ai ajouté avec une configuration minimale (`eslint.config.js`, flat config, typescript-eslint + react-hooks). Premier passage : 3 erreurs + 7 avertissements, **tous dans des fichiers hérités jamais touchés par Sprint 1** (`SubscribeModal.tsx`, `DashboardPage.tsx`, `AuthContext.tsx`, `EntrepriseProfileForm.tsx`, `DashboardNavContext.tsx`, `UIContext.tsx`, `supabase.ts`) — de la dette invisible faute d'outillage, pas une régression introduite ici. **Tous les fichiers créés ou modifiés par Sprint 1 (`src/lib/opportunities/**`, `src/pages/OpportunitesPage.tsx`, `src/App.tsx`, `src/components/AppSidebar.tsx`) sont lintés séparément et ne remontent aucune erreur ni avertissement.** Je n'ai pas corrigé la dette héritée : ce sont des fichiers hors périmètre de ce sprint, et les corriger sans lien avec la mission aurait été une modification non demandée d'un fichier existant.

## 12. Git graph

```
* 7a924b7 test: add opportunity tests
* 7bb6ce0 feat(front): add opportunities page, routing and navigation
* ec304f0 feat(api): add opportunity repository, service, mapper and types
* 3136377 fix(database): opportunity tables grants + default privileges parity
* 98f3d05 feat(database): create opportunity schema
*   24d28d9 (base, = staging-remote-24d28d9, dernier commit staging confirmé réel)
```

## 13. Liste des commits

1. `98f3d05` — `feat(database): create opportunity schema`
2. `3136377` — `fix(database): opportunity tables grants + default privileges parity`
3. `ec304f0` — `feat(api): add opportunity repository, service, mapper and types`
4. `7bb6ce0` — `feat(front): add opportunities page, routing and navigation`
5. `7a924b7` — `test: add opportunity tests`

Aucun squash. Historique complet, linéaire, base sur `24d28d9`.

## 14. Diff statistique

```
20 files changed, 5375 insertions(+), 1059 deletions(-)
```

(Les 1059 suppressions viennent quasi intégralement de la régénération de `package-lock.json` après ajout de `vitest`/`eslint` — aucune ligne de code applicatif existant n'est supprimée. Détail par fichier disponible sur demande.)

`git merge-base feature/sprint-1-opportunity-engine staging-remote-24d28d9` → `24d28d9496a46c1d68acc30f8309ad60e595ce91`, exact.

Livrable : `sprint-1-opportunity-engine.bundle` (contient uniquement `refs/heads/feature/sprint-1-opportunity-engine`, vérifié valide via `git bundle verify`).

## 15. Risques éventuels

- **Base Git non reconfirmée depuis GitHub** : je travaille depuis le dernier commit `staging` que tu m'as fourni (`24d28d9`) faute d'accès GitHub authentifié. Si `staging` a avancé, un rebase sera nécessaire avant merge — trivial, tout est additif.
- **`tsc -b` non exécuté tel quel dans ce sandbox** (voir point 11) — vérifié équivalent via deux commandes séparées, mais je n'ai pas de transcript unique de la commande officielle `npm run build`.
- **Dette de lint héritée** (3 erreurs + 7 avertissements, fichiers hors périmètre) — sans lien avec Sprint 1, mais maintenant visible pour la première fois grâce à l'outillage ajouté. À traiter dans un futur sprint dédié si souhaité.
- Risques hérités déjà documentés et inchangés : RLS désactivée sur 7 tables `public.*`, bucket Storage public listable, 2 fonctions `SECURITY DEFINER` exécutables par `anon`, protection mots de passe compromis désactivée dans Auth.
- Le bundle principal Vite dépasse 500 KB (avertissement de build, pas une erreur) — signalé par Vite lui-même, non lié à Sprint 1, candidat à du code-splitting plus tard.

## 16. Actions prévues pour Sprint 2

- Algorithme de scoring : calcul réel de `global_score` à partir des 4 sous-scores persistés (aucune logique encore aujourd'hui).
- Moteur de corrélation : peupler `opportunite_alertes`/`opportunite_decideurs` à partir des alertes existantes.
- Vrai Dashboard Opportunités (filtres, tri, affichage des preuves, actions commerciales) — la page actuelle est volontairement un état vide.
- UI de gestion des `comptes_strategiques`.
- Edge Function(s) dédiée(s) si l'écriture doit se faire hors du rôle admin RLS actuel (ex. corrélation automatique côté serveur avec service role).
- Étendre les tests SQL/TS au fur et à mesure de la logique métier ajoutée.

---

## Critères de validation

| Critère | Statut |
|---|---|
| Aucune régression | ✅ — Dashboard Alertes, Edge Functions, pipeline, tables existantes : non touchés (vérifié par diff) |
| Build vert | ✅ avec réserve documentée (point 11) — `vite build` + `tsc --noEmit` verts ; `tsc -b` non exécutable tel quel dans ce sandbox (limite de temps), équivalence démontrée |
| Tests verts | ✅ — 19/19 TS, 10/10 SQL |
| Migrations propres | ✅ — additives uniquement, appliquées sur Staging seulement, jamais sur Production |
| Aucune modification destructive | ✅ |
| Dashboard Alertes inchangé | ✅ |
| Staging uniquement | ✅ — confirmé, aucune requête vers `mhsbwabrvcqnxnwamvwc` |

**Sprint 1 (fondations) : livré et vérifié, avec une seule réserve transparente sur l'exécution littérale de `tsc -b` dans ce sandbox (point 11).** Pas de push, pas de fusion, pas de Sprint 2 démarré.
