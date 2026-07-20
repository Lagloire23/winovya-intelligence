# Sprint 11C — Refonte de la page détail « Dossier opportunité »

Branche : `feature/sprint-11c-opportunity-dossier-ui` (base : `staging` @ `0c5e63d`).

## 1. Audit préalable

| Élément | État actuel (avant Sprint 11C) | Transformation proposée | Risque |
|---|---|---|---|
| Bloc "Alertes liées" | Panneau React dédié (`AlertesLieesPanel`), liste plate, sans lien vers les preuves | Fusionné dans un fil unique `SignauxEtAlertesPanel`, trié chronologiquement | Faible — pure recomposition de données déjà lues |
| Bloc "Alertes écartées" | Panneau séparé (`AlertesEcarteesPanel`, Sprint 11B) | Intégré au même fil, filtrable (`Toutes / Actives / Écartées`), jamais compté dans les indicateurs actifs | Faible — logique de retrait/réintégration de Sprint 11B réutilisée telle quelle |
| Bloc "Preuves" | Panneau séparé (`PreuvesPanel`), liste plate liée à `opportunite_id` uniquement | Rattachement direct à l'alerte concernée (nouvelle colonne `alerte_id`), affichage imbriqué sous chaque signal ; section résiduelle "Preuves non rattachées" pour les preuves historiques sans `alerte_id` | Moyen — nécessite une migration additive (voir §Migration) ; aucune preuve existante ré-associée automatiquement (32/32 restent `NULL`, jamais une association fabriquée) |
| Bloc "Chronologie" | Panneau séparé (`ChronologiePanel`), fusion alertes+preuves+décideurs, redondant avec les deux blocs précédents | Supprimé de la page (le nouveau fil de signaux couvre déjà l'essentiel) ; le service `getChronologie` reste disponible pour d'autres consommateurs (docs API) | Faible |
| Rôle de corrélation (Sprint 11A) | Affiché dans `AlertesLieesPanel` uniquement pour les alertes actives | Affiché pour actives ET écartées (`roleCorrelationAvant` réutilisé), avec justification (`raisonCorrelation`) quand disponible | Faible |
| Analyse IA | Résumé générique unique (`resumeMetier`) | Nouveau composant dédié `AnalyseMetierPanel`, 7 axes avec étiquette Observé/Déduit/Non disponible ; seuls 2 axes ont une donnée serveur réelle aujourd'hui (résumé, raisons) | Moyen — 5 axes demandés par le brief (besoin probable, offres/compétences, facteurs favorables distincts, prochaine action) n'ont aucune donnée serveur : affichés "Non disponible", jamais inventés |
| Recalcul après retrait/réintégration | Non automatique (déjà hors-scope, confirmé Sprint 11B) | Inchangé — explicitement reporté au Sprint 11D | Aucun (hors périmètre assumé) |
| Informations commerciales (décideurs, notes, statut, assignation) | Dispersées entre l'en-tête et un bloc latéral | Regroupées dans une zone D dédiée, composants inchangés (`DecideursPanel`, `NotesPanel`, `ActivityTimeline`, `StatusControl`, `AssignmentControl`) | Aucun — non-régression testée |

Aucun blocage structurel majeur identifié : implémentation réalisée sans attendre, conformément à l'instruction du brief.

## 2. Structure UX retenue (4 zones)

- **A — En-tête** : titre, entité, localisation, statut, niveau de confiance, phase, budget, enrichissement, assignation, date du premier ET du dernier signal (le premier signal était absent de l'ancien en-tête).
- **B — Analyse métier IA** (`AnalyseMetierPanel`) : synthèse, pourquoi/confiance expliquée (fusionnés en une seule ligne pour éviter la duplication des `raisons[]`), besoin probable (non disponible), offres/compétences (non disponible), facteurs favorables (non disponible, renvoie vers la ligne "pourquoi"), incertitudes (déduites du statut d'enrichissement), prochaine action recommandée (non disponible).
- **C — Fil chronologique des signaux** (`SignauxEtAlertesPanel`) : remplace Alertes liées + Alertes écartées + Preuves + Chronologie. Un seul flux trié par date de détection (récent → ancien, cohérent avec le tri déjà utilisé ailleurs dans le produit), filtrable Toutes/Actives/Écartées. Par entrée : date, titre, source, résumé, rôle de corrélation + justification, documents/preuves rattachés, lien source, état actif/écarté, motif de retrait si écartée, actions retrait/réintégration si `isAdmin`.
- **D — Informations commerciales** : décideurs, notes internes, statut commercial (`StatusControl`), assignation (`AssignmentControl`), historique des actions (`ActivityTimeline`).

## 3. Fichiers modifiés / ajoutés

Backend :
- `supabase/migrations/20260718174144_sprint11c_preuve_alerte_link.sql` (nouveau) — colonne additive nullable `alerte_id` sur `veille.opportunite_preuves` + index. Appliquée sur Staging via MCP.
- `src/lib/opportunities/query/OpportuniteQueryRepository.ts` — `RawPreuveRow.alerteId`, `fetchPreuves` étendu ; `RawAlerteEcarteeRow` étendu (`datePublication`, `referenceOfficielle`, `lienSourceUrl`, `resume`), `fetchAlertesEcartees` étendu en conséquence.
- `src/lib/opportunities/query/types.ts` — `PreuveDto.alerteId`, `AlerteEcarteeDto` étendu, nouveaux `SignalTimelineEntryDto` / `SignalTimelineResultDto`.
- `src/lib/opportunities/query/OpportuniteQueryService.ts` — `mapPreuveDto`/`mapAlerteEcarteeDto` mis à jour, nouvelle méthode `getSignauxTimeline`.

Frontend :
- `src/components/opportunites/AnalyseMetierPanel.tsx` (nouveau) — zone B.
- `src/components/opportunites/DossierPanels.tsx` (réécriture) — suppression de `AlertesLieesPanel`, `AlertesEcarteesPanel`, `PreuvesPanel`, `ChronologiePanel` ; ajout de `SignauxEtAlertesPanel` (zone C). `DecideursPanel` inchangé.
- `src/pages/OpportuniteDetailPage.tsx` (réécriture) — 4 zones, actions interactives déplacées en zone D.

Tests :
- `scripts/sprint11c-dossier-ui-tests.ts` (nouveau).

Docs :
- `docs/sprint-11c-opportunity-dossier-ui.md` (ce document).

## 4. Composants supprimés

`AlertesLieesPanel`, `AlertesEcarteesPanel`, `PreuvesPanel`, `ChronologiePanel` (tous dans `DossierPanels.tsx`). Confirmé par grep : plus aucune référence dans `src/`.

**Décision conservée** : les méthodes de service `getPreuves` / `getChronologie` / le type `ChronologieEntryDto` restent en place dans `OpportuniteQueryService`/`types.ts` — ils sont documentés (`docs/opportunity-query-api.md`) comme une API générale réutilisable au-delà de cette seule page (dashboard, exports, intégrations CRM), et testés indépendamment par `scripts/sprint5-query-tests.ts`. Le mandat de suppression du Sprint 11C porte sur les panneaux React de cette page, pas sur l'API de service sous-jacente.

## 5. Changements de requêtes et DTO

- `getSignauxTimeline(opportuniteId)` : composition pure de 3 lectures déjà existantes (`fetchAlertesLiees`, `fetchAlertesEcartees`, `fetchPreuves`), exécutées en parallèle (`Promise.all`, aucune requête N+1 ajoutée). Aucune nouvelle règle métier : le rôle de corrélation (Sprint 11A) et l'état actif/écarté (Sprint 11B) sont recopiés tels quels, jamais recalculés.
- Les preuves sont regroupées par `alerteId` ; celles sans rattachement (`alerteId: null`) sont renvoyées à part dans `preuvesNonRattachees`, jamais associées à une alerte au hasard.
- Tri par défaut : `dateDetection` décroissante (le plus récent en premier).

## 6. Tests — `scripts/sprint11c-dossier-ui-tests.ts` (19/19 passés)

Pures (node:assert/strict, double de test du repository, aucun accès réseau) :
- `incertitudesMessage` pour les 4 statuts d'enrichissement (`ready`/`partial`/`pending`/`failed`).
- `getSignauxTimeline` : alerte unique sans preuve ; plusieurs alertes triées (récent→ancien) ; propagation du rôle de corrélation ; alerte sans rôle (donnée historique) ; preuves imbriquées sous l'alerte concernée + `preuvesNonRattachees` pour une preuve sans `alerte_id` ; alerte écartée (motif, date, rôle avant retrait) ; mélange actives+écartées sans doublon ; opportunité sans aucune alerte (fil vide, pas d'erreur).
- Non-régression du mapping `mapAlerteDto`/`mapAlerteEcarteeDto`/`mapPreuveDto`.

Structurelles (lecture de fichiers source, pas de framework de rendu React disponible dans ce dépôt) :
- Suppression effective de `PreuvesPanel`/`ChronologiePanel` (plus aucun export) et présence de `SignauxEtAlertesPanel`/`DecideursPanel`.
- `OpportuniteDetailPage.tsx` ne référence plus les 4 anciens panneaux et utilise bien `AnalyseMetierPanel`/`SignauxEtAlertesPanel`.
- Non-régression : `DecideursPanel`, `NotesPanel`, `ActivityTimeline` toujours rendus.
- Autorisation : les boutons "Retirer"/"Réintégrer" restent situés après la garde `{isAdmin && (...)}`.
- Aucune donnée inventée : `AnalyseMetierPanel` affiche bien "Non disponible" pour les axes non couverts côté serveur et ne fait aucun appel réseau direct.

Note : comme lors des sprints précédents, ce dépôt ne dispose d'aucun framework de rendu (pas de RTL/Jest/Vitest) — les interactions UI de clic (retrait/réintégration) restent couvertes au niveau service par `scripts/sprint11b-alerte-retrait-tests.ts`, inchangé. **Les tests réseau applicatifs avec une session utilisateur réelle (RLS, `alerte_id` en conditions réelles) n'ont pas pu être exécutés dans ce sandbox**, faute de `SUPABASE_URL`/`SUPABASE_ANON_KEY`/mot de passe de test disponibles — même limitation que tous les sprints précédents.

## 7. Résultats type-check et build

- `npx tsc --noEmit` : clean (aucune sortie).
- `npx tsc -b` : clean.
- `npx vite build` : succès, `dist/assets/index-B0Z_JkpW.js` 615.66 kB (gzip 164.90 kB) — avertissement de taille de chunk préexistant, non bloquant.

## 8. Rendu final (description)

La page détail affiche désormais, dans l'ordre : un en-tête compact avec les deux dates de signal ; un bloc "Analyse métier" à étiquettes Observé/Déduit/Non disponible (jamais de texte généré côté frontend) ; un fil unique de signaux trié chronologiquement avec filtre Actives/Écartées/Toutes, preuves imbriquées sous chaque alerte concernée et une section repliable "Preuves non rattachées" en bas du fil si applicable ; puis un bloc "Informations commerciales" regroupant décideurs, notes, statut et assignation interactifs, et l'historique d'activité.

## 9. Risques résiduels

- 5 des 8 axes d'analyse IA demandés par le brief (besoin probable, offres/compétences pertinentes, facteurs favorables distincts, prochaine action recommandée) n'ont aujourd'hui aucune donnée serveur : affichés "Non disponible" en toute transparence. Sprints 11D/14/15/16 devront les brancher.
- "Niveau de confiance de la corrélation" (distinct du rôle lui-même) n'existe pas comme champ séparé dans le schéma actuel — omis plutôt que fabriqué.
- Les preuves historiques (32 lignes) restent toutes `alerte_id = NULL` : elles apparaissent dans "Preuves non rattachées" jusqu'à un futur rattachement manuel ou un script de reclassement (hors périmètre de ce sprint).
- Tests réseau applicatifs (RLS, session utilisateur réelle) non exécutables dans ce sandbox — à rejouer manuellement sur Staging après merge, comme pour les sprints précédents.

## 10. SHA final

Commit à créer sur `feature/sprint-11c-opportunity-dossier-ui` (voir rapport de session pour le SHA exact après commit).

## 11. Prompt recommandé pour le Sprint 11D

```
Sprint 11D — Recalcul automatique après retrait/réintégration d'alerte

Contexte : Sprint 11C fusionné dans staging. Le fil unifié de signaux
(SignauxEtAlertesPanel, getSignauxTimeline) affiche déjà les alertes
actives et écartées, mais la consolidation métier (DossierEnrichmentService,
Sprint 4) n'est PAS automatiquement redéclenchée quand une alerte est
retirée ou réintégrée (Sprint 11B a posé la mécanique de retrait, mais
pas le recalcul).

Objectif : déclencher automatiquement consolidateDossier(opportuniteId)
après chaque retrait/réintégration, pour que resumeMetier, raisons,
niveauConfiance et statutEnrichissement reflètent immédiatement l'état
actif réel des alertes — sans recalcul manuel côté utilisateur.

Contraintes : ne pas dupliquer la logique de consolidation (Sprint 4,
inchangée) ; ne pas transformer ce recalcul en opération synchrone
bloquante si le volume grandit (évaluer une file d'attente si
nécessaire) ; couvrir par tests le cas où le recalcul échoue
partiellement (ne pas laisser le retrait/réintégration dans un état
incohérent) ; brancher ensuite les 5 axes "Non disponible" de
AnalyseMetierPanel (besoin probable, offres/compétences, facteurs
favorables distincts, prochaine action) un par un dans les sprints
suivants, chacun avec sa propre justification de donnée disponible
avant affichage.
```
