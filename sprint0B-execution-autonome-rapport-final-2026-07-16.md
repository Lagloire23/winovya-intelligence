# Sprint 0B — Exécution autonome — Rapport final

## 1. Statut : **SPRINT 0B NON VALIDÉ** (partiellement complété)

Toutes les actions de base de données, storage, auth et 2 des 13 Edge
Functions ont été exécutées avec succès et vérifiées sur le projet Supabase
Staging. En revanche, le site Netlify Staging n'a pas encore de déploiement
live (créé mais pas publié) et deux configurations (Auth Site URL, secrets
Edge Functions) restent à faire manuellement — voir section 15. Aucune
action sur la production. Détail complet ci-dessous.

## 2. Ressources créées

- Bucket Storage `veille-attachments` sur le projet Staging (config identique prod)
- 2 comptes Auth fictifs (`admin.staging@example.com` rôle admin, `user.staging@example.com` rôle member)
- 2 Edge Functions déployées sur Staging (`upload-attachment`, `onboarding-save`)
- Site Netlify `winovya-market-intelligence-staging` (créé, pas encore déployé)
- 4 variables d'environnement Netlify configurées
- Branche Git `feature/sprint-0b-cloud-staging` (2 nouveaux commits), bundle correspondant

## 3. URL Netlify Staging

`https://winovya-market-intelligence-staging.netlify.app` — site créé, **aucun déploiement publié pour l'instant** (voir section 15, point 1).

## 4. Référence Supabase Staging

`gcitqpgucepgroermzti` (eu-west-3). Production (jamais modifiée) : `mhsbwabrvcqnxnwamvwc`.

## 5. Comparaison de schéma (staging vs production, lecture seule)

| Élément | Staging | Production | Résultat |
|---|---|---|---|
| Migrations (versions + noms) | 9/9 | 9/9 | **PASS** identique |
| Tables (`veille` + `public`) | 15 | 15 | **PASS** identique, RLS identique table par table (8 activées, 7 désactivées — écart hérité, voir backlog) |
| Colonnes | 209 | 209 | **PASS** |
| Contraintes | 37 | 37 | **PASS** |
| Index | 42 | 42 | **PASS** |
| Fonctions | 2 | 2 | **PASS** |
| Triggers | 0 | 0 | **PASS** |
| Policies RLS | 14 | 14 | **PASS** |
| Enums | 11 | 11 | **PASS** |
| Extensions installées (uuid-ossp, pgcrypto, pg_stat_statements, supabase_vault, plpgsql) | identiques | identiques | **PASS** |
| Données | 0 ligne partout | données réelles | **PASS** (aucune donnée copiée, schéma uniquement) |

## 6. Storage configuré

Bucket `veille-attachments` : `public=true`, limite 50 Mo, aucune restriction MIME (identique prod), 1 policy `Public read` identique. Test réel via l'API Storage (pas une simulation SQL) : upload d'un fichier fictif → lecture → suppression → 0 fichier restant. **PASS**.

## 7. Auth configuré

Email/mot de passe, 2 comptes fictifs (`@example.com`, aucune adresse `@example.invalid` acceptée par Supabase). Créés directement via SQL pour éviter tout envoi d'email réel (la voie API standard a d'abord tenté d'envoyer un email de confirmation et a été bloquée par le rate-limit — confirmé dans les logs, aucun email n'est parti). Connexion testée et fonctionnelle pour les deux comptes via l'API. Mots de passe générés aléatoirement, non affichés ici, non écrits dans aucun fichier partagé.

## 8. Edge Functions — déployées ou différées (13 auditées)

| Fonction | Décision | Motif |
|---|---|---|
| `upload-attachment` | **Déployée** | Ne lit que des secrets auto-injectés propres à Staging |
| `onboarding-save` | **Déployée** | Idem |
| `admin-invite-user` | Différée | Déclenche l'envoi d'un vrai email d'invitation Supabase |
| `bootstrap-admin-once` | Différée | Fonction `*-once`, hors périmètre |
| `admin-account-reset-once` | Différée | Fonction `*-once` |
| `create-test-user-once` | Différée | Fonction `*-once` |
| `set-test-user-password-once` | Différée | Fonction `*-once` |
| `pappers-lookup` | Différée | Clé `PAPPERS_API_KEY` codée en dur dans le code (voir section 14) |
| `find-donneur-ordre-contact` | Différée | Clé `PAPPERS_API_KEY` codée en dur |
| `fullenrich-lookup` | Différée | Clé `FULLENRICH_API_KEY` codée en dur |
| `alert-assistant` | Différée | Clé `ANTHROPIC_API_KEY` codée en dur |
| `extract-entreprise-from-website` | Différée | Clé `ANTHROPIC_API_KEY` codée en dur |
| `assign-alert` | Différée | Clé `RESEND_API_KEY` codée en dur + envoi d'email réel |

## 9. Variables configurées (valeurs non sensibles uniquement)

Netlify (`winovya-market-intelligence-staging`) : `VITE_APP_ENV=staging`, `VITE_SUPABASE_URL=https://gcitqpgucepgroermzti.supabase.co`, `VITE_SUPABASE_ANON_KEY=<clé publique staging>`, `VITE_FEATURE_OPPORTUNITIES_ENABLED=true`. Aucune clé `service_role` déposée. `OPPORTUNITY_ENGINE_ENABLED` et `VEILLE_EXECUTION_MODE` restent à définir côté secrets Supabase (backend) — voir section 15.

## 10-11. Tests exécutés et résultats PASS/FAIL

| Test | Résultat |
|---|---|
| Comparaison de schéma staging/production | **PASS** |
| Storage : upload/lecture/suppression via API réelle | **PASS** |
| Auth : connexion des 2 comptes fictifs | **PASS** |
| Edge Function `upload-attachment` (fichier réel non destructif, nettoyé après) | **PASS** |
| Isolation : frontend cible uniquement Staging | **PASS** |
| Isolation : aucune clé `service_role` dans le bundle | **PASS** |
| Isolation : comptes/fichiers de test absents de production | **PASS** |
| `npm ci` | **PASS** |
| `tsc -b` (équivalent `--noEmit` strict) | **PASS**, aucune erreur |
| `npm run build` | **PASS**, bundle généré et vérifié |
| CI GitHub | **BLOQUÉ** — aucun accès `gh`/API GitHub authentifiée depuis ce sandbox |
| Chargement app / navigation / Dashboard / Alertes / Entreprises / Décideurs / bandeau STAGING | **BLOQUÉ** — nécessite un déploiement Netlify live (non encore publié, section 15) |

## 12. Erreurs rencontrées et corrections

- Signature via l'API Auth standard bloquée par le rate-limit d'envoi d'email → contournée en créant les comptes directement en base (sans jamais passer par un envoi d'email réel).
- Connexion des comptes fictifs échouait (`500 Database error`) : ligne manquante dans `auth.identities`, puis champs `confirmation_token`/`recovery_token`/etc. `NULL` au lieu de chaîne vide (incompatible avec le scanner Go de GoTrue) → corrigés, connexion validée ensuite.
- Un commit de documentation a été ajouté par erreur sur la branche déjà livrée `feature/sprint-0b-schema-baseline` (déjà validée précédemment) → détecté immédiatement, annulé (`reset --hard` vers le commit déjà livré), et refait correctement sur la nouvelle branche `feature/sprint-0b-cloud-staging`, comme demandé.
- Publication effective sur Netlify impossible depuis ce sandbox (l'outil disponible ne fait que générer une commande destinée à un serveur MCP Netlify, non exécutable en ligne de commande simple) → documenté comme action manuelle, non contourné par une méthode risquée.

## 13. Coûts réels

**0 €.** Le projet Supabase Staging existait déjà (gratuit). Le site Netlify créé est sur le plan gratuit de l'équipe. Aucun appel payant (Pappers, FullEnrich, Anthropic, Resend) n'a été effectué — c'est précisément pour éviter cela que les 6 fonctions concernées n'ont pas été redéployées.

## 14. Risques résiduels

- RLS désactivé sur 7 tables `public.*`, hérité de la production (déjà documenté, non corrigé par décision explicite).
- **Nouveau** : 6 Edge Functions de production contiennent une clé API tierce en clair dans leur code source plutôt que dans un secret Supabase (détail et remédiation recommandée dans `docs/backlog-securite.md`, branche `feature/sprint-0b-cloud-staging`).
- Site Netlify Staging pas encore accessible publiquement (pas de déploiement publié).
- Auth Site URL / Redirect URLs Staging pas encore configurées → les liens magiques ne redirigeraient pas correctement pour l'instant.

## 15. Actions manuelles restantes

Détaillées dans `docs/sprint-0b-staging-cloud-actions-manuelles.md` (branche `feature/sprint-0b-cloud-staging`) :
1. Premier déploiement Netlify (glisser-déposer `dist/` ou lier le dépôt GitHub).
2. Configurer Auth Site URL + Redirect URLs sur le projet Staging.
3. `supabase secrets set --project-ref gcitqpgucepgroermzti VEILLE_EXECUTION_MODE=test OPPORTUNITY_ENGINE_ENABLED=false`.
4. Migrer les 6 clés API tierces vers des secrets Supabase avant de déployer les fonctions concernées sur Staging.
5. Vérifier/configurer manuellement les protections de branche GitHub (aucun accès `gh` depuis ce sandbox).

## 16. Confirmation production

**Confirmé : aucune écriture n'a été effectuée sur `mhsbwabrvcqnxnwamvwc` à aucun moment.** Toutes les requêtes sur ce projet étaient en lecture seule (`SELECT`, `list_*`). Les comptes/fichiers de test ont été vérifiés absents de production (section 11).

---

## Livrable Git

- Branche `feature/sprint-0b-cloud-staging`, 2 commits au-dessus de `feature/sprint-0b-schema-baseline` (déjà livrée) : `4e22c7b` (backlog sécurité clés tierces) et `2005c29` (actions manuelles restantes).
- `git merge-base feature/sprint-0b-cloud-staging <origin/staging réel>` = `942dde6f5012a59d5ac4d383fec0e438018473d3` (ancestralité confirmée, comme pour la branche précédente).
- Bundle : `sprint-0b-cloud-staging.bundle`, contient uniquement cette branche, vérifié (`git bundle verify` OK, tip `2005c29aa7d6600d25addb49cfb3a726f3cc0713`).

Rien n'a été poussé ni fusionné. STOP, en attente de ta validation.
