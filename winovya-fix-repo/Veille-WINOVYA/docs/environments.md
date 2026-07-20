# Environnements — WINOVYA Market Intelligence

Ce document décrit l'architecture d'isolation dev / staging / production mise
en place au Sprint 0. Il doit être tenu à jour à chaque évolution de cette
architecture.

## ⚠️ Constat important (à valider avec Hope)

L'hébergement frontend réel est **Netlify**, et non Vercel. Le site en
production est servi par Netlify (site id
`bd7a3f79-e310-4fe4-9536-b05f9980f866`, domaine `intelligence.winovya.com`).
Au moment de l'audit du Sprint 0, ce site n'est **pas** relié à GitHub :
chaque déploiement est un upload manuel d'un dossier `dist/` pré-construit
(confirmé via les métadonnées du dernier déploiement : `deploy_source: "api"`,
`commit_ref: null`, `branch: null`).

## Branches Git

| Branche | Rôle | Déploiement associé |
|---|---|---|
| `main` | Production. Reflète exactement ce qui tourne sur `intelligence.winovya.com`. | Site Netlify de production |
| `staging` | Recette permanente. Reçoit les fusions de branches `feature/*` validées, avant promotion vers `main`. | Site Netlify staging (à créer/lier) |
| `feature/*` | Développement, une branche par sujet. Créées uniquement au début du sprint correspondant. | Preview Netlify (Deploy Preview) par PR, si activé |

Règles :
- Aucun push direct sur `main`.
- Aucune fusion de PR vers `main` sans validation explicite de Hope.
- Toute fonctionnalité se développe sur `feature/*`, fusionnée d'abord vers `staging`.

## Hébergement frontend

| Environnement | Plateforme | Site / projet | Domaine |
|---|---|---|---|
| Production | Netlify | `winovya-intelligence` (id `bd7a3f79-e310-4fe4-9536-b05f9980f866`) | `intelligence.winovya.com` |
| Staging | Netlify | à créer (site staging distinct, lié à la branche `staging`) | domaine Netlify généré dans un premier temps ; `staging-intelligence.winovya.com` uniquement après validation technique |
| Dev / feature | Netlify Deploy Previews (si activé) ou exécution locale (`npm run dev`) | — | URL de preview générée par Netlify, ou `localhost` |

## Projets Supabase

| Environnement | Projet | Référence |
|---|---|---|
| Production | WINOVYA Market Intelligence | `mhsbwabrvcqnxnwamvwc` (org `pinlwggvsroxebodcfxt`) |
| Staging | À créer : **vrai projet Supabase indépendant**, jamais une branche Supabase | référence à définir |

Le projet Supabase `svtcvijqmldjbsceoeef` ("Lagloire Project") existant dans
la même organisation est un produit indépendant et actif (backend probable de
attributions.winovya.com — tables opportunités/mémoires techniques/scoring
GO-NO GO, ~30 edge functions, 67 migrations) : **il n'est pas réutilisable
comme staging** et ne doit pas être modifié dans le cadre de ce projet.

## Variables d'environnement

### Frontend (préfixe `VITE_`, visibles dans le bundle client — jamais de secret ici)

| Variable | Rôle | Exemple staging | Exemple production |
|---|---|---|---|
| `VITE_APP_ENV` | Étiquette déclarée de l'environnement | `staging` | `production` |
| `VITE_SUPABASE_URL` | URL du projet Supabase ciblé | URL du projet Supabase staging (à créer) | `https://mhsbwabrvcqnxnwamvwc.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clé publique (anon) du projet ciblé | clé anon du projet staging | clé anon du projet production |
| `VITE_FEATURE_OPPORTUNITIES_ENABLED` | Contrôle uniquement l'affichage frontend de la couche "dossiers d'opportunité" (MVP : un seul flag frontend) | `true` (pour tester) | `false` tant que non validé |

Un bandeau visuel permanent (`src/components/EnvironmentBanner.tsx`) s'affiche automatiquement sur tout environnement où `VITE_APP_ENV` n'est pas `production`, pour qu'il soit impossible de confondre staging avec la production.

Un garde-fou (`src/lib/env.ts`, appelé depuis `src/main.tsx` via
`assertEnvironmentIsolation()`) bloque le démarrage de l'application si
`VITE_APP_ENV` et le projet Supabase réellement ciblé par `VITE_SUPABASE_URL`
sont incohérents (ex. `staging` pointant vers le projet Supabase de
production, ou l'inverse).

### Backend / edge functions (jamais préfixées `VITE_`, jamais dans un `.env` du dépôt)

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase ciblé par la fonction |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (secret, injectée par Supabase) |
| `ANTHROPIC_API_KEY` | Clé API pour les appels IA (enrichissement, veille) |
| `VEILLE_EXECUTION_MODE` | `production` ou `test` — contrôle si la tâche de veille écrit réellement en base de production |
| `OPPORTUNITY_ENGINE_ENABLED` | Contrôle l'exécution backend du moteur d'opportunités (MVP : second flag, backend uniquement). Réservé pour le Sprint 1 : aucune edge function ne le lit encore dans ce dépôt. |

Ces variables sont configurées dans les secrets des edge functions Supabase
(par projet), jamais commit dans le dépôt.

## Feature flags (MVP)

Pour le MVP, deux flags seulement, sans dépendance technique démontrée pour
en ajouter d'autres à ce stade :

| Flag | Variable | Portée | Production | Staging |
|---|---|---|---|---|
| Affichage frontend "dossiers d'opportunité" | `VITE_FEATURE_OPPORTUNITIES_ENABLED` | Frontend uniquement | `false` | `true` |
| Exécution backend du moteur d'opportunités | `OPPORTUNITY_ENGINE_ENABLED` | Backend / edge functions uniquement | `false` | `true` |

## Procédures

### Développement (feature/*)
1. Créer une branche `feature/xxx` à partir de `staging`, au début du sprint correspondant (pas avant).
2. Travailler avec `VITE_APP_ENV=development` et un projet Supabase de test
   (jamais production).
3. Ouvrir une PR vers `staging` une fois prêt.

### Recette (staging)
1. Fusionner la PR `feature/xxx` → `staging` après revue.
2. Le site Netlify staging (lié à la branche `staging`) se redéploie
   automatiquement avec `VITE_APP_ENV=staging` et le projet Supabase staging.
3. Valider fonctionnellement en recette avant toute promotion vers `main`.

### Production (main)
1. Ouvrir une PR `staging` → `main` **uniquement** après validation explicite
   de Hope.
2. Fusion vers `main` = seul déclencheur autorisé du redéploiement Netlify de
   production (une fois le lien Git↔Netlify mis en place — absent à ce jour).
3. Aucune migration Supabase n'est appliquée au projet de production sans
   validation explicite préalable, même si le code est déjà fusionné.

### Rollback
1. Frontend : chaque déploiement Netlify de production est horodaté et
   conserve les déploiements précédents — un rollback consiste à republier le
   déploiement précédent depuis l'interface Netlify (action manuelle de
   Hope, non automatisée ici).
2. Base de données : toute migration additive doit rester réversible (voir
   `conception-dossiers-opportunite-2026-07-15.md`, section rollback) — un
   rollback de schéma se fait via une migration inverse explicite, jamais par
   suppression destructive directe.
3. Git : `main` ne doit jamais être réécrit (`force push` interdit) une fois
   partagé ; un rollback de code se fait par un nouveau commit de revert,
   jamais par réécriture d'historique.

## Interdictions (rappel des règles non négociables)

- Pas de push direct sur `main`.
- Pas de fusion de PR vers `main` sans validation explicite.
- Pas de migration Supabase appliquée à la production sans validation
  explicite.
- Pas d'edge function déployée sur le projet Supabase de production sans
  validation explicite.
- Pas de tâche de veille de production exécutée avec du code non validé.
- Pas de suppression/modification destructive de table, colonne, policy ou
  donnée existante.
- Aucun secret dans le dépôt Git (vérifié : seul `.env.example`, sans valeur
  réelle, est versionné).
- Aucune ressource payante (projet Supabase staging, domaine, etc.) créée
  sans validation explicite de Hope.
- Aucune branche `feature/*` de sprint futur créée par anticipation — une
  seule branche d'infrastructure (`feature/sprint-0-infrastructure`) existe
  pour ce sprint.
