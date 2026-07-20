# Sprint 6 — Domaine métier commercial des opportunités (MVP)

## 1. Objectif

Transformer une opportunité détectée en opportunité exploitable
commercialement : cycle de vie contrôlé, assignation à un utilisateur,
notes internes, journal d'activité. **Ce n'est pas un CRM** : pas de
notifications, rappels, calendrier, synchronisation externe, ni rôle
d'équipe complexe. Le Frontend reste hors périmètre.

Ce sprint n'ajoute aucune règle au moteur de corrélation (Sprint 2.1),
au pipeline automatique / trigger Sprint 3, à `process_alert_opportunity`,
à `DossierEnrichmentService` (Sprint 4) ni à la couche Query (Sprint 5) —
tous strictement inchangés. Aucune IA, aucune API externe, aucun
framework, aucune dépendance npm ajoutés.

## 2. Audit initial (Phase 1)

- `veille.statut_opportunite` (Sprint 1) existait déjà avec NEW,
  QUALIFIED, IN_PROGRESS, WON, LOST, ARCHIVED. Le cycle de vie Sprint 6
  demande NEW, QUALIFYING, QUALIFIED, PROPOSAL, WON, LOST, ARCHIVED.
  **QUALIFYING et PROPOSAL ont été ajoutées** à l'enum existant (additif,
  `ALTER TYPE ... ADD VALUE IF NOT EXISTS`). **IN_PROGRESS reste dans le
  type** (PostgreSQL ne permet pas de retirer une valeur d'enum
  simplement, et « additif uniquement » interdit une réécriture) mais
  n'appartient plus au cycle de vie Sprint 6 : `lifecycle.ts` la traite
  comme un état inconnu (toute tentative de transition depuis
  `IN_PROGRESS` est refusée explicitement, jamais silencieusement
  acceptée) — limitation assumée et documentée (§8).
- `veille.opportunites` était vide (0 ligne) : aucune donnée existante à
  migrer.
- Aucune colonne `assigned_to`/`assigned_at`, aucune table de notes ni
  de journal n'existaient avant ce sprint.
- `veille.profiles` n'autorise la lecture que de sa propre ligne
  (`read own profile`, sauf admin via `is_admin()`) : un utilisateur non
  admin ne peut donc pas résoudre le nom d'un autre utilisateur assigné
  — limitation documentée (§8), le Frontend futur devra en tenir compte.
- Les DTO Sprint 5 (`OpportuniteListItemDto`/`OpportuniteDetailDto`)
  exposent déjà `statutOpportunite: string` : ce sprint ne les modifie
  pas et n'y ajoute rien (le domaine commercial est un module frère
  indépendant, `src/lib/opportunities/commercial/`, jamais une extension
  du Sprint 5).

## 3. Nouveau modèle métier

### 3.1 Cycle de vie (Phase 2)

7 états : `NEW`, `QUALIFYING`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`,
`ARCHIVED`. Graphe de transitions, centralisé dans
`src/lib/opportunities/commercial/lifecycle.ts` :

```
NEW        -> QUALIFYING, LOST, ARCHIVED
QUALIFYING -> QUALIFIED, LOST, ARCHIVED
QUALIFIED  -> PROPOSAL, LOST, ARCHIVED
PROPOSAL   -> WON, LOST, ARCHIVED
WON        -> ARCHIVED
LOST       -> ARCHIVED
ARCHIVED   -> (aucune sortie, état terminal)
```

Justifications : `ARCHIVED` est toujours atteignable (échappatoire de
sécurité) sauf depuis lui-même ; `WON` ne peut jamais redevenir `NEW`
(règle explicite Phase 7) — généralisé à « aucun retour en arrière » ;
`LOST`, par symétrie, ne peut aller que vers `ARCHIVED` (pas de
réouverture automatique dans ce MVP — limitation assumée, §8). Une
transition vers le même état est toujours invalide (pas de no-op
silencieux). Un état hors cycle de vie Sprint 6 (`IN_PROGRESS`) ne peut
jamais transitionner : erreur explicite, jamais un comportement par
défaut.

**La validation de transition est faite exclusivement en TypeScript**
(`lifecycle.assertValidTransition`), pas en SQL (pas de `CHECK`/trigger
dédié) : cohérent avec la philosophie du projet depuis le Sprint 2
(logique métier en TypeScript, SQL réservé au strict nécessaire) et avec
le refus assumé au Sprint 3 d'un 4ᵉ miroir de règle. Conséquence :
une écriture SQL directe (admin/outillage) contourne cette validation —
limitation documentée (§8).

### 3.2 Assignation (Phase 3)

`opportunites.assigned_to` (uuid, FK `profiles.id`, nullable) et
`assigned_at` (timestamptz). Aucune notion de rôle ni d'équipe. Écriture
soumise à la policy RLS existante `admin write opportunites` (Sprint 1,
inchangée) : seul un admin peut assigner/désassigner, comme pour tout
autre champ de `opportunites`.

### 3.3 Notes (Phase 4)

`veille.opportunite_notes` : `id`, `opportunite_id` (FK, cascade),
`auteur_id` (FK `profiles.id`), `contenu`, `created_at`, `updated_at`,
`deleted_at` (suppression logique uniquement, jamais physique — aucune
policy `DELETE`). CRUD complet côté application via
`CommercialService`.

### 3.4 Journal d'activité (Phase 5)

`veille.opportunite_activity_log`, append-only, extensible :
`id`, `opportunite_id`, `event_type` (`created`, `status_changed`,
`assigned`, `unassigned`, `note_added`, `note_updated`, `note_deleted`),
`acteur_id` (nullable — `null` quand l'événement vient du pipeline
automatique Sprint 3, sans utilisateur humain), `details` (jsonb libre),
`created_at`.

**Alimenté exclusivement par 2 triggers SQL `SECURITY DEFINER`**
(`log_opportunite_activity` sur `opportunites`, `log_opportunite_note_activity`
sur `opportunite_notes`) — jamais par le code applicatif TypeScript
directement. Même principe que le trigger Sprint 3 : une fonction
additive, greffée sur un événement déjà existant, qui ne modifie jamais
la ligne qui l'a déclenchée et n'appelle jamais `process_alert_opportunity`
ni le moteur de corrélation. Ce choix garantit que le journal ne peut
jamais être falsifié depuis le Frontend (anon-key) : il ne peut refléter
que des changements réellement survenus sur les tables sources (vérifié
§7).

## 4. Nouveaux objets créés

- Migrations : `20260717000500_sprint6_commercial_domain.sql` (en-tête
  d'audit + extension d'enum), `20260717000600_sprint6_commercial_domain_objects.sql`
  (colonnes assignation, 2 tables, RLS, 2 fonctions trigger + 4
  triggers), `20260717000700_sprint6_harden_trigger_grants.sql`
  (durcissement défensif : retrait du privilège `EXECUTE` implicite sur
  les fonctions trigger).
- Module TypeScript `src/lib/opportunities/commercial/` : `types.ts`
  (DTOs), `lifecycle.ts` (règles pures centralisées), `CommercialRepository.ts`
  (I/O pur), `CommercialService.ts` (orchestration), `index.ts`
  (barrel + `createOpportuniteCommercialService()`).
- `src/lib/opportunities/index.ts` : +1 ligne d'export additif
  (`OpportunityCommercial`), seul fichier préexistant touché.
- Tests : `scripts/sprint6-commercial-tests.ts` (20 tests),
  `scripts/sprint6-rls-network-check.mjs` (vérification RLS réseau
  réelle).

## 5. États métier

Voir §3.1. Résumé des règles (Phase 7, toutes centralisées dans
`lifecycle.ts`, jamais recopiées) :

- Une opportunité gagnée (`WON`) ne peut plus redevenir `NEW` (ni aucun
  autre état que `ARCHIVED`).
- Une opportunité archivée (`ARCHIVED`) ne peut plus être modifiée —
  généralisé par `canModify()` à **toute** modification (statut,
  assignation, notes), pas seulement au statut.
- Une note est toujours liée à une opportunité (`opportunite_id NOT NULL`,
  FK `ON DELETE CASCADE`).
- Une assignation est toujours historisée (trigger automatique, jamais
  manqué même en cas d'oubli côté application).

## 6. Règles métier (Phase 7, centralisées)

| Règle | Où elle vit |
|---|---|
| Graphe de transitions autorisées | `lifecycle.ts` (`ALLOWED_TRANSITIONS`) |
| "Opportunité archivée non modifiable" | `lifecycle.ts` (`canModify`), appliqué par `CommercialService` avant toute écriture (statut/assignation/notes) |
| "Note toujours liée à une opportunité" | Contrainte `NOT NULL` + FK SQL |
| "Assignation toujours historisée" | Trigger SQL automatique (jamais manuel) |
| "Journal jamais falsifiable" | Écriture réservée aux triggers `SECURITY DEFINER` ; aucune policy `INSERT` pour `authenticated`/`anon` |
| "Note jamais supprimée physiquement" | Aucune policy `DELETE` sur `opportunite_notes` ; seule `deleted_at` (soft-delete) est permise |

## 7. Sécurité (Phase 8)

- Client Supabase anon-key uniquement (même client que le reste de
  l'application) — jamais `service_role`.
- `opportunites.statut`/`assigned_to`/`assigned_at` : écriture soumise à
  la policy `admin write opportunites` (Sprint 1, **inchangée**) — Sprint
  6 n'introduit aucune nouvelle policy sur cette table.
- `opportunite_notes` : lecture partagée (`authenticated`), création par
  l'auteur uniquement (`auteur_id = auth.uid()`), modification par
  l'auteur ou un admin (`is_admin()`), aucune suppression physique.
- `opportunite_activity_log` : lecture partagée (`authenticated`),
  **aucune** policy `INSERT`/`UPDATE`/`DELETE` — seules les fonctions
  trigger `SECURITY DEFINER` y écrivent (même principe que le trigger
  Sprint 3 sur `opportunites`/`opportunite_alertes`/etc., qui contourne
  déjà RLS en tant que propriétaire de table).
- Vérifié en conditions réelles (réseau, clé anonyme publiable réelle
  contre Staging, `scripts/sprint6-rls-network-check.mjs`) : lecture
  anonyme des 2 nouvelles tables → 0 ligne, aucune erreur ; écriture
  anonyme (note, assignation) → bloquée (erreur RLS explicite pour la
  note, 0 ligne affectée pour l'assignation).
- Vérifié en SQL (`SET ROLE authenticated` + `request.jwt.claims`
  simulant deux utilisateurs fictifs réels, `admin.staging@example.com`
  et `user.staging@example.com`, déjà présents depuis le Sprint 0B) :
  un membre peut créer/modifier sa propre note, ne peut ni usurper un
  autre auteur ni modifier la note d'un tiers, ni la supprimer
  physiquement (toutes ces tentatives bloquées avec 0 ligne affectée,
  sans exception) ; un admin peut modifier la note de n'importe qui
  (override) ; toutes les écritures légitimes sont journalisées
  automatiquement avec le bon `acteur_id`, aucune tentative bloquée n'a
  généré d'entrée de journal.
- `get_advisors` (sécurité) : après durcissement (retrait de l'`EXECUTE`
  implicite sur les 2 fonctions trigger), aucune alerte nouvelle liée
  aux objets créés par ce sprint.

## 8. Limitations connues (MVP)

- **`IN_PROGRESS` reste dans l'enum SQL mais hors cycle de vie Sprint 6** :
  ne peut ni être atteint ni quitté par le code Sprint 6 ; une opportunité
  qui s'y trouverait nécessiterait une intervention manuelle (aucune
  n'existe à ce jour).
- **La validation des transitions n'est pas dupliquée en SQL** (pas de
  `CHECK`/trigger de garde-fou) : une écriture SQL directe (admin,
  script, migration future) peut techniquement écrire un statut
  incohérent avec le graphe. Assumé, cohérent avec la philosophie du
  projet (règles métier en TypeScript uniquement).
- **`LOST` est terminal** (seule sortie : `ARCHIVED`) : pas de mécanisme
  de réouverture automatique dans ce MVP.
- **Résolution du nom d'un utilisateur assigné** : un utilisateur non
  admin ne peut pas lire le profil (`nom`, `email`) d'un autre utilisateur
  (RLS `profiles`, héritée du Sprint 0B, non modifiée) — un futur
  Frontend devra soit passer par un admin, soit prévoir une vue dédiée
  hors périmètre de ce sprint.
- **Pas de pagination/recherche/filtre dédiés sur les notes ou le
  journal** dans ce sprint (hors périmètre MVP explicite — la couche
  Query Sprint 5 reste le point d'entrée pour lister/filtrer les
  opportunités elles-mêmes).

## 9. Vérifications exécutées

Voir rapport final : `npx tsc --noEmit`, `npx vite build`,
`scripts/sprint6-commercial-tests.ts` (20/20), démonstration Staging
complète (déclenchement automatique du journal, RLS notes/activity_log/
assignation, nettoyage vérifié), `get_advisors` (sécurité).
