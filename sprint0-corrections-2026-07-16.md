# Sprint 0 — Corrections et finalisation après audit

Réponse à ta demande de vérifications et corrections. Aucune action distante destructive n'a été effectuée. Le Sprint 1 n'a pas commencé.

---

## 1. Résultat de la vérification de la baseline

**Classement : `HIGH_CONFIDENCE`** (juste en dessous de `CONFIRMED` — il ne manque qu'une comparaison directe des hashs d'assets, techniquement impossible à faire depuis cette session, voir plus bas).

Preuves rassemblées, par ordre de force :

1. **Preuve directe de lien de déploiement** : le tout premier instantané Git de ce dépôt (avant nettoyage, voir section 6) contenait un fichier `.netlify/state.json` avec `"siteId": "bd7a3f79-e310-4fe4-9536-b05f9980f866"` — c'est-à-dire l'identifiant exact du site de production. Ce fichier est généré automatiquement par la CLI Netlify et prouve que ce dossier de travail précis a servi à déployer sur ce site précis.
2. **Corrélation temporelle très fine** : le fichier source modifié en dernier avant l'initialisation du dépôt Git est `src/components/AssignAlertModal.tsx`, modifié le 2026-07-15 à 10:55:37 UTC. Le déploiement actuellement live sur Netlify (`currentDeploy`) a été créé à 10:57:19 UTC — soit **102 secondes plus tard**, un délai parfaitement cohérent avec un cycle build + upload automatisé.
3. **Absence de changement de code entre le déploiement et le commit de baseline** : le commit de baseline a été créé le 2026-07-15 à 20:23:55 UTC, soit ~9h30 après le déploiement. Aucun fichier sous `src/` n'a de date de modification dans cet intervalle — les seules activités entre les deux ont été la rédaction de documents d'audit (fichiers `.md`), pas de modification de code.
4. **Contenu identique vérifié** : comparaison directe entre le dossier de travail actuel et le commit de baseline pour les deux fichiers les plus récemment modifiés (`AssignAlertModal.tsx`, `AppSidebar.tsx`) — **identiques, aucune différence**.
5. **Métadonnées de déploiement cohérentes** : le déploiement live est marqué `framework: "vite"`, `deploy_source: "api"` (upload direct, pas de build Netlify côté serveur), ce qui correspond exactement au mode de travail utilisé tout au long de cette session (build local, puis déploiement).

Ce qui manque pour passer à `CONFIRMED` : une comparaison octet-à-octet des noms de fichiers/hash d'assets réellement servis par `https://intelligence.winovya.com` (ex. `index-XXXX.js`) avec ceux produits par un rebuild local. Je n'ai pas pu l'obtenir : la lecture web (`web_fetch`) ne renvoie que les métadonnées de la page (titre, meta description), pas le HTML brut avec les balises `<script>` ; et l'extension Chrome n'est pas connectée dans cette session (`navigate` a échoué, pas de réponse de l'extension). Si tu veux fermer ce dernier point, je peux le faire via le navigateur si tu actives l'extension Claude in Chrome, ou tu peux toi-même faire un clic droit → "Afficher le code source" sur `intelligence.winovya.com` et me coller le nom du fichier `.js` chargé.

**Conclusion pratique : la baseline poussée sur `main` est fiable. Je l'ai donc traitée comme confirmée pour la suite (sections 5 et 6), conformément à ta consigne — elle n'est pas `UNCONFIRMED` ni `CONFLICTING`.**

## 2. État de `gh auth status`

`gh` (GitHub CLI) **n'est pas installé** dans l'environnement où j'exécute les commandes (`gh: command not found`). Je n'ai donc pas pu exécuter `gh auth status` ni `gh repo view`.

Par ailleurs, cet environnement est non-interactif : même si j'installais `gh`, une authentification par navigateur (`gh auth login --web`) nécessiterait un aller-retour interactif que je ne peux pas mener ici de façon fiable pour toi. Aucun connecteur GitHub natif n'existe non plus dans cette session Cowork (vérifié via le registre de connecteurs).

**Concrètement** : je n'ai aujourd'hui aucun moyen technique de me connecter directement à GitHub en lecture ou en écriture depuis cette session. Le canal qui fonctionne reste celui déjà utilisé : je prépare un bundle Git complet (ci-joint), et tu le pousses toi-même avec les commandes que je te donne. Si un connecteur GitHub officiel devient disponible dans Cowork, je pourrai basculer dessus.

## 3. État réel du dépôt GitHub

D'après ton message, le dépôt `Lagloire23/Veille-WINOVYA` existe et **est vide**. Je n'ai aucun moyen de le vérifier moi-même (voir point 2), donc je me fie à ta confirmation. Cela signifie concrètement qu'aucune réécriture d'historique partagé n'est en jeu : je peux réorganiser librement les commits locaux (ce que j'ai fait, section 6) sans risque de casser un historique déjà poussé.

## 4. Audit en lecture seule de `Lagloire Project` (`svtcvijqmldjbsceoeef`)

**Classement : "projet indépendant à conserver" — à ne surtout pas réutiliser comme staging.**

Ce n'est pas un projet vide ou abandonné : c'est un produit distinct, actif et mature.

- **26 tables** dans le schéma `public`, avec des noms très parlants côté métier commande publique : `opportunities` (avec des champs comme `Titre`, `Maitre_ouvrage`, `Date_limite_remise_offres`, `Statut` en enum Prospection/Qualification/.../GO/NO GO), `decision_support` (scores conformité/compétences/références/finances/opportunité — un outil d'aide à la décision GO/NO-GO), `memoires_techniques` et `template` (génération de mémoires techniques de réponse aux marchés), `company_profiles`, `user_team_members`, `documents`/`sources`/`chat_messages` avec colonnes `embedding` (recherche IA de type RAG), et une table `Données commande publique - fichiers consolidés` avec des dizaines de colonnes acheteur/titulaire/marché.
- **29 Edge Functions actives**, avec des noms métier explicites : `generate-proposal`, `generate-memoire`, `generate-memoire-rag`, `chat-rag`, `share-opportunity`, `share-memoire`, `send-team-member-invitation`, `send-opportunity-reminders`, etc.
- **67 migrations**, s'étalant de fin juillet 2025 à mars 2026 — un historique de développement long et actif.
- RLS activé sur toutes les tables analysées.
- Le nombre de lignes remonté par l'outil d'audit affiche 0 pour toutes les tables — cette valeur est une estimation statistique (`pg_class.reltuples`), pas nécessairement une preuve d'absence réelle de données ; je n'ai pas cherché à vérifier plus loin pour rester strictement en lecture seule et ne pas risquer d'afficher des données personnelles.
- Aucune table, fonction, trigger ou donnée n'a été modifiée, renommée ou réinitialisée.

Tout indique qu'il s'agit du backend d'un produit sœur (très probablement `attributions.winovya.com`, évoqué plus tôt dans nos échanges). **Ce projet doit être laissé complètement intact** et ne peut pas servir de base pour le staging de WINOVYA Market Intelligence : il faudra bien créer un nouveau projet Supabase dédié, comme prévu.

## 5. Liste des commits locaux actuels

```text
main:                            ad76769  baseline: état du code correspondant à la production au 2026-07-15
staging:                         ad76769  (identique à main)
feature/sprint-0-infrastructure: ad76769  (baseline)
                                  4f6d445  sprint 0 (B): configuration et documentation staging
                                  09e0e2f  sprint 0 (C): CI et garde-fous
```

Trois branches seulement existent désormais localement, conformément à ta demande de nettoyage. J'ai supprimé (en local uniquement — rien n'était poussé) : `feature/opportunites-dossiers`, `feature/opportunity-engine`, `feature/dashboard-opportunities`, `feature/pipeline-opportunities`. Elles seront recréées au début de leur sprint respectif.

**Correction apportée à la baseline elle-même (commit `ad76769`, remplace l'ancien `4dc2bcb`)** : le tout premier commit contenait par erreur deux fichiers qui n'auraient jamais dû être suivis par Git : `.netlify/state.json` (fichier de liaison local CLI↔site, révélé par cet audit — voir section 1) et `tsconfig.tsbuildinfo` (cache de compilation TypeScript). Je les ai retirés du suivi et ajoutés à `.gitignore`. Le reste de la baseline (51 fichiers, code source réel) est inchangé.

## 6. Fichiers différents entre la baseline et la branche d'infrastructure

```text
 .env.example                         |  43 +++++++++--
 .github/workflows/ci.yml             |  34 ++++++++
 README.md                            |  48 ++++++++++++
 docs/deployment.md                   |  49 ++++++++++++
 docs/environments.md                 | 145 +++++++++++++++++++++++++++++++++++
 docs/rollback.md                     |  30 ++++++++
 docs/sync-production-to-staging.md   |  55 +++++++++++++
 src/App.tsx                          |   2 +
 src/components/EnvironmentBanner.tsx |  38 +++++++++
 src/lib/env.ts                       |  73 ++++++++++++++++++
 src/lib/featureFlags.ts              |  15 ++++
 src/main.tsx                         |   6 ++
```

Aucun de ces fichiers n'existe dans le code de production (`main`) — exactement la séparation demandée. Répartition en deux commits distincts et propres :
- **Commit B** (`4f6d445`, config/doc) : `.env.example`, `README.md`, tous les fichiers `docs/*`.
- **Commit C** (`09e0e2f`, CI/garde-fous) : `src/lib/env.ts`, `src/lib/featureFlags.ts`, `src/components/EnvironmentBanner.tsx`, modifications de `src/App.tsx` et `src/main.tsx`, `.github/workflows/ci.yml`.

**Feature flags simplifiés (section 6 de ta demande)** : `src/lib/featureFlags.ts` n'exporte plus qu'un seul flag, `FEATURE_OPPORTUNITIES_ENABLED` (`VITE_FEATURE_OPPORTUNITIES_ENABLED`, affichage frontend uniquement). Le second flag MVP, `OPPORTUNITY_ENGINE_ENABLED` (exécution backend), est documenté dans `docs/environments.md` et `.env.example` comme variable backend réservée au Sprint 1 — il n'existe encore aucune edge function pour le consommer, donc aucun code frontend n'y correspond (pas de préfixe `VITE_`, jamais exposé au client). Les flags Timeline et Décideurs ont été retirés, faute de dépendance technique démontrée.

Build vérifié deux fois sur la branche d'infrastructure après réorganisation : `tsc --noEmit` propre, `vite build` réussi en configuration staging (bandeau "STAGING" confirmé présent dans le bundle) et en configuration production (bandeau confirmé absent).

**Point de transparence** : la baseline (`main`/`staging`) contient le vrai `.env.example` du dépôt de production, qui inclut la vraie URL et la vraie clé **anon** (publique) du projet Supabase de production — ce n'est pas un secret au sens strict (la clé anon est conçue par Supabase pour être publique et est de toute façon visible dans le bundle JS déployé), mais ce n'est pas une bonne pratique de la committer telle quelle. C'est corrigé dans le commit B de la branche d'infrastructure (placeholders génériques) ; ça ne disparaîtra de `main`/`staging` qu'une fois cette branche fusionnée. Aucune clé `service_role` ni aucun autre secret réel n'a été trouvé sur aucune des trois branches (vérifié explicitement).

## 7. Blocages restants

1. **Confirmation du push** : rien n'a encore été poussé sur GitHub par mes soins (je n'ai pas d'accès direct). Le bundle joint contient les 3 branches autorisées (`main`, `staging`, `feature/sprint-0-infrastructure`) avec l'historique corrigé — remplace le bundle du message précédent, qui contenait l'ancienne baseline non nettoyée et des branches supplémentaires à ne plus pousser pour l'instant.
2. **Accès GitHub pour Claude** : aucun disponible dans cette session (`gh` non installé, pas de connecteur, session non-interactive). Le mode de travail reste : je prépare, tu pousses, ou tu m'indiques si un connecteur GitHub apparaît dans Cowork.
3. **Ouverture de la Pull Request `feature/sprint-0-infrastructure` → `staging`** : à faire toi-même via le bouton GitHub "Compare & pull request" une fois le push effectué — je ne peux pas la créer sans accès API.
4. **Exécution réelle de la CI** : le workflow `.github/workflows/ci.yml` ne s'exécutera qu'une fois poussé sur GitHub — non testé en conditions réelles à ce stade (seulement testé localement via les mêmes commandes que le workflow exécute).
5. **Projet Supabase staging** : toujours pas créé, en attente de ta validation (nom, organisation, confirmation de coût au moment de la création).
6. **Site Netlify staging** : toujours pas créé, en attente de ta validation. Domaine : Netlify généré par défaut dans un premier temps, `staging-intelligence.winovya.com` seulement après validation technique, comme demandé.
7. **Preuve finale de baseline `CONFIRMED`** (hash d'assets exact) : nécessite soit ton retour depuis le navigateur (nom du fichier `.js` chargé par `intelligence.winovya.com`), soit l'activation de l'extension Claude in Chrome.

Je m'arrête ici, en attente de ta validation avant de poursuivre vers la création réelle de Supabase Staging et Netlify Staging (Étape 9 de ta demande précédente).
