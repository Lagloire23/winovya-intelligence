# Sprint 10.1 — Phase 2 : modèle d'autorisation

## Chemin d'autorisation

```
auth.uid()
  → veille.profiles.id
  → veille.profiles.role            ('admin' | 'member')
  → veille.profiles.entreprise_id   (nullable)
  → veille.opportunites.entreprise_id  (colonne directe, NOT NULL, FK réelle)
```

Confirmé par introspection (`information_schema.columns`,
`pg_constraint`) — pas supposé. `opportunites.entreprise_id` existe
directement ; aucun besoin de repasser par `pertinence_entreprise` pour
déterminer si une opportunité appartient à l'entreprise de l'appelant.

## Règles métier (exactes, telles que confirmées avec le donneur d'ordre)

1. Un administrateur de plateforme (`profiles.role = 'admin'`) consulte
   **toutes** les opportunités, sans restriction.
2. Un utilisateur standard (`profiles.role = 'member'`) ne consulte que les
   opportunités dont `entreprise_id = profiles.entreprise_id` de son propre
   profil.
3. Un utilisateur dont `profiles.entreprise_id IS NULL` ("sans entreprise")
   ne consulte **aucune** opportunité (ni aucune donnée métier rattachée à une
   entreprise) — `NULL = NULL` n'est jamais vrai en SQL, ce qui garantit ce
   comportement par construction dès lors que la policy compare
   `entreprise_id = (fonction retournant l'entreprise du profil)` sans
   traitement spécial : si la fonction retourne `NULL`, la comparaison échoue
   toujours, y compris pour une opportunité dont `entreprise_id` serait
   improbablement `NULL` lui-même (colonne `NOT NULL`, donc ce cas ne peut de
   toute façon pas exister côté `opportunites`).
4. Puisque `opportunites.entreprise_id` est `NOT NULL`, le cas « opportunité
   non rattachée à une entreprise » ne peut pas se produire dans le schéma
   actuel — la règle demandée par le cahier des charges est donc satisfaite
   par construction (aucune opportunité orpheline ne peut exister, donc
   aucune ne peut être visible par erreur à un utilisateur standard).
5. Les preuves (`opportunite_preuves`), décideurs liés
   (`opportunite_decideurs`), liens vers les alertes (`opportunite_alertes`),
   notes (`opportunite_notes`) et activités (`opportunite_activity_log`) ne
   sont visibles que si l'opportunité parente (`opportunite_id`) est elle-même
   visible selon la règle n°2 — vérifié par une sous-requête `EXISTS` sur
   `opportunites`, jamais par duplication de la logique d'autorisation.
6. Il n'existe pas de table `assignations` séparée : l'assignation vit dans
   les colonnes `opportunites.assigned_to` / `assigned_at`. Elle suit donc
   automatiquement la règle n°2 (si l'opportunité est visible, son
   assignation l'est aussi ; sinon aucune des deux ne l'est).
7. `pertinence_entreprise` porte elle-même une colonne `entreprise_id`
   directe : même règle (n°2), appliquée directement sans passer par
   `opportunites`.
8. `entreprises` (table de profils d'entreprises clientes) : un utilisateur
   standard ne voit que sa propre entreprise (`id = profiles.entreprise_id`) ;
   un administrateur les voit toutes. Ce point n'était pas 100% explicite
   dans le cahier des charges Sprint 10.1 mais est justifié par : (a) la
   Phase 1 l'a explicitement listée dans le périmètre d'audit, (b) un
   commentaire déjà présent dans `DashboardPage.tsx` documentait cette
   intention produit non appliquée, (c) le principe général du sprint
   ("aucune donnée d'une autre entreprise ne doit être accessible").

## Fonctions d'autorisation (SECURITY DEFINER, réutilisées/ajoutées)

- `veille.is_admin()` — existante, inchangée, déjà conforme (search_path
  fixé, retourne un booléen, aucun privilège élargi).
- `veille.current_entreprise_id()` — **nouvelle**, strictement dans le même
  style que `is_admin()` : `SECURITY DEFINER`, `SET search_path TO 'veille',
  'pg_temp'`, corps `SQL` d'une seule ligne, retourne uniquement
  `profiles.entreprise_id` (un UUID ou NULL) de l'appelant — aucune autre
  colonne, aucun privilège élargi. Nécessaire pour éviter la récursion RLS
  (une policy sur `opportunites` ne peut pas interroger `profiles` sans
  `SECURITY DEFINER`, sous peine de re-déclencher les policies de
  `profiles` à chaque évaluation — le même besoin qui justifiait déjà
  `is_admin()`).

## Ce qui reste hors périmètre (documenté, non modifié)

- `alertes`, `decideurs`, `alerte_decideurs`, `attachments` : référentiels de
  signaux/contacts partagés, non rattachés un-à-un à une seule entreprise par
  nature (un décideur ou une alerte brute peuvent être pertinents pour
  plusieurs entreprises clientes avant triage). Non listés explicitement dans
  le cahier des charges Sprint 10.1. Un futur sprint pourra les traiter si le
  besoin métier l'exige.

Aucune ambiguïté bloquante identifiée (contrainte n°10 du cahier des
charges) — passage à la Phase 3.
