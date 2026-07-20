# Limitations connues — MVP Module Opportunités

Document de synthèse (Sprint 8, Phase 11). Ne reprend que les
limitations réellement présentes, vérifiées par le code ou par une
vérification Staging — jamais une supposition.

## Backend / données (héritées, inchangées depuis les Sprints 2 à 6)

- **Triplication de la clé de corrélation** (Sprint 3) et **limite
  résiduelle de la stratégie B de corrélation** (Sprint 2.1) : non
  concernées par le Frontend, documentées en détail dans
  `docs/opportunity-*.md` des sprints correspondants.
- **`IN_PROGRESS` reste dans l'enum SQL `statut_opportunite`** (héritage
  Sprint 1) mais hors cycle de vie Sprint 6 : aucune opportunité ne s'y
  trouve à ce jour ; une intervention manuelle serait nécessaire si le
  cas se présentait. `StatusControl.tsx` affiche un badge neutre de
  repli pour toute valeur hors cycle de vie connu, jamais une couleur
  inventée.
- **`LOST` est terminal** (seule sortie : `ARCHIVED`) : pas de
  réouverture automatique dans ce MVP.
- **Validation des transitions non dupliquée en SQL** (pas de
  `CHECK`/trigger de garde-fou sur le graphe) : une écriture SQL directe
  (admin/outillage) pourrait techniquement écrire un statut incohérent.
  Assumé, cohérent avec la philosophie du projet (règles métier en
  TypeScript uniquement, jamais un 2ᵉ miroir SQL).
- **Résolution du nom d'un utilisateur assigné** limitée par la RLS
  existante sur `veille.profiles` (Sprint 6, inchangée) : un non-admin
  ne peut pas lire le profil (nom, email) d'un autre utilisateur. Le
  Frontend n'invente jamais de nom : il affiche l'identifiant technique
  masqué ou une mention neutre ("Utilisateur assigné").

## Frontend (Sprint 7, résolues ou toujours valables après le Sprint 8)

- **N+1 d'assignation dans la liste : RÉSOLU au Sprint 8** (Phase 2).
  L'assignation vient désormais directement de
  `veille.opportunite_dossier` (colonnes `assigned_to`/`assigned_at`
  ajoutées de façon additive), lue dans l'unique requête de liste déjà
  exécutée — plus aucun appel réseau par ligne visible.
- **`getStats` agrège en mémoire** (pas de `GROUP BY` SQL dédié,
  Sprint 5) : acceptable au volume MVP actuel, non utilisé par les pages
  Frontend actuelles (liste/dossier), aucun impact sur le parcours MVP.
- **Consolidation à la lecture uniquement sur `getDossier`, jamais sur
  `listDossiers`** (Sprint 5) : un dossier `pending`/`partial` peut
  apparaître dans la liste jusqu'à ouverture individuelle — assumé pour
  éviter un coût N+1 sur chaque page de résultats (le badge
  d'enrichissement et la bannière "Enrichissement en cours" ajoutée au
  Sprint 8 rendent cet état visible et honnête plutôt que de le masquer).
- **Aucun framework de test de composants** (jest/vitest/testing-library
  absent du projet, jamais ajouté — règle "aucune nouvelle dépendance").
  La validation repose sur `tsc --noEmit`, `vite build`, des tests
  ciblés `node:assert`/`tsx` sur la logique pure (mapping, formatage,
  traduction d'erreurs), et une recette Staging manuelle documentée
  (`docs/mvp-acceptance-checklist.md`).
- **Mobile complet hors périmètre** (comme spécifié dès le Sprint 7) :
  le MVP cible desktop/laptop/tablette ; en dessous de la largeur
  tablette portrait, l'application reste consultable (aucun crash, la
  table de liste défile horizontalement) mais n'est pas optimisée.

## Observations Sprint 8 (Phase 12, à trancher par l'équipe produit)

- **`VITE_FEATURE_OPPORTUNITIES_ENABLED` est un flag orphelin** : défini
  dans `src/lib/featureFlags.ts` et documenté dans `.env.example` depuis
  le Sprint 0/1 pour gater l'affichage du module Opportunités tant qu'il
  n'était pas prêt, mais **aucun composant ne le consulte
  actuellement** (`Layout.tsx`, `App.tsx` et les pages du module ne
  l'importent jamais) — vérifié par recherche exhaustive dans `src/`.
  Concrètement, le module Opportunités est aujourd'hui **toujours
  visible** pour tout utilisateur authentifié, indépendamment de la
  valeur de ce flag. Cela reste sûr (protégé par `ProtectedRoute` et par
  la RLS existante), mais si l'intention était de pouvoir désactiver le
  module en un clic avant la recette utilisateur, ce flag devra être
  câblé explicitement (non fait dans ce sprint : décision produit, pas
  une correction de bug).
- **Redirection SPA Netlify déjà correcte** : `netlify.toml` contient
  déjà la règle `/* -> /index.html (200)` nécessaire pour qu'une
  actualisation ou une navigation directe sur
  `/dashboard/opportunites/:id` fonctionne sans 404 — vérifié, aucune
  modification nécessaire.
- **Garde-fou d'isolation d'environnement déjà en place**
  (`src/lib/env.ts`, `assertEnvironmentIsolation`) : empêche un build
  déclaré `production` de démarrer s'il pointe vers un projet Supabase
  non-production, et inversement — vérifié, aucune modification
  nécessaire, aucun secret `service_role` présent côté client.

## Sprint 8 — limitations volontairement non traitées

- **Aucune notification, rappel ou calendrier** : hors périmètre
  explicite du Sprint 8 (comme des sprints précédents).
- **Aucun export ni intégration CRM externe** : hors périmètre.
- **Aucune internationalisation** : l'interface est en français
  uniquement, comme le reste du produit.

## Sprint 9 — limitations et décisions documentées

- **`/dashboard` (alertes, Sprint 0) volontairement inchangée** : le
  cockpit est une page séparée (`/dashboard/cockpit`), pas un
  remplacement — décision documentée dans
  `docs/dashboard-architecture.md` §8 (page existante activement
  utilisée, y compris par des liens d'email d'assignation d'alerte).
- **Score de priorité et actions requises = règles simples, pas une
  optimisation avancée** : le score ne prend volontairement en compte
  que confiance, budget, signaux et récence (colonnes déjà existantes) —
  aucune pondération apprise, aucune notion de secteur/géographie/valeur
  historique du client, pour rester strictement déterministe et
  explicable (règle absolue du sprint).
- **`IN_PROGRESS` (valeur héritée hors cycle de vie Sprint 6) exclu de
  toutes les vues du cockpit** (pipeline, priorités, actions, synthèse)
  — même traitement que les statuts fermés, décision documentée dans
  `dashboard.helpers.ts`.
- **Seuil de "staleness" unique (30 jours), non configurable** : un seul
  seuil pour toutes les opportunités/tous les utilisateurs — pas de
  seuil par secteur ou par utilisateur dans ce MVP.
- **Aucune notion IA implémentée** : `InsightSource` (`'deterministic' |
  'ai'`) est une abstraction de préparation pour le Sprint 10
  uniquement — aucun appel réseau, aucune dépendance, aucune
  table/colonne IA ajoutée dans ce sprint.
- **Résolution de nom d'utilisateur toujours limitée par la RLS
  `profiles`** (Sprint 6, inchangée) : le cockpit n'en a volontairement
  pas besoin (aucune section n'affiche le nom d'un autre utilisateur).
