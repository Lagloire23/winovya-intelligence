# Sprint 0B — Rapport corrigé — Tests refaits maintenant

Toutes les vérifications ci-dessous ont été ré-exécutées dans ce tour, avec preuve horodatée à l'appui (requêtes HTTP directes, pas de résultat réutilisé d'un tour précédent).

## Conclusion explicite : **SPRINT 0B NON VALIDÉ**

Raison unique et précise : un contrôle technique réel (appel `onboarding-save`) échoue, avec impact architectural avéré — ce n'est pas une simple vérification d'interface restante. Tout le reste (Netlify, Git, Auth, Storage) est **PASS**, preuves à l'appui ci-dessous.

## Mission 1 — Vérification actuelle du site : PASS

| Contrôle | Preuve obtenue à l'instant | Résultat |
|---|---|---|
| Requête HTTP vers l'URL live | `curl -i https://winovya-market-intelligence-staging.netlify.app/` → `HTTP/2 200` | **PASS** |
| Document HTML | Récupéré en direct : shell React standard, `<script src="/assets/index-D5yI5ZjY.js">`, `<div id="root">` | **PASS** |
| Déploiement Netlify | `get-project` → `currentDeploy: {"id":"6a58fa6ace29d2140d80f443","state":"ready"}` | **PASS** |
| Bundle JS récupéré et analysé | Téléchargé à l'instant (`/assets/index-D5yI5ZjY.js`, 512 703 octets) | **PASS** |
| URL Supabase Staging présente dans le bundle | `grep "gcitqpgucepgroermzti"` → trouvé | **PASS** |
| Référence Supabase Production absente fonctionnellement | `grep -c "mhsbwabrvcqnxnwamvwc"` → 1 seule occurrence, confirmée être la constante inerte du garde-fou `assertEnvironmentIsolation` (déjà identifiée précédemment, pas un appel réseau) | **PASS** |
| Aucune `service_role` exposée | `grep -i "service_role"` → absent | **PASS** |
| Bandeau STAGING | Chaînes `"STAGING"` et `"CECI N'EST PAS LA PRODUCTION"` présentes dans le bundle JS livré (le composant s'affichera au chargement) | **PASS** (preuve source ; pas de capture d'écran, voir Mission 2 pour la limite) |

## Mission 2 — Smoke tests fonctionnels

| # | Test | Résultat | Preuve |
|---|---|---|---|
| 1 | Chargement page de connexion | **PASS** | HTML récupéré à l'instant, shell correct |
| 2 | Connexion admin fictif | **PASS** | `/auth/v1/token?grant_type=password` → `HTTP 200`, exécuté à l'instant avec un mot de passe régénéré via l'API Admin officielle |
| 3 | Connexion utilisateur fictif | **PASS** | Idem, `HTTP 200` |
| 4-7 | Dashboard / Alertes / Entreprises / Décideurs (rendu visuel réel) | **ACTION HUMAINE REQUISE — PILOTAGE NAVIGATEUR INDISPONIBLE** | L'extension Claude in Chrome n'est pas connectée dans cette session (retestée à l'instant, toujours indisponible). Je ne peux pas prendre de capture d'écran ni cliquer dans une page réelle. Checklist manuelle ci-dessous. |
| 8 | Onboarding (rendu visuel réel) | **ACTION HUMAINE REQUISE — PILOTAGE NAVIGATEUR INDISPONIBLE** | Idem |
| 9 | Upload / lecture / suppression fichier fictif | **PASS** | Exécuté à l'instant via l'API Storage réelle : upload (200), lecture (200), suppression (200), `nb_objets_restants: 0` après nettoyage |
| 10 | Appel non destructif à `onboarding-save` | **FAIL** | Exécuté à l'instant, deux fois (avant et après reconnexion) : `HTTP 404 {"error":"Profil introuvable"}`. Cause confirmée à l'instant : `curl .../rest/v1/profiles -H "Accept-Profile: veille"` → `PGRST106 : Invalid schema: veille`. Aucune donnée créée (`select count(*) from veille.entreprises` → toujours `0`) |
| 11 | Déconnexion | **PASS** | `/auth/v1/logout` → `HTTP 204`, testé à l'instant |
| 12 | Absence de requête vers `mhsbwabrvcqnxnwamvwc` | **PASS** | Confirmé dans le bundle (Mission 1) et par relecture des compteurs de lignes en production, inchangés |

**Nettoyage effectué** : mots de passe temporaires supprimés du disque, fichier de test Storage supprimé (0 restant), policy temporaire de suppression retirée, fonctions Edge temporaires neutralisées après chaque usage, aucune entreprise/donnée créée en base.

### Checklist manuelle pour toi (points 4 à 8, une fois que tu as un navigateur sous la main)

1. Ouvrir `https://winovya-market-intelligence-staging.netlify.app`
2. Se connecter avec `admin.staging@example.com` (mot de passe : je peux t'en régénérer un à la demande via l'API Admin, à ce moment précis, si tu veux le faire toi-même)
3. Vérifier visuellement : bandeau STAGING en haut, puis Dashboard, Alertes, Entreprises, Décideurs, Onboarding
4. **S'attendre à ce que ces pages échouent à charger leurs données** tant que le point FAIL ci-dessous n'est pas corrigé (elles interrogent toutes le schéma `veille`)

## FAIL confirmé — impact architectural réel

```
curl https://gcitqpgucepgroermzti.supabase.co/rest/v1/profiles?select=id&limit=1 \
  -H "Accept-Profile: veille"
→ HTTP 406 : {"code":"PGRST106","message":"Invalid schema: veille",
  "hint":"Only the following schemas are exposed: public, graphql_public"}
```

Toutes les données de l'application (`entreprises`, `alertes`, `decideurs`, `profiles`...) vivent dans le schéma `veille`, interrogé par le frontend via `.schema('veille')`. Ce réglage (Project Settings → **Data API → Exposed schemas**) n'a jamais été activé sur le projet Staging — c'est un paramètre de plateforme, invisible dans toute comparaison de tables/colonnes/policies (qui reste, elle, un match parfait avec la production). Aucun outil disponible ici ne permet de le modifier. **Action requise : Dashboard Supabase → Project Settings → Data API → Exposed schemas → ajouter `veille`.**

Sans cette correction, Dashboard/Alertes/Entreprises/Décideurs/Onboarding ne chargeront aucune donnée sur Staging, même si la connexion fonctionne.

## Mission 3 — Git : PASS, reconfirmé à l'instant

- Base : `24d28d9496a46c1d68acc30f8309ad60e595ce91`
- Branche : `feature/sprint-0b-cloud-staging`
- Commit : `e970e89b1550a0ce15e28995b320a81665fadd28`
- `git merge-base feature/sprint-0b-cloud-staging staging-remote-24d28d9` → `24d28d9496a46c1d68acc30f8309ad60e595ce91` (exact)
- `git diff --stat 24d28d9 feature/sprint-0b-cloud-staging` → 2 fichiers, 143 lignes ajoutées, 0 supprimée, uniquement `docs/backlog-securite.md` et `docs/sprint-0b-staging-cloud-actions-manuelles.md`
- Bundle `sprint-0b-cloud-staging-final.bundle` : `git bundle verify` → OK, à l'instant
- Aucun secret dans le diff (uniquement des noms de variables cités en documentation)
- URL de création de PR : `https://github.com/Lagloire23/Veille-WINOVYA/compare/staging...feature/sprint-0b-cloud-staging?expand=1`

## Récapitulatif PASS / FAIL / ACTION HUMAINE / NON VÉRIFIÉ

- **PASS** : site live, déploiement ready, isolation (URL/clé/service_role), bandeau STAGING (preuve source), connexion admin, connexion utilisateur, déconnexion, Storage (upload/lecture/suppression), Git (merge-base, commit, bundle, contenu)
- **FAIL** : `onboarding-save` — schéma `veille` non exposé sur l'API Data Staging (impact architectural réel, pas cosmétique)
- **ACTION HUMAINE REQUISE — PILOTAGE NAVIGATEUR INDISPONIBLE** : rendu visuel de Dashboard, Alertes, Entreprises, Décideurs, Onboarding (extension Claude in Chrome non connectée dans cette session)
- **NON VÉRIFIÉ** : rien d'autre à signaler à ce stade

## Risques résiduels

- **Schéma `veille` non exposé — bloquant fonctionnel confirmé, à corriger avant toute utilisation réelle du staging.**
- RLS désactivé sur 7 tables `public.*` (hérité, backlog).
- 6 Edge Functions à clé API tierce codée en dur (backlog, non déployées sur staging).
- Fonctions Edge temporaires d'audit neutralisées mais toujours listées (`temp-sprint0b-recreate-test-accounts`, `temp-sprint0b-check-secrets`, `temp-sprint0b-reset-test-passwords`) — toutes renvoient `410`, `verify_jwt` actif.

## Actions restantes

1. **Dashboard Supabase → Project Settings → Data API → Exposed schemas → ajouter `veille`.**
2. Une fois fait, redemander un test `onboarding-save` (je peux le refaire immédiatement) et faire le tour visuel des points 4-8.
3. Pousser `feature/sprint-0b-cloud-staging` depuis le bundle fourni et ouvrir la PR (lien ci-dessus).
4. Migrer les 6 clés API tierces avant tout déploiement des fonctions concernées sur staging.
5. Vérifier les protections de branche GitHub (aucun accès `gh` depuis ce sandbox).

## Confirmation production

**Confirmé à l'instant : aucune ressource de production n'a été modifiée.** Toutes les requêtes vers `mhsbwabrvcqnxnwamvwc` pendant ce tour étaient en lecture seule.

---

STOP — en attente de la correction du point Exposed Schemas. Pas de Sprint 1.
