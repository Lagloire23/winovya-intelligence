# Mission corrective — Affichage des vraies alertes dans le cockpit WINOVYA

Date : 2026-07-18. Projet source (lecture seule) : `mhsbwabrvcqnxnwamvwc`.
Projet cible (Staging) : `gcitqpgucepgroermzti`. Aucune écriture sur
Production. Aucun code applicatif modifié — cette mission est une correction
de données/configuration sur Staging, pas un développement.

## 1. Constat de départ

L'objectif métier des Sprints 10 et 10.1 (afficher de vraies opportunités
dans le cockpit Staging) semblait non atteint : seules des opportunités
`SPRINT8-DEMO` / `SPRINT9-DEMO` étaient visibles.

## 2. Diagnostic (cause racine)

L'import réel avait bien eu lieu (Sprint 10, batch
`SPRINT10-LEGACY-REAL-DATA-V1`) : 42 alertes réelles, 35 opportunités
réelles, réparties sur 3 entreprises réelles (Cetim, Ekium, Etamine),
correctement isolées par RLS (Sprint 10.1). La donnée réelle existait donc
déjà et était visible par le compte administrateur (49 = 35 réelles + 14 de
démonstration avant nettoyage).

La cause du symptôme rapporté n'était pas un échec d'import, mais deux
points distincts :

1. Le seul compte de test "membre" disponible (`user.staging@example.com`)
   était rattaché à `SPRINT8-DEMO Entreprise Cliente` (état laissé ainsi à
   la fin de la recette Sprint 10.1) — il ne pouvait donc voir que des
   opportunités de démonstration, aucune des 3 entreprises réelles.
2. Les données de démonstration (14 opportunités : 11 `SPRINT8-DEMO` + 3
   `SPRINT9-DEMO`, toutes sous l'entreprise fictive
   `a0000000-8888-4000-8000-000000000001`) restaient présentes aux côtés
   des données réelles, ce qui aurait pu prêter à confusion lors de toute
   vérification globale (vue admin).

## 3. Vérification des environnements (Étape 1)

| Élément | Projet Supabase détecté |
|---|---|
| Application Staging (Netlify `winovya-market-intelligence-staging`, branche `staging`) | `gcitqpgucepgroermzti` (confirmé par inspection du bundle JS déployé) |
| Script d'import Sprint 10 | source `mhsbwabrvcqnxnwamvwc`, destination `gcitqpgucepgroermzti` (garde-fou `assertDestinationIsNotProduction` actif) |
| Données de démonstration (SPRINT8-DEMO / SPRINT9-DEMO) | `gcitqpgucepgroermzti` uniquement (jamais présentes sur Production) |
| Données réelles importées (batch `SPRINT10-LEGACY-REAL-DATA-V1`) | `gcitqpgucepgroermzti`, lues depuis `mhsbwabrvcqnxnwamvwc` |

## 4. Audit du projet source (Étape 2, lecture seule stricte)

`mhsbwabrvcqnxnwamvwc` : 388 alertes, 396 lignes de pertinence entreprise,
3 entreprises (Cetim, Ekium, Etamine), 203 décideurs, 203 liens
alerte-décideur, 123 pièces jointes. Aucune écriture effectuée sur ce
projet au cours de cette mission (uniquement des `select`).

## 5. Audit du projet cible avant correctif (Étape 3)

49 opportunités au total : 35 réelles (batch Sprint 10, réparties Cetim 7 /
Ekium 15 / Etamine 13) + 14 de démonstration. Cause de la non-visibilité :
voir section 2.

## 6. Action corrective

Aucun ré-import n'était nécessaire (les 35 opportunités réelles étaient
déjà présentes, correctement isolées). Deux actions ciblées :

1. `update veille.profiles set entreprise_id = <Cetim> where email =
   'user.staging@example.com'` — le compte de test standard voit désormais
   directement des opportunités réelles (Cetim, 7 dossiers).
2. Suppression des données de démonstration (`scripts/sprint8-demo-cleanup.sql`,
   script déjà existant et déjà conçu pour ce nettoyage exact — préfixe
   d'id fixe `a0000000-8888-4000-8000-%`, jamais une donnée réelle).
   Décision retenue parmi les 3 options proposées : **suppression**, car
   ces données sont exclusivement des jeux de test fictifs (Sprint 8/9,
   explicitement préfixés et documentés comme tels dans leurs scripts de
   seed), isolées dans leur propre entreprise fictive, sans aucune valeur
   de recette une fois la vraie donnée disponible et visible.

## 7. Idempotence de l'import (garantie structurelle)

`veille.alertes.airtable_id`, `veille.decideurs.airtable_id`,
`veille.entreprises.airtable_id` et
`veille.pertinence_entreprise.airtable_id` portent chacune une contrainte
`UNIQUE` en base — une ré-exécution de l'import ne peut donc jamais créer
de doublon, y compris en cas d'erreur applicative (garantie au niveau base
de données, pas seulement au niveau du script).

## 8. Résultat final (vérifié en direct sur Staging, sessions authentifiées réelles)

- 35 opportunités au total, 0 donnée de démonstration restante.
- Admin (`admin.staging@example.com`) : voit les 35 opportunités réelles
  (test direct Supabase : 5/5 OK).
- `user.staging@example.com` (rattaché à Cetim) : voit exactement 7
  opportunités, toutes réelles, aucune fuite vers Ekium/Etamine (test
  direct Supabase : 13/13 OK).
- Suite de non-régression Sprint 10 (`npm test`) : 35/35 OK, 0 FAIL.
- `npm ci` + `npm run build` (build de production) : OK.

## 9. Portée non couverte par cette mission (transparence)

Le projet source contient 388 alertes réelles au total ; seules 42 (un
échantillon représentatif, choix assumé du Sprint 10, couvrant toutes les
catégories de veille et au moins un cas de regroupement) ont été importées
à ce jour. Cette mission n'a pas élargi ce volume : le symptôme rapporté
(« seules des données de démo visibles ») ne provenait pas d'un import
insuffisant mais du rattachement du compte de test et de la présence des
données de démonstration (voir section 2). Un élargissement de l'import
aux 388 alertes reste possible dans un sprint dédié si souhaité.
