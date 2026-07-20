# Rollback — WINOVYA Market Intelligence

## Frontend (Netlify)

Netlify conserve l'historique des déploiements précédents pour chaque site.
En cas de problème après une mise en production :
1. Ouvrir le site concerné dans l'interface Netlify (`Deploys`).
2. Sélectionner le déploiement précédent (état `ready`, avant le déploiement problématique).
3. Cliquer sur "Publish deploy" pour le republier — action manuelle, non automatisée par Claude.

Aucun rollback frontend n'est déclenché automatiquement : c'est une action humaine.

## Code (Git)

- Un rollback de code se fait par un **nouveau commit de revert** (`git revert`), jamais par réécriture d'historique (`force push` interdit sur `main` et `staging` une fois qu'ils sont partagés/poussés).
- `main` ne doit jamais être réinitialisé (`reset --hard` + force push) une fois partagé : cela casserait la traçabilité et pourrait désynchroniser le déploiement Netlify de production.

## Base de données (Supabase)

- Toute migration additive appliquée (colonnes, tables, contraintes) doit être conçue pour être réversible : une migration inverse explicite (`DROP` ciblé, `ALTER ... DROP COLUMN`, etc.) doit exister et être testée sur l'environnement staging avant toute application en production.
- Aucune suppression destructive de table, colonne, policy ou donnée existante n'est jamais appliquée directement en production : un rollback de schéma est toujours une migration explicite supplémentaire, versionnée comme les autres.
- Avant toute migration en production : sauvegarde/point de restauration vérifié.

## Edge functions

- Chaque edge function déployée est versionnée (numéro de version visible côté Supabase). En cas de problème, redéployer la version précédente du code source de la fonction depuis Git.

## Principe général

Toute action de rollback proposée par Claude est présentée sous forme de plan avant exécution, avec confirmation explicite de Hope, exactement comme pour toute action de déploiement.
