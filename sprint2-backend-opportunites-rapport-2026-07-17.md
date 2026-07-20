# Sprint 2 — Backend déterministe du moteur d'opportunités — Rapport final

## 1. Résumé

Objectif atteint : backend entièrement déterministe (aucune IA), construit sur `feature/sprint-2-opportunity-backend`, base exacte = tip réel de `staging` (`ba19d4f1d662cad23e3bff3d8cc37f716992af64`, vérifié par `git merge-base`). Étend le Sprint 1 sans rien modifier de son contenu (4 tables, types, repository, mapper, page, route, navigation — tous intacts).

## 2. Phase 1 — Audit préalable

Aucune colonne inventée. Mapping basé sur le schéma réel de Staging (`gcitqpgucepgroermzti`), audité via `information_schema` :

| Concept | Colonne source réelle |
|---|---|
| Entité cible / donneur d'ordre | `alertes.acteur_entite` |
| Type de projet | `alertes.type_opportunite` (text[]) |
| Secteur | fourni explicitement par l'appelant (aucune colonne dédiée sur `alertes`) |
| Géographie | `alertes.commune_collectivite` → `departement` → `region[0]` → `pays` |
| Date du signal | `alertes.date_detection` (NOT NULL) |
| Lien source | `alertes.lien_source_url` |
| Pertinence | `pertinence_entreprise.statut` (couple alerte/entreprise) |
| Décideurs associés | `alerte_decideurs` (table de liaison déjà existante) |

**Aucun champ indispensable manquant** : aucune migration additive sur `alertes`/`entreprises`/`decideurs`/`pertinence_entreprise` n'a été nécessaire.

## 3. Phase 2 — Migration base de données

Migration additive `20260717000000_sprint2_opportunity_scoring_fields.sql` (appliquée sur Staging uniquement) : ajoute à `veille.opportunites` exactement les 15 colonnes demandées (`correlation_key`, `entite_cible`, `type_opportunite`, `secteur`, `geographie`, `adequation_score`, `convergence_score`, `anticipation_score`, `priorite_score`, `score_details` jsonb, `score_version`, `nombre_signaux`, `date_premier_signal`, `date_dernier_signal`, `last_processed_at`). Aucune colonne Sprint 1 modifiée ou supprimée.

Contraintes : 4 `CHECK` bornant les scores à `[0,100]`, 1 `CHECK` `nombre_signaux >= 0`, index unique partiel `(entreprise_id, correlation_key) WHERE correlation_key IS NOT NULL`, 3 index de consultation (`correlation_key`, `priorite_score`, `date_dernier_signal`).

## 4. Phase 3 — Contrat des sous-scores

`src/lib/opportunities/engine/types.ts` + `scoring.ts` : 7 sous-scores obligatoires (`competences` 30 %, `types_opportunite` 25 %, `secteurs` 15 %, `references` 10 %, `geographie` 10 %, `mots_cles` 5 %, `compte_strategique` 5 % — somme = 100 %). Toute valeur manquante ou hors `[0,100]` est rejetée (aucune valeur par défaut implicite). Arrondi documenté (`Math.round`). `score_version = "sprint2-v1"`.

## 5. Phase 4 — Les 3 autres indicateurs

- **Convergence** : 4 composantes pondérées (nombre de signaux 40 %, diversité des sources 25 %, proximité temporelle 20 %, cohérence entité/géo 15 %), calculées sur les agrégats réels renvoyés par la fonction Postgres.
- **Anticipation** : table fixe sur l'étape de projet, 100 (INTENTION) → 0 (APPEL_OFFRES).
- **Priorité commerciale** : 45 % adéquation + 35 % convergence + 20 % anticipation. Les 4 indicateurs restent toujours séparément persistés.

## 6. Phase 5 — Clé de corrélation

`correlationKey.ts` : normalisation (accents/casse/ponctuation) + `entreprise|entité|type|géographie|mois`. Si l'entité, le type ou la géographie manquent, confiance `"low"` et clé isolée par alerte (jamais de regroupement forcé). Limite documentée : fenêtre mensuelle calendaire (report Sprint 3).

## 7. Phase 6 — Service de traitement

`OpportunityEngineService.processAlertOpportunity()` : charge l'alerte/entreprise/pertinence/décideurs réels, calcule adéquation + anticipation (purs), délègue find-or-create + liaisons + recalcul des agrégats à la fonction Postgres, puis calcule convergence + priorité à partir des agrégats retournés et persiste le tout. Retourne `created` / `updated` / `already_processed` + indicateurs + explication.

## 8. Phase 7 — Idempotence et concurrence

Fonction Postgres transactionnelle `veille.process_alert_opportunity` (migration `20260717000100`) : `INSERT ... ON CONFLICT` sur l'index unique partiel, liaisons idempotentes (`ON CONFLICT DO NOTHING` / `NOT EXISTS`), recalcul des agrégats depuis les relations réelles (jamais incrémenté). Un bug d'ambiguïté de colonne PL/pgSQL a été détecté et corrigé pendant les tests (voir §12).

## 9. Phase 8 — Edge Function

`process-alert-opportunity` déployée sur Staging uniquement (`gcitqpgucepgroermzti`, version 2). `verify_jwt=true`, exige en plus un profil `role=admin`, coupe-circuit `OPPORTUNITY_ENGINE_ENABLED` (absent/≠"true" → 503, avant toute autre vérification). Aucun contournement possible. Clé `service_role` utilisée uniquement côté serveur.

**Point d'attention** : le secret `OPPORTUNITY_ENGINE_ENABLED` n'est pas défini sur Staging à ce jour → la fonction refusera tout appel tant qu'il ne sera pas explicitement positionné à `"true"` (aucun outil disponible dans cette session pour définir un secret Edge Function).

## 10. Phase 9 — Tests (18 cas)

Aucune nouvelle dépendance de test. Deux volets :

**A. Calculateurs purs** (`scripts/sprint2-engine-tests.ts`, exécuté via `npx tsx`, `node:assert/strict` intégré) : 14/14 PASS — adéquation pondérée, rejet sous-score hors intervalle, rejet sous-score manquant, anticipation (précoce > tardif), rejet étape invalide, convergence (signal unique bas, signaux multiples + cohérents élevé, cas limite proximité temporelle isolée), priorité pondérée, normalisation, déterminisme de la clé, confiance faible + dossier isolé, non-regroupement d'entités différentes.

**B. Fonction Postgres, avec données fictives sur Staging** (créées puis entièrement nettoyées, compteurs vérifiés à 0 avant/après) :
- Nouvelle opportunité créée (`created`, 1 signal).
- Signal corrélé (`updated`, 2 signaux, même opportunité).
- Appel exact répété deux fois (`nombre_signaux` reste à 2, aucune duplication de lien).
- Alerte/entreprise inexistante → exceptions `ALERTE_NOT_FOUND`/`ENTREPRISE_NOT_FOUND`.
- Alerte non pertinente pour l'entreprise → `ALERTE_NOT_RELEVANT_FOR_ENTREPRISE`.
- Alerte avec 2 décideurs → 2 liens créés ; alerte sans décideur → 0 lien.
- Preuve créée quand une source existe ; absente quand aucune source/URL n'existe.
- Contrainte `CHECK` : score > 100 rejeté (23514), score valide accepté.
- Sécurité : `EXECUTE` confirmé absent pour `anon`/`authenticated` (`information_schema.routine_privileges`) et refus réel constaté sous `SET ROLE authenticated` (`permission denied`, 42501).

**Non testable en environnement séquentiel** : la concurrence stricte (deux appels simultanés au sens propre) ne peut pas être simulée par des appels `execute_sql` séquentiels. La garantie repose sur une propriété du moteur transactionnel Postgres (index unique + `ON CONFLICT`), indépendante de l'ordre d'arrivée — documenté comme tel, pas simulé artificiellement.

**Vérifié par revue de code plutôt que par appel HTTP réel** : le refus quand le moteur est désactivé (`OPPORTUNITY_ENGINE_DISABLED`) — la vérification est la toute première instruction de la fonction, avant même l'authentification, et le secret est confirmé absent sur Staging.

## 11. Phase 10 — Documentation

`docs/opportunity-engine.md` : contrat entrée/sortie, formules des 4 indicateurs, clé de corrélation, idempotence, sécurité, exemple de payload fictif, procédure de test Staging, limites connues. Strictement scopé à ce sprint.

## 12. Bug détecté et corrigé pendant les tests

La fonction Postgres contenait une ambiguïté de nom (`opportunite_id` référencé à la fois comme colonne de retour et colonne de table dans une sous-requête `NOT EXISTS`), provoquant l'erreur `42702`. Corrigée par un alias de table explicite (`op.opportunite_id`) ; le fichier de migration a été mis à jour pour refléter exactement la version corrigée et testée (rien n'ayant été poussé, la correction a été pliée directement dans la migration, sans migration de correction séparée — même principe que le nettoyage Sprint 1.1).

## 13. Vérifications techniques

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` | PASS — 0 erreur |
| `npx vite build` | PASS — 22,2 s |
| `package.json` / `package-lock.json` | Inchangés (diff vide) |
| Audit sécurité Supabase (`get_advisors`) | PASS — la nouvelle fonction n'apparaît plus après correction du `search_path` ; tous les autres signalements sont hérités, sans lien avec ce sprint |
| Recherche de secrets dans le diff | Aucun secret — seule occurrence : le rôle `service_role` dans des `GRANT`/commentaires |
| Modules hors périmètre | Aucun fichier Alertes/Dashboard/Entreprises/Décideurs/Auth/Onboarding/Storage existant touché |

## 14. Git

Branche : `feature/sprint-2-opportunity-backend`, créée depuis `feature/sprint-1-foundations` (identique au tip Sprint 1 avant tout changement).

Commits (7, historique nettoyé — le correctif du bug §12 et le durcissement `search_path` ont été repliés directement dans leur commit d'origine, rien n'ayant été partagé) :

1. `92d8109` — `feat(db): add opportunity scoring, correlation fields and idempotent processing function`
2. `a0fc045` — `feat(engine): add adequation, convergence, anticipation and priority calculators`
3. `b3d3535` — `feat(engine): add deterministic correlation key generator`
4. `de22375` — `feat(engine): add idempotent alert-to-opportunity processing service`
5. `a2cb624` — `feat(functions): add process-alert-opportunity edge function (staging)`
6. `de701db` — `test: add sprint 2 engine calculator and correlation key tests`
7. `58cdeda` — `docs: document sprint 2 opportunity engine backend`

Commit final : `58cdeda396beb12508eae1f6390ceb7ac4617466`
Merge-base avec `feature/sprint-1-foundations` : exact (`e246ede4598a9a445397e6e35e02da82c61bb30d`)
Merge-base avec le staging réel importé : exact (`ba19d4f1d662cad23e3bff3d8cc37f716992af64`)

## 15. Diff final

```
 docs/opportunity-engine.md                         | 167 +++++++++
 scripts/sprint2-engine-tests.ts                    | 208 ++++++++++++
 .../engine/OpportunityEngineService.ts             | 246 ++++++++++++++
 src/lib/opportunities/engine/correlationKey.ts     |  79 +++++
 src/lib/opportunities/engine/index.ts              |   4 +
 src/lib/opportunities/engine/scoring.ts            | 197 +++++++++++
 src/lib/opportunities/engine/types.ts              | 105 ++++++
 .../functions/process-alert-opportunity/index.ts   | 376 +++++++++++++++++++++
 ...17000000_sprint2_opportunity_scoring_fields.sql |  68 ++++
 ..._sprint2_process_alert_opportunity_function.sql | 182 ++++++++++
 10 files changed, 1632 insertions(+)
```

## 16. Confirmations explicites

- **Aucune modification de la Production** (`mhsbwabrvcqnxnwamvwc`) ni de Netlify Production : confirmé, toutes les actions ont ciblé exclusivement Supabase Staging (`gcitqpgucepgroermzti`).
- **Aucune modification de `staging`/`main`** (Git) : confirmé, tout le travail est resté sur `feature/sprint-2-opportunity-backend`.
- **Aucun push GitHub, aucune Pull Request** : confirmé.
- **Aucune donnée de test résiduelle** : tous les compteurs (`entreprises`, `alertes`, `decideurs`, `opportunites`, `opportunite_alertes`, `opportunite_decideurs`, `opportunite_preuves`, `pertinence_entreprise` filtrés sur le préfixe `SPRINT2_TEST`) revérifiés à 0 après nettoyage.
- **Aucun outillage ajouté** : pas de nouveau framework de test, pas de nouvelle dépendance npm.

## 17. Point d'attention pour toi

`OPPORTUNITY_ENGINE_ENABLED` n'est pas défini comme secret sur le projet Staging — le moteur restera désactivé (503) tant que tu ne le positionnes pas explicitement à `"true"` via le dashboard Supabase ou la CLI (aucun outil de gestion de secrets Edge Function n'était disponible dans cette session pour le faire moi-même).

## 18. Bundle final

`sprint-2-opportunity-backend.bundle` — contient uniquement `refs/heads/feature/sprint-2-opportunity-backend`, `git bundle verify` OK, tip `58cdeda396beb12508eae1f6390ceb7ac4617466`.

## 19. STOP

Rien poussé sur GitHub, aucune Pull Request, `staging`/`main` non touchées, Production non touchée. Sprint 3 non commencé. En attente de ta validation explicite.
