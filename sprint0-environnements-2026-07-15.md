# Sprint 0 — Mise en place des environnements dev / staging / production

Date : 2026-07-15
Portée : `intelligence.winovya.com` (WINOVYA Market Intelligence)
Règles générales non négociables : appliquées intégralement (aucune modification de la production, aucune fusion vers `main`, aucune ressource payante créée sans validation).

---

## ÉTAPE 1 — Rapport d'audit (lecture seule)

### ⚠️ Constat prioritaire : Vercel vs Netlify

Le brief suppose un hébergement **Vercel**. En réalité, `intelligence.winovya.com` est hébergé sur **Netlify** (site `winovya-intelligence`, id `bd7a3f79-e310-4fe4-9536-b05f9980f866`). Aucun projet Vercel associé à ce site n'a été trouvé à aucun moment de ce chantier. Le seul indice "Vercel" rencontré concerne `attributions.winovya.com`, qui est un produit différent, non audité ici (accès non fournis, sujet mis en pause par toi précédemment).

Tout ce qui suit dans ce rapport et dans le plan d'isolation a donc été adapté à **Netlify**, en conservant l'intention exacte de tes règles (main = production, staging = recette, feature/* = dev). Si un projet Vercel existe réellement quelque part et m'a échappé, dis-le-moi et je corrige.

### A. GitHub

- Dépôt : `https://github.com/Lagloire23/Veille-WINOVYA.git`, créé vide par toi.
- Je n'ai **aucun connecteur GitHub** dans cette session (vérifié à plusieurs reprises via le registre de connecteurs) et **aucun accès web navigable** au dépôt (une requête sur l'URL `.git` ne renvoie que le protocole Git brut, pas une page consultable). Je ne peux donc pas confirmer par moi-même : la branche par défaut actuelle, les éventuels workflows GitHub Actions, les règles de protection de `main`, les règles de pull request, ni si le push que je t'ai fait faire (via le bundle Git) a bien abouti.
- Ce que j'ai construit de mon côté : un dépôt Git local (`/tmp/build/winovya-veille-app`, hors du dossier synchronisé pour éviter un bug de corruption de fichiers propre à ce dossier) avec 4 branches : `main`, `staging`, `feature/opportunites-dossiers`, `feature/staging-infrastructure`. Livré sous forme de bundle Git (fichier `.bundle`) que tu dois pousser toi-même vers GitHub.
- **Action de ta part nécessaire** : confirme-moi si le premier push (main/staging/feature/opportunites-dossiers) a bien fonctionné, pour que je sache si le nouveau bundle ci-joint peut simplement s'ajouter par-dessus ou s'il faut tout repartir de zéro.

### B. Hébergement (Netlify, à la place de Vercel)

- Site de production : `winovya-intelligence` (id `bd7a3f79-e310-4fe4-9536-b05f9980f866`), domaine `intelligence.winovya.com`.
- Aucun lien Git automatique vers GitHub n'a été observé sur ce site à ce stade de l'audit (les déploiements effectués pendant ce projet l'ont été manuellement via déploiement direct, pas via une intégration Git continue) — **à confirmer/compléter**, je n'ai pas un accès complet à la configuration de déploiement continu du site Netlify pour l'affirmer avec certitude à 100 %.
- Aucun site staging Netlify distinct n'existe actuellement.
- Aucune Preview Deployment / Environment Netlify distincte n'a été configurée à ce jour.

### C. Supabase

- Projet de production : `mhsbwabrvcqnxnwamvwc` (organisation `pinlwggvsroxebodcfxt`, "WINOVYA DataBase"), schéma `veille`.
- 7 migrations appliquées, listées et versionnées côté Supabase (voir `list_migrations`) — ces migrations ne sont pas encore répliquées sous forme de fichiers SQL dans le dépôt GitHub (dossier `supabase/migrations-proposed/` créé sur `feature/opportunites-dossiers` ne contient que la proposition non appliquée du chantier "dossiers d'opportunité", pas l'historique réel des 7 migrations déjà en place).
- 14 edge functions déployées en production (4 sont des scripts ponctuels auto-désactivés, retournant HTTP 410).
- Extension `pg_cron` **disponible mais non installée** (`installed_version: null`) sur le projet de production : le mécanisme exact de planification de la veille (8h/13h/18h) n'est donc **pas** géré par `pg_cron` Supabase. Je n'ai trouvé aucune autre preuve de planification via les outils disponibles dans cette session — **c'est une zone d'ombre non résolue**, à clarifier avec toi (ex. GitHub Actions cron externe ? tâche planifiée côté Netlify Functions ? autre orchestrateur ?).
- Aucun projet Supabase staging n'existe. Une branche Supabase payante a été évoquée (~0,01344 $/heure) — tu avais dit "Non, attends" : **rien n'a été créé**, cela reste en attente de ta validation.
- La commande de listing des branches Supabase (`list_branches`) a échoué à deux reprises avec une erreur technique du côté de l'outil ("Project reference is missing when validating permissions") — je n'ai donc pas de confirmation automatisée qu'aucune branche n'existe, mais je sais par notre échange qu'aucune n'a été créée puisque tu as refusé de valider la dépense.

### D. Pipeline de veille (8h / 13h / 18h)

- Emplacement exact du déclencheur (cron externe, planificateur tiers, autre) : **non identifié** avec les outils disponibles dans cette session. `pg_cron` étant confirmé absent, le mécanisme est très probablement externe à Supabase (ex. un service tiers de scheduling, ou une configuration côté plateforme d'hébergement) — je ne peux pas l'affirmer sans une information que tu détiens (accès à la configuration de ce planificateur).
- **Action de ta part utile** : si tu sais où est configurée cette planification (nom de l'outil, ou accès que je pourrais utiliser), dis-le-moi pour que je complète cette partie de l'audit.

---

## ÉTAPE 2 — Plan d'isolation retenu (adapté à Netlify)

| Branche Git | Rôle | Déploiement |
|---|---|---|
| `main` | Production, jamais modifiée sans validation explicite | Site Netlify de production (`winovya-intelligence`) |
| `staging` | Recette permanente | Site Netlify staging **à créer** |
| `feature/*` | Développement, une branche par sujet | Deploy Preview Netlify (si activé) ou exécution locale |

Bases Supabase : production (`mhsbwabrvcqnxnwamvwc`) et staging (**projet à créer, en attente de ta validation** car payant en continu) totalement distinctes.

Variables retenues, exactement selon ta nomenclature :

**Frontend** (`VITE_...`, jamais de secret) : `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_OPPORTUNITIES_ENABLED`.

**Backend / edge functions** (jamais préfixées `VITE_`) : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VEILLE_EXECUTION_MODE`.

Détail complet (valeurs par environnement, procédures, rollback) : voir `docs/environments.md`, ajouté au dépôt sur la branche `feature/staging-infrastructure`.

---

## ÉTAPE 3 — Actions réalisées (gratuites, non destructives)

Toutes réalisées sur le dépôt Git local, branche `feature/staging-infrastructure` (créée à partir de `staging`) — rien poussé vers un `main` ou une production, aucune ressource payante créée :

1. Branche `feature/staging-infrastructure` créée à partir de `staging`.
2. `.env.example` réécrit : les vraies valeurs de production qui s'y trouvaient (URL + clé anon du projet `mhsbwabrvcqnxnwamvwc`) ont été **retirées et remplacées par des placeholders génériques**, plus ajout de `VITE_APP_ENV` et `VITE_FEATURE_OPPORTUNITIES_ENABLED`.
3. `src/lib/env.ts` ajouté : fonction `assertEnvironmentIsolation()` qui bloque le démarrage de l'application si l'environnement déclaré (`VITE_APP_ENV`) est incohérent avec le projet Supabase réellement ciblé (`VITE_SUPABASE_URL`) — empêche un build "staging" de pointer vers la production, et empêche un build étiqueté "production" de pointer ailleurs. Testé unitairement (4 scénarios, tous corrects).
4. `src/main.tsx` modifié pour appeler ce garde-fou avant le rendu de l'application.
5. `docs/environments.md` ajouté : documentation complète des branches, de l'hébergement, des projets Supabase, des variables, des procédures dev/recette/production, du rollback, et des interdictions.
6. Aucune fonctionnalité métier (dossiers d'opportunité) activée — le feature flag reste à `false` par défaut.
7. Build vérifié : `tsc --noEmit` propre, `vite build` réussi sans erreur sur cette branche.
8. Aucun secret n'a été ajouté au dépôt (vérifié par recherche de motifs de clés/API sur l'ensemble des branches).

Aucun projet Supabase payant, aucun domaine, aucune ressource facturable n'a été créé.

---

## ÉTAPE 4 — Garde-fous techniques ajoutés

- `src/lib/env.ts` + appel dans `src/main.tsx` (détaillé ci-dessus).
- `docs/environments.md` (détaillé ci-dessus), incluant la procédure de rollback et le rappel des interdictions.
- Garde-fou équivalent pour les futures migrations/edge functions : **documenté dans `docs/environments.md`** (principe : toute migration ou edge function doit vérifier le projet cible avant écriture), mais pas encore implémenté en code, car aucune migration ni edge function n'est aujourd'hui versionnée dans ce dépôt (les 7 migrations existantes vivent uniquement côté Supabase, pas dans Git) — ce sera fait au moment où ces éléments seront eux-mêmes ajoutés au dépôt.

---

## Critères d'acceptation — statut

| # | Critère | Statut |
|---|---|---|
| 1 | Aucun commit direct sur `main` | ✅ tout le travail est sur `feature/staging-infrastructure` |
| 2 | Production non redéployée | ✅ aucune action Netlify/production effectuée |
| 3 | Supabase production n'a reçu aucune écriture | ✅ aucune requête d'écriture exécutée, uniquement lecture (`list_migrations`, `list_extensions`) |
| 4 | Branche `staging` existe | ✅ déjà créée lors du chantier précédent |
| 5 | Une branche `feature` existe | ✅ `feature/staging-infrastructure` (+ `feature/opportunites-dossiers` déjà existante) |
| 6 | Variables d'environnement documentées | ✅ `docs/environments.md` + `.env.example` |
| 7 | Une Preview/staging ne peut pas pointer vers Supabase production | ⚠️ partiel : le garde-fou logiciel (`assertEnvironmentIsolation`) l'empêche **si le code est utilisé**, mais tant qu'aucun projet Supabase staging réel n'existe, il n'y a pas encore de Preview Netlify fonctionnelle à tester en conditions réelles |
| 8 | Procédure de promotion staging → main documentée | ✅ dans `docs/environments.md` |
| 9 | Aucun secret dans le dépôt | ✅ vérifié par recherche de motifs sur toutes les branches |
| 10 | Une PR vers `staging` ouverte mais non fusionnée | ⚠️ je ne peux pas ouvrir de PR moi-même (aucun accès GitHub) — voir livrable et prochaine étape ci-dessous |

---

## Livrable final

- **Rapport d'audit** : ce document, section ÉTAPE 1.
- **Architecture retenue** : ce document, section ÉTAPE 2 + `docs/environments.md`.
- **Branches créées** : `staging` (existante), `feature/opportunites-dossiers` (existante), `feature/staging-infrastructure` (nouvelle, contient tout le travail de ce sprint).
- **PR vers `staging`** : impossible à ouvrir moi-même (aucun accès GitHub API/UI) — une fois que tu auras confirmé que le dépôt distant est à jour, je te donnerai les 2-3 clics exacts pour ouvrir toi-même la pull request `feature/staging-infrastructure` → `staging` depuis l'interface GitHub.
- **URL de Preview** : non disponible (pas d'intégration Netlify-Git configurée à ce stade).
- **Variables configurées (noms uniquement, sans valeurs)** : `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_OPPORTUNITIES_ENABLED` (frontend) ; `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VEILLE_EXECUTION_MODE` (backend).
- **Fichiers ajoutés/modifiés** (branche `feature/staging-infrastructure`, commit `1a1cdce`) :
  - `.env.example` (modifié — valeurs réelles retirées)
  - `src/lib/env.ts` (nouveau)
  - `src/main.tsx` (modifié — appel du garde-fou)
  - `docs/environments.md` (nouveau)
- **Vérification explicite** : production `intelligence.winovya.com` non touchée ; Supabase production interrogé uniquement en lecture ; aucune ressource payante créée ; aucun secret committé.

## Questions ouvertes pour toi

1. Le premier push (bundle précédent) vers `https://github.com/Lagloire23/Veille-WINOVYA.git` a-t-il fonctionné ?
2. Confirmes-tu que l'hébergement réel est Netlify (pas Vercel) ? Si un Vercel existe ailleurs, dis-moi lequel.
3. Sais-tu où est configurée la planification 8h/13h/18h de la veille (nom de l'outil ou accès disponible) ?
4. Valides-tu la création d'un projet Supabase staging (ressource payante en continu, ~0,01344 $/heure) ? Sans cela, l'isolation restera partielle (critère 7 ci-dessus).

**Je m'arrête ici, en attente de ta validation, conformément à la règle 6.**
