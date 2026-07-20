# Audit du schéma `veille` — WINOVYA Market Intelligence

Projet Supabase `mhsbwabrvcqnxnwamvwc`. Audit strictement en lecture seule (aucune table, colonne, contrainte, fonction, politique RLS ni donnée n'a été créée, modifiée ou supprimée), réalisé via `information_schema`, `pg_constraint`, `pg_indexes`, `pg_policies` et les catalogues PostgreSQL, le 15/07/2026.

---

## 1. `veille.entreprises` (3 lignes)

| Colonne | Type PostgreSQL | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| name | text | non | — |
| competences | text | oui | — |
| references_clients | text | oui | — |
| status | text | non | `'Actif'::text` |
| site_web | text | oui | — |
| description_courte | text | oui | — |
| secteurs_intervention | text | oui | — |
| zone_geographique | text | oui | — |
| mots_cles_metiers | text | oui | — |
| effectif_taille | text | oui | — |
| secteur_clients | enum `secteur_clients` | oui | — |
| created_at | timestamptz | non | `now()` |
| updated_at | timestamptz | non | `now()` |
| airtable_id | text | oui | — |
| onboarding_complete | boolean | non | `false` |
| pays | text[] | non | `'{France}'::text[]` |
| regions_suivies | text[] | oui | — |
| departements_suivis | text[] | oui | — |
| types_opportunite_suivis | text[] | oui | — |

- Clé primaire : `id`.
- Clés étrangères entrantes : `pertinence_entreprise.entreprise_id → entreprises.id` (ON DELETE CASCADE), `profiles.entreprise_id → entreprises.id` (ON DELETE NO ACTION).
- Contrainte unique : `airtable_id`.
- CHECK : uniquement les `NOT NULL` listés ci-dessus (aucun `CHECK` métier custom).
- Enum `secteur_clients` : `Majoritairement privé`, `Majoritairement public`, `Mixte (public et privé)`.
- Index : `entreprises_pkey` (id), `entreprises_airtable_id_key` (unique, airtable_id).
- RLS (activé) : `authenticated read entreprises` (SELECT, `true`) — tout utilisateur authentifié peut lire toutes les entreprises ; `admin write entreprises` (ALL, `is_admin()`) — seuls les admins peuvent écrire directement en base.
- Triggers : aucun sur cette table.
- Fonctions/RPC : aucune fonction SQL dédiée. Écriture exclusivement via l'edge function `onboarding-save` (service role, contourne RLS) ; lecture directe côté client partout ailleurs.

## 2. `veille.decideurs` (177 lignes)

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| nom | text | non | — |
| structure_entreprise | text | oui | — |
| nature | enum `nature_decideur` | oui | — |
| type_structure | text | oui | — |
| departement | text | oui | — |
| region | text[] | oui | — |
| nom_personne | text | oui | — |
| prenom_personne | text | oui | — |
| fonction_poste | text | oui | — |
| service_direction | text | oui | — |
| email | text | oui | — |
| telephone | text | oui | — |
| linkedin | text | oui | — |
| source_url | text | oui | — |
| date_capture | date | oui | — |
| statut | enum `statut_decideur` | oui | — |
| notes | text | oui | — |
| document_organigramme_url | text | oui | — |
| organigramme_page_web | text | oui | — |
| role_achat | enum `role_achat` | oui | — |
| created_at | timestamptz | non | `now()` |
| updated_at | timestamptz | non | `now()` |
| airtable_id | text | oui | — |

- Clé primaire : `id`.
- Clés étrangères entrantes : `alertes.decideur_id → decideurs.id` (ON DELETE NO ACTION), `alerte_decideurs.decideur_id → decideurs.id` (ON DELETE CASCADE).
- Contrainte unique : `airtable_id`.
- CHECK : NOT NULL uniquement (id, nom, created_at, updated_at).
- Enums : `nature_decideur` (`Public`, `Privé`) ; `statut_decideur` (`À jour`, `À revérifier`, `Introuvable sur le site officiel`) ; `role_achat` (`Utilisateur final / terrain`, `Décideur budgétaire (DAF/DSI/élu rapporteur)`, `Service marchés / achats`, `Dirigeant / représentant légal`, `Non catégorisé`).
- Index : `decideurs_pkey` (id), `decideurs_airtable_id_key` (unique, airtable_id).
- RLS : `authenticated read decideurs` (SELECT, `true`) ; `admin write decideurs` (ALL, `is_admin()`).
- Triggers : aucun.
- Fonctions/RPC : aucune. **Écriture directe côté client malgré la policy `admin write decideurs`** — voir section risques RLS ci-dessous : `ContactFinder.tsx` fait un `INSERT` direct dans `decideurs` (ligne 72-87) avec la clé anon, ce qui échouera silencieusement (ou lèvera une erreur RLS) pour tout compte non-admin.

## 3. `veille.alertes` (295 lignes)

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| name | text | non | — |
| notes | text | oui | — |
| categorie_veille | enum `categorie_veille` | oui | — |
| pays | text | non | `'France'::text` |
| departement | text | oui | — |
| region | text[] | oui | — |
| commune_collectivite | text | oui | — |
| date_publication | date | oui | — |
| date_detection | timestamptz | non | `now()` |
| lien_source_url | text | oui | — |
| resume | text | oui | — |
| acteur_entite | text | oui | — |
| montant | numeric | oui | — |
| reference_officielle | text | oui | — |
| echeance_date_limite | date | oui | — |
| priorite | enum `priorite` | oui | — |
| mots_cles | text[] | oui | — |
| type_opportunite | text[] | oui | — |
| contact_decideur_nom/fonction/email/telephone/linkedin | text | oui | — |
| notes_equipe | text | oui | — |
| assigne_email | text | oui | — |
| texte_extrait_document | text | oui | — |
| statut | enum `statut_alerte` | non | `'NOUVEAU'::veille.statut_alerte` |
| decideur_id | uuid | oui | — |
| created_at / updated_at | timestamptz | non | `now()` |
| airtable_id | text | oui | — |

- Clé primaire : `id`.
- Clé étrangère sortante : `decideur_id → decideurs.id` (ON DELETE NO ACTION — **seule FK sans cascade**, cf. risques).
- Clés étrangères entrantes : `alerte_decideurs.alerte_id → alertes.id` (CASCADE), `pertinence_entreprise.alerte_id → alertes.id` (CASCADE), `attachments.alerte_id → alertes.id` (CASCADE).
- Contrainte unique : `airtable_id`.
- CHECK : NOT NULL uniquement (id, name, pays, date_detection, statut, created_at, updated_at).
- Enums : `categorie_veille` (12 valeurs, ex. `5. Marchés publics & renouvellements`, `6. Délibérations`…) ; `priorite` (`Haute`, `Moyenne`, `Basse`) ; `statut_alerte` (`NOUVEAU`, `ASSIGNE`, `TRAITE`, `ARCHIVE`).
- Index : `alertes_pkey`, `alertes_airtable_id_key` (unique), `idx_alertes_date_detection` (DESC), `idx_alertes_departement`, `idx_alertes_lien_source`, `idx_alertes_reference`, `idx_alertes_statut`.
- RLS : `authenticated read alertes` (SELECT, `true`) ; `authenticated update alertes` (UPDATE, `true` / `true`) — **tout utilisateur authentifié peut modifier n'importe quelle alerte**, pas seulement celles de son entreprise (cf. risques). Aucune policy INSERT/DELETE pour `authenticated` : la création/suppression d'alertes ne peut se faire que par un rôle admin/service (cohérent avec un pipeline de collecte automatisé).
- Triggers : aucun.
- Fonctions/RPC : aucune fonction SQL. Écritures côté client : `AlertRow.tsx` (`statut`, `notes_equipe` via `updateField`) ; edge function `assign-alert` (`assigne_email`, `statut`, service role).

## 4. `veille.alerte_decideurs` (189 lignes) — table de liaison N↔N

| Colonne | Type | Nullable |
|---|---|---|
| alerte_id | uuid | non |
| decideur_id | uuid | non |

- Clé primaire composite : `(alerte_id, decideur_id)`.
- Clés étrangères : `alerte_id → alertes.id` (ON DELETE CASCADE), `decideur_id → decideurs.id` (ON DELETE CASCADE).
- Index : PK + `idx_alerte_decideurs_alerte`, `idx_alerte_decideurs_decideur`.
- RLS : `authenticated read alerte_decideurs` (SELECT, `true`) uniquement — **aucune policy INSERT** pour `authenticated`. Or `ContactFinder.tsx` fait un `INSERT` direct dans cette table (ligne 94) avec la clé anon : cet insert échouera pour tout utilisateur non-admin (RLS bloque, faute de policy INSERT explicite — PostgREST/RLS refuse par défaut). **Bug latent probable** à vérifier en conditions réelles (voir risques).
- Triggers/fonctions : aucun.

## 5. `veille.attachments` (118 lignes)

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| alerte_id | uuid | oui | — |
| filename | text | oui | — |
| storage_path | text | oui | — |
| url | text | oui | — |
| created_at | timestamptz | non | `now()` |

- Clé primaire : `id`.
- Clé étrangère : `alerte_id → alertes.id` (ON DELETE CASCADE).
- Index : `attachments_pkey`, `idx_attachments_alerte`.
- RLS : `authenticated read attachments` (SELECT, `true`) uniquement — aucune policy INSERT/UPDATE pour `authenticated`. Écriture réservée au service role (edge function `upload-attachment`, qui gère aussi le Storage bucket `veille-attachments`).
- Triggers/fonctions : aucun.

## 6. `veille.pertinence_entreprise` (337 lignes) — cœur du scoring

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| nom | text | oui | — |
| alerte_id | uuid | non | — |
| entreprise_id | uuid | non | — |
| score_pertinence | enum `score_pertinence` | oui | — |
| type_opportunite | text[] | oui | — |
| lien_business | text | oui | — |
| statut | enum `statut_pertinence` | non | `'Actif'::veille.statut_pertinence` |
| donneur_ordre_deja_client | enum `statut_client` | oui | — |
| created_at / updated_at | timestamptz | non | `now()` |
| airtable_id | text | oui | — |

- Clé primaire : `id`.
- Clés étrangères : `alerte_id → alertes.id` (CASCADE), `entreprise_id → entreprises.id` (CASCADE).
- Contraintes uniques : `airtable_id` ; **`(alerte_id, entreprise_id)`** — une seule ligne de pertinence par couple alerte/entreprise (important pour la future dé-duplication en dossiers).
- Enums : `score_pertinence` (`Très Haute`, `Haute`, `Moyenne`, `Basse`, `À confirmer`) ; `statut_pertinence` (`Actif`, `Écarté`) ; `statut_client` (`Oui - client actif`, `Oui - client / référence passée`, `Non - prospect nouveau`, `À vérifier`).
- Index : PK, unique `(alerte_id, entreprise_id)`, unique airtable_id, `idx_pertinence_alerte_id`, `idx_pertinence_entreprise_id`.
- RLS : `authenticated read pertinence` (SELECT, `true`) ; `authenticated update pertinence` (UPDATE, `true`/`true`) — pas de policy INSERT/DELETE pour `authenticated` (cohérent, ces lignes sont produites par le pipeline de scoring, pas par l'UI).
- Triggers/fonctions : aucun. C'est la table pivot qui relie une alerte à **N entreprises simultanément**, chacune avec son propre score/type d'opportunité/analyse — point d'attention majeur pour tout regroupement en "dossiers" (voir section risques).

## 7. `veille.abonnements_alertes` (4 lignes)

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | `gen_random_uuid()` |
| email | text | non | — |
| nom | text | oui | — |
| entreprises_suivies | uuid[] | oui | — |
| score_minimum | enum `score_pertinence` | oui | — |
| types_opportunite_suivis | text[] | oui | — |
| departements / regions / epci_suivis / communes_suivies | text[] | oui | — |
| categories_veille_suivies | text[] | oui | — |
| statut | text | non | `'Actif'::text` |
| token_desinscription | text | non | `(gen_random_uuid())::text` |
| created_at | timestamptz | non | `now()` |
| airtable_id | text | oui | — |

- Clé primaire : `id`. Aucune FK déclarée (les `uuid[]` de `entreprises_suivies` ne sont pas contraints par une clé étrangère — cohérence applicative uniquement).
- Contrainte unique : `airtable_id`.
- RLS : `authenticated read abonnements` (SELECT, `true`) ; `authenticated insert abonnements` (INSERT, `with_check: true`) — n'importe quel utilisateur authentifié peut créer un abonnement pour n'importe quel email (pas de contrôle `email = auth.email()`), à noter si cette table sert un jour un formulaire public.
- Table alimentée par `SubscribeModal.tsx` (insert direct, client-side). Semble être un mécanisme d'abonnement email indépendant du système `profiles`/`entreprises` (héritage Airtable probable — nom de champs proches mais non alignés 1:1 avec les filtres d'onboarding plus récents sur `entreprises`).
- Triggers/fonctions : aucun.

## 8. `veille.profiles` (4 lignes)

| Colonne | Type | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | — (= `auth.users.id`) |
| email | text | oui | — |
| full_name | text | oui | — |
| role | enum `profile_role` | non | `'member'::veille.profile_role` |
| entreprise_id | uuid | oui | — |
| created_at | timestamptz | non | `now()` |

- Clé primaire : `id`.
- Clés étrangères : `id → auth.users.id` (ON DELETE CASCADE — la suppression d'un compte Auth supprime son profil) ; `entreprise_id → entreprises.id` (ON DELETE NO ACTION).
- Enum `profile_role` : `admin`, `member`.
- Index : `profiles_pkey` uniquement (pas d'index sur `email` ni `entreprise_id`, à surveiller si la table grossit).
- RLS : `read own profile` (SELECT, `id = auth.uid()`) ; `admin manage profiles` (ALL, `is_admin()`). **Un utilisateur ne peut lire que son propre profil** — donc `AdminPage.tsx` (qui liste tous les profils) ne fonctionne que pour un compte admin (cohérent, RLS le garantit côté serveur même si l'UI n'avait pas de garde-fou).
- **Trigger** : `on_auth_user_created` (AFTER INSERT sur `auth.users`) → exécute `veille.handle_new_user()`.
- **Fonctions** :
  - `veille.handle_new_user()` (SECURITY DEFINER) : à la création d'un utilisateur Auth, insère automatiquement une ligne `profiles (id, email, full_name)` avec `role` par défaut `member` et `entreprise_id` NULL (`ON CONFLICT (id) DO NOTHING`).
  - `veille.is_admin()` (SECURITY DEFINER, SQL) : `SELECT EXISTS(... profiles WHERE id = auth.uid() AND role = 'admin')` — utilisée dans toutes les policies `admin write ...` / `admin manage ...` ci-dessus.

---

## Fonctions SQL du schéma `veille`

Seules deux fonctions PL/pgSQL existent réellement en base : `handle_new_user()` (trigger de provisioning de profil) et `is_admin()` (garde RLS). **Aucune autre fonction ni RPC métier** n'existe côté PostgreSQL — toute la logique applicative (scoring, extraction IA, enrichissement, envoi d'email, assignation) vit dans des **edge functions Deno**, qui utilisent la clé service role pour contourner RLS quand nécessaire :

| Edge function | Tables lues | Tables écrites | Notes |
|---|---|---|---|
| `assign-alert` (v4) | `alertes`, `profiles` | `alertes` (`assigne_email`, `statut`) | Bloque si aucun profil n'existe pour l'email cible (création de compte volontairement manuelle). |
| `onboarding-save` (v2) | `profiles` | `entreprises` (upsert complet + filtres), `profiles.entreprise_id` | Autorise un `entrepriseId` différent du sien uniquement si l'appelant est admin. |
| `extract-entreprise-from-website` (v1) | — | — | Scrape le site + appel Claude Haiku, retourne un JSON de suggestion (aucune écriture DB directe). |
| `admin-invite-user` (v1) | `profiles` (vérifie le rôle admin de l'appelant) | `profiles` (role, entreprise_id, full_name) | Crée le compte Auth via `inviteUserByEmail`, complète ensuite le profil auto-provisionné par le trigger. |
| `upload-attachment` (v1) | — | Storage bucket `veille-attachments` uniquement | Ne touche pas la table `attachments` elle-même — l'insert de la ligne metadata n'a pas été retrouvé côté frontend actuel (à vérifier : les 118 lignes existantes viennent probablement de la migration Airtable). |
| `alert-assistant` (v2) | — (contexte fourni par le frontend dans le body) | — | RAG borné au contexte transmis, aucune requête DB propre. |
| `find-donneur-ordre-contact` (v3) | — | — | Sources externes uniquement (Pappers, RNE, geo.api.gouv.fr) ; le frontend fait ensuite l'insert dans `decideurs`/`alerte_decideurs`. |
| `pappers-lookup` (v6), `fullenrich-lookup` (v3) | — | — | Recherche externe uniquement ; `fullenrich-lookup` ne persiste jamais le résultat en base (voir risques). |
| `bootstrap-admin-once`, `admin-account-reset-once`, `create-test-user-once`, `set-test-user-password-once` | — | — | Utilitaires ponctuels, tous auto-désactivés (retournent HTTP 410). |

---

## Utilisation par le frontend (React/TS)

Le client Supabase (`src/lib/supabase.ts`) est configuré avec `db.schema: 'veille'` globalement — tous les `.from('xxx')` du code ciblent donc directement `veille.xxx`, sans préfixe explicite.

| Page / composant | Table(s) | Colonnes affichées (principales) | Colonnes modifiables par l'UI | Requête Supabase |
|---|---|---|---|---|
| `DashboardPage.tsx` | `alertes` (+ jointures `pertinence_entreprise(*, entreprises(id,name))`, `attachments(*)`, `alerte_decideurs(decideurs(*))`), `entreprises` | Quasi toutes les colonnes de `alertes` (titre, résumé, montant, échéance, région/département, mots-clés, sources, décideurs, score par entreprise) | Aucune en direct sur cette page (délègue à `AlertRow`) | Un seul `select('*, pertinence_entreprise(*, entreprises(id,name)), attachments(*), alerte_decideurs(decideurs(*))')` trié par `date_publication desc`, limité à 500 lignes, + `entreprises.select('*').eq('status','Actif')`. |
| `AlertRow.tsx` | `alertes` | statut, `assigne_email`, notes_equipe, décideurs, pertinence | `statut` (select), `notes_equipe` (textarea) via `update().eq('id', alerte.id)` | `supabase.from('alertes').update(patch).eq('id', alerte.id)`. |
| `ContactFinder.tsx` | `decideurs`, `alerte_decideurs` | Contact trouvé (nom, fonction, email, tél.) | Insertion d'un nouveau décideur + lien à l'alerte | `insert()` sur `decideurs` puis sur `alerte_decideurs` — **avec la clé anon, donc soumis à RLS `admin write decideurs` et à l'absence de policy INSERT sur `alerte_decideurs`** (voir risques). |
| `AssignAlertModal.tsx` | — (délègue à l'edge function) | `assigne_email`, `statut` (résultat) | Email destinataire + message | `functions.invoke('assign-alert', ...)`. |
| `EntrepriseProfileForm.tsx` / `CriteresOpportunitesPage.tsx` / `OnboardingPage.tsx` | `entreprises` | Tous les champs de profil entreprise + `pays`/`regions_suivies`/`departements_suivis`/`types_opportunite_suivis` | Tous les champs, via `functions.invoke('onboarding-save', ...)` | `select('*').eq('id', targetEntrepriseId)` en lecture, edge function en écriture. |
| `AdminPage.tsx` (onglet Utilisateurs) | `profiles`, `entreprises` | Nom, email, rôle, entreprise | `role`, `entreprise_id` (update direct — fonctionne seulement pour un admin, RLS `admin manage profiles`) | `select('*')`, `update({role})`, `update({entreprise_id})`. |
| `AdminPage.tsx` (onglet Entreprises) | `entreprises` | Tous les champs sauf filtres de veille (pays/régions/départements/types, ajoutés après cet écran) | name, competences, references_clients, secteurs_intervention, zone_geographique, mots_cles_metiers, effectif_taille, secteur_clients, status, site_web, description_courte | `update()` direct — **n'écrit PAS les colonnes `pays`/`regions_suivies`/`departements_suivis`/`types_opportunite_suivis`/`onboarding_complete`** ajoutées par la suite : cet écran est désormais partiellement obsolète par rapport à `EntrepriseProfileForm`. |
| `DecideursPage.tsx` | `decideurs` | Tous les champs personne + structure | Aucune (lecture seule + bouton enrichissement) | `select('*').or('structure_entreprise.ilike...,nom.ilike...,nom_personne.ilike...,prenom_personne.ilike...')`. |
| `SubscribeModal.tsx` | `abonnements_alertes` | — (formulaire de souscription) | email, nom, filtres géographiques/catégories/score minimum | `insert()` direct côté client (policy `authenticated insert abonnements` ouverte). |
| `DecideurEnrichButton.tsx` | — | Email/téléphone enrichi | **Aucune persistance** : le résultat FullEnrich n'est affiché qu'en state React, jamais réécrit dans `decideurs` (voir risques). |
| `AuthContext.tsx` | `profiles`, `entreprises` | — | — | `select('*').eq('id', userId).single()` puis, si `entreprise_id` existe, lecture de `entreprises.onboarding_complete` pour calculer `needsOnboarding`. |
| `ElusPage.tsx` | — (hors schéma `veille`, source RNE externe) | — | — | N'utilise pas les tables auditées. |

### Champs nécessaires à l'authentification et au filtrage par entreprise

- **Authentification** : `auth.users.id` (Supabase Auth) ↔ `profiles.id` (FK CASCADE), `profiles.email`, `profiles.role` (`admin`/`member`), `profiles.entreprise_id`.
- **Filtrage par entreprise** dans le dashboard : `profiles.entreprise_id` détermine l'entreprise par défaut d'un `member` (`isMember && profile.entreprise_id` → sélection auto) ; le sélecteur d'entreprise du dashboard (actuellement **ouvert à tous les rôles, marqué TEMPORAIRE dev/QA** dans le code) pilote ensuite `pertinence_entreprise.entreprise_id` pour ne montrer que les alertes pertinentes à l'entreprise choisie.
- **Onboarding** : `entreprises.onboarding_complete` + `AuthContext.needsOnboarding` forcent la redirection vers `/onboarding` tant que le profil entreprise n'est pas complété (uniquement pour `role = member`).

---

## Cartographie du flux actuel

```
entreprise (veille.entreprises)
   │  pays / régions_suivies / départements_suivis / types_opportunite_suivis
   │  renseignés via l'onboarding (mini-formulaire + extraction IA du site
   │  + validation manuelle dans EntrepriseProfileForm)
   ▼
collecte (pipeline externe, hors app — Airtable historique / scripts de veille)
   │  produit des lignes dans veille.alertes (BOAMP, Géorisques, presse,
   │  délibérations, etc.) — colonnes categorie_veille, région/département,
   │  montant, échéance, texte_extrait_document...
   ▼
alerte (veille.alertes)
   │  chaque alerte est ensuite évaluée, PAR ENTREPRISE, dans...
   ▼
pertinence_entreprise (veille.pertinence_entreprise)
   │  1 ligne par couple (alerte_id, entreprise_id) — unique constraint —
   │  porte le score_pertinence, le type_opportunite, le lien_business
   │  (pourquoi c'est intéressant), et si le donneur d'ordre est déjà client.
   │  C'est cette table qui fait le lien entreprise ↔ alerte, pas alertes
   │  directement.
   ▼
décideurs (veille.decideurs via veille.alerte_decideurs, N↔N)
   │  contact(s) identifié(s) pour cette alerte — soit déjà en base (import
   │  Airtable), soit ajouté à la volée via ContactFinder (Pappers/RNE/
   │  extraction texte) ou enrichi via FullEnrich (email/tél., non persisté).
   ▼
affichage frontend (DashboardPage → AlertRow)
   sélection d'une entreprise (activeEntrepriseId) → filtre les alertes ayant
   une ligne pertinence_entreprise pour cette entreprise → chaque AlertRow
   affiche le score, le lien business, les décideurs liés, les pièces
   jointes, permet de changer le statut/notes/assignation.
```

Points clés de cette cartographie :

- Le lien "quelle alerte concerne quelle entreprise" est **entièrement porté par `pertinence_entreprise`**, jamais par une colonne directe sur `alertes`. Une alerte peut donc légitimement appartenir à plusieurs entreprises simultanément, chacune avec un score et une analyse différents.
- Les décideurs sont liés à l'alerte (pas à l'entreprise ni à la pertinence) via `alerte_decideurs` — un même décideur peut être rattaché à plusieurs alertes.
- `alertes.decideur_id` (colonne directe, FK simple sans cascade) coexiste avec la table de liaison `alerte_decideurs` (N↔N) : **deux mécanismes redondants** pour rattacher un décideur à une alerte, dont un seul (`alerte_decideurs`) est réellement utilisé par le frontend actuel (`decideur_id` ne semble plus alimenté nulle part côté UI).
- Rien dans le schéma actuel ne regroupe plusieurs alertes entre elles (pas de notion de "dossier", "projet" ou "opportunité" transverse à plusieurs alertes) — chaque alerte est un événement isolé.

---

## Risques identifiés pour l'ajout d'une couche "dossiers d'opportunité" regroupant des alertes

Analyse à titre d'inventaire de risques uniquement — **aucune migration n'est proposée ici**.

1. **Granularité du lien alerte↔entreprise déjà multiple.** Une alerte a déjà 0..N lignes `pertinence_entreprise` (une par entreprise cliente concernée). Un "dossier d'opportunité" devra décider s'il regroupe des alertes pour UNE entreprise donnée, ou des alertes multi-entreprises — sinon deux entreprises clientes verront le même dossier alors qu'elles ne devraient pas se voir mutuellement.

2. **Absence de toute notion de regroupement existante.** Aucune colonne (`dossier_id`, `groupe_id`, `parent_alerte_id`...) n'existe sur `alertes` ni sur `pertinence_entreprise`. Toute UI actuelle (compteurs, filtres, recherche, tri par date) travaille en liste plate d'alertes individuelles — `DashboardPage.tsx` fait ses `useMemo` de comptage/filtrage directement sur le tableau `alertes`, sans notion de parent : ajouter un regroupement demandera de revoir ces mémos (compteurs de sidebar, KPI de score, filtres) pour agréger au niveau dossier sans casser l'affichage par alerte individuelle qui reste probablement nécessaire.

3. **RLS actuelle très permissive sur `alertes` (`authenticated update alertes` = `true`/`true`).** N'importe quel compte authentifié peut modifier n'importe quelle alerte, y compris changer son `statut` ou son `assigne_email` sans lien avec son `entreprise_id`. Si un dossier expose un statut agrégé (ex. "dossier traité" dérivé du statut de ses alertes), cette policy permissive s'appliquera telle quelle au regroupement sauf durcissement explicite.

4. **Cascades de suppression asymétriques.** `alerte_decideurs`, `pertinence_entreprise` et `attachments` sont en `ON DELETE CASCADE` depuis `alertes`, mais `alertes.decideur_id → decideurs.id` est en `NO ACTION`. Si un futur "dossier" référence des alertes par FK, il faudra choisir consciemment la règle `ON DELETE` (CASCADE viderait le dossier si une alerte est supprimée ; RESTRICT bloquerait la suppression d'alerte tant qu'elle est dans un dossier) — actuellement aucune convention uniforme n'existe dans le schéma pour trancher automatiquement.

5. **Contrainte d'unicité `(alerte_id, entreprise_id)` sur `pertinence_entreprise`.** Un dossier qui voudrait, par exemple, permettre plusieurs "vues" ou versions de pertinence pour une même alerte/entreprise (ex. ré-évaluation après regroupement) se heurtera à cette unicité existante — à connaître avant toute évolution de cette table.

6. **Deux mécanismes de liaison alerte↔décideur coexistent** (`alertes.decideur_id` simple + `alerte_decideurs` N↔N), le premier semblant mort côté frontend. Un regroupement en dossiers qui voudrait exposer "les décideurs du dossier" devra composer avec cette redondance/incohérence historique plutôt que de supposer une seule source de vérité.

7. **Colonnes de filtrage dupliquées à trois endroits avec des noms différents** : `entreprises` (`pays`, `regions_suivies`, `departements_suivis`, `types_opportunite_suivis` — onboarding), `abonnements_alertes` (`departements`, `regions`, `epci_suivis`, `communes_suivies`, `categories_veille_suivies` — héritage Airtable), `alertes`/`pertinence_entreprise` (`region`, `departement`, `type_opportunite` au niveau de l'alerte elle-même). Un dossier qui voudrait hériter automatiquement des critères de filtrage d'une entreprise devra réconcilier ces trois vocabulaires plutôt que d'en supposer un seul.

8. **`AdminPage.tsx` (onglet Entreprises) est déjà partiellement désynchronisé du schéma réel** : son formulaire de modification n'écrit pas les colonnes `pays`/`regions_suivies`/`departements_suivis`/`types_opportunite_suivis`/`onboarding_complete` ajoutées depuis. Tout regroupement en dossiers qui toucherait à `entreprises` devra vérifier cet écran séparément plutôt que de supposer qu'un seul composant (`EntrepriseProfileForm`) est la source unique de vérité pour l'édition entreprise — ce n'est pas encore le cas partout.

9. **Écritures client bloquées par RLS non détectées côté UI.** `ContactFinder.tsx` insère directement dans `decideurs` (policy admin-only en écriture) et `alerte_decideurs` (aucune policy INSERT pour `authenticated`) avec la clé anon — ces inserts échoueront très probablement pour un compte `member` non-admin, sans que l'UI actuelle ne détecte ni ne signale cette classe d'erreur clairement (le code affiche un message générique en cas d'erreur). Si un dossier d'opportunité doit permettre aux mêmes utilisateurs d'ajouter des décideurs à un dossier, ce problème RLS latent existant devra être traité indépendamment (probablement en déplaçant ces écritures vers une edge function service-role, sur le modèle déjà établi par `assign-alert`/`onboarding-save`).

10. **Absence d'index sur `profiles.entreprise_id` et `pertinence_entreprise.statut`.** À faible volume actuel (295 alertes, 337 pertinences) ce n'est pas un problème, mais un regroupement en dossiers qui multiplierait les jointures/filtres par entreprise sur ces tables devra surveiller les plans de requête si le volume augmente significativement.

11. **Aucune fonction SQL/RPC agrégée n'existe aujourd'hui** (seuls `handle_new_user` et `is_admin`) : toute logique de regroupement (calcul du score agrégé d'un dossier, statut dérivé, etc.) devra être écrite soit côté edge function (cohérent avec l'architecture actuelle, qui centralise toute la logique métier hors PostgreSQL), soit via de nouvelles fonctions SQL — un choix architectural à trancher avant migration, pas neutre pour la maintenabilité.
