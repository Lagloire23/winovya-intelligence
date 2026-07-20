# Sprint 0B — Correction finale — Rapport

## 1. Statut : **SPRINT 0B NON VALIDÉ**

Deux conditions d'arrêt que tu as toi-même fixées sont réellement déclenchées (détail ci-dessous) : le commit `24d28d9` est inaccessible depuis ce sandbox, et la liaison GitHub → Netlify exige une action humaine que mes outils ne permettent pas. Tout le reste de la mission a été mené à terme.

## 2. Commit de base exact

**Bloquant.** `24d28d9` n'existe pas dans mon dépôt local, et je n'ai aucun accès GitHub authentifié pour le récupérer (confirmé à nouveau : `git fetch origin` échoue avec "could not read Username for 'https://github.com'", dépôt privé). Comme lors de l'épisode précédent avec `942dde6`, j'ai besoin que tu me fournisses un bundle Git contenant ce commit (`git bundle create staging-24d28d9.bundle staging` depuis ton clone à jour), pour que je puisse reconstruire `feature/sprint-0b-cloud-staging` dessus, exactement comme tu l'as fait pour `942dde6`.

**Tant que je n'ai pas cet objet, je n'ai pas touché à `feature/sprint-0b-cloud-staging`** : la branche reste sur son état précédent (basée sur `942dde6`, déjà livrée), rien n'a été poussé ni reconstruit dessus par-dessus une hypothèse fausse.

## 3. Merge-base exact

Non calculable tant que je n'ai pas l'objet `24d28d9` (voir point 2).

## 4. URL Netlify live

`https://winovya-market-intelligence-staging.netlify.app` — site existant, **toujours sans déploiement publié**. Détail au point 9 (Phase 4).

## 5. État Auth test — corrigé selon la procédure officielle

Les 2 comptes précédents (créés par INSERT manuel) ont été **supprimés et recréés via l'API Admin officielle** (`auth.admin.createUser` avec `email_confirm: true`), pas par INSERT direct. Concrètement :
- Une Edge Function temporaire, à usage unique, restreinte à exactement ces 2 emails (aucun paramètre accepté depuis la requête), a exécuté `deleteUser` puis `createUser` via la service role key auto-injectée du projet Staging (jamais vue ni manipulée par moi).
- Elle a ensuite été **neutralisée** (code remplacé par une réponse 410 inerte, `verify_jwt` réactivé) — aucun outil de suppression d'Edge Function n'existe dans cet environnement, donc je ne peux pas la faire disparaître de la liste, mais elle ne contient plus aucune logique d'admin.

Audit des 2 comptes, tous les points demandés :

| Vérification | admin.staging@example.com | user.staging@example.com |
|---|---|---|
| Présent dans `auth.users` | ✅ | ✅ |
| `auth.identities` cohérent (créé automatiquement par l'API, pas par moi) | ✅ | ✅ |
| Connexion via l'API Auth (`/token?grant_type=password`) | ✅ 200 | ✅ 200 |
| JWT décodable, `role=authenticated`, `sub=<user_id>` cohérent | ✅ | ✅ |
| Profil applicatif (`veille.profiles`) présent | ✅ | ✅ |
| Rôle attendu | `admin` | `member` |
| Email confirmé sans envoi réel | ✅ (`email_confirm:true`, aucun email parti) | ✅ |

**Procédure pérenne documentée pour la suite** (à committer dans `docs/` dès que j'ai `24d28d9`) : toute création de compte de test futur doit passer par `supabase.auth.admin.createUser({ email, password, email_confirm: true })` — jamais par INSERT direct dans `auth.users`/`auth.identities`, qui produit des lignes incomplètes (le bug du sprint précédent : `confirmation_token` NULL, `auth.identities` manquant). Cette méthode doit être appelée soit depuis une Edge Function dédiée et protégée (réservée aux comptes admin authentifiés), soit exécutée manuellement une fois par toi via le Dashboard Supabase (Authentication → Users → Add user → "Auto Confirm User").

## 6. Secrets Staging configurés

**Non fait — aucun outil disponible ici ne permet de gérer les secrets Edge Functions Supabase** (ni `supabase secrets set`, ni équivalent MCP). Aucune tentative de contournement (je n'ai pas de token CLI Supabase). Valeurs à définir toi-même :

```
supabase secrets set --project-ref gcitqpgucepgroermzti VEILLE_EXECUTION_MODE=test OPPORTUNITY_ENGINE_ENABLED=false
```

Je n'ai configuré aucune clé tierce de production, et n'ai modifié aucun secret côté production.

## 7. Résultats des smoke tests

| Test | Résultat |
|---|---|
| Storage : upload/lecture/suppression (API réelle) | **PASS** — nettoyé, 0 fichier restant |
| Edge Function `upload-attachment` (fichier réel, non destructif) | **PASS** — nettoyé, 0 fichier restant |
| Authentification admin fictif | **PASS** (voir point 5) |
| Authentification utilisateur fictif | **PASS** |
| Isolation : aucune requête ne cible `mhsbwabrvcqnxnwamvwc` | **PASS** (vérifié dans le bundle frontend + logs) |
| Isolation : aucune clé `service_role` dans le bundle | **PASS** |
| Chargement app / bandeau STAGING / Dashboard / Alertes / Entreprises / Décideurs / onboarding (interface réelle) | **BLOQUÉ** — nécessite le site live (point 9) |

## 8. Branche et commit Git

Inchangés par rapport au rapport précédent tant que je n'ai pas `24d28d9` : `feature/sprint-0b-cloud-staging`, commit `2005c29aa7d6600d25addb49cfb3a726f3cc0713`, basé sur `942dde6` (obsolète selon toi). **Je n'ai rien reconstruit dessus sur une hypothèse fausse**, conformément à la consigne.

## 9. URL de PR ou bundle final — et le blocage Netlify Phase 4

Pas de nouveau bundle tant que je n'ai pas `24d28d9`.

**Sur Netlify (Phase 4)** : mes outils Netlify ne permettent ni de lier un site à un dépôt GitHub, ni de configurer les build settings (build command / publish directory) — seules ces opérations existent : créer un site, renommer, gérer variables d'environnement, formulaires, accès visiteurs. Aucune opération de liaison de dépôt n'est exposée. C'est le blocage exact que tu as anticipé ("Netlify exige une action humaine que l'intégration ne permet pas"). Voici les clics exacts à faire toi-même :

1. Dashboard Netlify → site `winovya-market-intelligence-staging` → **Site configuration** → **Build & deploy** → **Continuous deployment** → **Link repository**.
2. Choisir **GitHub**, autoriser si demandé, sélectionner le dépôt `Lagloire23/Veille-WINOVYA`.
3. **Branch to deploy** : `staging`.
4. **Base directory** : laisser vide (racine du dépôt).
5. **Build command** : `npm run build`.
6. **Publish directory** : `dist`.
7. Ne pas toucher au champ **Custom domain** (rester sur `winovya-market-intelligence-staging.netlify.app`).
8. Sauvegarder, puis déclencher **Trigger deploy → Deploy site**.

Les 4 variables d'environnement (`VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_OPPORTUNITIES_ENABLED`) sont déjà configurées sur ce site, rien à refaire à cette étape.

**Phase 5 (Auth Site URL)** : même limitation — aucun outil ne permet de modifier la configuration Auth Supabase. Une fois l'URL live confirmée après l'étape ci-dessus (elle sera la même, `https://winovya-market-intelligence-staging.netlify.app`, sauf si Netlify l'assigne différemment) :
1. Dashboard Supabase, projet `gcitqpgucepgroermzti` → **Authentication → URL Configuration**.
2. **Site URL** : `https://winovya-market-intelligence-staging.netlify.app`.
3. **Redirect URLs** : ajouter `https://winovya-market-intelligence-staging.netlify.app/**`.
4. Ne rien changer sur le projet Production `mhsbwabrvcqnxnwamvwc`.

## 10. CI

Non vérifiable — aucun accès `gh`/API GitHub authentifiée depuis ce sandbox.

## 11. Actions humaines restantes

1. Fournir un bundle Git contenant le vrai `staging` à `24d28d9` (comme pour `942dde6` précédemment).
2. Lier Netlify à GitHub et lancer le premier déploiement (étapes exactes au point 9).
3. Configurer l'Auth Site URL / Redirect URLs (étapes exactes au point 9).
4. `supabase secrets set` pour `VEILLE_EXECUTION_MODE` / `OPPORTUNITY_ENGINE_ENABLED`.
5. Une fois le site live : je pourrai terminer les smoke tests d'interface (bandeau STAGING, Dashboard, Alertes, Entreprises, Décideurs, onboarding) et la reconstruction Git/PR sur `24d28d9`.

## 12. Confirmation production

**Confirmé : aucune ressource de production (`mhsbwabrvcqnxnwamvwc`, Netlify Production, Auth Production) n'a été modifiée à aucun moment.** Toutes les actions ont ciblé exclusivement le projet Staging `gcitqpgucepgroermzti` et le site Netlify Staging.

---

En attente de ton bundle pour `24d28d9` et de ton action sur Netlify/Auth pour terminer les Phases 1, 4, 5, 6 et 7. Je m'arrête ici comme demandé — pas de Sprint 1.
