# Outil `sync-production-to-staging` — spécification (non exécuté)

Ce document décrit un outil à construire pour synchroniser le projet Supabase
de production vers le futur projet Supabase staging. **Rien ici n'est
exécuté** : c'est une spécification, en attente de validation, et le projet
Supabase staging n'existe pas encore.

## Objectif

Permettre de rafraîchir périodiquement l'environnement staging avec une
structure de base identique à la production, sans jamais exposer de données
personnelles réelles.

## Ce qui est copié

1. **Schéma** : structure des tables, types enum, contraintes, index, RLS,
   fonctions (`is_admin()`, `handle_new_user()`) — via les migrations déjà
   versionnées (7 migrations listées à ce jour) rejouées sur le projet
   staging.
2. **Edge Functions** : code source des 14 fonctions actuelles, redéployées
   telles quelles sur le projet staging (secrets reconfigurés séparément,
   jamais copiés depuis la production).
3. **Données nécessaires** (optionnel, sur demande explicite) : un
   sous-ensemble anonymisé, pas un clone complet.

## Ce qui est exclu ou anonymisé

- `entreprises.email`, `decideurs.email` → remplacés par des adresses
  factices (`test+<id>@example.invalid`).
- Tout champ téléphone (`decideurs.telephone`, etc.) → mis à `null`.
- `alertes.notes_equipe` → vidé.
- Historique (`opportunite_historique` si présent, logs, tout champ
  d'audit contenant du texte libre) → tronqué/supprimé.
- Toute donnée d'authentification (`auth.users`) → jamais copiée ; le
  staging doit avoir ses propres comptes de test créés manuellement.

## Mécanisme envisagé (à construire, Sprint 1+)

1. Script (Node ou SQL) qui exporte le schéma de production (`pg_dump
   --schema-only` ou rejoue des migrations existantes) vers le projet
   staging.
2. Un second script optionnel qui copie un échantillon limité de lignes par
   table (ex. 20 lignes), en appliquant systématiquement les règles
   d'anonymisation ci-dessus via des `UPDATE` après insertion.
3. Le script ne doit jamais être exécutable sans double confirmation
   explicite (variable d'environnement de garde-fou + confirmation
   interactive), et ne doit jamais pouvoir cibler le projet de production
   comme destination (vérification de l'id de projet cible avant toute
   écriture).

## Statut

Spécification uniquement. Aucun script exécutable n'a été créé, aucune
synchronisation n'a eu lieu, et le projet Supabase staging cible n'existe pas
encore.
