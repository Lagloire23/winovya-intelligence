# Checklist de recette MVP — Module Opportunités

Document opérationnel destiné à toute personne (interne WINOVYA ou
testeur externe) qui doit valider le MVP sur Staging avant recette
utilisateur. Ne couvre que le module Opportunités (Sprints 1 à 8).

## 1. Prérequis

- Accès à l'environnement Staging : `https://<site-staging>.netlify.app`
  (Supabase Staging `gcitqpgucepgroermzti`, jamais Production
  `mhsbwabrvcqnxnwamvwc`).
- Un compte de test avec le rôle `admin` et un compte avec le rôle
  `member` (voir §2).
- Le jeu de données de démonstration `SPRINT8-DEMO` doit être présent
  (voir §9, "Procédure de création des données de démonstration") :
  11 opportunités fictives couvrant tous les cas ci-dessous, préfixées
  `SPRINT8-DEMO —` dans leur titre.

## 2. Profils de test

- **Admin** : `admin.staging@example.com` (profil fictif préexistant
  depuis le Sprint 0B). Seul un admin peut changer un statut ou
  assigner/désassigner une opportunité (policy RLS `admin write
  opportunites`, Sprint 1, inchangée).
- **Membre** : `user.staging@example.com` (profil fictif préexistant
  depuis le Sprint 0B). Peut consulter toutes les opportunités, créer
  ses propres notes, modifier/supprimer logiquement uniquement ses
  propres notes.

Les mots de passe de ces comptes fictifs ne sont pas gérés par ce
document ; demander l'accès à la personne responsable de
l'environnement Staging.

## 3. Scénario principal (bout en bout)

1. Se connecter avec le compte admin.
2. Ouvrir "Opportunités" dans le menu.
3. Vérifier que la liste des opportunités `SPRINT8-DEMO` s'affiche avec
   badges (statut, confiance, enrichissement), budget, compteurs
   (preuves/décideurs), date du dernier signal, colonne assignation.
4. Utiliser la recherche libre (ex. "piscine") : la liste se filtre
   après un court délai (recherche instantanée débouncée).
5. Appliquer un filtre de statut, un filtre de confiance, un filtre de
   phase : vérifier qu'ils se combinent (ET logique).
6. Changer le tri (ex. "Budget identifié", ordre décroissant).
7. Ouvrir le dossier "SPRINT8-DEMO — Réhabilitation piscine
   municipale" : vérifier résumé métier, raisons ("pourquoi cette
   opportunité"), budget, 2 preuves, 1 décideur affichés.
8. Changer le statut de ce dossier (transition valide proposée
   uniquement) : vérifier que le badge de statut et le journal
   d'activité se mettent à jour immédiatement, sans recharger la page.
9. Assigner puis désassigner ce dossier : vérifier la mise à jour
   immédiate de l'encart Assignation et du journal.
10. Ajouter une note, la modifier, puis la supprimer (logiquement) :
    vérifier que le panneau Notes et le journal d'activité se mettent à
    jour après chaque action, sans recharger la page.
11. Revenir à la liste via "Retour aux opportunités".

## 4. Scénarios admin

- Changer le statut d'une opportunité non archivée : autorisé,
  transitions limitées au graphe du Sprint 6 (ex. NEW → QUALIFYING,
  jamais NEW → WON directement).
- Assigner une opportunité à n'importe quel utilisateur du sélecteur.
- Modifier ou supprimer la note d'un autre utilisateur (override admin).
- Ouvrir "SPRINT8-DEMO — Étude faisabilité médiathèque" (statut
  ARCHIVED) : les contrôles Statut/Assignation/Notes doivent être
  visuellement désactivés (opportunité archivée = non modifiable,
  règle Sprint 6 généralisée à toute écriture).

## 5. Scénarios membre

- Ouvrir un dossier non archivé : le statut s'affiche en lecture seule
  avec la mention "Seul un administrateur peut changer le statut."
  (aucun sélecteur interactif).
- Assignation : lecture seule, avec la mention "Seul un administrateur
  peut réassigner." si déjà assignée à un tiers.
- Créer une note : autorisé. Modifier/supprimer sa propre note :
  autorisé. Aucun bouton modifier/supprimer visible sur la note d'un
  autre utilisateur.

## 6. Cas d'erreur

- Ouvrir `/dashboard/opportunites/00000000-0000-0000-0000-000000000000`
  (UUID inexistant) : la page affiche "Opportunité introuvable" avec un
  bouton de retour à la liste — jamais d'écran blanc ni d'erreur brute.
- Couper temporairement la connexion réseau puis rafraîchir la liste :
  un message d'erreur clair s'affiche avec un bouton "Réessayer" (aucune
  page blanche, aucun détail technique affiché).
- Toute erreur métier (transition interdite, opportunité archivée, note
  introuvable) doit s'afficher en français, sans nom de table, sans SQL,
  sans UUID technique (voir `src/lib/opportunities/errorMessages.ts`).

## 7. Vérifications RLS (déjà prouvées au niveau base, à confirmer visuellement)

- Un membre ne peut pas changer de statut ni assigner (RLS `admin write
  opportunites`, Sprint 1) : les contrôles sont simplement masqués côté
  Frontend plutôt que de tenter une action systématiquement bloquée.
- Un membre ne peut modifier/supprimer que ses propres notes (RLS
  `opportunite_notes`, Sprint 6).
- Le journal d'activité n'est jamais modifiable depuis l'interface (RLS
  `opportunite_activity_log`, Sprint 6 : aucune policy d'écriture pour
  `authenticated`).

## 8. Vérifications responsive

- Desktop large (≥ 1440px) : liste et dossier confortables, deux
  colonnes de panneaux.
- Laptop (~1280px) : identique, aucune coupure.
- Tablette paysage (~1024px) : panneaux du dossier sur 2 colonnes
  (seuil `lg`), toolbar de filtres sur une ou deux lignes.
- Tablette portrait (~768-820px) : panneaux du dossier empilés sur 1
  colonne (sous le seuil `lg`), Statut/Assignation empilés sous le
  seuil `md`, table de la liste défile horizontalement
  (`overflow-x-auto`) sans casser la mise en page.
- Aucun débordement horizontal de la page elle-même à aucune de ces
  largeurs.

## 9. Procédure de création des données de démonstration

```bash
# Dans le SQL Editor du projet Supabase Staging (gcitqpgucepgroermzti)
# UNIQUEMENT — jamais sur mhsbwabrvcqnxnwamvwc :
```

Exécuter le contenu de `scripts/sprint8-demo-seed.sql`. Le script est
idempotent (UUID fixes, `on conflict ... do update`, delete+insert pour
les sous-ressources) : le relancer ne duplique jamais rien et
resynchronise les 11 opportunités `SPRINT8-DEMO` à l'état documenté.

## 10. Procédure de nettoyage

Exécuter le contenu de `scripts/sprint8-demo-cleanup.sql` (toujours sur
Staging). Supprime uniquement les lignes dont l'id commence par
`a0000000-8888-4000-8000-` (entreprise, opportunités, décideur, alerte
et leurs sous-ressources) — jamais une donnée réelle. Vérifier après
coup :

```sql
select count(*) from veille.opportunites where id::text like 'a0000000-8888-4000-8000-%'; -- doit renvoyer 0
select count(*) from veille.entreprises where id::text like 'a0000000-8888-4000-8000-%'; -- doit renvoyer 0
```

## 11. Critères de validation

Le MVP est considéré prêt pour recette utilisateur si, sur
l'environnement Staging :

- le scénario principal (§3) se déroule sans erreur console et sans
  rechargement de page inutile ;
- les scénarios admin (§4) et membre (§5) se comportent exactement
  comme décrit ;
- tous les cas d'erreur (§6) affichent un message honnête, sans détail
  technique ;
- l'affichage reste correct sur les 4 largeurs listées en §8 ;
- `npx tsc --noEmit` et `npm run build` réussissent sans erreur.

## 12. Limitations connues

Voir `docs/mvp-known-limitations.md` pour le détail complet.

## 13. Sprint 9 — Cockpit & Dashboard Intelligent

Voir `docs/dashboard-architecture.md` (architecture, requêtes, règles de
scoring) et `docs/dashboard-demo-guide.md` (2 scénarios de recette
détaillés, admin + utilisateur, aucun mot de passe réel). Résumé des
critères de validation ajoutés par ce sprint :

- `/dashboard/cockpit` devient la destination par défaut après
  connexion ; `/dashboard` (alertes, Sprint 0) reste inchangée et
  fonctionnelle (recherche, filtres, deep-link `?alert=`).
- Le cockpit affiche un contenu strictement différent selon le rôle
  (organisationnel pour un admin, personnel — `assigned_to` — pour un
  membre), déterminé uniquement depuis le profil authentifié, jamais un
  paramètre client.
- Toutes les valeurs affichées (score de priorité, actions requises,
  synthèse) sont déterministes et explicables — aucun appel IA, aucune
  dépendance de graphiques ajoutée.
- Au plus 2 requêtes réseau par chargement de cockpit (voir
  `dashboard-architecture.md` §4), aucun N+1.
- Aucune migration SQL n'a été nécessaire pour ce sprint.
