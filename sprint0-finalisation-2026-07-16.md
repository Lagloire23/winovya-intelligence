# Sprint 0 — Finalisation de l'infrastructure de développement

Date : 2026-07-16
Statut : **plan et préparations uniquement — aucune création ni modification distante effectuée.**
Règle absolue respectée : aucune action sur le site Netlify de production, le domaine `intelligence.winovya.com`, le projet Supabase de production, les edge functions de production, les variables d'environnement de production, la tâche de veille de production, ou la branche GitHub `main`.

---

## 1. Rapport GitHub (ÉTAPE 1)

Le dépôt `https://github.com/Lagloire23/Veille-WINOVYA.git` existe (créé par toi) et serait actuellement vide côté distant, sauf si le push que je t'avais fait faire lors du sprint précédent (via bundle Git) a abouti — je n'ai aucun moyen de le vérifier moi-même.

**Ce que je ne peux pas confirmer, faute d'accès** (aucun connecteur GitHub disponible dans cette session, aucune lecture web possible de la page du dépôt) :
- branche par défaut actuelle
- règles de protection de `main`
- règles de pull request existantes
- GitHub Actions existants
- Secrets et Variables GitHub configurés
- Environments GitHub configurés

**Ce que je sais avec certitude** : ton compte Netlify est relié à GitHub sous le nom d'utilisateur `Lagloire23` (confirmé via l'API Netlify) — cela correspond bien à l'URL du dépôt que tu m'as donnée.

**Action nécessaire de ta part** : confirme si le dépôt contient déjà les branches poussées précédemment (`main`, `staging`, `feature/opportunites-dossiers`), pour que je sache si le nouveau bundle ci-joint s'ajoute simplement par-dessus.

## 2. Rapport Netlify (ÉTAPE 4)

Analysé via le connecteur Netlify réel (lecture seule, aucune modification) :

- Équipe : "Lagloire23's team" (`lagloire23-2y1slrm`), plan **Free**, 1 seul membre (toi, Owner).
- 4 sites existent sur cette équipe : `winovya-intelligence` (celui qui nous intéresse), plus 3 sites sans rapport (`mywaitlist`, `graceful-sunflower-838df1`, `clever-zabaione-c8cd53` — produits différents, hors périmètre).
- Site de production : `winovya-intelligence`, id `bd7a3f79-e310-4fe4-9536-b05f9980f866`, domaine principal `intelligence.winovya.com`, accès par mot de passe désactivé, pas de SSO.
- **Méthode de déploiement actuelle : aucune intégration Git.** Le dernier déploiement a `deploy_source: "api"`, `commit_ref: null`, `branch: null`, `deploy_source: "api"` — c'est un déploiement par upload direct d'un dossier `dist/` pré-construit, pas un déploiement déclenché par un push GitHub. Concrètement : Netlify n'exécute pas lui-même `npm run build` aujourd'hui, il n'y a ni Preview Deployments automatiques, ni build hooks, ni build settings Git configurés pour ce site.
- Fonctions : aucune fonction serverless/edge Netlify déployée sur ce site (`available_functions: []`).
- Formulaires Netlify : non activés.
- Redirects : 1 règle de redirection traitée au dernier déploiement (probablement le SPA fallback vers `index.html` — standard pour une app React).
- Headers : aucune règle de headers custom au dernier déploiement.
- Scheduled functions : aucune détectée sur ce site.

**Limite de cet audit** : le connecteur Netlify disponible ici est en lecture seule et ne donne pas accès à la liste des variables d'environnement configurées, ni au détail des "Deploy contexts" (Production/Preview/Branch). Pour ce point précis, il faudrait que tu regardes toi-même dans Site settings → Environment variables, ou que j'utilise le navigateur (Claude in Chrome) si tu veux que j'aille plus loin visuellement.

## 3. Rapport Supabase (ÉTAPE 6, partie audit)

Organisation : **WINOVYA DataBase** (`pinlwggvsroxebodcfxt`), plan **Free**.

Deux projets existent dans cette organisation :

| Projet | Référence | Créé le | Statut |
|---|---|---|---|
| WINOVYA Market Intelligence (production) | `mhsbwabrvcqnxnwamvwc` | 2026-07-11 | ACTIVE_HEALTHY |
| **"Lagloire Project"** | `svtcvijqmldjbsceoeef` | 2025-07-25 | ACTIVE_HEALTHY |

⚠️ **Point à clarifier avec toi** : un second projet Supabase ("Lagloire Project") existe déjà dans la même organisation, créé avant même le projet de production. Je ne sais pas s'il est utilisé pour autre chose, s'il s'agit d'un ancien test, ou s'il pourrait servir de base pour le staging. **Je ne l'ai pas touché** (aucune lecture de son contenu au-delà de ses métadonnées de projet). Dis-moi ce qu'il est censé devenir.

Sur le projet de production (`mhsbwabrvcqnxnwamvwc`) :
- 7 migrations appliquées (confirmées, mêmes que l'audit précédent).
- 14 edge functions actives.
- `pg_cron` **confirmé non installé** (`installed_version: null`) — le mécanisme de planification de la veille (8h/13h/18h) reste non identifié avec les outils disponibles.
- Coût d'un **nouveau projet Supabase** (vérifié via l'outil officiel de coût) : **0 $/mois**. Coût d'une **branche Supabase** (fonctionnalité différente, explicitement exclue par ta consigne) : 0,01344 $/heure (~9,80 $/mois) — non retenue, conformément à ta demande de "ne jamais utiliser les Branches Supabase".

## 4. Plan de création du staging (ÉTAPE 5 + ÉTAPE 6, partie plan)

**Rien n'est créé. Ceci est un plan.**

### Netlify staging
- Nom : "WINOVYA Market Intelligence Staging"
- Branche liée : `staging`
- Domaine conseillé : `staging-intelligence.winovya.com` (nécessite un enregistrement DNS sur le domaine `winovya.com` — à créer par la personne ayant accès au gestionnaire DNS ; je n'ai pas cet accès)
- Variables : `VITE_APP_ENV=staging`, `VITE_SUPABASE_URL=<projet staging>`, `VITE_SUPABASE_ANON_KEY=<clé staging>`, `VITE_FEATURE_OPPORTUNITIES_ENABLED=true` (+ les 3 autres feature flags, voir section 8)
- Bandeau "STAGING" : **déjà codé et vérifié** (`src/components/EnvironmentBanner.tsx`, branche `feature/staging-infrastructure`) — s'affiche automatiquement dès que `VITE_APP_ENV` ≠ `production`, testé dans un build réel (le texte apparaît bien dans le bundle JS du build staging, absent du build production).

### Supabase staging
- Nom : "WINOVYA Market Intelligence Staging"
- Organisation : `pinlwggvsroxebodcfxt` (WINOVYA DataBase) — ou une organisation séparée si tu préfères une isolation encore plus stricte (à valider)
- Type : **vrai projet indépendant**, pas une branche Supabase (conforme à ta consigne)
- Coût annoncé par l'outil Supabase au moment de l'audit : 0 $/mois — **à reconfirmer au moment réel de la création** (l'outil de création exige une confirmation de coût dédiée, et le plan Free de Supabase limite généralement le nombre de projets actifs simultanés par organisation ; avec 2 projets déjà présents, il faut vérifier qu'un 3ème est possible sans upgrade de plan)
- Contiendra : le schéma complet (7 migrations rejouées), les 14 edge functions (redéployées, secrets reconfigurés séparément), aucune donnée de production copiée par défaut (voir section 6)

## 5. Plan de protection GitHub (ÉTAPE 3)

Paramètres exacts à appliquer sur la branche `main` (à faire toi-même via GitHub, faute d'accès API ; ou par moi si un connecteur GitHub devient disponible) :

- Require a pull request before merging : **activé**
- Required approvals : **1**
- Require status checks to pass before merging : **activé**, check requis = `build-and-typecheck` (nom du job dans le workflow CI ci-joint, `.github/workflows/ci.yml`, préparé mais pas encore poussé — GitHub exige qu'un workflow ait tourné au moins une fois avant de pouvoir le sélectionner comme check obligatoire, donc ce paramètre ne pourra être coché qu'après le premier push de ce fichier et une première exécution)
- Restrict who can push to matching branches : **activé** (personne ne pousse directement, tout passe par PR)
- Include administrators : **activé** (la règle s'applique aussi à toi en tant qu'administrateur du dépôt)
- Allow force pushes : **désactivé**
- Allow deletions : **désactivé**

Même logique recommandée pour la branche `staging` (PR obligatoire depuis `feature/*`, pas de push direct), avec une exigence de revue éventuellement assouplie à 0 si tu veux garder de la fluidité en recette — à toi de trancher.

## 6. Plan de synchronisation Production → Staging (ÉTAPE 7)

Spécification complète rédigée dans `docs/sync-production-to-staging.md` (branche `feature/staging-infrastructure`). Résumé :

- Copié : schéma (via les migrations déjà versionnées), edge functions (code source), rien d'autre par défaut.
- Si des données d'exemple sont copiées un jour (sur demande explicite future) : anonymisation systématique des emails, téléphones, notes d'équipe, et suppression de tout historique.
- Aucun script exécutable n'a été créé à ce stade — uniquement la spécification. Le script réel serait un travail de Sprint 1+, avec un garde-fou explicite empêchant qu'il ne puisse jamais écrire vers le projet de production.

## 7. Variables d'environnement (ÉTAPE 8)

**Frontend** (préfixe `VITE_`, jamais de secret) : `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_OPPORTUNITIES_ENABLED`, plus 3 nouveaux flags (voir section 8).

**Backend / edge functions** (jamais préfixées `VITE_`, jamais dans le dépôt) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VEILLE_EXECUTION_MODE`.

Vérification effectuée : recherche de motifs de secrets (clés API, JWT de production, `service_role`) sur l'ensemble des fichiers versionnés, toutes branches confondues — **aucun secret trouvé**. `.env.example` ne contient que des placeholders génériques.

## 8. Feature Flags (ÉTAPE 10)

Implémentés dans le code (`src/lib/featureFlags.ts`, branche `feature/staging-infrastructure`), tous inertes (aucune fonctionnalité métier n'est branchée dessus) :

| Flag | Variable | Production | Staging |
|---|---|---|---|
| `FEATURE_OPPORTUNITIES` | `VITE_FEATURE_OPPORTUNITIES_ENABLED` | `false` | `true` |
| `FEATURE_PROJECT_ENGINE` | `VITE_FEATURE_PROJECT_ENGINE_ENABLED` | `false` | `true` |
| `FEATURE_TIMELINE` | `VITE_FEATURE_TIMELINE_ENABLED` | `false` | `true` |
| `FEATURE_DECISION_MAKERS` | `VITE_FEATURE_DECISION_MAKERS_ENABLED` | `false` | `true` |

## 9. Scripts qui seront exécutés (si tu valides)

1. `git push` du bundle joint vers GitHub (branches `main` si pas déjà fait, `staging`, `feature/staging-infrastructure`, `feature/opportunites-dossiers`, `feature/opportunity-engine`, `feature/dashboard-opportunities`, `feature/pipeline-opportunities`) — action à faire toi-même (voir sprint précédent pour la procédure PowerShell exacte), ou par moi si un accès GitHub devient disponible.
2. Ouverture d'une Pull Request `feature/staging-infrastructure` → `staging` — à faire toi-même via le bouton GitHub "Compare & pull request" une fois le push effectué (je ne peux pas créer de PR sans accès API GitHub).
3. Application des règles de protection de branche décrites en section 5 — à faire toi-même dans Settings → Branches de GitHub, ou par moi avec un accès approprié.
4. Création du projet Supabase staging — outil prêt côté Supabase, **en attente de ta validation explicite** (voir section 10 et 11).
5. Création du site Netlify staging + configuration du domaine — **en attente de ta validation explicite**.
6. Liaison Git↔Netlify pour la production (transformer le déploiement manuel actuel en déploiement automatique sur push `main`) — **décision distincte, à valider séparément**, car cela change le mode opératoire de la production même si le contenu ne change pas.

Aucun de ces scripts n'a été exécuté.

## 10. Ressources payantes qui seraient créées

| Ressource | Coût annoncé | Statut |
|---|---|---|
| Projet Supabase staging (nouveau projet, pas une branche) | 0 $/mois (à reconfirmer à la création) | Non créé |
| Site Netlify staging | 0 $/mois attendu (plan Free actuel), sous réserve des quotas de build/bande passante partagés entre les 4 sites de l'équipe (non vérifiable avec les outils actuels) | Non créé |
| Sous-domaine `staging-intelligence.winovya.com` | 0 $ (sous-domaine d'un domaine déjà possédé) | Non créé, nécessite un accès DNS |

Aucune branche Supabase payante (0,01344 $/heure) n'est proposée, conformément à ta consigne explicite de ne jamais les utiliser.

## 11. Coût mensuel total estimé

**0 $/mois**, sous réserve des deux points de vigilance suivants, non totalement vérifiables avec les outils disponibles aujourd'hui :
- limite du nombre de projets Supabase gratuits actifs simultanément par organisation (2 projets existent déjà) ;
- quotas de build/bande passante Netlify partagés entre les 4 sites de l'équipe (plan Free).

## 12. Validations dont j'ai encore besoin avant toute action distante

1. Le push GitHub précédent (bundle du sprint dernier) a-t-il fonctionné ? Sinon, je dois repartir de zéro pour le push.
2. Que dois-je faire du projet Supabase existant "Lagloire Project" (`svtcvijqmldjbsceoeef`) — l'ignorer, ou le réutiliser comme staging ?
3. Valides-tu la création du projet Supabase staging tel que décrit (nom, organisation, coût annoncé) ?
4. Valides-tu la création du site Netlify staging (nom, domaine `staging-intelligence.winovya.com`) ? As-tu accès au DNS de `winovya.com` pour créer l'enregistrement une fois le site créé ?
5. Valides-tu qu'on relie Git à Netlify pour la production (changement du mode de déploiement actuel, manuel → automatique sur push `main`) — distinct de la création du staging ?
6. Valides-tu les paramètres de protection de `main` proposés en section 5 (1 review, checks obligatoires via le workflow CI joint) ?
7. Sais-tu où est configurée la planification 8h/13h/18h de la veille (nécessaire pour compléter cette partie de l'audit, sujet traité au Sprint 3) ?

**Je m'arrête ici. Rien n'a été créé ni modifié à distance. En attente de ta validation, point par point si tu préfères.**

---

## Annexe — Fichiers ajoutés depuis le dernier rapport (branche `feature/staging-infrastructure`, non poussés)

- `README.md` (nouveau)
- `docs/deployment.md` (nouveau)
- `docs/rollback.md` (nouveau)
- `docs/sync-production-to-staging.md` (nouveau)
- `.github/workflows/ci.yml` (nouveau, non poussé, non actif)
- `src/components/EnvironmentBanner.tsx` (nouveau)
- `src/lib/featureFlags.ts` (nouveau)
- `.env.example`, `docs/environments.md`, `src/App.tsx`, `src/lib/env.ts` (modifiés)

Branches locales préparées (non poussées) : `main`, `staging`, `feature/staging-infrastructure`, `feature/opportunites-dossiers`, `feature/opportunity-engine`, `feature/dashboard-opportunities`, `feature/pipeline-opportunities`.

Build vérifié deux fois (`tsc --noEmit` + `vite build`) : une fois en configuration staging (bandeau confirmé présent dans le bundle), une fois en configuration production (bandeau confirmé absent).
