# Sprint 0B — Méthode d'extraction, de vérification et d'application des 9 migrations

Statut : **méthode proposée, en attente de ta validation. Aucun fichier SQL écrit, aucune migration appliquée, aucun commit poussé.**

Décisions confirmées par toi et prises en compte ci-dessous :
1. Git devient la source de vérité ; les 9 migrations sont extraites **une seule fois** depuis la production, puis toute évolution future passe exclusivement par Git.
2. Le staging doit être une image fidèle du schéma de production — les migrations 8 et 9 (`create_veille_ofgl_schema`, `create_arretes_prefectoraux_tables`) sont **incluses**, sans exclusion.
3. Le problème RLS/droits ouverts sur les tables `public.*` créées par les migrations 8 et 9 n'est **pas corrigé** — il est ajouté au backlog sécurité, aucune modification de la production.
4. Aucune donnée réelle n'est copiée — uniquement le schéma.

---

## A. Méthode d'extraction des 9 migrations

Pour chacune des 9 migrations, dans l'ordre chronologique déjà établi (versions `20260711083008` → `20260716061441`) :

1. Requête en lecture seule sur la production : `select statements from supabase_migrations.schema_migrations where version = '<version>'`.
2. Pour les 9 migrations observées à ce jour, la colonne `statements` est un tableau contenant **un seul élément** : le texte SQL exact tel qu'il a été soumis à l'origine. C'est ce texte, verbatim (espaces, retours à la ligne, commentaires compris), qui sera utilisé — aucune reformulation, aucune réécriture, aucun "nettoyage" de ma part.
3. Immédiatement après extraction, je calcule un hash SHA-256 de ce texte exact — c'est le **hash source**, avant toute écriture de fichier.
4. Le texte est ensuite écrit tel quel dans un fichier `supabase/migrations/<version>_<name>.sql` (convention Supabase CLI), dans le dépôt Git de travail (sur le système de fichiers natif utilisé pour tout le travail Git de ce projet — pas le dossier synchronisé Windows, pour éviter le bug de corruption déjà rencontré plusieurs fois sur ce chantier).
5. Répété pour les 9 migrations, dans l'ordre.

Résultat attendu : 9 fichiers `.sql` dans `supabase/migrations/`, un par migration, contenu identique à ce qui a été réellement exécuté en production.

## B. Méthode de vérification d'intégrité

1. Pour chaque fichier écrit, je recalcule un hash SHA-256 du contenu réellement présent sur disque.
2. Je compare ce hash au hash source calculé en étape A.3, **avant** l'écriture du fichier — les deux doivent être strictement identiques (comparaison octet à octet). En cas de désaccord sur une seule migration : j'arrête tout, je ne commite rien, je signale l'anomalie avant de continuer.
3. Vérification du compte : exactement 9 fichiers doivent exister, avec des noms correspondant exactement aux 9 couples (version, nom) inventoriés — ni fichier manquant, ni fichier en trop.
4. Un hash global (empreinte de l'ensemble des 9 migrations concaténées dans l'ordre) est conservé comme référence pour un contrôle futur.

## C. Méthode de comparaison entre les fichiers Git et les migrations réellement exécutées

Cette vérification est conçue pour être **rejouable à tout moment**, pas seulement aujourd'hui — c'est elle qui fait de Git la source de vérité dans la durée :

1. **Liste et ordre** : comparer `select version, name from supabase_migrations.schema_migrations order by version` (production) avec la liste triée des fichiers présents dans `supabase/migrations/` (version et nom extraits du nom de fichier). Les deux listes doivent correspondre exactement, un à un.
2. **Contenu exact** : pour chaque version, ré-extraire `statements` depuis la production, recalculer son hash, et le comparer au hash du fichier Git correspondant — doivent être identiques.
3. **Usage dans la durée** : si un jour cette comparaison révèle une migration présente en production mais absente de Git (exactement ce qui s'est passé avec les migrations 8 et 9 avant cet audit), c'est le signal qu'une modification a été appliquée en dehors du flux Git — à investiguer immédiatement plutôt qu'à ignorer.

## D. Plan d'application sur le projet Staging

1. **Vérification de cible** (répétée avant chaque action) : le projet visé est exclusivement `gcitqpgucepgroermzti` (Staging). Le projet `mhsbwabrvcqnxnwamvwc` (Production) n'est jamais la cible d'une écriture dans ce plan.
2. **Vérification d'état initial** : confirmer que `gcitqpgucepgroermzti` est toujours vide (aucune table dans `veille` ni `public`) juste avant de commencer, pour écarter tout risque de conflit `CREATE TABLE`.
3. **Application une par une, dans l'ordre exact des 9 versions** : chaque migration est appliquée individuellement (jamais en un seul bloc groupé), en relisant le texte SQL directement depuis le fichier Git au moment de l'application (pas depuis ma mémoire de conversation) — garantit que ce qui est appliqué est exactement ce qui est versionné.
   - Point important à anticiper : l'outil d'application de migration Supabase enregistre chaque migration appliquée sur staging avec un **nouveau numéro de version** (l'horodatage du moment de l'application sur staging), différent du numéro de version d'origine en production. Le **nom** de la migration et son **contenu SQL** restent identiques — c'est ce qui garantit la fidélité, pas la coïncidence des numéros de version entre les deux projets. Je le signale pour qu'il n'y ait pas de confusion plus tard si tu compares les deux tables `schema_migrations`.
4. **Arrêt immédiat en cas d'erreur** : si une migration échoue, j'arrête la séquence, je ne tente pas les suivantes, et je fais un rapport de l'erreur avant toute nouvelle tentative.
5. **Vérification post-application complète** : une fois les 9 migrations appliquées, comparaison avec la production actuelle (re-interrogée à ce moment, pas seulement l'audit du 15 juillet) sur : tables, contraintes (y compris `ON DELETE`), index, fonctions SQL (`is_admin()`, `handle_new_user()`), triggers, et policies RLS.
6. **Contrôle de sécurité informatif** : exécution de l'outil d'audit de sécurité Supabase (`get_advisors`, lecture seule) sur le projet staging. Je m'attends à ce qu'il signale l'absence de RLS sur les tables `public.*` des migrations 8 et 9 — c'est cohérent avec la fidélité recherchée (staging reproduit fidèlement, y compris ce point connu), je ne le corrige pas, conformément à ta décision.
7. **Confirmation finale** : aucune écriture n'aura été envoyée à `mhsbwabrvcqnxnwamvwc` à aucun moment de cette séquence — uniquement des lectures (`select`) sur la production, et des écritures uniquement sur `gcitqpgucepgroermzti`.
8. **Rapport de clôture** : tableau des 9 migrations avec leur hash source, leur hash de fichier, et confirmation d'application réussie sur staging ; résultat de la comparaison tables/contraintes/index/fonctions/triggers/RLS ; résultat de l'audit de sécurité informatif ; confirmation explicite que la production n'a reçu aucune écriture.

## Backlog sécurité (documentation uniquement, pas de correction)

Une fois cette méthode validée, j'ajouterai — dans le même lot de commits, en documentation seulement — une entrée de backlog décrivant : les 7 tables `public.*` sans RLS avec droits complets `anon`/`authenticated`, le fait qu'aucune Edge Function ni fichier du dépôt ne les référence, et la recommandation de clarifier leur origine avant d'envisager une correction. Aucune action corrective n'est prévue dans ce sprint.

---

**J'attends ta validation de cette méthode avant d'écrire le moindre fichier SQL, d'exécuter la moindre migration, ou de créer le fichier de backlog.**
