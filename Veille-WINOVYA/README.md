# WINOVYA Market Intelligence

Application de veille et de gestion des opportunités commerciales pour WINOVYA
(commande publique). React + Vite + TypeScript + Tailwind CSS, connectée à
Supabase (schéma `veille`), déployée sur Netlify.

- Production : https://intelligence.winovya.com
- Staging : à venir (voir `docs/environments.md`)

## Stack

- React 18, Vite 5, TypeScript 5, Tailwind CSS 3, react-router-dom 6
- `@supabase/supabase-js` 2 (client pointé sur le schéma `veille`)
- Supabase (Postgres + Auth + Edge Functions)
- Netlify (hébergement frontend)

## Démarrage local

```bash
npm install
cp .env.example .env.local   # renseigner VITE_APP_ENV=development + vos valeurs Supabase de test
npm run dev
```

Ne jamais renseigner `.env.local` avec les valeurs du projet Supabase de
production. Voir `docs/environments.md` pour le détail des environnements.

## Branches

| Branche | Rôle |
|---|---|
| `main` | Production — jamais de push direct, uniquement des PR validées |
| `staging` | Recette permanente |
| `feature/*` | Développement, une branche par sujet, créée uniquement au début du sprint correspondant |

## Documentation

- [`docs/environments.md`](docs/environments.md) — environnements, variables, procédures dev/recette/prod
- [`docs/deployment.md`](docs/deployment.md) — comment déployer (staging et production)
- [`docs/rollback.md`](docs/rollback.md) — comment annuler un déploiement ou une migration
- [`docs/sync-production-to-staging.md`](docs/sync-production-to-staging.md) — spécification de l'outil de synchronisation (non exécuté)

## Règles non négociables (rappel)

Aucune modification directe de la production (site Netlify, domaine
`intelligence.winovya.com`, projet Supabase de production, edge functions,
variables d'environnement, tâche de veille) sans validation explicite. Tout
travail se fait sur une branche `feature/*`, fusionnée d'abord vers `staging`.
