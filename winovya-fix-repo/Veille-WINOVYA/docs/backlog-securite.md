# Backlog sécurité

Ce document liste des points de sécurité identifiés lors d'audits, à traiter
dans un sprint dédié — **documentation uniquement, aucune correction n'est
appliquée depuis ce fichier**.

## RLS désactivé sur 7 tables `public.*` (production)

**Découvert le** : 2026-07-16, pendant l'audit du Sprint 0B (préparation du
schéma staging).

**Constat** : les migrations `create_veille_ofgl_schema` (20260716061409) et
`create_arretes_prefectoraux_tables` (20260716061441), appliquées le même
jour en production, créent 7 tables dans le schéma `public` :
`veille_ofgl_runs`, `collectivites_detectees`, `postes_budgetaires`,
`alertes_opportunites`, `arretes_prefectoraux`,
`arretes_entreprises_concernees`, `veille_raa_runs`.

Sur les 7 tables :
- Row Level Security (RLS) est **désactivé** (`rowsecurity = false`).
- Les rôles `anon` et `authenticated` ont tous les deux les privilèges
  complets `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`,
  `TRIGGER`.

**Conséquence** : ces 7 tables sont aujourd'hui accessibles en lecture et en
écriture via l'API REST publique de Supabase à quiconque dispose de la clé
anon (clé publique par nature, visible dans tout bundle frontend déployé).

**Origine inconnue** : aucune Edge Function ni fichier du dépôt Git ne
référence ces tables — elles semblent alimentées par un processus externe à
ce dépôt, non identifié à ce jour.

**Statut** : non corrigé, intentionnellement. Reproduit à l'identique sur le
projet Supabase Staging (fidélité du schéma), sans modification. À traiter
dans un sprint sécurité dédié, après clarification de l'origine et du rôle
réel de ces tables.

**Action recommandée (future, pas maintenant)** : une fois l'origine
clarifiée, soit activer RLS avec des politiques appropriées, soit révoquer
les privilèges `anon`/`authenticated` si ces tables ne doivent être
accessibles que via un rôle de service.
