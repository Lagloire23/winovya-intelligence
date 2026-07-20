# Sprint 9 — Architecture du cockpit (`/dashboard/cockpit`)

## 1. Objectif

Transformer la page d'accueil post-connexion en un cockpit **déterministe**
et **adapté au rôle** :

- **Administrateur** : vue organisationnelle globale (toutes les
  opportunités, tous les utilisateurs).
- **Utilisateur standard** : vue personnelle centrée sur
  `assigned_to = utilisateur courant`.

Aucun appel IA/LLM dans ce sprint. "Intelligent" = règles simples,
transparentes et explicables, appliquées aux données déjà existantes
(statuts, dates, niveau de confiance, signaux, budget).

## 2. Audit préalable (Phase 1) — ce qui a rendu ce sprint possible sans migration

| Constat | Conséquence sur l'architecture |
|---|---|
| `veille.opportunite_dossier` (Sprint 4/5/8) expose déjà statut, confiance (+ rang numérique), budget, signaux, dates d'évolution, assignation | Une seule vue suffit comme source de lecture — aucune nouvelle vue ni RPC nécessaire. |
| `veille.opportunite_activity_log` (Sprint 6) est lisible par tout utilisateur authentifié (`using (true)`) et alimenté uniquement par des triggers `SECURITY DEFINER` | Le flux d'activité peut être lu directement, sans contournement de la RLS, aussi bien côté admin (non filtré) que côté utilisateur (filtré par `opportunite_id in (...)`). |
| `admin write opportunites` (Sprint 1, inchangée) restreint toute écriture aux admins ; `authenticated read opportunites` autorise la lecture à tous | La distinction admin/utilisateur du cockpit est une **convention produit côté lecture** ("mes opportunités" = filtre applicatif `assigned_to`), **pas** une restriction RLS — l'écriture réelle (changement de statut, assignation) reste, elle, strictement gouvernée par la RLS existante via `StatusControl`/`AssignmentControl` (Sprint 7/8), jamais réimplémentée ici. |
| `veille.profiles` ne permet de lire que sa propre ligne (sauf admin) | Le cockpit ne lit jamais `profiles` pour résoudre un nom d'utilisateur : il n'affiche que des identifiants déjà connus du contexte (l'utilisateur courant) ou des agrégats côté admin qui n'ont pas besoin d'un nom. |
| Aucun trigger ne met à jour `opportunites.updated_at` automatiquement (vérifié Sprint 5) | `derniere_evolution_metier_at` (déjà calculée par la vue) est la seule colonne fiable pour détecter l'absence d'évolution ("staleness") — réutilisée telle quelle, jamais recalculée autrement. |
| `IN_PROGRESS` est une valeur héritée hors cycle de vie Sprint 6 | Exclue de toutes les vues pipeline/priorités/actions (décision Sprint 9, documentée dans le code, `dashboard.helpers.ts`). |

Conclusion : **aucune migration SQL n'a été nécessaire pour ce sprint**.
Le module `src/lib/dashboard/` est une couche de lecture et d'agrégation
purement applicative au-dessus de vues/tables déjà existantes.

## 3. Architecture retenue

```
src/lib/dashboard/
  dashboard.types.ts        types transverses (période, rôle de confiance, InsightSource)
  dashboard.dto.ts          DTO publics (seule forme connue du Frontend)
  dashboard.errors.ts       adaptateur fin vers ../opportunities/errorMessages (aucune dup.)
  dashboard.helpers.ts      calculs purs (score, pipeline, distributions, synthèse...)
  dashboard.repository.ts   I/O pur (2 requêtes bornées max par appel)
  dashboard.service.ts      orchestration (repository injecté en `import type`)
  index.ts                  barrel + createDashboardService()
```

Même patron que les modules Sprint 5 (`query/`) et Sprint 6
(`commercial/`) : Repository (I/O) → Service (orchestration) → DTO
(contrat) → composants React (présentation uniquement).
`DashboardRepository` est importé en `import type` dans
`dashboard.service.ts`, jamais en import réel — ce qui permet de tester
tout le service sous `tsx` pur (sans `import.meta.env`) avec un faux
repository dupliqué par structure (voir
`scripts/sprint9-dashboard-tests.ts`).

## 4. Stratégie de requêtes (Phase 9) — Option B retenue

Deux options étaient possibles :

- **Option A** — vue/RPC d'agrégation SQL dédiée.
- **Option B** — lot de lignes borné + agrégation TypeScript.

**Option B a été retenue**, pour ces raisons documentées :

1. Les volumes réels (quelques dizaines à quelques centaines
   d'opportunités pour un MVP) rendent une agrégation TypeScript sur un
   lot borné largement suffisante en performance.
2. Elle ne nécessite **aucune migration** (règle "aucune règle métier
   redéfinie, tout additif" plus facile à respecter sans toucher au
   schéma).
3. Elle est **testable unitairement** sans base de données réelle (voir
   `dashboard.helpers.ts`), contrairement à une agrégation faite
   entièrement en SQL.

Requêtes effectivement exécutées, toutes bornées et documentées dans
`dashboard.repository.ts` :

| Cockpit | Requêtes | Détail |
|---|---|---|
| Admin | 2 | `fetchAllDossiers(limit=1000)` (tous statuts, triée par activité récente) + `fetchRecentActivity(limit=200)` |
| Utilisateur | 2 | `fetchDossiersForUser(userId, limit=500)` (`assigned_to = userId`) + `fetchRecentActivityForOpportunites(ids, limit=200)` |

Aucune requête n'est exécutée à l'intérieur d'une boucle (pas de N+1).
Le flux d'activité admin résout les titres d'opportunité à partir du
même lot déjà chargé (`fetchAllDossiers`), sans requête supplémentaire.

## 5. Score de priorité déterministe (Phase 4/5)

Voir `dashboard.helpers.ts:computePriorityScore` pour l'implémentation
exacte. Règles, toutes dérivées de colonnes existantes :

- Confiance (rang 0-3, déjà calculé par la vue Sprint 5/8) : jusqu'à 60 pts.
- Budget identifié connu : +15 pts.
- Signaux multiples (`nombre_signaux >= 3` : +10, `== 2` : +5).
- Signal récent (`date_dernier_signal` ≤ 7 jours : +10, ≤ 30 jours : +5).
- Score plafonné à 100. Les statuts fermés (`WON`/`LOST`/`ARCHIVED`) et
  `IN_PROGRESS` sont exclus par construction (`isActionableStatus`).

Les raisons affichées (`reasons`) sont des libellés humains directement
dérivés des règles ci-dessus — jamais qualifiées "IA" (voir §7).

## 6. "Actions requises" (vue calculée, jamais persistée)

Deux règles, toutes deux dérivées de colonnes existantes uniquement :

1. Opportunité `NEW` non assignée (`assigned_to is null`) → besoin de
   triage.
2. Opportunité active sans évolution depuis plus de 30 jours
   (`derniere_evolution_metier_at`) → besoin de relance ("obsolète").

Une même opportunité n'apparaît qu'une fois (règle 1 prioritaire sur la
règle 2). Cette vue n'est **jamais écrite en base** : recalculée à
chaque chargement du cockpit.

## 7. Point d'extension Sprint 10 (Phase 15 — préparation, pas d'implémentation)

`InsightSource = 'deterministic' | 'ai'` (`dashboard.types.ts`) marque la
provenance d'un texte ou d'un score déjà calculé. Dans ce sprint,
**100% des valeurs produites sont `'deterministic'`** — aucun appel
réseau, aucune dépendance IA, aucune table/colonne IA ajoutée. Le point
d'extension concret est `buildPortfolioSynthesis` /
`PortfolioSynthesisDto` (`dashboard.helpers.ts`/`dashboard.dto.ts`) : un
futur générateur IA (Sprint 10) pourrait produire le même DTO
(`source: 'ai'`) sans qu'aucun composant React n'ait à changer.

### KPI temporel "Opportunités détectées" (Sprint 9.1, Phase 3/4)

Le KPI initialement libellé "Nouvelles" (clé interne `nouvelles_periode`,
inchangée) comptait déjà, dès le Sprint 9, **toutes** les opportunités
créées sur la période sélectionnée, tous statuts confondus (y compris
`WON`/`LOST`/`ARCHIVED`/`IN_PROGRESS`) — un calcul techniquement correct
mais un libellé ambigu. Décision Sprint 9.1 : le calcul
(`nouvellesSurPeriode`, `dashboard.service.ts`) reste strictement
inchangé (il représente honnêtement "toutes les opportunités créées"),
seul le libellé et le sous-texte changent pour l'expliciter :

- Libellé : **"Opportunités détectées"**.
- Sous-texte : **"Créées sur les {période} derniers jours, tous statuts
  confondus"** (période = 7, 30 ou 90 selon le sélecteur).

La synthèse déterministe du portefeuille (`buildPortfolioSynthesis`) ne
reprend, avant comme après ce sprint, aucune formulation "nouvelles
opportunités" — elle ne référence que total actif / confiance / budget /
non-assignées / obsolescence. Aucune incohérence à corriger de ce
côté ; ce constat est fixé par un test dédié
(`scripts/sprint9-1-cockpit-ux-tests.ts`).

## 8. Routes et navigation (Phase 6/7)

- **Nouvelle route** `/dashboard/cockpit` → `CockpitPage.tsx`.
- **`/dashboard` (alertes, Sprint 0) reste totalement inchangée** :
  recherche, filtres, tri et le deep-link `?alert=<id>` (utilisé par les
  emails d'assignation d'alerte, Sprint 0) continuent de fonctionner à
  l'identique. Décision documentée : ne jamais remplacer une page
  existante activement utilisée par une fonctionnalité réelle et déjà
  intégrée (emails sortants).
- **Destination par défaut après connexion** : le wildcard (`App.tsx`),
  la redirection post-onboarding et le repli `AdminRoute` non-admin
  (`ProtectedRoute.tsx`), la redirection "session déjà active"
  (`LoginPage.tsx`) et la redirection post-sauvegarde onboarding
  (`OnboardingPage.tsx`) pointent tous désormais vers
  `/dashboard/cockpit`.
- **Navigation minimale** : nouvelle entrée "Tableau de bord" en tête de
  la barre latérale (`AppSidebar.tsx`), "Opportunités" déjà existante
  (Sprint 7) inchangée, "Accueil" (alertes) conservée séparément.
- **Navigation responsive du cockpit (Sprint 9.1, Phase 2)** : sous le
  point de rupture Tailwind `lg` (1024 px), la sidebar desktop
  (`Layout.tsx`, bloc `hidden lg:block`) est masquée. `CockpitPage.tsx`
  rend désormais, en tête de page, un bloc de repli `lg:hidden`
  contenant `AppSidebar` — exactement le même patron déjà utilisé par
  `DashboardPage.tsx` depuis le Sprint 0, aucun composant ni
  bibliothèque de navigation nouvelle. Les deux blocs (`hidden
  lg:block` / `lg:hidden`) sont mutuellement exclusifs par construction
  CSS : jamais affichés en même temps, quel que soit le rôle
  (administrateur ou utilisateur) ou la route (`/dashboard/cockpit`,
  retour navigateur, rechargement direct).

## 9. Détermination du rôle (Phase 8 — règle absolue)

`DashboardService.getDashboard(actor: TrustedActor, period)` détermine
le cockpit à afficher **uniquement** à partir de `actor.role`. `actor`
est construit dans `CockpitPage.tsx` à partir de `useAuth().profile`
(chargé après une connexion Supabase réelle, protégé par la RLS
`read own profile` / `admin manage profiles`, Sprint 6, inchangée). Ce
rôle **ne peut jamais** provenir d'un paramètre d'URL, d'un
`localStorage`, ou de toute autre source non authentifiée — aucune
route ni composant de ce sprint n'accepte un tel paramètre.

## 10. Ce qui n'a pas changé

Moteur de corrélation, `process_alert_opportunity`, pipeline
automatique (Sprint 3), calculateurs d'enrichissement (Sprint 4), graphe
de transitions du cycle de vie commercial (Sprint 6), triggers de
journalisation (Sprint 6), RLS existante (Sprint 1/6) : **aucune ligne
modifiée**. Aucune migration SQL n'a été appliquée par ce sprint (seule
une extension de données de démonstration, voir
`docs/dashboard-demo-guide.md`).
