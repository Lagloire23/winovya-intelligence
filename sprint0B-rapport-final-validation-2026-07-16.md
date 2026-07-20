# Sprint 0B — Rapport final après correction des droits du schéma `veille`

Toutes les vérifications ci-dessous ont été exécutées à l'instant, après ta correction (ajout de `veille` aux Exposed Schemas + mes GRANTs sur Staging). Aucun résultat d'un tour précédent n'est réutilisé.

## Conclusion explicite : **SPRINT 0B VALIDÉ**

Le test Data API, le test `onboarding-save` et les contrôles techniques passent tous. Il ne reste que des vérifications d'interface (rendu visuel) non exécutables depuis cette session faute d'outil de pilotage navigateur — sans impact architectural, classées ci-dessous.

## 1. Data API — schéma `veille` exposé

```
GET /rest/v1/profiles?select=id&limit=1
Header: Accept-Profile: veille
→ HTTP 200, body: []
```

Plus aucune trace de `PGRST106` ni de `42501`. **PASS.**

## 2. Droits du schéma `veille` — parité stricte avec la production

| Contrôle | Résultat |
|---|---|
| `USAGE` sur `veille` pour anon/authenticated/service_role | **PASS** — `true/true/true` sur Staging, identique à Production |
| Grants de table (`SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER`) sur les 8 tables `veille.*` | **PASS** — comparaison ligne à ligne Staging vs Production : identique sur les 8 tables × 3 rôles, aucun écart, aucun privilège plus large |
| `EXECUTE` sur `veille.handle_new_user()` et `veille.is_admin()` pour les 3 rôles | **PASS** — déjà identique avant et après (grant PUBLIC par défaut de Postgres, jamais révoqué) |

Seuls les GRANTs identiques à ceux déjà présents en production ont été appliqués sur Staging — rien de plus large.

## 3. Test réel `onboarding-save` — compte fictif Staging

- Régénération du mot de passe de `user.staging@example.com` via une Edge Function temporaire (API Admin officielle, `updateUserById`), puis neutralisation immédiate après usage.
- Connexion : `/auth/v1/token?grant_type=password` → `HTTP 200`.
- Appel `onboarding-save` avec `{"entrepriseFields":{"name":"SPRINT0B-TEST-FICTIF-A-SUPPRIMER"}}` → **`HTTP 200 {"ok":true,"entrepriseId":"edcedfe8-8261-422e-b43b-b2b280469b1d"}`**. Plus de 404 « Profil introuvable ».
- Nettoyage effectué immédiatement après vérification : profil délié (`entreprise_id = null`), ligne `veille.entreprises` supprimée. `select count(*) from veille.entreprises` → **`0`**, identique à l'état initial.
- Déconnexion (`/auth/v1/logout`) → `HTTP 204`.

**PASS.**

## 4. Smoke tests applicatifs restants

| Test | Résultat | Preuve |
|---|---|---|
| Connexion admin fictif | **PASS** | Mot de passe régénéré via API Admin, `/auth/v1/token` → 200, `/auth/v1/user` confirme identité + rôle, déconnexion 204 |
| Connexion utilisateur fictif | **PASS** | Idem (section 3) |
| Upload / lecture / suppression fichier fictif | **PASS** | Upload via `upload-attachment` (200), lecture publique (200), suppression via appel Storage service-role (confirmé `remaining: []`), re-vérification lecture après suppression → 400 (fichier bien absent) |
| Dashboard / Alertes / Entreprises / Décideurs / Onboarding (rendu visuel) | **ACTION HUMAINE REQUISE — PILOTAGE NAVIGATEUR INDISPONIBLE** | L'extension Claude in Chrome n'est toujours pas connectée dans cette session (retestée à l'instant). Ces pages appellent exactement les mêmes routes API que celles validées ci-dessus (schéma `veille` exposé + droits corrects + `onboarding-save` fonctionnel), donc rien n'indique un blocage fonctionnel résiduel — mais je ne peux pas produire de capture d'écran. |

### Checklist manuelle (points visuels uniquement)

1. Ouvrir `https://winovya-market-intelligence-staging.netlify.app`
2. Se connecter avec `admin.staging@example.com` — je peux régénérer un mot de passe à la demande
3. Vérifier visuellement : bandeau STAGING, Dashboard, Alertes, Entreprises, Décideurs, Onboarding
4. Ces pages devraient maintenant charger leurs données normalement (le blocage Data API est levé)

## 5. Aucune requête vers la production

Confirmé : toutes les actions de ce tour (lecture des grants, GRANT, tests REST, régénération de mots de passe, appel `onboarding-save`, upload/suppression Storage) ont ciblé exclusivement `gcitqpgucepgroermzti`. Aucun appel, lecture ou écriture n'a touché `mhsbwabrvcqnxnwamvwc` dans ce tour.

## 6. Git — inchangé, reconfirmé

- Branche : `feature/sprint-0b-cloud-staging` → `e970e89b1550a0ce15e28995b320a81665fadd28`
- `git merge-base feature/sprint-0b-cloud-staging staging-remote-24d28d9` → `24d28d9496a46c1d68acc30f8309ad60e595ce91` (exact)
- Bundle `sprint-0b-cloud-staging-final.bundle` : `git bundle verify` → OK, historique complet
- Aucune modification de code nécessaire pour ce tour (uniquement des vérifications Supabase)

## 7. Nettoyage effectué ce tour

- Mots de passe de test régénérés, jamais affichés, jamais enregistrés sur disque
- Entreprise fictive créée par le test `onboarding-save` : supprimée, profil délié
- Fichier de test Storage : supprimé, `remaining: []`
- Fonctions Edge temporaires (`temp-sprint0b-reset-test-passwords`, `temp-sprint0b-cleanup-storage`) : neutralisées après usage (`410`, `verify_jwt` actif)

## Risques résiduels (inchangés, non bloquants pour ce Sprint)

- RLS désactivé sur 7 tables `public.*` (hérité, backlog documenté).
- 6 Edge Functions à clé API tierce codée en dur (backlog documenté, non déployées sur staging).
- Rendu visuel des 5 pages applicatives non vérifiable depuis cette session (navigateur non connecté) — aucune raison technique de s'attendre à un échec, vu que la chaîne API sous-jacente est validée.
- Fonctions Edge temporaires d'audit antérieures, déjà neutralisées lors de tours précédents, toujours listées (aucun outil de suppression disponible) : `temp-sprint0b-recreate-test-accounts`, `temp-sprint0b-check-secrets` — sans impact, renvoient `410`.

---

**SPRINT 0B VALIDÉ.**

Pas de Sprint 1.
