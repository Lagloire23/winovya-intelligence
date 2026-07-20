# Sprint 0B — Audit complet et plan d'exécution (avant création de ressources cloud)

Statut : **audit et plan uniquement. Aucune ressource cloud créée ou modifiée.** Sprint 0A confirmé terminé de ton côté (PR fusionnée dans `staging`, CI verte, `staging` synchronisé avec `origin/staging` @ `942dde6`, `.env.example` propre).

---

## 1. GitHub

### État déclaré par toi (je n'ai pas d'accès direct pour le revérifier moi-même)
- PR Sprint 0 fusionnée dans `staging`.
- CI GitHub Actions verte (le workflow `.github/workflows/ci.yml` préparé au sprint précédent s'est donc exécuté avec succès au moins une fois).
- `staging` local = `origin/staging` @ `942dde6`.
- `.env.example` sur `staging` ne contient plus que des placeholders.

### Ce que je ne peux toujours pas vérifier moi-même
`gh` (GitHub CLI) n'est pas installé dans mon environnement d'exécution, aucun connecteur GitHub n'est disponible dans cette session Cowork, et la session est non-interactive (pas d'authentification par navigateur possible depuis ici). Je ne peux donc pas confirmer par moi-même :
- les règles de protection de branche actuellement actives sur `main` et `staging` (les paramètres que je t'avais transmis au sprint précédent restent des recommandations, pas une confirmation qu'ils sont appliqués) ;
- la liste exacte des workflows GitHub Actions autres que celui que j'ai préparé ;
- les secrets et variables GitHub configurés au niveau du dépôt ou des environnements GitHub.

**Si tu veux que je ferme ce point** : soit tu me confirmes ces éléments directement (capture d'écran de Settings → Branches / Settings → Secrets and variables), soit tu actives l'extension Claude in Chrome pour que je consulte l'interface GitHub moi-même.

## 2. Supabase Staging

| Élément | Valeur recommandée | Justification |
|---|---|---|
| Nom exact du projet | `WINOVYA Market Intelligence Staging` | Cohérent avec le nom du projet de production, sans ambiguïté |
| Organisation cible | `WINOVYA DataBase` (`pinlwggvsroxebodcfxt`) — la même que la production | Pas de raison de fragmenter la facturation/gestion ; l'isolation vient du projet, pas de l'organisation |
| Région recommandée | `eu-west-3` (Paris) | Identique à la région du projet de production — évite tout écart de comportement lié à la latence, cohérent avec un hébergement de données en France/UE |
| Coût estimé | **0 $/mois** (annoncé par l'outil de coût Supabase au moment de l'audit) | À reconfirmer via la confirmation de coût dédiée au moment réel de la création (obligatoire dans le flux de création) |
| Version PostgreSQL | 17.x (alignée sur la production, actuellement 17.6.1.141) | Éviter tout écart de comportement SQL entre staging et production |

⚠️ **Point de vigilance non résolu** : l'organisation possède déjà 2 projets (le projet de production, et un projet indépendant sans rapport, `Lagloire Project`). Le plan Supabase Free limite en général le nombre de projets actifs simultanés par organisation. Je n'ai pas de moyen de confirmer par avance si un 3ème projet gratuit sera accepté sans erreur — cela ne se saura qu'au moment de la tentative de création (l'outil de confirmation de coût te sera de toute façon présenté avant toute création réelle).

### Extensions nécessaires

Sur le projet de production, seules ces extensions sont réellement installées (sur ~80 disponibles) : `pgcrypto` (1.3), `uuid-ossp` (1.1), `plpgsql` (1.0, par défaut), `supabase_vault` (0.3.1), `pg_stat_statements` (1.11). `pg_cron` n'est **pas** installé en production (confirmé à nouveau lors de cet audit). Recommandation : installer exactement le même ensemble sur staging, rien de plus, pour rester fidèle à la production.

### Méthode de duplication du schéma

**Découverte importante lors de cet audit (à te signaler)** : la production a évolué depuis mon audit du 15 juillet. Il y a maintenant **9 migrations** appliquées (contre 7 précédemment), les deux nouvelles datées d'aujourd'hui (2026-07-16) :
- `20260716061409` — `create_veille_ofgl_schema`
- `20260716061441` — `create_arretes_prefectoraux_tables`

En creusant, ces deux migrations n'ont en réalité pas créé de nouveau schéma `veille_ofgl` : elles ont ajouté **trois tables dans le schéma `public`** (pas `veille`) : `public.veille_ofgl_runs`, `public.arretes_prefectoraux`, `public.arretes_entreprises_concernees`. Comme le client Supabase du frontend est configuré pour pointer uniquement sur le schéma `veille` (`db: { schema: 'veille' }`), ces nouvelles tables ne sont probablement pas accessibles depuis l'app telle qu'elle existe aujourd'hui — elles semblent alimentées par un processus séparé (une tâche de veille distincte, à confirmer avec toi). Je n'ai pas cherché à en savoir plus pour rester strictement dans le cadre de cet audit.

**Méthode recommandée pour dupliquer le schéma sur staging** : rejouer les 9 migrations, dans l'ordre de version, en récupérant leur texte SQL exact stocké par Supabase (`supabase_migrations.schema_migrations`, colonne `statements`) — c'est la méthode la plus fiable et la plus traçable, bien plus sûre qu'un `pg_dump` généraliste. Ne copier aucune donnée : uniquement le schéma (tables, colonnes, contraintes, index, RLS, fonctions, triggers).

### Configuration Auth

Je n'ai pas d'outil disponible dans cette session pour lire la configuration Auth actuelle de la production (URL du site, URLs de redirection autorisées, fournisseurs activés, modèles d'email, expiration des JWT) — ces réglages ne sont pas exposés via les tables SQL interrogeables, ils vivent dans la configuration de plateforme Supabase. Recommandation par défaut, à ajuster si tu connais des réglages spécifiques en production :
- Email/mot de passe uniquement (aucune preuve d'un autre fournisseur OAuth dans le code frontend audité).
- Site URL et Redirect URLs du projet staging pointés uniquement vers le futur domaine staging, jamais vers `intelligence.winovya.com`.
- Comptes de test créés manuellement sur staging (jamais copiés depuis la production).

### Configuration Storage

Un seul bucket existe en production : `veille-attachments` (public, limite 50 Mo, aucune restriction de type MIME) — utilisé par la fonction `upload-attachment`. Recommandation : créer un bucket staging identique en configuration (même nom, mêmes réglages), **vide** (aucun fichier copié).

### Configuration RLS

RLS activé sur toutes les tables du schéma `veille`. Recommandation : répliquer exactement les mêmes politiques que la production (via les migrations rejouées, qui les incluent déjà). Pour mémoire (déjà documenté dans l'audit du 15 juillet, toujours valable) : certaines politiques existantes sont larges (`alertes` en écriture sans filtrage par entreprise, lecture ouverte sur `entreprises`/`pertinence_entreprise`) — ce sont des caractéristiques de la production actuelle, pas des bugs introduits par ce sprint ; les répliquer à l'identique sur staging est cohérent avec l'objectif de fidélité, mais reste un point à corriger un jour, indépendamment de ce sprint.

## 3. Edge Functions

13 fonctions actives en production : `upload-attachment`, `admin-invite-user`, `bootstrap-admin-once`, `admin-account-reset-once`, `create-test-user-once`, `fullenrich-lookup`, `pappers-lookup`, `find-donneur-ordre-contact`, `alert-assistant`, `assign-alert`, `extract-entreprise-from-website`, `onboarding-save`, `set-test-user-password-once`.

**Stratégie de déploiement sur staging** : redéployer le code source de chaque fonction telle quelle sur le nouveau projet staging, à l'exception des 4 fonctions à usage strictement ponctuel (`bootstrap-admin-once`, `admin-account-reset-once`, `create-test-user-once`, `set-test-user-password-once`) — celles-ci sont conçues pour s'auto-désactiver après un seul usage (elles retournent HTTP 410 une fois consommées en production) ; sur staging, il faudra les ré-exécuter une fois dans leur propre contexte pour créer un compte admin/test initial, pas les copier dans un état "déjà consommé".

**Secrets nécessaires par fonction** (à reconfigurer sur staging, jamais copiés depuis la production) : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` du projet staging, `ANTHROPIC_API_KEY` (peut être la même clé qu'en production ou une clé de test séparée selon ta politique de facturation IA — à me préciser), clé Resend (pour `assign-alert`), clé Pappers (pour `pappers-lookup`), clé FullEnrich (pour `fullenrich-lookup`).

**Différences attendues entre staging et production** : `VEILLE_EXECUTION_MODE=test` par défaut sur staging (aucune écriture réelle vers des systèmes externes de production), `OPPORTUNITY_ENGINE_ENABLED=false` tant que le moteur n'existe pas encore (Sprint 1).

## 4. Netlify Staging

- **Nouveau site** (pas un environnement de déploiement sur le site de production existant) : `WINOVYA Market Intelligence Staging`, distinct de `winovya-intelligence` (id `bd7a3f79-e310-4fe4-9536-b05f9980f866`).
- **Branche GitHub utilisée** : `staging` — actuellement synchronisée à `942dde6` selon ta confirmation.
- **Variables d'environnement** : `VITE_APP_ENV=staging`, `VITE_SUPABASE_URL=<URL du projet staging>`, `VITE_SUPABASE_ANON_KEY=<clé anon staging>`, `VITE_FEATURE_OPPORTUNITIES_ENABLED=true`.
- **URL de staging attendue** : domaine Netlify généré automatiquement dans un premier temps (ex. `random-name--winovya-intelligence-staging.netlify.app` ou équivalent) — `staging-intelligence.winovya.com` uniquement après validation technique, comme convenu précédemment.
- Build command : `npm run build` — Publish directory : `dist`.

## 5. Sécurité

### Mécanismes empêchant une connexion accidentelle à Supabase Production
- Le garde-fou déjà en place dans le code (`src/lib/env.ts`, `assertEnvironmentIsolation()`) bloque le démarrage de l'application si `VITE_APP_ENV` et le projet Supabase réellement ciblé sont incohérents — vérifié par test réel lors du sprint précédent (build staging bloqué s'il pointe vers le projet de production, et inversement).
- Séparation totale des projets Supabase (staging = nouveau projet distinct, pas une branche du projet de production) — élimine tout risque de fuite croisée au niveau base de données.
- Le bandeau visuel "STAGING" (`EnvironmentBanner.tsx`) rend visuellement impossible de confondre les deux environnements à l'écran.

### Séparation complète des secrets
- Aucun secret de production (clé service_role, clés API tierces) ne doit être copié vers staging : chaque environnement a ses propres secrets, configurés séparément dans Supabase (edge functions) et Netlify (variables de build).
- `.env.example` ne contient et ne contiendra jamais de valeur réelle (déjà vérifié sur `staging`).

### Risques identifiés
1. Le plan Free Supabase pourrait refuser la création d'un 3ème projet dans cette organisation (à voir au moment de la tentative).
2. Les 4 fonctions "-once" ne sont pas directement réutilisables sur staging (déjà consommées en production) : il faudra les ré-exécuter dans leur contexte staging pour amorcer un compte admin.
3. Les nouvelles tables `public.veille_ofgl_runs` / `public.arretes_prefectoraux` / `public.arretes_entreprises_concernees` créées aujourd'hui en production ne sont pas encore comprises dans le détail (rôle, alimentation) — à clarifier avec toi avant de les répliquer aveuglément sur staging.
4. Configuration Auth de production non auditable avec les outils actuels — risque de configurer staging différemment sans le savoir sur ce point précis.
5. Aucune vérification possible des protections de branche GitHub réellement actives — risque que `main` ne soit pas aussi protégée qu'annoncé si les réglages recommandés au sprint précédent n'ont pas été appliqués tels quels.

## 6. Rollback

| Étape | Réversible ? | Comment revenir en arrière |
|---|---|---|
| Création du projet Supabase staging | Oui | Suppression du projet staging (aucun impact sur la production, projets totalement indépendants) |
| Application des migrations sur staging | Oui | Le projet staging peut être réinitialisé ou supprimé et recréé sans aucun effet sur la production |
| Déploiement des edge functions sur staging | Oui | Re-déploiement d'une version antérieure, ou suppression pure et simple sur le projet staging |
| Création du site Netlify staging | Oui | Suppression du site staging, aucun impact sur le site de production |
| Configuration des variables d'environnement staging | Oui | Modification/suppression directe dans Netlify/Supabase staging |
| Fusion de PR vers `staging` | Oui (avec prudence) | `git revert` du commit de merge, jamais de réécriture d'historique déjà partagé |
| Fusion de PR vers `main` / déploiement en production | **Non trivial** | Nécessite un rollback manuel du déploiement Netlify de production (republier le déploiement précédent) — pas concerné par ce sprint, aucune action sur `main` prévue |
| Association Git↔Netlify sur le site de **production** | **Non prévu dans ce sprint** | Décision distincte, non traitée ici |

Toutes les actions prévues dans ce Sprint 0B sont réversibles et n'affectent aucune ressource de production existante.

---

## Plan d'exécution proposé (numéroté, en attente de ta validation)

1. Confirmer avec toi les points ouverts : rôle des 3 nouvelles tables `public.*` créées aujourd'hui, politique sur la clé Anthropic (partagée ou séparée pour staging), et toute config Auth spécifique à reproduire.
2. Créer le projet Supabase staging (`WINOVYA Market Intelligence Staging`, org `pinlwggvsroxebodcfxt`, région `eu-west-3`) — confirmation de coût affichée avant création effective.
3. Installer les extensions nécessaires (`pgcrypto`, `uuid-ossp`, `supabase_vault`, `pg_stat_statements`).
4. Extraire le texte SQL des 9 migrations depuis `supabase_migrations.schema_migrations` (production) et les rejouer dans l'ordre sur le projet staging.
5. Créer le bucket Storage `veille-attachments` sur staging (config identique, vide).
6. Vérifier RLS et policies sur staging (doivent arriver automatiquement via les migrations rejouées) — contrôle de cohérence avec la production.
7. Déployer les 9 edge functions "normales" sur staging ; exécuter une fois les 4 fonctions "-once" dans leur contexte staging pour amorcer un compte admin/test.
8. Configurer les secrets des edge functions sur staging (URL/clé service_role du nouveau projet, clés tierces).
9. Créer le site Netlify staging, lié à la branche `staging` du dépôt GitHub.
10. Configurer les variables d'environnement du site Netlify staging (`VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_FEATURE_OPPORTUNITIES_ENABLED`).
11. Premier déploiement du site staging ; vérification visuelle du bandeau "STAGING".
12. Test de l'isolation : tentative volontaire de configuration incohérente (ex. `VITE_APP_ENV=staging` + URL de production) pour confirmer que le garde-fou bloque bien le démarrage.
13. Test fonctionnel de bout en bout sur staging (connexion, affichage des données de test, au moins une edge function).
14. Rapport final du Sprint 0B : ce qui a été créé, coûts réels engagés, URL de staging obtenue, résultats des tests, risques restants.

**Aucune étape ci-dessus n'a été exécutée. J'attends ta validation avant de commencer, idéalement étape par étape ou par blocs que tu m'indiqueras.**
