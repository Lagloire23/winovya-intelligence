# Sprint 7 — MVP Frontend « Opportunités »

## 1. Objectif et périmètre

Ce sprint construit exclusivement l'interface (React + TypeScript +
Tailwind, sans nouveau framework ni dépendance) permettant de consulter
et d'exploiter commercialement les dossiers d'opportunité déjà produits
par le backend (Sprints 1 à 6). Aucune règle métier n'est réécrite ni
dupliquée : chaque composant appelle uniquement `createOpportuniteQueryService()`
(Sprint 5) et `createOpportuniteCommercialService()` (Sprint 6).

## 2. Résultat de l'audit initial (Phase 1)

- `src/pages/OpportunitesPage.tsx` (Sprint 1) était un simple espace
  réservé vide — remplacé intégralement par la page liste (Phase 3).
- Aucune page de détail d'opportunité n'existait (`OpportuniteDetailPage.tsx`
  est entièrement nouveau).
- Design system existant réutilisé tel quel, jamais réinventé : palette
  `brand-*` (Tailwind), polices `font-heading`/`font-body`, classes
  composants `.card-winovya`, `.btn-primary`/`.btn-secondary`, `.badge`,
  `.input-winovya` (`src/index.css`), convention badge/format existante
  (`src/lib/displayHelpers.ts`, pour les alertes) — reprise à l'identique
  dans un fichier miroir dédié aux opportunités (`uiHelpers.ts`), jamais
  en modifiant le fichier existant.
- `dark:` (media, suit l'OS, pas de bouton toggle) : convention
  existante, tous les nouveaux composants la respectent.
- Aucun framework de test (jest/vitest/testing-library) dans
  `package.json` : conformément à la règle « aucune nouvelle
  dépendance », Phase 9 s'appuie sur `tsc`/`vite build` + une
  démonstration Staging réelle (voir §8), pas un nouveau test runner.
- **Découverte clé** : la policy RLS `admin write opportunites`
  (Sprint 1, inchangée) restreint TOUTE écriture sur `veille.opportunites`
  (statut ET assignation) aux seuls administrateurs — déjà documentée au
  Sprint 6 mais pas encore reflétée dans l'UI avant correction (voir §6).

## 3. Architecture Frontend

```
src/lib/opportunities/uiHelpers.ts       — libellés/styles de badges, formatage (montant, dates), miroir de displayHelpers.ts
src/components/common/States.tsx         — LoadingState / ErrorState / EmptyState génériques
src/components/opportunites/
  Badges.tsx                             — StatutCommercialBadge, ConfianceBadge, EnrichissementBadge, BudgetFiabiliteBadge
  StatusControl.tsx                      — changement de statut (admin uniquement, lecture seule sinon)
  AssignmentControl.tsx                  — assignation (admin uniquement, lecture seule sinon)
  NotesPanel.tsx                         — notes CRUD (créer/éditer/supprimer logiquement)
  ActivityTimeline.tsx                   — journal d'activité (lecture seule, alimenté par triggers SQL Sprint 6)
  DossierPanels.tsx                      — AlertesLieesPanel, PreuvesPanel, DecideursPanel, ChronologiePanel (lecture seule)
src/pages/OpportunitesPage.tsx           — liste (recherche, filtres, tri, pagination)
src/pages/OpportuniteDetailPage.tsx      — dossier complet (assemble tous les composants ci-dessus)
```

Aucun composant n'accède directement à Supabase : tout passe par les
deux services Sprint 5/6, instanciés une seule fois par page via leurs
factories (`createOpportuniteQueryService()`, `createOpportuniteCommercialService()`).

## 4. Pages et navigation (Phase 2/3)

- `/dashboard/opportunites` — liste premium : recherche instantanée
  (debounce 300 ms), filtres combinables (statut commercial, confiance,
  phase projet), tri (7 champs), pagination (20/page), badges (statut
  commercial, confiance, enrichissement), compteurs (preuves,
  décideurs), date du dernier signal (relative), indicateur d'assignation.
- `/dashboard/opportunites/:id` — dossier complet (Phase 4/5, voir §5).
- États gérés partout : chargement (`LoadingState`), erreur avec
  réessai (`ErrorState`), vide (`EmptyState`), dossier introuvable
  (`getDossier` renvoyant `null`, contrat Sprint 5 inchangé).

## 5. Dossier d'opportunité (Phase 4/5)

En-tête : titre, entité cible, géographie, budget identifié, badges
(confiance/enrichissement/statut), résumé métier, « pourquoi cette
opportunité » (raisons), métadonnées (création, dernier signal, nombre
de signaux/preuves/décideurs, dernière consolidation).

Actions (toutes via les services Sprint 5/6, jamais de règle recopiée) :
changement de statut (transitions valides calculées par
`lifecycle.ts`, Sprint 6, jamais recopiées), assignation/désassignation,
création/édition/suppression logique de note. Panneaux de lecture :
alertes liées, preuves, décideurs, chronologie fusionnée, journal
d'activité (jamais modifiable depuis le Frontend — alimenté uniquement
par les triggers SQL Sprint 6).

## 6. Règle d'autorisation reflétée dans l'UI (correction Phase 9)

La policy RLS `admin write opportunites` (Sprint 1, inchangée) autorise
uniquement un `admin` à écrire sur `veille.opportunites` — donc à
changer le statut ou à assigner/désassigner. `AssignmentControl` le
respectait déjà (sélecteur d'assignation affiché uniquement si
`isAdmin`). `StatusControl` ne le faisait pas initialement : corrigé
pour n'afficher le sélecteur de transition qu'aux administrateurs ;
un non-admin voit désormais le statut actuel en lecture seule avec une
note explicative, plutôt que de tenter une action systématiquement
bloquée par la RLS. Vérifié par simulation SQL réelle (`SET ROLE
authenticated` + `request.jwt.claims`, voir §8) : la tentative d'un
membre reste bloquée (0 ligne affectée), la tentative d'un admin
réussit.

Les notes suivent une règle différente et inchangée (Sprint 6) : tout
utilisateur authentifié peut créer sa propre note ; seuls l'auteur ou
un admin peuvent la modifier/supprimer logiquement — reflété dans
`NotesPanel` via `canModify && (isOwn || isAdmin)`.

## 7. Design, performance, responsive (Phases 6-8)

- Design : réutilisation stricte du design system existant (couleurs,
  typographie, `.card-winovya`, badges), densité contrôlée, tableaux
  lisibles (`overflow-x-auto` sur la liste), dark mode automatique
  (`dark:`) sur tous les nouveaux composants.
- Performance : `React.memo` sur la ligne de tableau (`OpportuniteRow`),
  `useCallback`/`useMemo` pour le chargement et les filtres, compteur
  `requestIdRef` pour ignorer les réponses réseau obsolètes (protection
  contre les races de rendu), assignation de liste résolue uniquement
  pour les lignes visibles (voir limitation §9).
- Responsive : grilles `md:grid-cols-2`/`lg:grid-cols-2` (empilement
  automatique en dessous du seuil, mobile-first Tailwind), tableau de
  liste scrollable horizontalement. Le MVP cible desktop/laptop/tablette ;
  le mobile complet est hors périmètre (comme spécifié).

## 8. Vérifications effectuées (Phase 9)

- `npx tsc --noEmit` : succès, 0 erreur (plusieurs exécutions au fil du
  sprint, dernière après la correction §6 : 0 erreur).
- `npx vite build` : succès, 1663 modules transformés (avertissement
  standard de taille de chunk, préexistant).
- **Démonstration Staging, données 100 % fictives** (préfixe
  `SPRINT7-TEST`, 1 entreprise, 1 opportunité `NEW`, budget/raisons/
  résumé renseignés) simulant exactement les actions déclenchées par
  la nouvelle UI, via `SET ROLE authenticated` + `request.jwt.claims`
  sur les deux profils fictifs préexistants (Sprint 0B) :

  | # | Action UI simulée | Acteur | Résultat |
  |---|---|---|---|
  | 1 | Changer le statut (StatusControl, si un membre contournait l'UI) | membre | Bloqué, statut inchangé (NEW) |
  | 2 | Changer le statut NEW → QUALIFYING | admin | OK, journalisé (`status_changed`) |
  | 3 | Assigner au membre | admin | OK, journalisé (`assigned`) |
  | 4 | Créer une note (NotesPanel) | membre | OK, journalisé (`note_added`) |
  | 5 | Modifier sa note | membre | OK, journalisé (`note_updated`) |
  | 6 | Supprimer logiquement sa note | membre | OK, journalisé (`note_deleted`) |
  | 7 | Désassigner | admin | OK, journalisé (`unassigned`) |

  Journal d'activité relu en fin de scénario : les 7 événements
  attendus (dont `created` automatique à l'insertion), dans l'ordre,
  avec l'`acteur_id` correct pour chacun — aucune entrée parasite.
  Compteurs avant/après nettoyage (entreprises, opportunites,
  opportunite_notes, opportunite_activity_log) : **tous à 0 avant, tous
  à 0 après**.
- États vides vérifiés par construction : la même opportunité fictive
  n'avait aucune alerte/preuve/décideur liés, donc `AlertesLieesPanel`,
  `PreuvesPanel`, `DecideursPanel`, `ChronologiePanel` ont chacun
  emprunté leur chemin `EmptyState` réel.
- `git diff --stat ... -- package.json package-lock.json` : vide
  (aucune dépendance ajoutée).

## 9. Limitations connues / risques résiduels

- **Colonne d'assignation de la liste (N+1 borné)** : ni le DTO de
  liste (Sprint 5) ni le service commercial (Sprint 6) n'exposent de
  lecture d'assignation en lot ; la liste résout donc l'assignation
  uniquement pour les lignes visibles de la page courante (≤ 20 appels),
  choix documenté plutôt que de modifier un DTO/service existant.
- **Résolution du nom d'un utilisateur assigné** limitée par la RLS
  `profiles` existante (Sprint 6, inchangée) : un non-admin ne peut
  résoudre le nom d'un autre utilisateur ; seul un admin peut peupler
  le sélecteur d'assignation.
- **Aucun framework de test de composants** : validation par
  `tsc`/`build` + démonstration Staging réelle (voir §8), pas de
  suite de tests automatisés de rendu (introduire un tel framework
  violerait la règle « aucune nouvelle dépendance »).
- **Mobile complet hors périmètre** (comme spécifié) : le MVP cible
  desktop/laptop/tablette.
- **Risques hérités, inchangés** : tous les risques résiduels
  documentés aux Sprints 2 à 6 (clé de corrélation, stratégie de
  corrélation B, consolidation à la lecture, RLS `profiles`, etc.)
  restent valables et ne sont pas repris ici en détail.
