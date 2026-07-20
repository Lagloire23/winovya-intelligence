# Sprint 4 — Enrichissement métier des dossiers d'opportunité
### Rapport final

## 1. Sprint 4 prêt pour Pull Request

**OUI.**

Un seul fichier existant touché (`src/lib/opportunities/index.ts`, +1 ligne
d'export additif). Tout le reste est nouveau : migration additive, module de
calcul pur, repository, tests, documentation. Testé sur Staging avec des
données 100 % fictives, nettoyées après validation.

## 2. Résultat de l'audit initial

Audit complet de `opportunites`, `opportunite_preuves`, `opportunite_decideurs`,
`alertes`, `pertinence_entreprise` et des métadonnées produites par le
pipeline IA :

- `opportunites.resume` et `opportunites.description` existent déjà depuis le
  Sprint 1 mais ne sont **jamais peuplés** par le traitement automatique
  (Sprint 2/3) — réutilisés tels quels pour le résumé métier, aucune
  nouvelle colonne « résumé » créée.
- `alertes.montant` et `alertes.categorie_veille` existent déjà et portent
  une information de budget/fiabilité réelle, jamais exploitée au niveau de
  l'opportunité jusqu'ici.
- `score_details` (Sprint 2) contient déjà `correlation.confidence` et
  `anticipation.etapeProjet` quand un scoring manuel a eu lieu — réutilisés
  comme entrées, jamais recalculés.
- Seul composant IA du produit : `AlertAssistant.tsx`, un chat RAG **éphémère,
  non persisté**, qui n'écrit rien en base. Aucune métadonnée IA cachée à
  consolider.
- `opportunite_preuves` / `opportunite_decideurs` : comptables directement
  (`COUNT(*)`), aucun nouveau compteur stocké nécessaire.

Champs réellement absents (créés par ce sprint) : `phase_projet`,
`budget_identifie`, `budget_source`, `budget_fiabilite`, `budget_estime`,
`niveau_confiance`, `statut_enrichissement`, `raisons`,
`derniere_consolidation_at`. Aucun champ dupliquant une donnée existante n'a
été créé.

## 3. Nouveau modèle métier

Voir `docs/opportunity-dossier.md` §3 pour le détail champ par champ
(origine, observé/déduit/indisponible). Résumé :

- **Observé** : budget identifié (`alertes.montant` le plus récent parmi les
  alertes rattachées qui en portent un), source du budget, nombre de
  preuves/décideurs (comptés en direct).
- **Déduit** (règle documentée, jamais inventé) : fiabilité du budget (table
  de correspondance `categorie_veille` → Officiel/Probable/À vérifier),
  niveau de confiance global (confiance de corrélation + nombre de signaux),
  statut d'enrichissement, raisons factuelles, résumé métier.
- **Indisponible, jamais fabriqué** : `phase_projet` (sauf scoring manuel
  déjà effectué), `budget_estime` (aucune méthodologie fiable à ce jour).

## 4. Nouveaux champs créés

Migration `supabase/migrations/20260717000300_sprint4_opportunity_dossier.sql` :
9 colonnes additives sur `veille.opportunites` (`phase_projet`,
`budget_identifie`, `budget_source`, `budget_fiabilite`, `budget_estime`,
`niveau_confiance`, `statut_enrichissement` défaut `'pending'`, `raisons`
jsonb défaut `[]`, `derniere_consolidation_at`), 6 contraintes `CHECK`, 1
index, et la vue `veille.opportunite_dossier` (`security_invoker = true`,
comptages `nombre_preuves`/`nombre_decideurs` en direct, jamais stockés en
double). Toutes les colonnes existantes restent inchangées ; toutes les
lignes déjà existantes reçoivent proprement leurs valeurs par défaut.

## 5. Règles d'enrichissement

- **Fiabilité du budget** : table de correspondance `categorie_veille` →
  Officiel / Probable / À vérifier (docs §3).
- **Niveau de confiance** : `Élevé` si corrélation fiable et ≥2 signaux ;
  `Moyen` si corrélation fiable et 1 signal, ou pas encore scoré et ≥2
  signaux ; `Faible` sinon.
- **Statut d'enrichissement** : `ready` uniquement si ≥1 preuve **ET** ≥1
  décideur **ET** confiance ≠ `Faible` ; `partial` sinon ; `pending` tant
  qu'aucune consolidation n'a eu lieu ; `failed` en cas d'erreur inattendue
  lors de la consolidation (posé par l'orchestration, jamais par le calcul).
- **Raisons / résumé métier** : gabarits déterministes, chaque clause
  n'apparaît que si la donnée sous-jacente existe réellement ; sinon le
  texte dit explicitement ce qui manque plutôt que de l'omettre ou de
  l'inventer.

## 6. Résultat des tests

**15/15 tests unitaires purs** (`scripts/sprint4-dossier-tests.ts`) : règles
de confiance, de statut, gabarits de raisons/résumé, y compris les cas
limites (dossier vide, confiance faible malgré preuves/décideurs présents,
idempotence du résumé).

**10/10 cas Staging** exécutés avec des données fictives (préfixe
`SPRINT4-TEST`), en import direct du code réellement expédié
(`DossierEnrichmentService.consolidate`, non réimplémenté), sur des données
lues en base réelle :

| # | Cas | Résultat |
|---|---|---|
| 1 | Données complètes (3 signaux, 2 décideurs, 3 preuves, budget) | `ready`, budget = celui de l'alerte la plus récente PORTANT un montant (1 800 000 €, catégorie « Presse locale » filtrée correctement malgré une alerte plus récente sans montant) |
| 2 | Données partielles | `partial` |
| 3 | Sans budget | `budget_identifie = null`, jamais fabriqué |
| 4 | Sans décideur | `partial` malgré preuve(s)/budget présents |
| 5 | Sans preuve | `partial` malgré décideur(s)/budget présents |
| 6 | Plusieurs preuves | comptage vue = 3, cohérent avec les tables sources |
| 7 | Plusieurs décideurs | comptage vue = 2, cohérent |
| 8 | Transitions de statut | `pending` (défaut Sprint 3) → `partial` (preuve+décideur ajoutés mais confiance encore `Faible`, 1 seul signal) → `ready` (après un 2ème signal réel, confiance `Moyen`) |
| 9 | Absence de duplication | comptages de liens strictement stables (1/1) sur 3 consolidations successives ; aucune ligne insérée dans les tables de liaison par ce sprint |
| 10 | Rétrocompatibilité Sprint 3 | opportunités créées par le trigger automatique **inchangé** ; `statut_enrichissement` correctement initialisé à `pending` par défaut ; `nombre_signaux` continue d'être mis à jour par Sprint 3 indépendamment, sans interférence |

Compteurs avant/après nettoyage (entreprises, alertes, décideurs,
alerte_decideurs, pertinence_entreprise, opportunites, opportunite_alertes,
opportunite_decideurs, opportunite_preuves) : **tous à 0 avant, tous à 0
après**, `engine_settings.opportunity_engine_enabled` remis à `false`.

`get_advisors` (sécurité) après migration : liste strictement identique à
celle d'avant ce sprint — aucune nouvelle alerte liée aux objets créés
(colonnes, contraintes, vue).

## 7. Résultat TypeScript

`npx tsc --noEmit` : **succès, 0 erreur** (exécuté en tâche de fond avec
sondage, terminé après 38 s, code de sortie 0).

## 8. Résultat Build

`npx vite build` : **succès** (21 s, code de sortie 0). 1643 modules
transformés, build produit dans `dist/` (avertissement standard de Vite sur
la taille d'un chunk > 500 kB, préexistant, sans rapport avec ce sprint).
Contrairement au Sprint 3, l'environnement sandbox a permis cette fois de
mener le build à terme dans une seule fenêtre d'exécution.

## 9. Vérification Git

- Branche : `feature/sprint-4-opportunity-enrichment`, créée depuis
  `feature/sprint-3-pipeline-integration` (tip `92e55f7`).
- 4 commits ajoutés : `4200735` (migration), `1b855c3` (service pur +
  repository), `f37ebbf` (tests), `8138a1b` (documentation).
- `git merge-base ... feature/sprint-1-foundations` = `e246ede4598a9a445397e6e35e02da82c61bb30d` (exact).
- `git merge-base ... staging-real` = `ba19d4f1d662cad23e3bff3d8cc37f716992af64` (exact).
- `git merge-base ... feature/sprint-3-pipeline-integration` = `92e55f7` (exact, aucune dérive).
- `git diff --stat feature/sprint-1-foundations..feature/sprint-4-opportunity-enrichment` :
  24 fichiers, 3782 insertions, **0 suppression** (purement additif sur
  l'ensemble Sprint 2 + 2.1 + 3 + 4).
- `git status` : arbre de travail propre.
- `package.json` / `package-lock.json` : diff vide (aucune dépendance ajoutée).
- Aucun `git push`, aucune Pull Request créée.

## 10. Risques résiduels

- **Consolidation manuelle/à la demande, pas automatique en temps réel** :
  choix assumé (§8/§9 de `docs/opportunity-dossier.md`) — aucun besoin
  concret ne justifiait un nouveau trigger automatique dans ce sprint ;
  ajout simple et à faible risque si un besoin apparaît.
- **`budget_estime` jamais rempli** : colonne réservée, aucune méthodologie
  d'estimation fiable aujourd'hui — assumé, documenté.
- **`phase_projet` reste `null` hors scoring manuel** : pas d'inférence
  heuristique depuis `categorie_veille` — assumé, pour éviter toute
  fabrication.
- **Écrasement silencieux de `resume`** : si une future UI permet l'édition
  manuelle du résumé métier, un indicateur anti-écrasement sera nécessaire ;
  hors périmètre ici car aucune UI n'écrit ce champ aujourd'hui.
- **Risques hérités, inchangés** : triplication de la clé de corrélation
  (Sprint 3), limite résiduelle de la stratégie B de corrélation (Sprint 2.1).

## 11. Confirmation : aucune Production n'a été modifiée

Confirmé. Toutes les actions (migration, tests, requêtes de vérification) ont
été exécutées exclusivement sur le projet Supabase **Staging**
(`gcitqpgucepgroermzti`). Le projet Production (`mhsbwabrvcqnxnwamvwc`) n'a
fait l'objet d'aucun appel. Aucun `git push`, aucune fusion vers `main` ou
`staging`, aucune modification de Netlify Production, aucune modification du
moteur de corrélation, de `process_alert_opportunity`, des Edge Functions de
production ou du pipeline de collecte.

## 12. Chemin du bundle final

`sprint-4-opportunity-enrichment.bundle` — livré dans le dossier partagé,
vérifié (`git bundle verify` : *okay*, historique complet), référence unique
`refs/heads/feature/sprint-4-opportunity-enrichment` au commit `8138a1b`.

---

STOP. Sprint 5 non commencé.
