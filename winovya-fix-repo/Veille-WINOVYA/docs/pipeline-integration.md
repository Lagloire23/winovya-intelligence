# Sprint 3 — Raccordement automatique du pipeline de veille

## 1. Objectif

Avant ce sprint, le moteur d'opportunités déterministe (Sprint 2 / 2.1) existait
et fonctionnait, mais n'était appelé que **manuellement**, via la Edge Function
`process-alert-opportunity`. Ce sprint ne crée aucun nouveau moteur : il
**raccorde** le moteur existant au pipeline de veille existant, pour que toute
nouvelle alerte pertinente soit traitée automatiquement, sans étape manuelle.

## 2. Audit du pipeline existant (Phase 1)

Recherche exhaustive, avant toute modification, de ce qui connecte aujourd'hui
`veille.alertes` / `veille.pertinence_entreprise` à un traitement en aval :

- `information_schema.triggers`, filtré sur `event_object_schema = 'veille'` :
  **aucun résultat**.
- `information_schema.triggers`, sans filtre de schéma (toute la base) :
  seuls des triggers préexistants et sans rapport existent
  (`auth.users.on_auth_user_created`, `realtime.subscription.tr_check_filters`,
  triggers `storage.buckets` / `storage.objects`).
- `pg_tables` sur le schéma `supabase_functions` (Database Webhooks) : vide —
  aucun webhook configuré.
- Liste des Edge Functions déployées (connue depuis les sprints précédents) :
  aucune ne lit `pertinence_entreprise` pour en dériver un traitement
  automatique ; `process-alert-opportunity` est invoquée uniquement à la
  demande (admin, via le frontend ou un appel direct).

**Conclusion de l'audit** : le pipeline de collecte et d'analyse (scripts
externes à ce dépôt, qui écrivent directement dans `veille.alertes` puis
`veille.pertinence_entreprise` via SQL) s'arrête aujourd'hui à l'écriture de
`pertinence_entreprise`. Rien ne consomme cette écriture automatiquement.
C'est très précisément l'endroit où "l'alerte existe" et "la pertinence
entreprise est disponible" (Phase 2) deviennent vraies.

### Schéma du pipeline — AVANT

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

## 3. Point d'intégration retenu (Phase 2)

**Trigger PostgreSQL sur `veille.pertinence_entreprise`**, plutôt qu'une
nouvelle Edge Function ou un job planifié.

Justification :

- C'est le point exact, déjà audité (Phase 1), où les trois conditions du
  Sprint 3 sont réunies : l'alerte existe (contrainte FK), l'entreprise existe
  (contrainte FK), la pertinence entreprise est disponible (la ligne
  elle-même).
- Il fonctionne **quelle que soit la manière dont la ligne est écrite** :
  scripts du pipeline actuel (SQL direct), écriture manuelle, ou un futur outil
  — sans exiger que ce pipeline externe soit modifié ou même connaisse
  l'existence du moteur d'opportunités. C'est la garantie centrale demandée par
  la Phase 2 ("ne pas casser le pipeline existant").
- Il ne nécessite ni nouvelle Edge Function, ni nouveau job planifié, ni
  nouvelle dépendance — cohérent avec "ne complexifie jamais l'architecture
  sans nécessité démontrée".
- Alternative écartée : Database Webhook vers une nouvelle Edge Function.
  Rejetée car elle ajoute un aller-retour réseau et une nouvelle fonction pour
  un traitement qui est déjà, structurellement, un problème purement
  transactionnel (trouver-ou-créer une opportunité) — exactement ce que
  `process_alert_opportunity` fait déjà, en SQL, de façon idempotente.

## 4. Déclenchement automatique (Phase 3)

Deux triggers `AFTER` sur `veille.pertinence_entreprise`, sans aucune étape
manuelle :

- `trg_pertinence_insert_process_opportunity` — `AFTER INSERT`,
  `WHEN (new.statut = 'Actif')`.
- `trg_pertinence_update_process_opportunity` — `AFTER UPDATE OF statut`,
  `WHEN (new.statut = 'Actif' AND old.statut IS DISTINCT FROM new.statut)`
  (couvre le cas d'une ligne créée `Écarté` puis requalifiée `Actif`).

Les deux exécutent `veille.trg_process_pertinence_to_opportunity()`, qui :

1. vérifie le coupe-circuit (`veille.engine_settings`, Phase 4/7) ;
2. dérive les champs de corrélation depuis l'alerte réelle, à l'identique de
   `OpportunityEngineService.processAlertOpportunity` (chemin manuel) ;
3. calcule la `correlation_key` via un miroir SQL de `CorrelationEngine.ts`
   (voir §7) ;
4. appelle **uniquement** `veille.process_alert_opportunity(...)` — la RPC
   transactionnelle et idempotente du Sprint 2, inchangée.

Aucun calcul de score n'est effectué automatiquement (voir §8, limite connue
et assumée).

### Schéma du pipeline — APRÈS

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

## 5. Conditions de traitement (Phase 4)

Le moteur n'est jamais appelé si l'une de ces conditions est vraie :

- `veille.engine_settings.opportunity_engine_enabled = false` (par défaut :
  désactivé — voir §7).
- `pertinence_entreprise.statut` n'est pas `'Actif'` au moment de
  l'évènement (garde au niveau du `WHEN` du trigger : la fonction n'est même
  pas invoquée).
- L'alerte ou l'entreprise référencées n'existent pas : **structurellement
  impossible** grâce aux contraintes `FOREIGN KEY` déjà existantes sur
  `pertinence_entreprise.alerte_id` / `entreprise_id` (vérifié par test, §8,
  cas 7) — l'INSERT échoue avant même que le trigger ne s'exécute. Un garde-fou
  redondant existe malgré tout dans la fonction (défense en profondeur), au
  cas où ces contraintes venaient à changer.

## 6. Idempotence (Phase 5)

Aucun nouveau mécanisme créé. Le trigger délègue entièrement à
`veille.process_alert_opportunity`, dont l'idempotence (contrainte unique
`(entreprise_id, correlation_key)` + upsert transactionnel, Sprint 2) est
réutilisée telle quelle. Un même couple (alerte, entreprise) traité plusieurs
fois (ex : `statut` qui oscille) ne crée jamais de doublon — vérifié par test
(§8, cas 3).

## 7. Gestion des erreurs (Phase 6)

Avant de créer un nouveau mécanisme de journalisation, audit des mécanismes
existants : les logs Postgres/Supabase (`get_logs`, niveau `log_min_messages =
warning`) sont suffisants et déjà utilisés pour toutes les autres fonctions de
ce moteur. **Aucune nouvelle table de logs créée.**

Le corps de `trg_process_pertinence_to_opportunity()` encapsule l'appel à la
RPC dans un bloc `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...` :

- toute erreur (fonction absente, contrainte violée, etc.) est journalisée via
  `RAISE WARNING` avec l'alerte, l'entreprise, le `SQLSTATE` et le message
  d'erreur ;
- l'exception n'est **jamais relevée** : l'INSERT/UPDATE sur
  `pertinence_entreprise` aboutit toujours, quel que soit l'état du moteur ;
- **retraitement ultérieur** possible sans nouvelle infrastructure : un appel
  manuel identique à `process_alert_opportunity` (déjà idempotent), ou un
  aller-retour du `statut` (`Actif` -> autre valeur -> `Actif`) qui refait
  passer la ligne par le même trigger.

Preuve d'exécution réelle (Phase 8, cas 5) : la fonction
`process_alert_opportunity` a été temporairement renommée pour provoquer un
échec authentique. Le log Postgres réellement capturé :

```
opportunity_engine: echec traitement automatique
  alerte=146ce7c7-e7d6-4eaa-99e3-675a81c0fe1f
  entreprise=5466ec87-2b92-43cd-b08f-c22a161d1c62
  sqlstate=42883
  erreur=function veille.process_alert_opportunity(...) does not exist
```

La ligne `pertinence_entreprise` a bien été insérée (pipeline non interrompu),
aucune opportunité n'a été créée pour ce cas (aucune donnée corrompue), et un
retraitement ultérieur (après restauration de la fonction) a bien créé
l'opportunité attendue.

## 8. Sécurité (Phase 7)

- **Coupe-circuit dédié**, `veille.engine_settings` (table à une seule ligne),
  indépendant de `OPPORTUNITY_ENGINE_ENABLED` (variable d'environnement Deno,
  qui gouverne le chemin **manuel**, Edge Function). Un trigger Postgres ne
  peut pas lire une variable d'environnement Deno : ce commutateur côté base
  est nécessaire pour que le chemin **automatique** reste, lui aussi,
  désactivable instantanément (un seul `UPDATE`, effectif dès le prochain
  déclenchement, sans redéploiement). **Désactivé par défaut**, comme le
  commutateur Edge Function.
- `veille.engine_settings` : RLS activée, une seule policy (`service_role`,
  tous droits), accès révoqué à `public`/`anon`/`authenticated`.
- `veille.trg_process_pertinence_to_opportunity()` est `SECURITY DEFINER`
  (justifié : le pipeline externe qui écrit dans `pertinence_entreprise` n'a
  pas et ne doit pas avoir besoin du privilège `EXECUTE` sur
  `process_alert_opportunity`, réservé à `service_role`/`postgres` depuis le
  Sprint 2.1) avec `search_path` explicitement fixé (obligatoire pour toute
  fonction `SECURITY DEFINER`). Elle ne peut de toute façon être appelée que
  comme trigger (type `trigger`), pas directement.
- Aucune clé `service_role` n'est exposée au frontend : aucun changement
  frontend dans ce sprint.
- JWT, RLS, Edge Functions existants : strictement inchangés.
- `get_advisors` (sécurité) exécuté après la migration : **aucune nouvelle
  alerte** liée aux objets de ce sprint (`engine_settings`,
  `normalize_for_correlation`, `generate_correlation_key`,
  `trg_process_pertinence_to_opportunity`, les deux triggers). Les seules
  alertes retournées sont préexistantes et sans rapport (tables `public.*`
  d'autres fonctionnalités de veille, policies `authenticated` déjà en place,
  bucket de stockage, `handle_new_user`/`is_admin`).

## 9. Miroir SQL de la clé de corrélation (Sprint 2.1, Stratégie B)

Le trigger ne peut pas exécuter de TypeScript : l'algorithme de
`CorrelationEngine.ts` (normalisation NFD + suppression des diacritiques,
puis `entreprise|entité|type|géographie`, sans fenêtre temporelle — Stratégie
B retenue au Sprint 2.1) est reproduit en PL/pgSQL
(`veille.normalize_for_correlation`, `veille.generate_correlation_key`).

Conséquence assumée : une **troisième** implémentation de cet algorithme
existe désormais (TypeScript, miroir Deno de la Edge Function, miroir SQL).
Toute évolution de l'algorithme doit être répercutée dans les trois et
revalidée. C'est la conséquence directe et documentée de la contrainte "aucun
nouveau framework" : il n'existe aucun mécanisme de partage de code entre
TypeScript et PL/pgSQL dans cette architecture.

Cohérence vérifiée par test croisé (régression MBDA — voir
`scripts/sprint3-key-consistency-check.mjs` côté TypeScript et appels directs
`veille.generate_correlation_key(...)` côté SQL) : mêmes 4 identifiants
d'alerte, même entité/type/géographie -> **même clé** des deux côtés, char
pour char, y compris sur des cas avec diacritiques (`Île-de-France`,
`L'Haÿ-les-Roses`, `Provence-Alpes-Côte d'Azur`).

Un bug réel a été détecté et corrigé pendant cette vérification : la table de
translittération initiale comptait 6 caractères `o/O` accentués en cible pour
5 en source, décalant toutes les correspondances suivantes (`ÿ` était
transformé en `n` au lieu de `y`). Corrigé avant livraison, revérifié.

## 10. Limite connue et assumée : scores non calculés automatiquement

Le chemin automatique s'arrête à "opportunité créée -> décideurs liés ->
preuves liées" (Phase 9), sans calculer les 4 indicateurs
(adéquation/convergence/anticipation/priorité) : ils restent `NULL` après un
traitement automatique.

Raison : le contrat de `ScoreEngine.computeAdequationScore` (Sprint 2) exige 7
sous-scores réels, sans valeur par défaut. Les données réellement disponibles
dans le pipeline actuel (`pertinence_entreprise.score_pertinence`,
`donneur_ordre_deja_client`) sont un jugement global, pas 7 dimensions
distinctes. Fabriquer une correspondance approximative aurait été une fausse
précision, explicitement évitée. Cette lecture est cohérente avec la
spécification du Sprint 3 elle-même, dont la séquence de démonstration
(Phase 9) s'arrête à "Preuves liées", sans mention de scores calculés.

Les scores restent calculables ensuite via le chemin **manuel** existant et
inchangé (Edge Function `process-alert-opportunity`), dès lors que de vrais
sous-scores sont disponibles.

## 11. Tests exécutés (Phase 8) — résumé

Dix cas exécutés sur Staging avec des données 100% fictives (préfixe
`SPRINT3-TEST`), toutes supprimées ensuite (compteurs avant/après identiques,
tous à 0). Détail complet dans le rapport final du sprint. Résumé :

1. Nouvelle alerte -> nouvelle opportunité : **OK**.
2. Deuxième alerte, même correspondance -> enrichissement (pas de doublon) :
   **OK**.
3. Répétition du même traitement (`Actif` -> `Écarté` -> `Actif`) ->
   idempotent : **OK**.
4. Moteur désactivé -> aucune opportunité créée : **OK**.
5. Erreur moteur simulée (fonction RPC renommée) -> pipeline non interrompu,
   erreur journalisée (log réel capturé), aucune donnée corrompue, reprise
   ultérieure réussie : **OK**.
6. Pertinence non `'Actif'` -> trigger jamais invoqué : **OK**.
7. Alerte/entreprise inexistante -> bloqué par les contraintes `FOREIGN KEY`
   existantes, avant même le trigger : **OK** (confirme une garantie
   structurelle préexistante, pas une nouvelle).
8. Même alerte, deux entreprises concernées -> deux opportunités distinctes,
   une par entreprise : **OK**.
9. Aucune opportunité dupliquée sur l'ensemble des cas : **OK**.
10. Démonstration bout-en-bout (Phase 9) : alerte -> pertinence -> moteur ->
    opportunité créée -> décideur lié -> preuves liées, sur Staging : **OK**.
