# Sprint 10.1 — Phase 6 : recette cockpit post-correctif

Effectuée sur Staging, après application de la migration
`sprint10_1_rls_tenant_isolation`, via un navigateur headless (Chromium)
piloté par Playwright — recette visuelle réelle du cockpit, pas seulement
des requêtes SQL directes (celles-ci font l'objet de la Phase 5).

Compte de test utilisé pour les rôles "membre" : `user.staging@example.com`,
son `entreprise_id` a été basculé successivement entre Cetim et Ekium
(compte fictif Staging unique disponible pour le rôle membre), puis remis à
sa valeur d'origine (`SPRINT8-DEMO Entreprise Cliente`) à la fin de la
recette. Aucune donnée réelle du batch Sprint 10 n'a été modifiée par ces
bascules (uniquement `veille.profiles.entreprise_id`, un attribut de compte
de test).

## 1. Connexion administrateur

- Compte : `admin.staging@example.com`
- Page `/dashboard/opportunites`
- **Total observé : 49 opportunités** (identique à avant le correctif —
  l'administrateur garde bien sa visibilité globale).

## 2. Connexion utilisateur Cetim

- Compte : `user.staging@example.com`, `entreprise_id` = Cetim
- Page `/dashboard/opportunites` : liste affichée sans pagination (moins
  d'une page de résultats), titres observés : DVF Clamart, DVF Val-de-Reuil,
  DVF Saint-Ouen-sur-Seine, "Plan Électrifions la France", "FIM —
  Rencontres nationales…", "France 2030 — Appels à Projets Industrie",
  "Aperam Stainless France — Gueugnon (71)" — **exactement les 7
  opportunités Cetim connues**, aucune de plus.
- Recherche explicite de titres appartenant uniquement à Ekium ou Etamine
  dans le corps de la page (`Thales`, `MBDA`, `NOVACARB`) : **absents**.

## 3. Accès direct par URL à une opportunité étrangère (Cetim → Ekium)

- URL testée : `/dashboard/opportunites/2c55a39f-6358-45c8-ac40-ceb65138faa3`
  (opportunité réelle "Thales — Expansion roquettes laser-guidées à Herstal",
  appartenant à Ekium).
- Résultat affiché à l'utilisateur Cetim : **« Opportunité introuvable — Ce
  dossier n'existe pas ou plus. »**
- Confirme le comportement attendu : la RLS renvoie zéro ligne, et le
  frontend traite cela comme une absence de dossier (comportement sûr — ne
  révèle ni l'existence ni le contenu de l'opportunité Ekium).

## 4. Connexion utilisateur Ekium

- Compte : `user.staging@example.com`, `entreprise_id` = Ekium.
- Recherche du titre "FIM — Rencontres nationales…" (propre à Cetim) dans la
  page `/dashboard/opportunites` : **absent**, confirmant l'isolation
  également côté Ekium au niveau de la liste.
- La tentative d'accès direct à l'URL d'une opportunité Cetim a été
  redirigée vers `/onboarding` plutôt que d'afficher "opportunité
  introuvable" — **cause identifiée et non liée à la sécurité** : l'entreprise
  Ekium a `onboarding_complete = false` (import legacy Sprint 10, jamais
  onboardée via le parcours applicatif), ce qui déclenche la garde
  `ProtectedRoute`/`OnboardingPage` avant même d'atteindre la page
  d'opportunité. La preuve d'isolation RLS pour Ekium a donc été apportée de
  façon concluante par les tests directs Supabase de la Phase 5 (round
  "ekium" : 3/3 tests passés, y compris l'absence totale d'opportunités
  Cetim/Etamine dans le jeu de résultats) plutôt que par cette étape UI —
  limite documentée, pas un échec de la recette.

## Conclusion

Les 4 étapes demandées ont été exécutées. Le défaut initial (utilisateur
Cetim voyant les 49 opportunités) est confirmé résolu : un utilisateur Cetim
voit exactement 7 opportunités (les siennes), un accès direct par UUID à une
opportunité Ekium échoue proprement, et l'administrateur conserve sa
visibilité totale (49).
