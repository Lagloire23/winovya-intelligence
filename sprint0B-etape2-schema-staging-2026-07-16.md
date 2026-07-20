# Sprint 0B — Étape 2 : préparation et validation du schéma staging

Statut : **audit et plan uniquement. Aucun fichier créé, aucune migration exécutée, aucun commit poussé.** Aucune ressource modifiée (Production, Staging, Netlify, GitHub `main`, DNS, Edge Functions, Storage, Auth).

---

## 0. Vérification de sécurité préalable (point 8 de ta demande)

Confirmé explicitement avant tout le reste :
- Projet **staging** ciblé pour la suite : `gcitqpgucepgroermzti` (`WINOVYA Market Intelligence Staging`, vide, créé à l'Étape 1).
- Projet **production**, à ne jamais toucher : `mhsbwabrvcqnxnwamvwc`.
- Les deux identifiants sont distincts et vérifiés via des appels séparés à l'outil Supabase — aucune ambiguïté possible.

## 1. Inventaire des migrations Git

**Résultat : aucun dossier `supabase/migrations/` n'existe dans le dépôt Git**, sur aucune des trois branches (`main`, `staging`, `feature/sprint-0-infrastructure`). Vérifié directement sur le listing complet des fichiers versionnés de chaque branche.

(Pour mémoire : un dossier `supabase/migrations-proposed/` existait temporairement sur une branche du sprint précédent, mais il ne contenait qu'un fichier `README.md` indiquant que son contenu était une proposition non appliquée pour la future couche "dossiers d'opportunité" — sans rapport avec les 9 migrations réellement appliquées en production. Cette branche a été supprimée localement lors du nettoyage demandé au sprint précédent.)

**Conclusion : 0 migration versionnée dans Git à ce jour.**

## 2. Inventaire des migrations Production

9 migrations appliquées sur `mhsbwabrvcqnxnwamvwc`, dans l'ordre chronologique (source : `supabase_migrations.schema_migrations`) :

| # | Version | Nom |
|---|---|---|
| 1 | `20260711083008` | `001_veille_schema_enums_tables` |
| 2 | `20260711083018` | `002_veille_indexes` |
| 3 | `20260711083032` | `003_veille_rls_and_auth_trigger` |
| 4 | `20260711083450` | `004_add_airtable_id_tracking` |
| 5 | `20260712075546` | `fix_profiles_rls_recursion` |
| 6 | `20260712075605` | `use_is_admin_helper_on_decideurs_entreprises` |
| 7 | `20260713220751` | `add_onboarding_fields_to_entreprises` |
| 8 | `20260716061409` | `create_veille_ofgl_schema` |
| 9 | `20260716061441` | `create_arretes_prefectoraux_tables` |

Les migrations 8 et 9 sont datées d'**aujourd'hui** (2026-07-16) — postérieures à tout notre travail Sprint 0/0A/0B jusqu'ici. Analyse détaillée en section 4.

## 3. Matrice des écarts

| Catégorie | Résultat |
|---|---|
| Présentes dans Git **et** en production | **Aucune** (0 sur 9) |
| Présentes en production, absentes de Git | **Les 9** — 100 % du schéma réel de production n'est reflété nulle part dans le dépôt Git |
| Présentes dans Git, non appliquées en production | Aucune (Git ne contient aucune migration réelle) |
| Écarts de schéma | Le code source du dépôt (`src/lib/types.ts`, `src/lib/supabase.ts`) ne documente que le schéma `veille` (8 tables). Les 7 tables ajoutées par les migrations 8 et 9 vivent dans le schéma `public`, complètement en dehors de ce que le frontend actuel connaît ou utilise (le client Supabase est configuré avec `db: { schema: 'veille' }`) |

**Constat central : Git n'est aujourd'hui la source de vérité de rien concernant le schéma. Toute l'historique réelle vit uniquement dans `supabase_migrations.schema_migrations` côté production.**

## 4. Analyse des deux migrations récentes

### `create_veille_ofgl_schema` (20260716061409)

- **Objectif apparent** : suivi d'un pipeline de veille basé sur les données OFGL (Observatoire des Finances et de la Gestion publique Locale — données budgétaires des collectivités territoriales françaises), avec détection de collectivités, identification de postes budgétaires, et génération d'alertes d'opportunités scorées.
- **Tables créées** (malgré son nom, cette migration ne crée **aucun schéma Postgres nommé "veille_ofgl"** — tout est créé dans le schéma `public`) :
  - `veille_ofgl_runs` (historique des exécutions du pipeline)
  - `collectivites_detectees` (collectivités territoriales détectées, avec budget, région, géographie JSONB)
  - `postes_budgetaires` (lignes budgétaires identifiées par collectivité)
  - `alertes_opportunites` (alertes générées, avec score de pertinence et contact décideur)
- **Schéma ciblé** : `public` (pas `veille`).
- **Dépendances** : `postes_budgetaires` → `collectivites_detectees` → `veille_ofgl_runs` (clés étrangères en chaîne) ; `alertes_opportunites` dépend des trois autres tables.
- **RLS** : **désactivé sur les 4 tables** (aucune instruction `ENABLE ROW LEVEL SECURITY` dans la migration).

### `create_arretes_prefectoraux_tables` (20260716061441)

- **Objectif apparent** : suivi d'un pipeline de veille des arrêtés préfectoraux (RAA — Recueil des Actes Administratifs), avec extraction de contenu PDF, scoring de pertinence et identification d'entreprises concernées.
- **Tables créées** : `public.arretes_prefectoraux` (table principale, avec URL source/PDF, contenu extrait, score de pertinence), `public.arretes_entreprises_concernees` (entreprises liées à un arrêté, avec SIRET), `public.veille_raa_runs` (suivi des exécutions de collecte).
- **Schéma ciblé** : `public`.
- **Dépendances** : `arretes_entreprises_concernees` → `arretes_prefectoraux` (clé étrangère avec `ON DELETE CASCADE`) ; `veille_raa_runs` est indépendante.
- **RLS** : **désactivé sur les 3 tables**.

### ⚠️ Constat de sécurité (indépendant de ce sprint, mais découvert pendant cet audit)

J'ai vérifié les droits réels accordés sur ces 7 tables : **les rôles `anon` et `authenticated` ont tous les deux SELECT/INSERT/UPDATE/DELETE/TRUNCATE en plus, sans RLS activé.** Concrètement, ces tables sont aujourd'hui accessibles en lecture et en écriture via l'API REST publique de Supabase à quiconque dispose de la clé anon (qui est par nature publique, visible dans n'importe quel bundle frontend déployé). Ce n'est pas un problème introduit par ce sprint, ni par moi — c'est l'état actuel réel de la production, découvert en creusant les deux migrations récentes. Je te le signale sans le corriger, car cela sort du périmètre strict de cette étape (préparation du schéma staging) et car toute correction sur la production nécessite ta validation explicite séparée.

### Ces tables ne correspondent à aucune Edge Function ni aucun code frontend connus

Aucune des 13 edge functions actuelles ne porte un nom lié à "ofgl", "arrete" ou "raa", et aucun fichier du dépôt Git ne les référence. Cela signifie que ces 7 tables sont probablement alimentées par un processus externe à ce dépôt (un autre script, une automatisation séparée, ou un travail en cours par une autre personne/outil sur le projet de production) — **en dehors du flux de gouvernance Git que nous mettons en place avec ce Sprint 0.** C'est la même question que je t'avais déjà posée sans réponse : sais-tu ce qui écrit dans ces tables ?

### Doivent-elles être incluses dans le staging dès maintenant ?

**Recommandation : non, pas dans cette étape.** Tant que je n'ai pas confirmation de leur rôle réel, de qui/quoi les alimente, et que le point RLS n'est pas clarifié avec toi, les répliquer sur staging ajouterait de la confusion sans bénéfice clair pour l'objectif actuel (valider l'environnement staging pour le développement futur de l'app connue). Elles peuvent être ajoutées plus tard, une fois clarifiées, sans coût de rattrapage particulier.

## 5. Stratégie de source de vérité proposée

Objectif : **Git devient la source de vérité**, sans dépendance durable à `supabase_migrations.schema_migrations`.

1. **Reconstruction** : le texte SQL exact de chacune des 9 migrations est déjà récupérable tel quel via `supabase_migrations.schema_migrations` (colonne `statements`) — vérifié en récupérant celui des migrations 8 et 9 pendant cet audit. Aucune reconstruction approximative n'est nécessaire : c'est le SQL réellement exécuté, mot pour mot.
2. **Versionnement** : créer un dossier `supabase/migrations/` dans le dépôt, avec un fichier par migration, nommé selon la convention Supabase CLI (`<version>_<name>.sql`), dans l'ordre chronologique des 9 versions ci-dessus.
3. **Bascule de gouvernance** : à partir de ce moment, toute nouvelle migration doit être écrite comme un fichier dans ce dossier, committée, revue via PR, puis appliquée — jamais exécutée directement en base sans passer par Git. Cela aurait empêché (ou du moins tracé) l'apparition des migrations 8 et 9 en dehors de tout contrôle.
4. **Application au staging** : une fois les 9 fichiers présents dans Git, les rejouer dans l'ordre sur `gcitqpgucepgroermzti` — staging devient alors le premier projet dont le schéma est garanti identique à ce que Git décrit.

Cette reconstruction n'est pas encore faite : elle fait partie du plan ci-dessous, à exécuter uniquement après ta validation.

## 6. Plan d'application sur Staging (proposé, non exécuté)

**Ordre exact des migrations à rejouer** (les 7 premières uniquement, sauf validation contraire de ta part sur les migrations 8 et 9 — voir section 4) :
1. `001_veille_schema_enums_tables`
2. `002_veille_indexes`
3. `003_veille_rls_and_auth_trigger`
4. `004_add_airtable_id_tracking`
5. `fix_profiles_rls_recursion`
6. `use_is_admin_helper_on_decideurs_entreprises`
7. `add_onboarding_fields_to_entreprises`

**Migrations à ajouter dans Git avant toute application** : les 9 fichiers `.sql` reconstruits à l'identique depuis `supabase_migrations.schema_migrations` (voir section 5), dans `supabase/migrations/`.

**Contrôles avant exécution** :
- Confirmer une dernière fois l'identifiant du projet cible (`gcitqpgucepgroermzti`) juste avant chaque application.
- Vérifier que le projet staging est toujours vide (aucune table `veille.*` existante) pour éviter tout conflit `CREATE TABLE`.
- Vérifier qu'aucune des 9 migrations ne contient de référence en dur à un identifiant de production (URL, ID de projet, clé) — à ma connaissance actuelle, aucune n'en contient, à reconfirmer au moment de l'extraction complète du texte SQL.

**Contrôles après exécution** :
- **Tables** : comparer la liste des tables du schéma `veille` sur staging avec les 8 tables connues en production (`entreprises`, `alertes`, `pertinence_entreprise`, `decideurs`, `alerte_decideurs`, `attachments`, `abonnements_alertes`, `profiles`).
- **Contraintes** : comparer les clés primaires, clés étrangères (avec leur `ON DELETE`) et contraintes `CHECK` table par table.
- **Index** : comparer le nombre et la définition des index entre production et staging.
- **Fonctions SQL** : vérifier la présence de `veille.is_admin()` et `handle_new_user()` (les deux seules fonctions réelles du schéma).
- **Triggers** : vérifier `on_auth_user_created` sur `auth.users` (le seul trigger connu).
- **Policies RLS** : comparer le nombre de policies par table et leurs expressions `USING`/`WITH CHECK` avec l'audit du 15 juillet (`audit-schema-veille-2026-07-15.md`), qui reste la référence documentée la plus complète du schéma `veille`.

## 7. Risques

1. Les migrations 8 et 9 suggèrent qu'un processus modifie déjà la production **en dehors** de ce nouveau flux Git — tant que ce n'est pas clarifié, le principe même de "Git = source de vérité" reste fragile si quelqu'un d'autre continue à appliquer des migrations directement.
2. RLS désactivé + droits complets `anon`/`authenticated` sur 7 tables de production — risque de sécurité réel, indépendant de ce sprint mais à ne pas ignorer trop longtemps.
3. Reconstruire les 9 fichiers de migration demande de manipuler le texte SQL exact extrait de la base — une erreur de copie pourrit la source de vérité dès le départ ; je recommande une vérification par diff automatique (hash du texte extrait vs hash du fichier committé) avant tout commit.
4. Si les migrations 8 et 9 sont finalement exclues du staging (recommandation actuelle), staging et production auront des schémas légèrement différents tant que ce point n'est pas tranché — à documenter clairement pour ne pas fausser les tests futurs.

## 8. Critères d'acceptation (pour la suite, une fois validée)

- [ ] Les 9 migrations sont présentes dans `supabase/migrations/` sur Git, avec un contenu identique (vérifié par comparaison) à `supabase_migrations.schema_migrations` de production.
- [ ] Le projet staging (`gcitqpgucepgroermzti`) contient exactement les mêmes tables, contraintes, index, fonctions, triggers et policies RLS que la production pour le schéma `veille` (les tables `public.*` des migrations 8/9 restent en attente de ta décision).
- [ ] Aucune donnée réelle n'a été copiée — uniquement le schéma.
- [ ] La production n'a subi aucune écriture pendant toute l'opération.
- [ ] Un rapport de vérification post-migration (tables/contraintes/index/fonctions/triggers/policies) est produit et comparé point par point à l'audit du 15 juillet.

---

**Aucun fichier n'a été créé. Aucune migration n'a été exécutée. Aucun commit n'a été poussé.** J'attends ta validation avant d'écrire quoi que ce soit sur `supabase/migrations/` ou sur le projet Supabase Staging — et en particulier ta décision sur l'inclusion ou non des migrations 8 et 9 (section 4).
