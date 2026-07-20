# Sprint 9 — Guide de démonstration du cockpit (Staging uniquement)

**Aucun mot de passe réel n'est jamais inscrit dans ce document** (règle
absolue de ce sprint). Les deux comptes fictifs utilisés existent depuis
le Sprint 0B et n'ont jamais eu de mot de passe défini/communiqué dans
Git. Pour obtenir un accès de test :

1. Ouvrir Supabase Studio (projet Staging `gcitqpgucepgroermzti`) →
   Authentication → Users.
2. Sélectionner le compte concerné (`admin.staging@example.com` ou
   `user.staging@example.com`) → "Send password recovery" (ou définir un
   mot de passe temporaire directement dans l'interface Supabase, jamais
   dans un fichier versionné).
3. Se connecter sur l'environnement Staging (`https://<site-staging>.netlify.app`),
   jamais sur Production.

Alternative sans navigateur (déjà utilisée aux Sprints 7/8) : simulation
SQL de session authentifiée via `SET LOCAL role authenticated; SET LOCAL
request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`, pour
valider les requêtes exactement telles qu'exécutées par le Frontend,
sans jamais nécessiter de mot de passe.

## Jeu de données

`SPRINT8-DEMO` (Sprint 8) + son extension `SPRINT9-DEMO` (Sprint 9,
Phase 16, voir `scripts/sprint9-dashboard-demo-seed.sql`) — 14
opportunités fictives au total, préfixe d'id fixe
`a0000000-8888-4000-8000-%`, laissées intentionnellement sur Staging
comme fixture de recette persistante (comme au Sprint 8).

## Scénario 1 — Cockpit administrateur

**Compte** : `admin.staging@example.com` (rôle `admin`).

1. Se connecter → redirection automatique vers `/dashboard/cockpit`
   (destination par défaut post-connexion, Phase 6/7).
2. Vérifier les 6 cartes KPI : total actives (13, `IN_PROGRESS`/fermés
   exclus), **"Opportunités détectées"** (Sprint 9.1 — libellé
   explicite, sous-texte "Créées sur les X derniers jours, tous statuts
   confondus"), confiance élevée, non assignées, avec budget identifié,
   gagnées sur la période.
3. Vérifier le pipeline : 7 statuts du cycle de vie affichés (y compris
   à 0), `IN_PROGRESS` absent.
4. Vérifier "Opportunités prioritaires" (max 5) : la première doit être
   `SPRINT9-DEMO — Rénovation thermique lycée régional` (confiance
   élevée + budget + signal récent), avec ses raisons affichées en clair
   (jamais qualifiées "IA").
5. Vérifier "Actions requises" (max 5) : doit contenir au moins une
   opportunité `NEW` non assignée (ex. `SPRINT8-DEMO — Rénovation
   énergétique groupe scolaire`) et l'opportunité obsolète
   `SPRINT9-DEMO — Proposition réhabilitation gare routière` ("aucune
   activité depuis ~45 jours").
6. Vérifier "Activité récente" (max 10) : événements les plus récents en
   tête, aucun contenu de note visible même pour les événements
   `note_added`/`note_updated`.
7. Vérifier les 2 répartitions (statut, confiance) : "Non renseigné"
   apparaît pour les opportunités sans confiance renseignée.
8. Vérifier le bloc de synthèse : texte cohérent avec les compteurs
   ci-dessus, mention "calculée automatiquement à partir de règles
   déterministes" visible.
9. Changer la période (7 / 30 / 90 jours) : les compteurs "Opportunités
   détectées" et "Gagnées" se recalculent (le sous-texte de la première
   mentionne toujours la période exacte sélectionnée), le reste
   (pipeline, priorités, actions) reste stable (ces vues ne dépendent
   pas de la période).
10. Vérifier la navigation de repli (Sprint 9.1, Phase 2) : réduire la
    largeur de la fenêtre sous 1024 px (point de rupture `lg`) — un
    bloc de navigation (mêmes entrées : "Tableau de bord", "Accueil",
    "Opportunités") doit apparaître en tête du cockpit, permettant de
    naviguer puis de revenir sur `/dashboard/cockpit` sans jamais deux
    navigations visibles simultanément.

## Scénario 2 — Cockpit utilisateur

**Compte** : `user.staging@example.com` (rôle `member`).

1. Se connecter → redirection automatique vers `/dashboard/cockpit`.
2. Vérifier "Mes opportunités" : exactement 3 dossiers
   (`SPRINT9-DEMO — Rénovation thermique lycée régional` / QUALIFYING,
   `— Proposition réhabilitation gare routière` / PROPOSAL,
   `— Signal récent extension crèche municipale` / NEW) — jamais un nom
   ou email d'un autre utilisateur nulle part sur l'écran.
3. Vérifier "Mes priorités" : le dossier "Rénovation thermique lycée
   régional" apparaît en tête avec ses raisons.
4. Vérifier "Mes actions attendues" : le dossier "Proposition
   réhabilitation gare routière" apparaît ("aucune activité depuis ~45
   jours").
5. Vérifier "Activité de mes dossiers" : au moins 3 événements
   (création des 3 dossiers), horodatage relatif cohérent.
6. Vérifier "Mon pipeline personnel" : 3 statuts distincts représentés
   (NEW, QUALIFYING, PROPOSAL) parmi les 7 possibles.
7. Ouvrir un dossier depuis n'importe quelle section du cockpit (clic) →
   doit rediriger vers `/dashboard/opportunites/:id` (page existante,
   Sprint 7/8, inchangée) ; vérifier que les contrôles d'action
   (statut/assignation) y respectent toujours les droits réels (lecture
   seule pour un non-admin, StatusControl Sprint 7/8, inchangé).
8. Vérifier la navigation de repli (Sprint 9.1, Phase 2) sous 1024 px :
   mêmes entrées que l'admin, aucune action administrateur visible
   (assignation, changement de statut interactif), KPI personnel
   ("Mes opportunités actives") inchangé.

## Cas d'erreur à vérifier

- Couper temporairement l'accès réseau (ou simuler une erreur) pendant
  le chargement du cockpit : le message d'erreur affiché doit être
  générique (jamais un message Postgres/RLS brut, voir
  `dashboard.errors.ts` qui réutilise `translateError`, Sprint 8), avec
  un bouton "Réessayer" fonctionnel.
- Console navigateur : aucune erreur JavaScript ne doit apparaître
  pendant le chargement normal des deux scénarios ci-dessus.

## Nettoyage

Le jeu `SPRINT8-DEMO` + son extension `SPRINT9-DEMO` partage le même
préfixe d'id (`a0000000-8888-4000-8000-%`) : `scripts/sprint8-demo-cleanup.sql`
supprime l'ensemble en une seule exécution si un nettoyage complet est
un jour souhaité. Aucun nouveau script de nettoyage n'a été créé pour ce
sprint.
