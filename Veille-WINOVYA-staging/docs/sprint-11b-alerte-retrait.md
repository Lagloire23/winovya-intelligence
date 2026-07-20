# Sprint 11B — Retrait/réintégration logique d'une alerte liée

Base : Sprint 11A fusionné dans `staging` (merge commit `0827a77`).
Branche : `feature/sprint-11b-alert-removal`.

## 1. Objectif

Permettre à un utilisateur autorisé de retirer une alerte mal rattachée à une
opportunité **sans supprimer l'alerte globale** et **sans perdre l'historique**.
Le retrait est toujours logique (`is_active`), jamais physique. Ce sprint ne
recalcule aucune valeur métier (confiance, résumé, besoins) : il se contente
de marquer l'opportunité comme à reconsolider (préparation Sprint 11C).

## 2. Audit ciblé (avant implémentation)

| Élément | État actuel | Modification minimale | Risque |
|---|---|---|---|
| `veille.opportunite_alertes` | Table de liaison (Sprint 1), enrichie Sprint 11A de `role_correlation/raison_correlation/source_role/role_attribue_at` | Ajout additif de `is_active, retire_at, retire_par, motif_retrait, commentaire_retrait` + 3 CHECK | Faible : colonnes nullable/défaut `true`, aucune ligne existante modifiée |
| `veille.opportunite_activity_log` | Append-only (Sprint 6), `event_type` CHECK à 7 valeurs, écrit uniquement par triggers `SECURITY DEFINER` | Étendre le CHECK à 9 valeurs (+`alerte_retiree`, `alerte_reintegree`) + nouveau trigger `AFTER UPDATE OF is_active` | Faible : extension de CHECK additive, aucun insert applicatif direct introduit |
| RLS `opportunite_alertes` | Policy unique `"admin write opportunite_alertes"` (ALL, `is_admin()`, bypass global) ; lecture partagée existante | Aucune nouvelle policy : la policy `ALL` couvre déjà l'UPDATE des nouvelles colonnes | Moyen (documenté, non résolu ce sprint) : "utilisateur autorisé" = admin global uniquement aujourd'hui, pas de granularité par entreprise |
| `OpportuniteQueryRepository.fetchAlertesLiees` | Lit toutes les lignes de liaison sans filtre d'état | Ajout `.eq('is_active', true)` + nouvelle méthode `fetchAlertesEcartees` (`is_active=false`) | Faible : filtre supplémentaire, aucune requête existante cassée |
| `DossierRepository.getConsolidationInput` | `nombreSignaux` retombait sur `opportunites.nombre_signaux` (colonne stockée, potentiellement obsolète) ; lisait toutes les alertes liées sans filtre | Filtrer `is_active=true` sur la lecture des signaux ; `nombreSignaux` toujours `signaux.length` | Faible : rend le compte plus exact, pas de régression de lecture identifiée |
| Services métier (mutation) | Patron établi : `CommercialService`/`CommercialRepository` (Sprint 6) — pas de duplication de la sécurité RLS, erreurs typées dédiées | Nouveau module `alerteRetrait/` suivant strictement le même patron | Faible |
| Frontend — fiche opportunité | `AlertesLieesPanel` (lecture seule), pas d'action de retrait ; rechargement via `refreshKey`/`bumpActivity()` (Sprint 7/8) | Ajout d'une action "Retirer" + panneau "Alertes écartées", réutilisation du même mécanisme de rechargement | Faible |

Aucun blocage structurel majeur identifié : implémentation réalisée sans attendre de validation intermédiaire, conformément à l'instruction.

## 3. Stratégie retenue

- **Retrait logique uniquement** : `is_active` (booléen, défaut `true`) + 4 colonnes de métadonnées (`retire_at`, `retire_par`, `motif_retrait`, `commentaire_retrait`). Aucune ligne n'est jamais supprimée, aucune alerte globale (`veille.alertes`) n'est jamais touchée.
- **Cohérence imposée en base**, pas seulement côté application : 3 contraintes CHECK (`motif_retrait` dans la taxonomie fermée ; cohérence active/inactive des 4 champs ensemble ; commentaire obligatoire quand `motif_retrait = 'autre'`).
- **Historique séparé de l'état courant** : les 4 colonnes de métadonnées reflètent l'état du retrait *courant* (nettoyées à la réintégration) ; la trace *permanente* de chaque retrait/réintégration vit exclusivement dans `veille.opportunite_activity_log` (append-only, jamais modifiable depuis l'application).
- **Autorisation déléguée à la RLS existante**, jamais dupliquée dans le service : la policy `"admin write opportunite_alertes"` (Sprint 1) couvre déjà l'UPDATE des nouvelles colonnes. `AlerteRetraitRepository` détecte un refus RLS silencieux (0 ligne affectée) et le service lève `RetraitNonAppliqueError` plutôt que de prétendre un succès.
- **Rôle de corrélation (Sprint 11A) jamais touché par ce sprint** : ni le retrait ni la réintégration ne modifient `role_correlation`. La "restauration du rôle précédent" (exigée par le prompt) est donc satisfaite trivialement — le rôle n'a jamais changé.
- **Préparation Sprint 11C** : `requestOpportunityRecalculation(opportuniteId)` (nouveau module `recalculation/`) se contente de repasser `opportunites.statut_enrichissement` à `'pending'` — le mécanisme de consolidation paresseuse existant (Sprint 4/5, inchangé) fera le reste plus tard. Aucun recalcul de confiance/résumé/besoins n'est effectué ici.

## 4. Décisions explicites / non-couvert par ce sprint

- "Utilisateur autorisé" = administrateur global (`veille.profile_role` n'a que `admin`/`member`, confirmé par requête live). Une granularité plus fine (ex. "membre autorisé de l'entreprise concernée") est un choix produit non tranché ici — signalé comme dette, pas inventé silencieusement.
- L'isolation par entreprise n'est **pas** dupliquée dans `AlerteRetraitService` : elle reste entièrement déléguée à la RLS, exactement comme `CommercialService` (Sprint 6) le fait déjà pour `changeStatut`/`assign`/`unassign`.
- `datePremierSignal`/`dateDernierSignal` sur `opportunite_dossier` ne sont pas recalculés par ce sprint pour exclure les signaux retirés (seul `nombreSignaux`, dans `getConsolidationInput`, l'est) — limitation documentée, à traiter éventuellement en Sprint 11C/12.

## 5. Vérifications réalisées

- Migration appliquée à Supabase Staging (`gcitqpgucepgroermzti`) via l'outil MCP `apply_migration` : 5 nouvelles colonnes confirmées, CHECK `opportunite_alertes_motif_retrait_check`/`opportunite_alertes_retrait_coherence_check`/`opportunite_alertes_motif_autre_commentaire_check` posées, `35 total / 35 actifs / 0 retirés` juste après application (aucun backfill fabriqué).
- Cycle complet retrait → réintégration exécuté en direct sur Staging via SQL (lien Cetim de test, remis dans son état d'origine après vérification) :
  - motif hors taxonomie rejeté par le CHECK ;
  - retrait accepté, alerte globale toujours présente dans `veille.alertes` ;
  - lien exclu de la requête `is_active = true` (utilisée par `fetchAlertesLiees`) ;
  - lien présent dans la requête `is_active = false` (utilisée par `fetchAlertesEcartees`) ;
  - trigger a inséré un événement `alerte_retiree` avec motif/alerte/rôle-avant/confiance-avant/statut-avant ;
  - réintégration acceptée, métadonnées de retrait nettoyées ;
  - trigger a inséré un événement `alerte_reintegree` distinct, sans effacer l'événement `alerte_retiree` original (append-only confirmé) ;
  - état final du lien de test revérifié identique à l'état de départ.
- `get_advisors(type="security")` : uniquement les avertissements déjà connus des sprints précédents, plus l'avertissement attendu "fonction SECURITY DEFINER exécutable par anon/authenticated" sur la nouvelle fonction trigger — même catégorie déjà acceptée pour `is_admin()`/`handle_new_user()`/le trigger Sprint 6.
- `npx tsc --noEmit` : aucune erreur.
- `npx tsc -b` puis `npx vite build` (exécutés séparément — voir note technique ci-dessous) : succès.
- `npx tsx scripts/sprint11b-alerte-retrait-tests.ts` : 21/21 tests purs passés (validation de domaine + `AlerteRetraitService` avec double de test du repository). La section réseau (comptes `admin.staging@example.com`/`user.staging@example.com`, mot de passe de test) s'ignore proprement si les variables d'environnement `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SPRINT10_TEST_PASSWORD` sont absentes — c'est le cas dans ce sandbox (aucune persistance de secret entre sessions), donc cette portion a été vérifiée manuellement par SQL direct (voir ci-dessus) plutôt que par le script.

## 6. Note technique — build en deux commandes

`npm run build` (qui enchaîne `tsc -b && vite build`) dépasse le délai de 45s de
l'outil shell de ce sandbox. Comme pour les sprints précédents, `tsc -b` et
`vite build` ont été exécutés comme deux commandes séparées (37s puis 41s).

## 7. Sprint 11C — ce qui reste à brancher

`requestOpportunityRecalculation(opportuniteId)` (`src/lib/opportunities/recalculation/`)
est le point d'entrée unique déjà en place. Le Sprint 11C devra :
- lire le nouveau statut `'pending'` (déjà le cas via `needsConsolidation`, inchangé) ;
- remplacer/étendre `DossierEnrichmentService.consolidate` pour tenir compte des
  alertes retirées (déjà exclues des signaux d'entrée par ce sprint) et implémenter
  les 7 niveaux de confiance métier P11.1 ;
- ne jamais dupliquer la logique de retrait/réintégration : ce module reste la
  seule source de vérité sur l'état actif d'un lien.
