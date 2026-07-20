# Sprint 0B — Smoke tests et clôture — Rapport

## Conclusion explicite : **SPRINT 0B NON VALIDÉ**

Le site est bien live désormais (confirmé), et Git/la plupart de Supabase sont conformes — mais en testant réellement les smoke tests demandés, j'ai découvert un **blocage réel et nouveau** : le schéma `veille` n'est pas exposé par l'API Data (PostgREST) du projet Staging. Concrètement, **toute l'application (Dashboard, Alertes, Entreprises, Décideurs, onboarding) va échouer à charger ses données** une fois connectée, même si la connexion elle-même fonctionne. Détail au point suivant.

## Découverte bloquante : schéma `veille` non exposé sur Staging

Test effectué directement sur l'API REST du projet Staging :
```
curl .../rest/v1/profiles?select=id&limit=1 -H "Accept-Profile: veille"
→ HTTP 406 : {"code":"PGRST106","message":"Invalid schema: veille","hint":"Only the following schemas are exposed: public, graphql_public"}
```

Toute l'application WINOVYA interroge la base via `.schema('veille')` (entreprises, alertes, décideurs, profils...). Ce réglage (« Exposed schemas » dans Project Settings → API) n'a jamais été configuré sur le projet Staging au moment de sa création — c'est un paramètre de plateforme (PostgREST), pas une table ou une migration SQL, donc invisible dans toutes les comparaisons de schéma que j'ai faites précédemment (colonnes/contraintes/index/policies, qui ont toutes montré un match parfait). **Aucun outil disponible ici ne permet de modifier ce réglage** — il se configure uniquement dans le Dashboard Supabase : **Project Settings → Data API → Exposed schemas**, ajouter `veille` à côté de `public` et `graphql_public`, puis sauvegarder.

C'est la cause probable de l'échec du test `onboarding-save` ci-dessous, et cela bloquerait de la même façon Dashboard/Alertes/Entreprises/Décideurs une fois qu'un utilisateur est connecté sur le site live.

## Résultats des smoke tests

| # | Test | Résultat |
|---|---|---|
| — | Site Netlify live, déploiement `ready` | **PASS** — `currentDeploy.state: ready`, id `6a58fa6ace29d2140d80f443`, HTTP 200 confirmé par requête directe |
| — | Bundle déployé cible bien Staging | **PASS** — `gcitqpgucepgroermzti` présent dans le bundle JS servi en direct, aucune clé `service_role`, référence production présente uniquement comme constante inerte du garde-fou `assertEnvironmentIsolation` |
| 1 | Connexion `admin.staging@example.com` | **PASS** (API : `/auth/v1/token` → 200, `/auth/v1/user` confirme l'identité) |
| 2 | Connexion `user.staging@example.com` | **PASS** (idem) |
| 3-6 | Dashboard / Alertes / Entreprises / Décideurs | **NON TESTÉ EN INTERFACE** — l'extension de navigateur (Claude in Chrome) n'est pas connectée dans cette session, donc pas de test visuel possible ; et de toute façon **ces pages échoueraient à charger leurs données** tant que le schéma `veille` n'est pas exposé (voir ci-dessus) |
| 7 | Onboarding | Même limitation |
| 8 | Upload / lecture / suppression pièce jointe fictive | **PASS** — testé via l'API Storage réelle lors des phases précédentes, nettoyé (0 fichier restant). Non re-testé aujourd'hui car état inchangé. |
| 9 | Appel non destructif à `onboarding-save` | **FAIL** — `HTTP 404 {"error":"Profil introuvable"}`. Cause identifiée : schéma `veille` non exposé (ci-dessus), pas un bug de la fonction elle-même (son code est correct, déjà audité) |
| 10 | Absence de requête vers `mhsbwabrvcqnxnwamvwc` | **PASS** — confirmé dans le bundle |
| 11 | Absence de `service_role` dans le bundle | **PASS** — confirmé dans le bundle live |

Toutes les données de test créées pendant ces vérifications ont été nettoyées (mots de passe temporaires supprimés, aucun fichier Storage résiduel, aucune entreprise créée puisque l'appel `onboarding-save` a échoué avant toute écriture).

## Vérification Netlify

- URL live : `https://winovya-market-intelligence-staging.netlify.app` — **PASS**, HTTP 200
- Déploiement : `state: ready` (confirmé via l'outil Netlify) — **PASS**
- Commit déployé exact (`24d28d9`) : non vérifiable via les outils Netlify disponibles (pas de champ commit exposé par le lecteur de projet) — mais le contenu du bundle JS servi est identique octet pour octet à celui que j'avais buildé localement depuis la branche `staging` réelle, donc cohérent
- Build command / publish directory : non ré-affichables via l'outil (pas de champ correspondant exposé), mais le résultat (bundle correct, taille cohérente) confirme indirectement une build réussie avec les bons réglages
- 4 variables VITE présentes : **PASS** (confirmées lors de leur configuration, valeurs non re-affichées)

## Vérification Supabase (`gcitqpgucepgroermzti`)

| Élément | Résultat |
|---|---|
| 9 migrations | **PASS** |
| 15 tables (schéma identique prod) | **PASS** |
| Bucket `veille-attachments` | **PASS** |
| 2 comptes Auth fictifs | **PASS** (via API Admin officielle) |
| Edge Functions `upload-attachment` / `onboarding-save` | **PASS** (déployées, actives) |
| Secrets `VEILLE_EXECUTION_MODE` / `OPPORTUNITY_ENGINE_ENABLED` | **PASS** (présence confirmée sans afficher les valeurs) |
| Site URL / Redirect URLs Auth Staging | Non vérifiable avec mes outils — tu indiques que c'est fait, je n'ai pas pu le contrôler indépendamment |
| **Schéma `veille` exposé sur l'API Data** | **FAIL** — nouvelle découverte, voir ci-dessus |

## Git

- Merge-base : `git merge-base feature/sprint-0b-cloud-staging staging-remote-24d28d9` → `24d28d9496a46c1d68acc30f8309ad60e595ce91` — exact, reconfirmé
- Commit final : `e970e89b1550a0ce15e28995b320a81665fadd28` (inchangé, aucune nouvelle modification de code nécessaire)
- Contenu : uniquement 2 fichiers documentaires (`docs/backlog-securite.md`, `docs/sprint-0b-staging-cloud-actions-manuelles.md`), aucun secret
- Bundle : `sprint-0b-cloud-staging-final.bundle` (déjà fourni, toujours valide)
- URL de création de PR :
```
https://github.com/Lagloire23/Veille-WINOVYA/compare/staging...feature/sprint-0b-cloud-staging?expand=1
```

## Risques résiduels

- **Schéma `veille` non exposé sur l'API Data Staging — bloquant fonctionnel réel, à corriger avant toute démo/test utilisateur.**
- RLS désactivé sur 7 tables `public.*` (hérité, backlog).
- 6 Edge Functions à clé API tierce codée en dur (backlog, non déployées sur staging).
- Fonctions Edge temporaires d'audit neutralisées mais toujours listées (aucun outil de suppression disponible) : `temp-sprint0b-recreate-test-accounts`, `temp-sprint0b-check-secrets`, `temp-sprint0b-reset-test-passwords` — toutes renvoient `410`, `verify_jwt` actif, aucune logique sensible restante.
- Tests d'interface visuelle non exécutables depuis cette session (extension de navigateur non connectée) — à faire toi-même une fois le point ci-dessus corrigé.

## Actions restantes

1. **Dashboard Supabase → Project Settings → Data API → Exposed schemas → ajouter `veille`** (à côté de `public`, `graphql_public`) — sans cela, rien de l'application ne fonctionnera sur Staging au-delà de la connexion.
2. Une fois fait, revérifier `onboarding-save` et faire un tour visuel rapide (Dashboard, Alertes, Entreprises, Décideurs, bandeau STAGING) toi-même ou me redemander si tu veux que je re-teste.
3. Pousser `feature/sprint-0b-cloud-staging` depuis le bundle fourni et ouvrir la PR (lien ci-dessus).
4. Migrer les 6 clés API tierces avant tout déploiement des fonctions concernées sur staging.
5. Vérifier les protections de branche GitHub (aucun accès `gh` depuis ce sandbox).

## Confirmation production

**Confirmé : aucune ressource de production n'a été modifiée** à aucun moment (uniquement des lectures sur `mhsbwabrvcqnxnwamvwc`, et le test comparatif de code HTTP sur son endpoint REST n'a utilisé aucune clé valide donc aucun accès réel).

---

STOP — la découverte du schéma non exposé change la conclusion : je ne peux pas valider le Sprint 0B tant que ce point n'est pas corrigé. Pas de Sprint 1.
