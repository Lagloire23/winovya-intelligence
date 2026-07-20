# Sprint 10.1 — Phase 1 : audit RLS complet (Staging)

Projet audité : `gcitqpgucepgroermzti` (Staging). Lecture seule — aucune écriture
effectuée pendant cette phase. Méthode : introspection directe de
`pg_policy`/`pg_class`/`pg_proc` via l'outil MCP Supabase (`execute_sql`), pas
de supposition sur le schéma.

## Défaut confirmé (déclencheur du sprint)

Connecté en tant qu'utilisateur réel rattaché à Cetim (rôle `member`), la page
`/dashboard/opportunites` affichait les 49 opportunités toutes entreprises
confondues (Cetim : 7, Ekium : 15, Etamine : 13, démos antérieures : 14),
au lieu des 7 propres à Cetim. Confirmé aussi en base : la policy `authenticated
read opportunites` sur `veille.opportunites` est `USING (true)`, sans aucune
condition sur `entreprise_id`.

## Fonctions utilitaires existantes (réutilisées, non dupliquées)

`veille.is_admin()` — `SECURITY DEFINER`, `search_path` fixé explicitement à
`'veille', 'pg_temp'`, retourne un booléen unique, déjà utilisée par les
politiques d'écriture. Bonne pratique existante, conservée telle quelle.

## Tables et vue auditées

Toutes les tables listées ont RLS **activée** (`relrowsecurity = true`),
`FORCE ROW LEVEL SECURITY` **non activé** (`relforcerowsecurity = false` —
sans incidence ici car le propriétaire de la table n'est jamais utilisé pour
les requêtes applicatives, seulement `anon`/`authenticated`).

| Table | RLS | Policy SELECT | Rôles | USING | Risque |
|---|---|---|---|---|---|
| `opportunites` | ✅ | `authenticated read opportunites` | `authenticated` | `true` | **Fuite directe critique** : aucune restriction par entreprise. |
| `opportunite_preuves` | ✅ | `authenticated read opportunite_preuves` | `authenticated` | `true` | **Fuite directe** : preuves de toutes les opportunités, toutes entreprises. |
| `opportunite_decideurs` | ✅ | `authenticated read opportunite_decideurs` | `authenticated` | `true` | **Fuite directe** : décideurs liés à des opportunités d'autres entreprises. |
| `opportunite_alertes` | ✅ | `authenticated read opportunite_alertes` | `authenticated` | `true` | Fuite indirecte (lien opportunité↔alerte visible hors périmètre). |
| `opportunite_activity_log` | ✅ | `authenticated read opportunite_activity_log` | `authenticated` | `true` | **Fuite directe** : journal d'activité (titres, dates) de toutes les opportunités. |
| `opportunite_notes` | ✅ | `authenticated read opportunite_notes` | `authenticated` | `true` | **Fuite directe** : notes internes potentiellement confidentielles, toutes entreprises. INSERT/UPDATE déjà correctement restreints à `auteur_id = auth.uid()` (ou admin) — seul le SELECT est trop permissif. |
| `pertinence_entreprise` | ✅ | `authenticated read pertinence` | `authenticated` | `true` | **Fuite directe** : la table porte elle-même `entreprise_id`, jamais utilisée dans la policy. Table "équivalente" visée par le cahier des charges. |
| `pertinence_entreprise` | ✅ | `authenticated update pertinence` (UPDATE) | `authenticated` | `true` / WITH CHECK `true` | **Écriture inter-entreprises possible** : n'importe quel utilisateur authentifié peut modifier la pertinence de n'importe quelle entreprise. Aucun usage frontend actuel identifié (`grep` du dépôt : seule une lecture existe dans `AlertContextRepository`), donc restriction sans risque de régression connu. |
| `entreprises` | ✅ | `authenticated read entreprises` | `authenticated` | `true` | Fuite secondaire : un utilisateur voit le profil des entreprises clientes concurrentes (nom, secteur, critères). Un commentaire déjà présent dans `src/pages/DashboardPage.tsx:134` documente l'intention non appliquée : `isMember ? entreprises.filter(e => e.id === profile?.entreprise_id) : entreprises` — jamais réellement branché, confirmant que la restriction attendue existait dans l'intention produit mais pas dans le code ni la RLS. |
| `profiles` | ✅ | `read own profile` | `authenticated` | `id = auth.uid()` | Déjà correctement isolé. `admin manage profiles` (ALL) via `is_admin()` — correct. |
| `alertes` | ✅ | `authenticated read alertes` | `authenticated` | `true` | Accepté tel quel : les alertes sont un flux de signaux bruts partagé, pas encore rattaché à une entreprise (c'est justement `pertinence_entreprise` qui porte ce rattachement). Hors périmètre strict du cahier des charges Sprint 10.1 (non listé). Écriture (`authenticated update alertes`, USING/CHECK `true`) laissée telle quelle : pré-existante, hors périmètre du correctif RLS opportunités, à traiter dans un sprint dédié si nécessaire. |
| `decideurs`, `alerte_decideurs`, `attachments` | ✅ | lecture `true` | `authenticated` | `true` | Référentiel partagé (un décideur peut être lié à plusieurs opportunités de sociétés différentes), hors périmètre explicite du cahier des charges (qui cible `opportunite_decideurs`, pas `decideurs`). Non modifié. |

## Vue utilisée par le cockpit

`veille.opportunite_dossier` (unique vue du schéma `veille`) :
- déjà créée avec l'option `security_invoker = true` (confirmé via
  `pg_class.reloptions`) : la vue s'exécute avec les droits et la RLS de
  l'utilisateur appelant, **pas** ceux du propriétaire — donc **aucun
  contournement de RLS via cette vue**.
- Elle joint `opportunites` (base), `opportunite_preuves`,
  `opportunite_decideurs`, `opportunite_alertes` — les 4 mêmes tables déjà
  identifiées ci-dessus. Une fois leurs policies SELECT corrigées, la vue
  hérite automatiquement de l'isolation, sans recréation nécessaire.
- Aucune autre vue n'existe dans le schéma `veille`.

## Chemin de rattachement auth.uid() → profil → entreprise

```
auth.uid()
  → veille.profiles.id (PK = auth.users.id)
  → veille.profiles.entreprise_id (nullable, FK vers veille.entreprises.id)
  → veille.opportunites.entreprise_id (colonne directe, confirmée en Sprint 10 —
    PAS besoin de passer par pertinence_entreprise pour l'autorisation)
```

`opportunites.entreprise_id` est une colonne réelle et directe (`NOT NULL`,
`FOREIGN KEY ... ON DELETE CASCADE` vers `entreprises`) — confirmée par
introspection du schéma, pas supposée. Le modèle d'autorisation peut donc
comparer directement `opportunites.entreprise_id` à l'entreprise du profil
appelant, sans jointure indirecte via `pertinence_entreprise`.

## Écritures (INSERT/UPDATE/DELETE) sur les tables métier opportunités

Déjà correctement restreintes à `is_admin()` sur `opportunites`,
`opportunite_preuves`, `opportunite_decideurs`, `opportunite_alertes` (policies
`admin write ...`, `USING`/`WITH CHECK` = `is_admin()`). Confirmé dans le code
frontend (`CommercialRepository.updateStatut/assign/unassign`,
`OpportunityRepository.updateOpportunite`) : ces écritures passent par le
client Supabase authentifié standard (pas de `service_role` frontend, conforme
à la contrainte n°7), et échoueront silencieusement (ligne bloquée par RLS)
pour un utilisateur `member` — comportement voulu, non modifié dans ce sprint.

Seule anomalie d'écriture trouvée : `pertinence_entreprise` UPDATE
(`USING`/`WITH CHECK` = `true`), sans usage frontend identifié — corrigée en
Phase 3 par prudence (contrainte n°3 du cahier des charges Sprint 10 : jamais
d'écriture inter-entreprises).

## Conclusion Phase 1

Aucune ambiguïté sur le rattachement profil → entreprise (colonne directe,
non nullable côté `opportunites`, nullable côté `profiles.entreprise_id` pour
le cas "utilisateur sans entreprise"). Pas de blocage — passage à la Phase 2.
