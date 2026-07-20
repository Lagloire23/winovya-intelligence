# Déploiement — WINOVYA Market Intelligence

## Frontend (Netlify)

### État actuel (constaté à l'audit du Sprint 0)

Le site de production (`winovya-intelligence`, id
`bd7a3f79-e310-4fe4-9536-b05f9980f866`) n'est **pas** relié à GitHub pour un
déploiement continu : les derniers déploiements observés sont de type
`deploy_source: "api"` ("Deploy triggered by upload"), c'est-à-dire un
dossier `dist/` pré-construit envoyé directement, sans lien de branche Git
(`commit_ref`, `branch` sont `null` sur le déploiement courant).

Cela signifie concrètement :
- Netlify n'exécute pas lui-même `npm run build` sur ce site aujourd'hui.
- Il n'y a aucune Preview Deployment automatique liée aux Pull Requests.
- Chaque mise en production actuelle est un déploiement manuel (build local
  puis upload).

Un fichier `.netlify/state.json` retrouvé dans l'historique local liait déjà
ce dossier de travail au site `bd7a3f79-e310-4fe4-9536-b05f9980f866` — preuve
que les déploiements historiques de cette application sont bien passés par ce
même dossier de travail, via la CLI/API Netlify.

### Cible (après Sprint 0)

1. Lier le site de production Netlify au dépôt GitHub `Lagloire23/Veille-WINOVYA`, branche `main` uniquement — **pas encore fait, décision distincte à valider séparément**.
2. Créer un second site Netlify ("WINOVYA Market Intelligence Staging"), lié à la branche `staging` du même dépôt.
3. Build command : `npm run build` — Publish directory : `dist`.
4. Variables d'environnement configurées par site (voir `docs/environments.md`), jamais partagées entre staging et production.
5. Domaine : dans un premier temps, utiliser le domaine Netlify généré automatiquement pour le staging. `staging-intelligence.winovya.com` sera configuré uniquement après validation technique de l'environnement staging.

### Procédure de déploiement (cible, une fois le lien Git en place)

- **Staging** : fusionner une PR `feature/*` → `staging`. Netlify redéploie automatiquement le site staging.
- **Production** : fusionner une PR `staging` → `main` **uniquement après validation explicite de Hope**. Netlify redéploie automatiquement le site de production — **une fois le lien Git↔Netlify Production mis en place, ce qui n'est pas fait à ce stade.**

### Procédure actuelle (tant que le lien Git n'est pas en place)

- Build local (`npm run build`), puis déploiement manuel du dossier `dist/` sur le site concerné (staging ou production), avec vérification préalable des variables d'environnement utilisées pour le build (`VITE_APP_ENV`, `VITE_SUPABASE_URL`).

## Backend (Supabase)

- Migrations : appliquées manuellement au projet ciblé via les outils Supabase, jamais au projet de production sans validation explicite.
- Edge functions : déployées individuellement par fonction, jamais sur le projet de production sans validation explicite.

## Pipeline de veille (8h / 13h / 18h)

Mécanisme de planification non identifié à ce stade (voir rapport d'audit) — `pg_cron` confirmé non installé sur le projet de production. Ce sujet est traité au Sprint 3, aucune modification n'est prévue ici.
