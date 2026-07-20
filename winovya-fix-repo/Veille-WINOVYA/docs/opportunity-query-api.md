# Sprint 5 — API métier de consultation des dossiers d'opportunité

## 1. Objectif

Fournir une **couche d'accès métier unique** pour consulter les dossiers
d'opportunité (Sprint 4), destinée à tout consommateur futur : Dashboard
Opportunités, Frontend React, exports, Assistant IA, intégrations CRM.
Aucun consommateur ne doit interroger directement `veille.opportunites`,
`veille.opportunite_dossier` ou les tables de liaison — tout passe par
`OpportuniteQueryService` (`src/lib/opportunities/query/`).

Ce sprint n'ajoute **aucune règle métier** : la classification
(`niveau_confiance`, `statut_enrichissement`, `raisons`, `résumé`) reste
calculée exclusivement par `DossierEnrichmentService` (Sprint 4,
inchangé). Il n'ajoute ni IA, ni API externe, ni framework, ni dépendance
npm. Ce n'est pas une nouvelle Edge Function ni une API HTTP exposée :
c'est un module TypeScript pur, appelé directement par le code
applicatif, avec le même client Supabase anon-key que le reste du
produit (jamais `service_role`).

## 2. Audit initial (Phase 1)

- `veille.opportunite_dossier` (Sprint 4) expose déjà tous les champs
  métier nécessaires à la liste et au détail, avec les comptages
  `nombre_preuves`/`nombre_decideurs` calculés en direct.
- **Aucun trigger** sur `opportunite_preuves`, `opportunite_decideurs`
  ou `opportunite_alertes` (vérifié via `information_schema.triggers`,
  filtré sur `event_object_schema = 'veille'`) : `opportunites.updated_at`
  n'est mis à jour que par `process_alert_opportunity` (Sprint 2), jamais
  par un rattachement direct de preuve/décideur/alerte. `updated_at` seul
  est donc un signal de fraîcheur insuffisant pour la Phase 3.
- `DossierRepository` / `OpportunityDossierService` (Sprint 4) et
  `DossierEnrichmentService.consolidate` sont réutilisés tels quels,
  jamais recopiés.
- `OpportunityRepository` (Sprint 1/2) et `OpportunityMapper` restent
  dédiés au moteur de corrélation ; aucune logique commune à dupliquer
  avec la couche de consultation.

## 3. Architecture retenue (Phase 2)

```
Consommateur (Frontend, Dashboard, exports, Assistant IA, CRM)
        |
        v
createOpportuniteQueryService()  (src/lib/opportunities/query/index.ts)
        |
        v
OpportuniteQueryService                 <-- orchestration (lecture, décision
  - listDossiers()                          de consolidation, mapping DTO)
  - getDossier()
  - getAlertesLiees() / getPreuves() / getDecideursLies()
  - getChronologie()
  - getStats()
        |                     \
        v                      v
OpportuniteQueryRepository     OpportunityDossierService (Sprint 4, inchangé)
  - pure I/O                    - consolidateDossier() : lecture -> calcul pur
  - lit veille.opportunite_dossier  (DossierEnrichmentService) -> écriture
  - lit alertes/preuves/decideurs   (jamais recopié ici)
    (batch, jamais en boucle)
```

Séparation stricte lecture / écriture / calcul / mapping :

- **Lecture (I/O pure)** : `OpportuniteQueryRepository` — aucune ligne de
  calcul métier, uniquement des requêtes Supabase.
- **Écriture** : exclusivement déléguée à
  `OpportunityDossierService.consolidateDossier` (Sprint 4) ; ce fichier
  n'écrit jamais directement dans `opportunites` ou les tables de
  liaison.
- **Calcul** : aucun nouveau calcul métier — seule une fonction de
  décision pure (`needsConsolidation`, Phase 3) et des fonctions de
  mapping pur (DTO) sont ajoutées.
- **Mapping DTO** : `mapToListItemDto`, `mapToDetailDto`,
  `mapAlerteDto`, `mapPreuveDto`, `mapDecideurDto` — jamais de type SQL
  brut exposé hors du module `query/`.

### Détail testabilité (choix technique notable)

`OpportuniteQueryService.ts` importe `OpportuniteQueryRepository` et
`OpportunityDossierService` **uniquement en tant que types**
(`import type`), jamais comme valeurs runtime, et son constructeur
n'a **aucune valeur par défaut** (dépendances toujours explicites). Cela
permet de tester ce fichier (décision de consolidation, mapping,
orchestration complète avec des doubles de test) sans environnement
Supabase réel, sans reproduire la logique. La construction réelle,
câblée sur le client Supabase applicatif (anon-key), se fait
exclusivement via `createOpportuniteQueryService()` (`query/index.ts`),
qui est le seul point d'entrée destiné au code applicatif.

## 4. Migration (Phase 2/3) — extension additive de la vue

`supabase/migrations/20260717000400_sprint5_opportunity_dossier_view_extension.sql` :
`CREATE OR REPLACE VIEW veille.opportunite_dossier`, colonnes Sprint 4
strictement inchangées et dans le même ordre, 3 colonnes ajoutées à la
fin :

| Colonne | But | Phase |
|---|---|---|
| `derniere_evolution_metier_at` | `GREATEST(updated_at, dernière preuve, dernier décideur, dernière alerte liée)` — signal de fraîcheur réel, sans nouveau trigger, sans N+1 | 3 / 10 |
| `niveau_confiance_rang` | Traduction numérique (`Élevé`=3, `Moyen`=2, `Faible`=1, absent=0) de `niveau_confiance` (Sprint 4, inchangé) — tri uniquement, ne redéfinit pas la classification | 7 |
| `texte_recherche` | Concaténation minuscule de titre/entité/type/géographie/résumé/raisons — un seul filtre `ILIKE` pour la recherche libre | 5 |

`security_invoker = true` conservé ; `REVOKE ALL FROM PUBLIC` /
`GRANT SELECT TO authenticated, service_role` réémis défensivement.
Migration appliquée sur Staging (`gcitqpgucepgroermzti`) ; colonnes
vérifiées via `information_schema.columns` après application.

## 5. Stratégie de consolidation à la lecture (Phase 3)

Appliquée **uniquement** à `getDossier(id)` (lecture d'un dossier
précis), **jamais** à `listDossiers()` :

```
consolidation nécessaire  <=>  statut_enrichissement = 'pending'
                           OU  derniere_consolidation_at IS NULL
                           OU  derniere_consolidation_at < derniere_evolution_metier_at
```

Si nécessaire : un seul appel à
`OpportunityDossierService.consolidateDossier(id)` (Sprint 4, jamais
recopié), puis relecture de la ligne. Sinon : la ligne déjà lue est
retournée telle quelle, sans recalcul.

**Pourquoi pas sur la liste ?** Reconsolider potentiellement chacune des
lignes d'une page de résultats à chaque appel serait coûteux (Phase 10 :
« limiter les requêtes SQL, éviter le N+1 » — une liste de 20 dossiers
`pending` déclencherait 20 cycles lecture-calcul-écriture à chaque
affichage) et sans bénéfice pour un simple survol. La liste peut afficher
un statut `pending`/`partial` correspondant à la dernière consolidation
connue ; dès qu'un consommateur ouvre un dossier précis, la fraîcheur est
garantie par `getDossier`. Documenté comme choix assumé, pas comme
lacune.

## 6. Endpoints (méthodes publiques de `OpportuniteQueryService`)

| Méthode | Rôle | Phase |
|---|---|---|
| `listDossiers(query)` | Liste paginée, recherche, filtres, tri | 4-7 |
| `getDossier(id)` | Détail, avec consolidation à la demande | 4 / 3 |
| `getAlertesLiees(id)` | Signaux (alertes) rattachés | 4 |
| `getPreuves(id)` | Preuves rattachées | 4 |
| `getDecideursLies(id)` | Décideurs rattachés, avec date de liaison | 4 |
| `getChronologie(id)` | Fusion signaux+preuves+décideurs, triée décroissant | 4 |
| `getStats(search?, filters?)` | Compteurs/statistiques sur un ensemble filtré | 4 |

## 7. DTOs (Phase 4/8)

Définis dans `src/lib/opportunities/query/types.ts`, découplés de la
forme SQL (voir mapping dans `OpportuniteQueryService.ts`) :

- `OpportuniteListItemDto` — champs de liste (classification, budget
  réduit, confiance, statut d'enrichissement, signaux, compteurs) ;
  n'expose jamais `raisons`/`resumeMetier` (réservé au détail).
- `OpportuniteDetailDto` — étend le DTO de liste : budget complet
  (source, estimé), raisons, date de dernière consolidation, résumé
  métier.
- `AlerteLieeDto`, `PreuveDto`, `DecideurLieDto` — sous-ensembles
  métier des tables sources, jamais la ligne SQL brute.
- `ChronologieEntryDto` — entrée fusionnée `{type, date, label, refId}`.
- `OpportuniteStatsDto` — compteurs agrégés.
- `PageResult<T>` — `{items, page, pageSize, total, totalPages}`.

## 8. Recherche (Phase 5)

Un seul paramètre `search`, appliqué en `ILIKE` sur la colonne
`texte_recherche` (vue). Couvre titre, entité cible, type d'opportunité,
géographie, résumé et raisons (jsonb converti en texte) en une seule
clause. Extensible : ajouter un champ recherchable = une ligne de plus
dans la concaténation SQL de la vue, aucun changement côté TypeScript.

## 9. Filtres (Phase 6)

Tous combinables (ET logique entre filtres, OR à l'intérieur d'un filtre
à valeurs multiples) : `statutOpportunite[]`, `statutEnrichissement[]`,
`niveauConfiance[]`, `phaseProjet[]`, `typeOpportunite[]`,
`geographie[]`, `dateDebut`/`dateFin` (sur `date_dernier_signal` —
activité la plus récente, choix documenté), `nombreSignauxMin`,
`nombreDecideursMin`, `nombrePreuvesMin`. Vérifié sur Staging avec des
combinaisons réelles (voir §11).

## 10. Tri (Phase 7)

| `SortField` public | Colonne vue |
|---|---|
| `dernierSignal` | `date_dernier_signal` |
| `premierSignal` | `date_premier_signal` |
| `dateCreation` | `created_at` |
| `confiance` | `niveau_confiance_rang` |
| `nombreSignaux` | `nombre_signaux` |
| `budgetIdentifie` | `budget_identifie` |
| `alphabetique` | `titre` |

## 11. Sécurité (Phase 9)

- Client Supabase **anon-key uniquement** (`AppSupabaseClient`, même
  client que le reste de l'application) — jamais `service_role`.
- RLS des tables sources (`opportunites`, `opportunite_preuves`,
  `opportunite_decideurs`, `alertes`, `decideurs`) intégralement
  respectée grâce à `security_invoker = true` sur la vue (Sprint 4,
  reconduit).
- Vérifié en conditions réelles (requête réseau avec la clé anonyme
  publiable réelle contre Staging, `scripts/sprint5-rls-network-check.mjs`) :
  un client non authentifié reçoit **0 ligne** en lecture (`count: 0`,
  aucune erreur) et **0 ligne modifiée** en écriture (tentative
  `UPDATE opportunites.titre` bloquée : `titre` inchangé, vérifié après
  coup). Confirme qu'aucun contournement de RLS n'est possible depuis
  cette couche.
- Aucune policy modifiée, aucune nouvelle policy créée : ce sprint ne
  touche qu'à une vue en lecture.

## 12. Performance (Phase 10)

- `listDossiers` : **une seule requête** à la vue (filtres + tri +
  pagination + `count: 'exact'` en un seul aller-retour PostgREST).
- `getDossier` : une lecture, et — seulement si nécessaire — un cycle
  consolidation (Sprint 4, déjà optimisé) + une relecture. Jamais de
  requête par ligne de liste.
- Sous-ressources (`getAlertesLiees`, `getPreuves`, `getDecideursLies`)
  : toujours 1 requête de liaison + 1 requête `IN (...)` groupée, jamais
  de boucle — même schéma que `DossierRepository.getConsolidationInput`
  (Sprint 4).
- `getChronologie` : 3 requêtes batch en parallèle (`Promise.all`),
  fusion et tri en mémoire.
- `getStats` : une seule requête (colonnes réduites), agrégation en
  mémoire — acceptable au volume MVP actuel ; limite connue documentée
  ci-dessous.
- `derniere_evolution_metier_at`, `niveau_confiance_rang`,
  `texte_recherche` sont **calculés dans la vue**, jamais recalculés
  côté TypeScript ni stockés en double sur `opportunites`.

## 13. Tests exécutés (Phase 11)

**16/16 tests purs** (`scripts/sprint5-query-tests.ts`, `npx tsx`,
`node:assert/strict`), important le vrai code expédié
(`needsConsolidation`, `mapToListItemDto`, `mapToDetailDto`,
`mapAlerteDto`, `mapPreuveDto`, `mapDecideurDto`,
`OpportuniteQueryService`) avec des doubles de test pour le repository
et `OpportunityDossierService` (aucun accès réseau) :

- Décision de consolidation : `pending`, `derniere_consolidation_at`
  absente, antérieure à `derniere_evolution_metier_at` (3 cas → vrai) ;
  `ready`/`partial` à jour (2 cas → faux).
- Mapping DTO liste/détail/alerte/preuve/décideur : structure imbriquée
  correcte, aucun champ SQL brut, aucune fabrication de valeur.
- `getDossier` déjà consolidé et à jour → **`consolidateDossier` jamais
  appelé** (aucun recalcul inutile).
- `getDossier` pending → `consolidateDossier` appelé **exactement une
  fois**, relecture ensuite, statut reflété correctement.
- `getDossier` opportunité inexistante → `null`, consolidation jamais
  tentée.
- `getDossier` disparition entre consolidation et relecture → `null`,
  pas de crash.
- `listDossiers` : pagination (total/totalPages), `pageSize` plafonnée
  à 100, **aucune consolidation déclenchée** pour une liste (stratégie
  Phase 3 documentée).
- `getChronologie` : fusion + tri décroissant vérifiés.
- `getStats` : agrégation exacte sur un jeu fictif, une seule requête.

**Démonstration Staging avec données réelles fictives** (préfixe
`SPRINT5-TEST`, 1 entreprise, 8 opportunités, 1 alerte, 1 décideur, 2
preuves, toutes supprimées après validation) :

| # | Cas | Résultat |
|---|---|---|
| 1 | Pagination (pageSize 3, tri alphabétique) | Page 1/2/3 : 3+3+2 = 8 lignes exactes, aucun doublon, aucun oubli |
| 2 | Recherche libre (`"portuaire"`) | 1 résultat exact (`SPRINT5-TEST Plateforme portuaire`) |
| 3 | Filtres combinés (`statut_enrichissement=ready` ET `niveau_confiance=Élevé`) | 2 résultats exacts |
| 4 | Filtre `nombre_signaux >= 2` | 4 résultats exacts, exclut bien les dossiers à 0/1 signal |
| 5 | Tri `budget_identifie` décroissant (nulls en dernier) | Ordre exact : 5M, 1.5M, 800k, 300k, puis nulls |
| 6 | Tri confiance (`niveau_confiance_rang`) décroissant | Ordre exact : Élevé(3) x2, Moyen(2) x2, Faible(1), absent(0) x3 |
| 7 | Sous-ressources (alertes/preuves/décideurs liés à un dossier précis) | Requêtes batch vérifiées : 1 alerte, 1 preuve, 1 décideur avec date de liaison correcte |
| 8 | Opportunité inexistante | 0 ligne, aucune erreur |
| 9 | RLS (clé anonyme réelle, réseau réel contre Staging) | Lecture : 0 ligne, aucune erreur. Écriture (`UPDATE titre`) : 0 ligne affectée, `titre` inchangé vérifié après coup |
| 10 | Absence de duplication | Compteurs `opportunite_preuves`/`opportunite_decideurs`/`opportunite_alertes` strictement stables après toutes les lectures (2/1/1, exactement ce qui a été inséré) |

Compteurs avant/après nettoyage (entreprises, alertes, décideurs,
alerte_decideurs, pertinence_entreprise, opportunites,
opportunite_alertes, opportunite_decideurs, opportunite_preuves) :
**tous à 0 avant, tous à 0 après**.

`get_advisors` (sécurité) après migration : aucune alerte nouvelle liée
aux objets créés par ce sprint (les alertes présentes sont toutes
préexistantes, sans rapport avec `opportunite_dossier`).

## 14. Limites connues

- **`getStats` charge toutes les lignes filtrées en mémoire** pour
  agréger (pas d'agrégation SQL `GROUP BY` côté vue). Acceptable au
  volume MVP actuel ; si le nombre de dossiers devient important, migrer
  vers une agrégation SQL dédiée (vue ou fonction), sans changer la
  signature `getStats()`.
- **`dateDebut`/`dateFin` filtrent sur `date_dernier_signal`** (activité
  la plus récente), pas sur `created_at` — choix assumé et documenté
  (§9) ; un filtre supplémentaire sur la date de création pourrait être
  ajouté plus tard sans rien casser.
- **`getChronologie` n'inclut pas les transitions de statut** (changement
  de `statut_enrichissement`/`niveau_confiance` dans le temps) : aucune
  table d'historique n'existe aujourd'hui pour ces champs (limite héritée
  de Sprint 4, non créée par ce sprint).
- **Consolidation à la lecture uniquement sur `getDossier`, jamais sur
  `listDossiers`** : assumé (§5) — un dossier `pending`/`partial` peut
  apparaître dans une liste jusqu'à ce qu'il soit ouvert individuellement
  ou consolidé par un autre chemin (manuel, Sprint 4).
- **Pas de nouvel index dédié** à `texte_recherche`/`niveau_confiance_rang`
  au-delà de l'index Sprint 4 existant sur `statut_enrichissement` :
  acceptable au volume actuel (dizaines/centaines de dossiers) ; à
  revoir (index `GIN`/`trigram` sur `texte_recherche`) si le volume
  augmente significativement.
