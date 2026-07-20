# Sprint 4 — Enrichissement métier des dossiers d'opportunité

## 1. Objectif

Transformer une opportunité "technique" (Sprint 1-3 : titre, correlation_key,
scores, agrégats) en un dossier exploitable par un commercial, sans toucher
au moteur de corrélation (Sprint 2.1), à la RPC `process_alert_opportunity`
(Sprint 2/2.1) ni aux triggers automatiques (Sprint 3).

## 2. Audit du modèle actuel (Phase 1)

Avant toute création de champ, audit complet de ce qui existe déjà :

- `veille.opportunites` (Sprint 1/2/3) : `titre`, `resume`, `description`
  existent déjà mais ne sont **jamais peuplés** par le pipeline automatique
  (Sprint 2/3 n'écrivent que `titre`) — réutilisables tels quels pour le
  résumé métier (§8), sans nouvelle colonne.
- `veille.alertes` : `montant` (numeric) et `categorie_veille` (enum à 12
  valeurs) existent déjà et portent une information de budget/fiabilité
  observée, jamais exploitée jusqu'ici au niveau de l'opportunité.
- `score_details` (jsonb, Sprint 2) contient déjà, quand un scoring manuel a
  eu lieu, `correlation.confidence` (`high`/`low`) et
  `anticipation.etapeProjet` — réutilisables comme entrées du niveau de
  confiance et de la phase du projet, sans nouveau calcul redondant.
- `veille.opportunite_preuves` / `opportunite_decideurs` : comptables
  directement (`COUNT(*)`), aucun nouveau compteur stocké nécessaire.
- Métadonnées IA : le seul composant IA du produit (`AlertAssistant.tsx`,
  chat RAG par alerte) est **éphémère et non persisté** — il n'écrit rien en
  base. Aucune métadonnée IA cachée à consolider.

**Champs réellement absents** (ajoutés par ce sprint, voir §9) :
`phase_projet` (miroir persistant de `etapeProjet`), `budget_identifie`,
`budget_source`, `budget_fiabilite`, `budget_estime` (réservé, jamais rempli
— §8), `niveau_confiance`, `statut_enrichissement`, `raisons`,
`derniere_consolidation_at`.

## 3. Modèle métier cible (Phase 2/3)

| Champ | Origine | Nature |
|---|---|---|
| famille / type de projet | `opportunites.type_opportunite` (existant, Sprint 2) | Déduit (dérivé de l'alerte) — aucun nouveau champ |
| phase / maturité | `score_details.anticipation.etapeProjet` si un scoring manuel a eu lieu, sinon `null` | Déduit si présent, sinon **indisponible** (jamais inféré depuis `categorie_veille`) |
| budget identifié | `alertes.montant` de l'alerte la plus récente parmi celles rattachées qui en portent un | **Observé** |
| budget estimé | — | **Réservé, jamais peuplé** dans ce sprint (aucune méthodologie d'estimation fiable aujourd'hui) |
| source du budget | référence/URL/nom de l'alerte source du budget identifié | Observé |
| fiabilité du budget | `categorie_veille` de l'alerte source (table de correspondance ci-dessous) | Déduit |
| niveau de confiance global | `score_details.correlation.confidence` si disponible, sinon nombre de signaux | Déduit |
| statut d'enrichissement | preuves + décideurs + confiance | Déduit (voir §4) |
| raisons | signaux, budget, décideurs, preuves, confiance, phase | Déduit (phrases factuelles gabarisées) |
| résumé métier | tous les champs ci-dessus | Déduit (gabarit déterministe, §8) |
| nombre de preuves / décideurs | `COUNT(*)` sur les tables de liaison existantes | Observé, jamais stocké en double |
| dates premier/dernier signal, dernière mise à jour | déjà existantes (Sprint 2/3) | Observé |

Table de correspondance `categorie_veille` → fiabilité du budget :

| Catégorie | Fiabilité |
|---|---|
| 1. Documents administratifs | Officiel |
| 5. Marchés publics & renouvellements | Officiel |
| 6. Délibérations | Officiel |
| 9. Arrêtés préfectoraux | Officiel |
| 12. Budgets collectivités / investissements | Officiel |
| 3. Maîtrise foncière | Probable |
| 4. Urbanisme (compatibilité) | Probable |
| 7. ICPE | Probable |
| 2. Presse locale | À vérifier |
| 8. Actualisation de données | À vérifier |
| 10. Articles associations | À vérifier |
| 11. Élus locaux | À vérifier |

Règle de niveau de confiance :

```
confiance = Faible                          si correlation.confidence = 'low'
confiance = Élevé   si high  et signaux >= 2 ; Moyen si high et signaux = 1
confiance = Moyen si (jamais scoré) et signaux >= 2 ; Faible sinon
```

## 4. Statut d'enrichissement (Phase 4)

Quatre valeurs : `pending` (jamais consolidé — valeur par défaut de la
colonne), `partial`, `ready`, `failed` (échec inattendu lors de la dernière
consolidation, posé par la couche d'orchestration, jamais par le calcul pur).

Règle de passage `partial` / `ready` (fonction pure, jamais `pending` ni
`failed`) :

```
ready = (nombre_preuves >= 1) ET (nombre_decideurs >= 1) ET (confiance != 'Faible')
partial = sinon
```

Un dossier sans preuve OU sans décideur OU à confiance encore faible n'est
jamais considéré exploitable tel quel, quel que soit le budget identifié.
Transition validée sur Staging (données fictives) : un dossier `partial`
(1 signal, sans preuve ni décideur) est resté `partial` après ajout d'une
preuve et d'un décideur tant que la confiance restait `Faible` (1 seul
signal) ; il est passé à `ready` uniquement après l'arrivée d'un deuxième
signal réel (confiance `Moyen`) — voir rapport final pour le détail.

## 5. Consolidation des preuves et décideurs (Phase 5/6)

Aucune écriture dans `opportunite_preuves` / `opportunite_decideurs` /
`opportunite_alertes` par ce sprint : ces tables ne sont que **lues** pour
compter et pour dériver le budget (via les alertes liées). Aucun risque de
duplication introduit, par construction. La vue `veille.opportunite_dossier`
(SQL, `security_invoker = true`) expose ces comptages en direct
(`COUNT(*)` sur les tables de liaison), jamais un compteur stocké
séparément qui pourrait diverger.

## 6. Raisons factuelles (Phase 7)

`DossierEnrichmentService.buildRaisons(...)` construit une liste de phrases
strictement factuelles à partir de données déjà connues (nombre de signaux,
budget, décideurs, preuves, confiance, phase). Aucun texte marketing, aucune
génération par un modèle de langage — un gabarit déterministe, testé
(`scripts/sprint4-dossier-tests.ts`).

## 7. Résumé métier (Phase 8)

Audit préalable : les données disponibles (titre, entité cible, type,
géographie, nombre de signaux, dates, budget, décideurs, preuves) permettent
de produire un résumé fiable **sans inventer d'information** — chaque clause
n'apparaît que si la donnée sous-jacente existe réellement ; sinon, le
gabarit dit explicitement que l'information manque ("Aucun décideur
identifié à ce jour.") plutôt que de l'omettre silencieusement ou de la
deviner. Implémenté dans `buildResumeMetier(...)`, réutilise la colonne
`opportunites.resume` déjà existante (Sprint 1) — aucune nouvelle colonne
"résumé" créée. Idempotent (mêmes entrées => même sortie, testé).

Limite documentée : aucune UI n'écrit aujourd'hui dans `resume` — si un futur
écran permet l'édition manuelle du résumé, il faudra prévoir un indicateur
pour ne pas l'écraser silencieusement à la prochaine consolidation
automatique. Hors périmètre de ce sprint.

## 8. Architecture (Phase 9)

```
DossierRepository (I/O)          DossierEnrichmentService (pur)
  .getConsolidationInput()  --->   .consolidate(input)
  .saveConsolidation()      <---   DossierConsolidationResult
  .markConsolidationFailed()
        ^
        |
OpportunityDossierService.consolidateDossier(opportuniteId)
        (orchestration : lecture -> calcul pur -> écriture,
         échec => statut_enrichissement = 'failed', erreur relevée)
```

Même séparation que Sprint 2/2.1 (repository = I/O pur, service de calcul =
pur, orchestration = compose les deux), mais **sans nouvelle fonction
PL/pgSQL** : contrairement à `process_alert_opportunity` (qui doit garantir
une atomicité transactionnelle sur un find-or-create concurrent), la
consolidation du dossier est une simple mise à jour d'une ligne déjà
existante — écrire un mirroir SQL supplémentaire ici aurait ajouté de la
complexité sans nécessité démontrée.

Déclenchement : **manuel/à la demande** dans ce sprint (appelé directement,
pas de nouveau trigger automatique). L'objectif du Sprint 4 ("chaque
opportunité **devrait pouvoir contenir** toutes les informations
disponibles") n'exige pas de consolidation temps réel ; automatiser ce
passage (ex. trigger sur `opportunite_preuves`/`opportunite_decideurs`/
`opportunite_alertes`) resterait un ajout simple et à faible risque pour un
sprint futur, si un besoin concret l'exige.

## 9. Migration (additive)

`supabase/migrations/20260717000300_sprint4_opportunity_dossier.sql` :
9 colonnes additives sur `veille.opportunites` (toutes nullable sauf
`statut_enrichissement` et `raisons`, qui ont une valeur par défaut), 6
contraintes `CHECK` documentées, 1 index, 1 vue (`veille.opportunite_dossier`,
`security_invoker = true`). Aucune colonne existante modifiée ou supprimée,
aucune donnée existante affectée (toutes les nouvelles colonnes prennent leur
valeur par défaut sur les lignes déjà existantes).

## 10. Tests (Phase 10) — résumé

15 tests unitaires purs (`scripts/sprint4-dossier-tests.ts`, 15/15 passés) sur
les règles de confiance, de statut et les gabarits de raisons/résumé,
couvrant explicitement les cas limites (dossier vide, confiance faible malgré
preuves/décideurs, idempotence).

10 cas exécutés sur Staging avec des données fictives (préfixe
`SPRINT4-TEST`), en import direct du code réellement expédié
(`DossierEnrichmentService.consolidate`, non réimplémenté) sur des données
lues en base réelle, toutes supprimées ensuite (compteurs avant/après
identiques, tous à 0) : données complètes (ready), données partielles,
sans budget, sans décideur, sans preuve, plusieurs preuves, plusieurs
décideurs, transitions de statut, absence de duplication, rétrocompatibilité
Sprint 3 (opportunités créées par le trigger automatique inchangé, champs
Sprint 4 correctement initialisés à `pending` par défaut). Détail complet
dans le rapport final.

## 11. Limites connues

- `budget_estime` existe en base mais n'est jamais rempli par ce sprint
  (aucune méthodologie d'estimation fiable aujourd'hui).
- `phase_projet` reste `null` tant qu'aucun scoring manuel n'a fourni
  `etapeProjet` — pas d'inférence heuristique depuis `categorie_veille`.
- La consolidation est manuelle/à la demande, pas automatique en temps réel.
- Si une future UI permet l'édition manuelle de `resume`, un indicateur
  anti-écrasement sera nécessaire (non traité ici, aucune UI n'écrit ce
  champ aujourd'hui).
