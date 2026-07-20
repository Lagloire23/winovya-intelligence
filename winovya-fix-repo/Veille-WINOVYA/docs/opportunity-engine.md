# Backend déterministe du moteur d'opportunités (Sprint 2 / 2.1)

Documentation strictement limitée au périmètre de ces deux sprints :
contrat entrée/sortie, architecture, formules des 4 indicateurs, clé de
corrélation (stratégie revue en 2.1), idempotence/concurrence, sécurité,
exemple de payload fictif, procédure de test Staging, limites connues.
Aucune IA n'intervient dans ce backend.

## 1. Architecture (revue Sprint 2.1, Phase 4)

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

`OpportunityEngineService` ne contient plus aucun `client.from(...)` :
toute lecture/écriture passe par l'un des deux repositories injectés.
`CorrelationEngine` et `ScoreEngine` sont des modules purs (aucun import
Supabase) — `ScoreEngine` ne calcule jamais à partir d'une requête SQL,
`CorrelationEngine` ne calcule aucun score, `OpportunityRepository` et
`AlertContextRepository` ne contiennent aucune logique métier (uniquement
des lectures/écritures directes, mappées).

`AlertContextRepository` a été introduit en 2.1 : `OpportunityRepository`
reste documenté et limité aux 4 tables "opportunités" du Sprint 1 ; lire
`alertes`/`entreprises`/`pertinence_entreprise`/`alerte_decideurs` est un
domaine de données différent, mieux isolé dans son propre repository de
lecture que mélangé dans OpportunityRepository.

## 2. Contrat d'entrée / sortie

Entrée (`ProcessAlertOpportunityInput`, voir `src/lib/opportunities/engine/types.ts`) :

- `alerteId`, `entrepriseId` : identifiants réels.
- `subScores` : les 7 sous-scores d'adéquation (`competences`,
  `types_opportunite`, `secteurs`, `references`, `geographie`,
  `mots_cles`, `compte_strategique`), chacun un nombre dans `[0, 100]`,
  tous obligatoires (aucune valeur par défaut).
- `etapeProjet` : une des 8 valeurs `INTENTION | ETUDE | FONCIER |
  AUTORISATION | RECRUTEMENT | CONSULTATION | ANNONCE | APPEL_OFFRES`.
- `correlationMetadata` (optionnel) : `entiteCible`, `typeOpportunite`,
  `secteur`, `geographie` — s'ils sont fournis, ils priment sur ce qui
  est dérivé automatiquement de l'alerte.
- `titre` (optionnel) : sinon dérivé de l'alerte.

Sortie (`ProcessAlertOpportunityResult`) : `opportuniteId`, `action`
(`created` | `updated` | `already_processed`), les 4 indicateurs +
`scoreDetails` + `scoreVersion`, et une `explanation` synthétique.

## 3. Mapping des champs réels (Phase 1 — audit, inchangé depuis le Sprint 2)

| Concept | Colonne source |
|---|---|
| Entité cible / donneur d'ordre | `alertes.acteur_entite` |
| Type de projet | `alertes.type_opportunite` (text[], 1ère valeur) |
| Secteur | fourni explicitement par l'appelant (aucune colonne dédiée sur `alertes`) |
| Géographie | `alertes.commune_collectivite` → `departement` → `region[0]` → `pays` |
| Date du signal | `alertes.date_detection` (NOT NULL, fiable) |
| Lien source | `alertes.lien_source_url` |
| Niveau de pertinence | `pertinence_entreprise.statut` (couple alerte/entreprise) |
| Décideurs associés | `alerte_decideurs` (table de liaison existante) |

## 4. Configuration centralisée (Phase 3, Sprint 2.1)

Toutes les pondérations et tables vivent dans un unique fichier,
`src/lib/opportunities/engine/scoringConfig.ts` : `ADEQUATION_WEIGHTS`,
`CONVERGENCE_WEIGHTS`, `ANTICIPATION_TABLE`, `PRIORITE_WEIGHTS`,
`SCORE_VERSION`. `ScoreEngine.ts` importe cette configuration et ne
déclare aucun poids lui-même. Aucune constante métier ne reste dispersée
ailleurs dans le code TypeScript.

La version Deno de l'Edge Function duplique ces mêmes valeurs à
l'identique, regroupées dans un unique bloc contigu clairement labellisé
("ScoreEngine (miroir de .../ScoreEngine.ts + scoringConfig.ts)") — les
Edge Functions de ce projet sont des scripts Deno autonomes, non
bundlés avec Vite, donc un import direct du fichier TypeScript est
impossible. Toute modification d'un poids doit être répercutée dans les
deux fichiers et revalidée par `scripts/sprint2-engine-tests.ts`.

**Adéquation** = somme pondérée des 7 sous-scores :
compétences 30 %, types d'opportunité 25 %, secteurs 15 %, références
10 %, géographie 10 %, mots-clés 5 %, compte stratégique 5 % (somme =
100 %). Rejette toute valeur manquante ou hors `[0,100]`.

**Convergence** = combinaison pondérée de 4 composantes, calculées à
partir des agrégats réels (jamais estimés) :
- nombre de signaux (40 %) — table fixe : 1→0, 2→40, 3→70, 4→90, 5+→100.
- diversité des sources (25 %) — ratio catégories de veille distinctes / nombre de signaux.
- proximité temporelle (20 %) — table fixe sur l'écart en jours entre premier et dernier signal : ≤7j→100, ≤30j→70, ≤90j→40, ≤180j→20, sinon 0.
- cohérence entité/géographie (15 %) — 100 si les deux correspondent, 50 si une seule, 0 sinon.

**Anticipation** = table de correspondance fixe sur l'étape de projet,
échelle linéaire décroissante de 100 (INTENTION) à 0 (APPEL_OFFRES).

**Priorité commerciale** = 45 % adéquation + 35 % convergence + 20 %
anticipation. Les 4 indicateurs restent toujours séparément persistés
et accessibles ; la priorité ne se substitue jamais aux 3 autres.

Arrondi : `Math.round` à l'entier le plus proche, appliqué à chaque
indicateur final.

## 5. Clé de corrélation — stratégie revue (Phase 2, Sprint 2.1)

### 5.1 Défaut identifié dans la stratégie Sprint 2

La version Sprint 2 initiale calculait :
`correlation_key = entreprise | entité | type | géographie | mois calendaire`.

Réexamen demandé avec l'exemple : **MBDA — "nouvelle usine" — Bourges —
signaux détectés en Mars, Mai, Juillet, Septembre**. Avec la fenêtre
mensuelle, ces 4 signaux (même entité, même type, même géographie, seule
la date change) produisaient **4 clés différentes**, donc 4 opportunités
distinctes — alors qu'il s'agit manifestement d'un seul projet dont la
maturité progresse sur plusieurs mois. **Faux négatif avéré et
systématique** : la majorité des projets publics/industriels détectés
par ce moteur s'étalent sur plusieurs mois entre l'intention et l'appel
d'offres — la fenêtre mensuelle fragmentait donc le cas normal.

### 5.2 Stratégies comparées

- **A) entreprise + entité + type + géographie + fenêtre temporelle**
  (Sprint 2 initial) — **rejetée**. Cf. §5.1.
- **B) entreprise + entité + type + géographie (site)** — **retenue**.
  Élimine le faux négatif MBDA (mêmes 4 signaux → une seule clé, quel
  que soit l'écart de plusieurs mois). "Géographie" correspond déjà,
  dans le mapping Phase 1, à la valeur la plus précise disponible
  (`commune_collectivite` en priorité) — pas de nouvelle colonne "site"
  nécessaire.
- **C) entreprise + entité + type + géographie + phase projet** —
  **rejetée**. Réintroduit le même défaut que A sous une autre forme :
  un projet qui progresse change quasi systématiquement de phase à
  chaque nouveau signal (INTENTION → ÉTUDE → FONCIER → ... →
  APPEL_OFFRES) ; inclure la phase dans la clé fragmenterait le même
  projet à chaque transition de phase — le problème MBDA se
  reproduirait, déclenché par un changement de phase plutôt que de
  mois.

### 5.3 Limite résiduelle acceptée (stratégie B)

Sans fenêtre temporelle, deux projets réellement distincts, portés par
le même acteur, de même type, au même endroit, mais séparés de plusieurs
années (ex: un projet clos en 2024 et un nouveau projet sans rapport en
2027), partageraient la même `correlation_key` et seraient à tort
regroupés. Ce risque est jugé moins dommageable que la fragmentation
systématique de la stratégie A (sous-groupement silencieux d'un dossier
actif) et **n'est pas corrigé dans ce sprint de stabilisation** : une
correction propre (ex: réinitialiser la clé si l'opportunité existante
est déjà WON/LOST/ARCHIVED depuis longtemps) constituerait une nouvelle
règle métier, hors périmètre du Sprint 2.1. Documenté comme candidat
pour un sprint futur.

### 5.4 Génération

`generateCorrelationKey` (`CorrelationEngine.ts`) normalise (accents,
casse, ponctuation) puis assemble `entreprise|entité|type|géographie`.
Si l'entité cible, le type ou la géographie sont absents, la confiance
est jugée insuffisante (`confidence: 'low'`) : un dossier distinct est
créé, dont la clé incorpore l'identifiant de l'alerte — aucun
regroupement hasardeux n'est jamais forcé. Le niveau de confiance est
conservé dans `score_details.correlation.confidence`.

Vérifié empiriquement sur Staging (données fictives) : 4 alertes MBDA/
Bourges datées mars/mai/juillet/septembre résolues vers la **même**
opportunité, avec `nombre_signaux` incrémentant correctement 1→2→3→4
(voir rapport Sprint 2.1, section preuves d'exécution).

## 6. Idempotence et concurrence (Phase 5, Sprint 2.1)

La fonction Postgres `veille.process_alert_opportunity` (migration
`20260717000100`) exécute dans une seule transaction : find-or-create
sur `(entreprise_id, correlation_key)` via `INSERT ... ON CONFLICT`
(index unique partiel), liaison idempotente alerte/décideurs/preuve
(`ON CONFLICT DO NOTHING` / `NOT EXISTS`), et recalcul des agrégats
réels (`nombre_signaux`, dates, diversité) depuis les relations, jamais
incrémentés manuellement.

**Analyse de concurrence (revue Sprint 2.1)** :
- *Race condition* sur l'upsert : le conflit d'unicité Postgres sérialise
  nativement deux transactions concurrentes visant la même
  `correlation_key` — la seconde attend la validation de la première
  puis relit un COUNT frais, pas de lecture obsolète.
- *Phantom read* : l'agrégat `nombre_signaux`/dates est toujours filtré
  sur l'`opportunite_id` déjà résolu — aucune ligne d'une autre clé ne
  peut s'y glisser.
- *Deadlock* : chaque appel verrouille toujours dans le même ordre
  (ligne `opportunites` de sa propre clé, puis ses tables enfants) ;
  deux clés différentes ne se contentent jamais sur la même ressource —
  aucun cycle de verrous possible.
- *Write skew* : la génération de `correlation_key` est pure et
  déterministe (mêmes entrées → même clé) ; deux appels concurrents
  pour la même alerte/entreprise ne peuvent jamais dériver vers deux
  clés différentes.
- *Lost update* : le recalcul de `nombre_signaux` se fait par `COUNT(*)`
  frais après acquisition du verrou, jamais par incrémentation d'une
  valeur lue en dehors de la transaction.

**Conclusion** : aucune correction nécessaire au mécanisme existant — le
conflit d'unicité + le recalcul systématique à l'intérieur de la même
transaction suffisent. Ajouter un verrou explicite ou passer en
isolation `SERIALIZABLE` serait une complexité inutile au regard des
garanties déjà offertes par la contrainte unique.

**Vérification empirique** : deux appels RPC pour la même
`correlation_key` (fictifs, acteur "Thales"/Cazaux) émis dans le même
tour d'outils ont produit `created` puis `updated` sur le **même**
`opportunite_id`, `nombre_signaux` 1 puis 2, et un `COUNT(*)` final de 1
ligne pour cette clé — aucune duplication observée. Limite honnête :
l'environnement d'exécution ne garantit pas que ces deux appels aient
été exécutés dans deux transactions Postgres strictement simultanées
(vs. très rapprochées) ; la garantie d'absence de duplication repose
avant tout sur la propriété structurelle de l'index unique + `ON
CONFLICT`, indépendante de l'ordre d'arrivée, et non sur cette seule
observation empirique.

## 7. Sécurité (Phase 7, reconfirmée Sprint 2.1)

- `EXECUTE` sur `process_alert_opportunity` : accordé uniquement à
  `postgres`/`service_role` (reconfirmé via
  `information_schema.routine_privileges`), refus réel constaté sous
  `SET ROLE authenticated` (`permission denied for function`, 42501).
- Fonction non `SECURITY DEFINER`, `search_path` figé
  (`veille, pg_temp`) — reconfirmé via `pg_proc.proconfig`.
- Edge Function déployée avec `verify_jwt=true` (aucun appel anonyme au
  niveau plateforme) + vérification applicative du rôle `admin`.
- Clé `service_role` utilisée uniquement côté serveur (Edge Function),
  jamais exposée au frontend.
- Coupe-circuit `OPPORTUNITY_ENGINE_ENABLED` : vérifié en toute première
  instruction, avant authentification. **Non défini sur Staging à ce
  jour** — le moteur reste désactivé (503) par défaut.
- RLS inchangée sur les 4 tables opportunités (lecture `authenticated`,
  écriture admin) — reconfirmé via `pg_policies`, aucune régression
  introduite par les colonnes additives Sprint 2.
- Aucune cible Production dans ce sprint (uniquement
  `gcitqpgucepgroermzti`, Staging).

## 8. Exemple de payload fictif

```json
{
  "alerteId": "…uuid d'une alerte réelle…",
  "entrepriseId": "…uuid d'une entreprise réelle…",
  "subScores": {
    "competences": 80, "types_opportunite": 70, "secteurs": 60,
    "references": 50, "geographie": 90, "mots_cles": 40,
    "compte_strategique": 20
  },
  "etapeProjet": "ETUDE",
  "correlationMetadata": { "secteur": "BTP" }
}
```

## 9. Procédure de test Staging

1. Activer `OPPORTUNITY_ENGINE_ENABLED=true` comme secret de l'Edge
   Function sur le projet Staging (`gcitqpgucepgroermzti`).
2. S'authentifier avec un compte admin Staging, appeler
   `process-alert-opportunity` avec le payload ci-dessus sur des
   données fictives.
3. Nettoyer les données fictives après test (voir Sprint 2 Phase 9 et
   Sprint 2.1 pour des exemples complets de fixtures + nettoyage).

## 10. Limites connues

- Sur-groupement résiduel accepté de la stratégie B de corrélation (§5.3).
- La concurrence stricte au sens de deux transactions rigoureusement
  simultanées n'est pas démontrable dans cet environnement d'exécution
  séquentiel ; la garantie repose sur une propriété structurelle de
  Postgres (§6), pas sur la seule observation empirique.
- `OPPORTUNITY_ENGINE_ENABLED` n'étant pas défini sur Staging, la chaîne
  complète Edge Function (bout en bout via HTTP réel) n'a pas pu être
  exercée dans cette session ; la logique a été validée directement au
  niveau de la fonction Postgres et des modules TypeScript purs.
