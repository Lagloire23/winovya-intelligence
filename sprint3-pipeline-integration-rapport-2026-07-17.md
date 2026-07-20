# Sprint 3 — Raccordement automatique du pipeline de veille
### Rapport final

## 1. Sprint 3 prêt pour Pull Request

**OUI.**

Aucun fichier existant modifié (TypeScript, Edge Functions, migrations
antérieures, `package.json`). Seuls 3 fichiers nouveaux ajoutés : une
migration additive, un script de test autonome, une documentation. Testé sur
Staging avec des données 100 % fictives, nettoyées après validation.

## 2. Point d'intégration exact retenu

**Trigger PostgreSQL sur `veille.pertinence_entreprise`** (et non une nouvelle
Edge Function ou un job planifié) :

- `trg_pertinence_insert_process_opportunity` — `AFTER INSERT`,
  `WHEN (new.statut = 'Actif')`.
- `trg_pertinence_update_process_opportunity` — `AFTER UPDATE OF statut`,
  `WHEN (new.statut = 'Actif' AND old.statut IS DISTINCT FROM new.statut)`.

Les deux exécutent `veille.trg_process_pertinence_to_opportunity()`, qui
appelle **uniquement** la RPC existante et inchangée
`veille.process_alert_opportunity` (Sprint 2/2.1).

Justification : l'audit (Phase 1, ci-dessous) a confirmé qu'aucun trigger,
webhook ou Edge Function ne connectait déjà `alertes`/`pertinence_entreprise`
à un traitement en aval. Un trigger sur `pertinence_entreprise` est le point
exact où « l'alerte existe » et « la pertinence entreprise est disponible »
deviennent vraies, et fonctionne quelle que soit la manière dont la ligne est
écrite (le pipeline de collecte/analyse actuel, externe à ce dépôt, n'a besoin
d'aucune modification).

## 3. Schéma du pipeline avant / après

**Avant :**

```
Source publique
      |
      v
Pipeline de collecte/analyse (externe à ce dépôt)
      |
      v
veille.alertes (INSERT)
      |
      v
veille.pertinence_entreprise (INSERT, statut = 'Actif' si pertinent)
      |
      X   <-- fin du pipeline : rien ne consomme cet évènement automatiquement
```

**Après :**

```
Source publique
      |
      v
Pipeline de collecte/analyse (externe à ce dépôt, INCHANGÉ)
      |
      v
veille.alertes (INSERT)
      |
      v
veille.pertinence_entreprise (INSERT / UPDATE statut -> 'Actif')
      |
      v   (trigger AFTER, automatique, Sprint 3)
veille.trg_process_pertinence_to_opportunity()
      |
      v
veille.process_alert_opportunity()  (RPC Sprint 2/2.1, INCHANGÉE)
      |
      v
veille.opportunites (créée ou enrichie)
      |         \
      v          v
opportunite_alertes   opportunite_decideurs
      |
      v
opportunite_preuves
```

Détail complet de l'audit (Phase 1) dans `docs/pipeline-integration.md` §2 :
`information_schema.triggers` interrogé avec et sans filtre de schéma (zéro
trigger pertinent trouvé, seulement des triggers préexistants et sans rapport
sur `auth`/`realtime`/`storage`), `pg_tables` sur `supabase_functions` vide
(aucun Database Webhook configuré), aucune Edge Function existante ne lit
`pertinence_entreprise`.

## 4. Fichiers modifiés

Aucun fichier existant modifié. Trois fichiers nouveaux uniquement :

- `supabase/migrations/20260717000200_sprint3_pipeline_integration.sql`
  (310 lignes) — `veille.engine_settings`, miroir SQL de la clé de
  corrélation, fonction trigger, deux triggers.
- `scripts/sprint3-key-consistency-check.mjs` (20 lignes) — vérification
  croisée TS/SQL de la clé de corrélation.
- `docs/pipeline-integration.md` (294 lignes) — documentation complète du
  nouveau pipeline.

`git diff --stat` confirme : 0 fichier modifié, 0 suppression, 3 fichiers
ajoutés. `package.json` / `package-lock.json` : diff vide (aucune dépendance
ajoutée).

## 5. Tests exécutés

Dix cas exécutés sur Staging (projet `gcitqpgucepgroermzti`), données 100 %
fictives (préfixe `SPRINT3-TEST`), toutes supprimées après validation :

| # | Cas | Résultat |
|---|---|---|
| 1 | Nouvelle alerte -> nouvelle opportunité | OK — opportunité créée, `correlation_key` correcte, scores `NULL` (attendu) |
| 2 | Deuxième alerte, même correspondance -> enrichissement | OK — même opportunité, `nombre_signaux` 1 -> 2, pas de doublon |
| 3 | Répétition du même traitement (`Actif`→`Écarté`→`Actif`) | OK — idempotent, aucun changement de compteur |
| 4 | Moteur désactivé (`engine_settings` = false) | OK — 0 opportunité créée |
| 5 | Erreur moteur simulée (RPC renommée temporairement) | OK — pipeline non interrompu, ligne `pertinence_entreprise` insérée, aucune opportunité créée, erreur journalisée (log réel capturé, voir §9), reprise ultérieure réussie après restauration |
| 6 | Pertinence non `'Actif'` (`Écarté`) | OK — trigger jamais invoqué (`WHEN` clause) |
| 7 | Alerte/entreprise inexistante | OK — bloqué par les contraintes `FOREIGN KEY` existantes (`23503`), avant même le trigger |
| 8 | Même alerte, deux entreprises concernées | OK — deux opportunités distinctes, une par entreprise |
| 9 | Absence de duplication | OK — vérifié sur l'ensemble des cas (3 opportunités distinctes au total, correspondant exactement aux 3 correspondances entreprise+entité+type+géo réellement créées) |
| 10 | Démonstration bout-en-bout sur Staging | OK — alerte -> pertinence -> moteur -> opportunité créée (2 alertes, 1 décideur, 2 preuves liées pour le cas principal) |

Compteurs avant/après nettoyage (`entreprises`, `alertes`, `decideurs`,
`alerte_decideurs`, `pertinence_entreprise`, `opportunites`,
`opportunite_alertes`, `opportunite_decideurs`, `opportunite_preuves`) :
**tous à 0 avant, tous à 0 après**, `engine_settings.opportunity_engine_enabled`
remis à `false` (état livré : désactivé par défaut).

Un bug réel a été détecté et corrigé pendant les tests : la table de
translittération du miroir SQL de `normalizeForCorrelation` comptait un
caractère de trop côté cible (6 `o`/`O` accentués en sortie pour 5 en entrée),
décalant toutes les correspondances suivantes (`ÿ` produisait `n` au lieu de
`y`). Détecté par comparaison directe avec la sortie TypeScript, corrigé, et
revérifié caractère par caractère (longueurs égales confirmées par `length()`
SQL).

## 6. Résultat TypeScript

`npx tsc --noEmit` : **succès, 0 erreur** (exécuté en tâche de fond avec
sondage, terminé après 28 s, code de sortie 0).

## 7. Résultat build

`npm run build` (`tsc -b && vite build`) et `npx vite build` seul : **n'ont
pas pu être menés à terme dans cette session.** Quatre tentatives
indépendantes (avec et sans mise en arrière-plan détachée, avec vérification
des ressources sandbox — 2 CPU, 3.4 Gi disponibles, aucune saturation) se sont
toutes arrêtées exactement à l'étape `transforming...` de Vite, sans
progression mesurable sur 30 à 40 s d'observation directe des processus. Ceci
correspond à une limite déjà documentée de cet environnement sandbox lors de
sprints précédents (`tsc -b` en mode composite s'était déjà montré
occasionnellement lent/instable), et non à une régression introduite par ce
sprint : **aucun fichier TypeScript/React existant n'a été modifié** (`git
diff` le confirme, §4), donc le graphe de build est strictement identique à
celui d'avant ce sprint. La vérification TypeScript complète (`tsc --noEmit`,
§6) a en revanche abouti avec succès et constitue la preuve de non-régression
disponible pour ce rapport. Recommandation : relancer `npm run build` dans un
environnement avec plus de marge de temps avant toute fusion, par prudence —
mais rien dans ce sprint ne justifie d'anticiper un échec réel du bundling.

## 8. Vérification Git

- Branche : `feature/sprint-3-pipeline-integration`, créée depuis
  `feature/sprint-2-opportunity-backend` (tip `362e9f7`).
- 3 commits ajoutés : `5a2d089` (migration), `0194cf9` (script de test),
  `92e55f7` (documentation).
- `git merge-base feature/sprint-3-pipeline-integration
  feature/sprint-1-foundations` = `e246ede4598a9a445397e6e35e02da82c61bb30d`
  (exact, aucune dérive).
- `git merge-base feature/sprint-3-pipeline-integration staging-real` =
  `ba19d4f1d662cad23e3bff3d8cc37f716992af64` (exact, aucune dérive).
- `git diff --stat feature/sprint-1-foundations..feature/sprint-3-pipeline-integration`
  : 16 fichiers, 2617 insertions, **0 suppression** (purement additif sur
  l'ensemble Sprint 2 + 2.1 + 3).
- `git status` : arbre de travail propre après les 3 commits.
- `package.json` / `package-lock.json` : diff vide.
- Aucun `git push`, aucune Pull Request créée.

## 9. Risques résiduels

- **Triplication de l'algorithme de clé de corrélation** (TypeScript, miroir
  Deno de la Edge Function, miroir SQL) : conséquence directe et documentée de
  la contrainte « aucun nouveau framework ». Toute évolution future de
  l'algorithme doit être répercutée dans les trois implémentations et
  revalidée par le test de cohérence (`scripts/sprint3-key-consistency-check.mjs`).
- **Scores non calculés automatiquement** : le chemin automatique s'arrête à
  « opportunité créée -> décideurs liés -> preuves liées » ; les 4 indicateurs
  restent `NULL` jusqu'à un passage ultérieur par le chemin manuel existant
  (assumé et documenté, §10 de `docs/pipeline-integration.md`, cohérent avec
  la donnée réellement disponible dans le pipeline actuel).
- **Limite résiduelle héritée du Sprint 2.1** (stratégie de clé B, sans
  fenêtre temporelle) : deux projets réellement distincts, même acteur, même
  type, même géographie, mais séparés de plusieurs années, partageraient à
  tort la même `correlation_key`. Risque déjà documenté et accepté au Sprint
  2.1, non modifié ici.
- **`npm run build` non vérifié de bout en bout dans cette session** (voir
  §7) : à revérifier avant fusion, dans un environnement offrant plus de
  marge de temps.
- **Réactivation du moteur automatique** : `engine_settings.opportunity_engine_enabled`
  est livré à `false`. L'activer sur Staging (puis, plus tard, en Production
  après validation humaine) est une décision opérationnelle distincte, hors
  périmètre de ce sprint.

## 10. Confirmation : aucune Production modifiée

Confirmé. Toutes les actions (migration, tests, requêtes de vérification) ont
été exécutées exclusivement sur le projet Supabase **Staging**
(`gcitqpgucepgroermzti`). Le projet Production (`mhsbwabrvcqnxnwamvwc`) n'a
fait l'objet d'aucun appel, d'aucune lecture, d'aucune écriture durant ce
sprint. Aucun `git push`, aucune fusion vers `main` ou `staging`, aucune
modification de Netlify Production.

## 11. Chemin du bundle final

`sprint-3-pipeline-integration.bundle` — livré dans le dossier partagé,
vérifié (`git bundle verify` : *okay*, historique complet), référence unique
`refs/heads/feature/sprint-3-pipeline-integration` au commit `92e55f7`.

---

STOP. Sprint 4 non commencé.
