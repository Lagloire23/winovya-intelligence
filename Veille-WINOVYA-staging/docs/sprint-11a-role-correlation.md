# Sprint 11A — Rôle des alertes dans la corrélation

Premier sprint d'implémentation de P11.0/P11.1. Périmètre strictement
limité au rôle d'une alerte dans la corrélation d'une opportunité
(P11.1 §5.3 : déclencheur / confirmant / contextuel / hors sujet). Aucun
moteur de cohérence des regroupements (Sprint 12), aucun retrait manuel
(Sprint 11B), aucun recalcul en cascade (Sprint 11C) : ce sprint ajoute
uniquement la capacité de STOCKER et D'AFFICHER un rôle déjà
existant/futur, sans jamais en calculer ni en inventer un.

## 1. Ce qui a été fait

- Migration additive sur `veille.opportunite_alertes` (Sprint 1,
  inchangée par ailleurs) : `role_correlation`, `raison_correlation`,
  `source_role`, `role_attribue_at`. Contraintes CHECK sur les valeurs
  autorisées (`declencheur | confirmant | contextuel | hors_sujet |
  non_classe` pour le rôle ; `moteur | manuel` pour la source) et sur la
  cohérence (pas de raison/source/date sans rôle).
- Domaine métier : `src/lib/opportunities/dossier/roleCorrelation.ts`
  (types `RoleCorrelation`/`SourceRole` + validation défensive
  `sanitizeRoleCorrelation`/`sanitizeSourceRole`, même principe que
  `sanitizeRaisons`).
- API : `OpportuniteQueryRepository.fetchAlertesLiees` lit désormais le
  rôle sur la table de liaison (une seule requête supplémentaire, pas de
  N+1) ; `AlerteLieeDto` expose `roleCorrelation`, `raisonCorrelation`,
  `sourceRole`, `roleAttribueAt`.
- Frontend : badge `RoleCorrelationBadge` (Déclencheur / Confirmant /
  Contextuel / Hors sujet / Non classé), affiché dans le panneau
  "Alertes liées" de la fiche opportunité, avec la justification en
  italique si renseignée. Aucune action de retrait n'est implémentée
  (réservé au Sprint 11B).
- Tests : `scripts/sprint11a-role-correlation-tests.ts` — 7 tests purs
  (validation/taxonomie) + 10 tests réseau réels sur Staging
  (rétrocompatibilité, écriture valide, rejet valeur invalide, rejet
  incohérence raison/rôle, lecture API, RLS positif/négatif Cetim vs
  Ekium, non-régression liste/détail, nettoyage). 17/17 OK.

## 2. Décisions explicites

- **Aucune valeur n'est calculée par ce sprint.** Les 35 liens existants
  restent `role_correlation = NULL` ("jamais évalué"). `'non_classe'`
  est une valeur autorisée par la contrainte SQL mais n'est écrite par
  aucun code de ce sprint — elle est réservée à un futur passage du
  moteur de cohérence (Sprint 12) qui aurait évalué une alerte sans lui
  trouver de rôle clair. La distinction NULL/`non_classe` n'est pas
  encore montrée à l'utilisateur (les deux affichent "Non classé") : la
  nuance devient utile seulement quand le Sprint 12 existera.
- **`role_attribue_par` volontairement absent.** Ce sprint n'introduit
  aucune attribution manuelle. Conformément à P11.1 §13.6, la
  traçabilité d'une correction humaine (qui, quand, pourquoi) devra
  réutiliser le patron d'historique append-only déjà existant
  (`veille.opportunite_activity_log`) plutôt qu'un champ sur ce lien —
  un lien peut être retiré (Sprint 11B), et un champ dessus disparaîtrait
  avec lui, cassant la traçabilité au moment précis où elle compte le
  plus (voir P11.1 §10.4).
- **`source_role` reste inutilisé en écriture par ce sprint** (colonne
  présente, jamais renseignée par du code applicatif) : elle attend le
  Sprint 12 (`'moteur'`) et une future correction manuelle (`'manuel'`).

## 3. Vérifications

- Migration appliquée sur Supabase Staging (`gcitqpgucepgroermzti`),
  schéma vérifié après coup (colonnes + 0/35 lignes avec rôle).
  `get_advisors` (sécurité) : aucune alerte nouvelle liée à cette
  migration.
- `npx tsx scripts/sprint11a-role-correlation-tests.ts` : 17/17 OK
  (contre Staging, comptes de test existants, aucune trace laissée après
  nettoyage).
- `npx tsc --noEmit` : aucune erreur.
- `npx tsc -b && npx vite build` (exécutés séparément pour respecter le
  budget de temps du bac à sable, voir rapport de sprint) : les deux
  étapes passent sans erreur, warning de taille de chunk préexistant et
  non lié à ce sprint.
- Aucun linter dédié (ESLint) n'est configuré dans ce dépôt : la seule
  vérification statique est `tsc --noEmit` (déjà validée) — la CI
  (`.github/workflows/ci.yml`) ne fait pas non plus tourner ESLint.

## 4. Dette technique / risques identifiés (hors périmètre de ce sprint)

- Le mécanisme de consolidation à la lecture
  (`OpportuniteQueryService.getDossier`) écrit via
  `DossierRepository.saveConsolidation`, soumis à la policy RLS
  "admin write opportunites" : un utilisateur non-admin ouvrant un
  dossier ne peut donc jamais déclencher lui-même une réécriture de
  `veille.opportunites` (déjà documenté dans
  `scripts/mission-fix-consolidate-pending.ts`, branche
  `fix/mission-real-data-visibility`, non fusionnée à `staging` à ce
  jour). Le Sprint 11C (recalcul en cascade après retrait d'alerte)
  devra tenir compte de cette même contrainte RLS pour le rôle de
  corrélation et pour la confiance métier (Sprint 13).
- Le correctif "écran blanc" (`sanitizeRaisons` dans
  `DossierRepository.ts`/`OpportuniteQueryRepository.ts`) vit sur la
  branche `fix/mission-real-data-visibility`, pas encore sur `staging` :
  ce sprint en repart donc sans ce correctif (branché depuis `staging`,
  conformément à la contrainte "créer une branche dédiée depuis
  staging"). Sans conséquence pour ce sprint (aucune modification du
  traitement de `raisons`), mais à garder en tête avant de fusionner
  les deux branches un jour.
