# Sprint 2.1 — Stabilisation du backend du moteur d'opportunités — Rapport final

## 1. Sprint 2 prêt pour PR

**OUI.**

## 2. Résultat de l'audit (Phase 1)

Aucune anomalie bloquante détectée.

- Branche `feature/sprint-2-opportunity-backend` confirmée exactement au dernier commit du Sprint 2 (`58cdeda`) avant le début de ce sprint de stabilisation.
- Migrations Sprint 2 (`sprint2_opportunity_scoring_fields`, `sprint2_process_alert_opportunity_function`) présentes et appliquées sur Staging, aucune divergence avec le git local.
- Contraintes SQL vérifiées via `information_schema`/`list_tables` : 4 `CHECK` sur les scores (`[0,100]`), 1 `CHECK` `nombre_signaux >= 0`, tous intacts.
- Index vérifiés : index unique partiel `(entreprise_id, correlation_key) WHERE correlation_key IS NOT NULL` + 3 index de consultation, tous présents.
- RLS vérifiée sur les 4 tables opportunités (`pg_policies`) : lecture `authenticated`, écriture admin — strictement inchangée depuis le Sprint 1, aucune régression introduite par les colonnes additives.
- Edge Function `process-alert-opportunity` confirmée active sur Staging (v2 au début de l'audit, redéployée en v3 après les corrections de ce sprint).
- Dépendances npm : `package.json`/`package-lock.json` inchangés (diff vide, reconfirmé après toutes les modifications).
- Types TypeScript : `npx tsc --noEmit` → 0 erreur (avant et après refactor).

**Un seul point d'attention reporté depuis le Sprint 2, non résolu ici** (hors scope stabilisation) : le secret `OPPORTUNITY_ENGINE_ENABLED` n'est toujours pas défini sur Staging — le moteur reste désactivé (503) par défaut, aucun outil de gestion de secrets Edge Function n'étant disponible dans cet environnement.

## 3. Choix définitif de la correlation_key et justification (Phase 2)

**Stratégie retenue : B — `entreprise + entité cible + type d'opportunité + géographie`, sans fenêtre temporelle.**

La stratégie Sprint 2 (A : ajout d'une fenêtre mensuelle) a été **rejetée** après réexamen : avec l'exemple fourni (MBDA / "nouvelle usine" / Bourges, signaux détectés en Mars, Mai, Juillet, Septembre), elle produisait 4 clés de corrélation différentes — donc 4 opportunités distinctes — pour un seul et même projet. C'est un **faux négatif avéré et systématique**, puisque la majorité des projets réels que ce moteur doit détecter s'étalent sur plusieurs mois entre l'intention et l'appel d'offres.

La stratégie C (ajout de la phase projet à la clé) a également été **rejetée** : elle réintroduit exactement le même défaut sous une autre forme, puisqu'un projet qui progresse change quasi systématiquement de phase à chaque nouveau signal — la fragmentation MBDA se reproduirait, déclenchée par un changement de phase plutôt que de mois.

**Preuve empirique** (données fictives sur Staging, nettoyées ensuite) : les 4 alertes MBDA/Bourges (mars, mai, juillet, septembre) ont été traitées via 4 appels à `veille.process_alert_opportunity` et ont toutes les 4 résolu vers le **même** `opportunite_id` (`607b9553-...`), avec `nombre_signaux` incrémentant correctement 1 → 2 → 3 → 4.

**Limite résiduelle acceptée, documentée, non corrigée dans ce sprint** : sans fenêtre temporelle, deux projets réellement distincts (même acteur, même type, même lieu, mais séparés de plusieurs années) partageraient à tort la même clé. Corriger cela proprement (ex: réinitialiser la clé si l'opportunité existante est déjà `WON`/`LOST`/`ARCHIVED` depuis longtemps) constituerait une nouvelle règle métier — explicitement hors périmètre d'un sprint de stabilisation. Documenté comme candidat Sprint 3.

## 4. Architecture finale (Phase 4, diagramme Phase 8)

```
Alert
  |
  v
Edge Function (process-alert-opportunity)
  |   - vérifie JWT + rôle admin
  |   - coupe-circuit OPPORTUNITY_ENGINE_ENABLED
  |   - valide le payload
  v
OpportunityEngineService            (orchestration uniquement,
  |                                  aucun accès SQL direct)
  |-- CorrelationEngine              (pur : génère correlation_key)
  |-- ScoreEngine                    (pur : calcule les 4 indicateurs)
  |-- AlertContextRepository         (lecture : alerte / entreprise /
  |                                   pertinence / décideurs liés)
  |-- OpportunityRepository          (écriture : RPC idempotente +
  |                                   persistance des scores)
  v
PostgreSQL (veille.process_alert_opportunity, transactionnelle)
```

Corrections apportées pour faire correspondre le code à ce diagramme :

- `OpportunityEngineService` ne contient plus aucun `client.from(...)` : il ne fait plus que composer les 4 collaborateurs ci-dessus.
- `scoring.ts` renommé `ScoreEngine.ts` ; `correlationKey.ts` renommé `CorrelationEngine.ts` — chacun expose désormais un objet nommé (`ScoreEngine`, `CorrelationEngine`) que le service appelle explicitement.
- Toutes les pondérations extraites dans un fichier unique, `scoringConfig.ts` (Phase 3) — `ScoreEngine.ts` ne déclare plus aucun poids lui-même.
- Nouveau `AlertContextRepository.ts` : lectures sur `alertes`/`entreprises`/`pertinence_entreprise`/`alerte_decideurs`, hors du périmètre documenté de `OpportunityRepository` (Sprint 1 : 4 tables opportunités uniquement). Séparer ce domaine de lecture évite de mélanger deux domaines de données dans un seul repository.
- `OpportunityRepository` étendu de 2 méthodes strictement I/O (`processAlertOpportunityRpc`, `updateOpportunityScores`) — aucune logique métier ajoutée, uniquement des wrappers typés autour de l'appel RPC et de la mise à jour des scores.
- `ScoreEngine` n'importe jamais Supabase ; `CorrelationEngine` ne calcule aucun score ; aucun des deux repositories ne contient de décision métier.
- L'Edge Function (Deno, ne peut importer ces modules TypeScript) reproduit la même séparation via des sections clairement labellisées ("ScoreEngine", "CorrelationEngine") dans son fichier autonome.

## 5. Preuves des builds (Phase 6 — sorties réelles)

**`npx tsc --noEmit`** :
```
(aucune sortie — 0 erreur)
EXIT=0
```

**`npm run build`** (script composite `tsc -b && vite build`, littéralement demandé) :
```
> winovya-veille-app@0.1.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
transforming...
✓ 1643 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                       0.94 kB │ gzip:   0.50 kB
dist/assets/logo-full-ELTwUTUt.png   98.59 kB
dist/assets/index-CkhpPCs9.css       23.82 kB │ gzip:   5.23 kB
dist/assets/index-Bo5aXfiu.js       511.89 kB │ gzip: 139.93 kB
✓ built in 14.30s
EXIT_CODE=0
```

**Tests moteur (calculateurs purs + clé de corrélation)**, `npx tsx scripts/sprint2-engine-tests.ts` :
```
PASS - cas #13 — adéquation pondérée, valeurs médianes connues
PASS - somme des poids d'adéquation = 1.00
PASS - cas #7 — sous-score hors intervalle [0,100] rejeté
PASS - sous-score manquant rejeté (aucune valeur par défaut)
PASS - cas #15 — anticipation : INTENTION > APPEL_OFFRES
PASS - cas #8 — étape de projet invalide rejetée
PASS - cas #14 — convergence : un seul signal, pas de proximité temporelle ni cohérence => score bas
PASS - cas #14 — convergence : un seul signal détecté à l'instant => proximité temporelle seule contribue
PASS - cas #14 — convergence : signaux multiples + cohérents => score élevé
PASS - cas #16 — priorité : combinaison pondérée exacte
PASS - normalisation : accents, casse, ponctuation
PASS - clé de corrélation : déterministe pour les mêmes entrées
PASS - clé de corrélation : confiance faible + dossier isolé si donnée insuffisante
PASS - clé de corrélation : ne regroupe jamais aveuglément deux entités différentes
PASS - régression MBDA — 4 signaux sur 4 mois différents => une seule clé de corrélation

15/15 tests passés
```

**`git status`** (avant le dernier commit de documentation, working tree ensuite clean) :
```
On branch feature/sprint-2-opportunity-backend
Your branch is ahead of 'origin/feature/sprint-2-opportunity-backend' by 6 commits.
nothing to commit, working tree clean
```

**`git bundle verify`** :
```
/tmp/.../sprint-2.1-stabilization.bundle is okay
The bundle records a complete history.
362e9f76767fbc4ef7d268f08b503840021b5e58 refs/heads/feature/sprint-2-opportunity-backend
```

## 6. Résultat des vérifications SQL

- Colonnes/contraintes/index de `veille.opportunites` : conformes à la migration Sprint 2, aucune régression.
- Fonction `veille.process_alert_opportunity` : non `SECURITY DEFINER`, `search_path` figé (`veille, pg_temp`), `EXECUTE` limité à `postgres`/`service_role` — reconfirmé via `information_schema.routine_privileges` et `pg_proc.proconfig`.
- RLS des 4 tables opportunités : lecture `authenticated`, écriture admin — reconfirmé via `pg_policies`, identique au Sprint 1.
- Test réel du refus `authenticated` sur la fonction (`SET ROLE authenticated` puis appel) : `ERROR: 42501: permission denied for function process_alert_opportunity` — confirmé.
- Test réel de régression MBDA (4 alertes fictives, mars/mai/juillet/septembre) : 1 seule opportunité créée, `nombre_signaux` 1→2→3→4, données nettoyées ensuite (compteurs revérifiés à 0).
- Test réel de non-duplication sous double appel rapproché (2 alertes fictives, même clé, 2 appels RPC émis dans le même tour) : `created` puis `updated`, même `opportunite_id`, `COUNT(*)` final = 1 ligne pour cette clé.

## 7. Résultat de la revue de sécurité (Phase 7)

- Aucun secret dans le frontend : confirmé, recherche `api_key|secret|password|service_role|token` sur le diff complet — seules occurrences : le nom du rôle Postgres `service_role` dans des commentaires/documentation, jamais une valeur.
- Aucune `service_role` exposée côté client : confirmé, la clé n'est utilisée que dans l'Edge Function (environnement serveur Deno).
- Aucune cible Production : confirmé, toutes les actions (migrations, tests, déploiement de fonction) ont ciblé exclusivement Supabase Staging (`gcitqpgucepgroermzti`).
- JWT correctement vérifié : `verify_jwt=true` au déploiement + vérification applicative du rôle `admin` dans la fonction elle-même (double barrière).
- Variables d'environnement cohérentes : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `OPPORTUNITY_ENGINE_ENABLED` — toutes lues via `Deno.env.get`, aucune valeur en dur.
- Edge Function protégée : coupe-circuit vérifié en toute première instruction (avant même l'authentification), aucun chemin de contournement ; secret `OPPORTUNITY_ENGINE_ENABLED` absent sur Staging → moteur désactivé par défaut (503), comportement sûr.

## 8. Résultat de la revue de concurrence (Phase 5)

Aucune correction nécessaire au mécanisme existant. Analyse détaillée :

- **Race condition** : l'`INSERT ... ON CONFLICT` sur l'index unique partiel sérialise nativement deux transactions visant la même `correlation_key` (verrou de ligne Postgres) — la seconde relit un `COUNT` frais après le verrou, jamais une valeur obsolète.
- **Phantom read** : l'agrégat `nombre_signaux`/dates est toujours filtré sur l'`opportunite_id` déjà résolu — aucune ligne d'une autre clé ne peut s'y glisser.
- **Deadlock** : chaque appel verrouille toujours dans le même ordre (ligne `opportunites` de sa propre clé, puis ses tables enfants) ; deux clés différentes ne se contentent jamais — aucun cycle de verrous possible.
- **Write skew** : la génération de `correlation_key` est pure et déterministe — deux appels concurrents pour la même alerte/entreprise ne peuvent jamais dériver vers deux clés différentes.
- **Lost update** : `nombre_signaux` est recalculé par `COUNT(*)` frais après acquisition du verrou, jamais incrémenté depuis une valeur lue hors transaction.

Aucune complexification proposée (pas de verrou explicite additionnel, pas d'escalade `SERIALIZABLE`) : le mécanisme d'unicité + recalcul systématique suffit.

**Vérification empirique complémentaire** : deux appels RPC pour la même clé de corrélation émis dans le même tour d'outils ont produit `created` puis `updated` sur le même `opportunite_id`, sans duplication (`COUNT(*)` final = 1). Limite honnêtement documentée : cet environnement ne garantit pas que ces deux appels aient été exécutés dans deux transactions strictement simultanées (vs. très rapprochées) — la garantie de fond repose sur la propriété structurelle de l'index unique Postgres, pas sur cette seule observation.

## 9. Diff Git final

```
 docs/opportunity-engine.md                         | 288 ++++++++++++++++
 scripts/sprint2-engine-tests.ts                    | 226 ++++++++++++
 src/lib/opportunities/OpportunityRepository.ts     |  83 +++++
 .../opportunities/engine/AlertContextRepository.ts |  99 ++++++
 src/lib/opportunities/engine/CorrelationEngine.ts  | 139 ++++++++
 .../engine/OpportunityEngineService.ts             | 185 ++++++++++
 src/lib/opportunities/engine/ScoreEngine.ts        | 166 +++++++++
 src/lib/opportunities/engine/index.ts              |   5 +
 src/lib/opportunities/engine/scoringConfig.ts      |  64 ++++
 src/lib/opportunities/engine/types.ts              | 105 ++++++
 .../functions/process-alert-opportunity/index.ts   | 383 +++++++++++++++++++++
 ...17000000_sprint2_opportunity_scoring_fields.sql |  68 ++++
 ..._sprint2_process_alert_opportunity_function.sql | 182 ++++++++++
 13 files changed, 1993 insertions(+)
```
(vs. `feature/sprint-1-foundations` — diff total du travail Sprint 2 + 2.1 combiné, aucune suppression : le Sprint 1 reste intact.)

`package.json` / `package-lock.json` : inchangés (diff vide, reconfirmé après toutes les modifications de ce sprint).

Merge-base avec `feature/sprint-1-foundations` : exact (`e246ede4598a9a445397e6e35e02da82c61bb30d`).
Merge-base avec le staging réel : exact (`ba19d4f1d662cad23e3bff3d8cc37f716992af64`).

## 10. Commits ajoutés (6, au-dessus du Sprint 2 déjà livré)

1. `10fe7dc` — `fix(engine): drop temporal window from correlation key (Sprint 2.1 Phase 2)`
2. `49ddf0e` — `refactor(engine): centralize all weights/tables in scoringConfig.ts`
3. `dea3dcf` — `refactor(engine): separate CorrelationEngine/ScoreEngine/repositories (Sprint 2.1 Phase 4)`
4. `6008bf4` — `fix(functions): mirror corrected correlation strategy in edge function`
5. `c5ec3a9` — `test: update imports for renamed engine files, add MBDA regression test`
6. `362e9f7` — `docs: document Sprint 2.1 stabilization (architecture, correlation strategy, concurrency analysis)`

Commit final : `362e9f76767fbc4ef7d268f08b503840021b5e58`

## 11. Risques résiduels

- **Sur-groupement résiduel de la stratégie de corrélation B** (§3) : deux projets non liés, même acteur/type/lieu, séparés de plusieurs années, partageraient à tort la même clé. Accepté et documenté, non corrigé (nécessiterait une nouvelle règle métier).
- **Mutabilité des champs sources de l'alerte** : si `acteur_entite` (ou un autre champ utilisé pour la corrélation) est modifié après un premier traitement, un signal ultérieur sur la même alerte pourrait générer une clé différente. Non spécifique à la concurrence, orthogonal à ce sprint ; documenté pour référence.
- **Concurrence stricte non démontrable empiriquement** dans cet environnement séquentiel (§8) — la garantie repose sur l'analyse structurelle, pas sur un test de charge réel.
- **`OPPORTUNITY_ENGINE_ENABLED` non défini sur Staging** — aucun outil disponible dans cette session pour le positionner ; à faire manuellement avant tout test bout-en-bout réel de l'Edge Function.

## 12. Confirmations explicites

- **Aucune IA ajoutée** : confirmé — tous les calculs (adéquation, convergence, anticipation, priorité, corrélation) restent des fonctions déterministes, table de correspondance ou combinaison pondérée fixe.
- **Aucun changement de périmètre** : confirmé — aucune fonctionnalité métier nouvelle, uniquement correction (clé de corrélation), centralisation (pondérations) et réorganisation (séparation des responsabilités). Aucun nouveau champ utilisateur, aucune nouvelle table, aucune nouvelle page.
- **Aucune modification de Production** : confirmé — toutes les actions ont ciblé exclusivement Supabase Staging (`gcitqpgucepgroermzti`) ; aucune action sur `mhsbwabrvcqnxnwamvwc` ni sur Netlify Production.
- **Sprint 3 non commencé** : confirmé.

---

Bundle final : `sprint-2.1-stabilization.bundle` (contient uniquement `refs/heads/feature/sprint-2-opportunity-backend`, `git bundle verify` OK, tip `362e9f76767fbc4ef7d268f08b503840021b5e58`).

Rien poussé sur GitHub, aucune Pull Request créée. STOP.
