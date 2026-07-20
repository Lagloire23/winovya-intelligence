# Sprint 10 — Audit en lecture seule des anciennes tables (Phase 1)

**Projet source (Production, lecture seule) :** `mhsbwabrvcqnxnwamvwc` ("WINOVYA Market Intelligence")
**Projet destination (Staging, seul environnement autorisé en écriture) :** `gcitqpgucepgroermzti` ("WINOVYA Market Intelligence Staging")
**Méthode :** requêtes `SELECT` exclusivement, via l'outil Supabase MCP en lecture seule. Aucune écriture, aucune commande DDL/DML exécutée sur Production durant cette phase.
**Date de l'audit :** 2026-07-18.

## 0. Correction d'un chiffre annoncé dans le cahier des charges

Le cahier des charges du Sprint 10 mentionne "ne pas importer les 346 alertes avant validation du Product Owner". Le comptage réel effectué ci-dessous montre **375 lignes** dans `veille.alertes` sur Production, pas 346. Ce rapport utilise donc 375 comme chiffre de référence réel ; l'échantillon Sprint 10 (30 à 50 lignes) reste très largement en dessous des deux chiffres, donc cet écart ne remet pas en cause le plan d'échantillonnage, mais il est signalé explicitement pour ne rien laisser d'invérifié.

## 1. Inventaire des tables demandées

| Table | Lignes | RLS activé | Clé primaire | Relations sortantes principales |
|---|---|---|---|---|
| `veille.alertes` | 375 | oui | `id` (uuid) | → `decideurs` (decideur_id) |
| `veille.pertinence_entreprise` | 379 | oui | `id` (uuid) | → `alertes` (alerte_id), → `entreprises` (entreprise_id) |
| `veille.entreprises` | 3 | oui | `id` (uuid) | — |
| `veille.decideurs` | 203 | oui | `id` (uuid) | — |
| `veille.alerte_decideurs` | 203 | oui | (`alerte_id`,`decideur_id`) | → `alertes`, → `decideurs` |
| `veille.attachments` | 123 | oui | `id` (uuid) | → `alertes` (alerte_id) |
| `veille.profiles` (« profils ») | 4 | oui | `id` (uuid = `auth.users.id`) | → `entreprises` (entreprise_id) |
| `veille.abonnements_alertes` | 4 | oui | `id` (uuid) | — |

Table connexe non listée explicitement dans le périmètre mais rattachée à `alertes` par clé étrangère, donc pertinente pour la traçabilité : `veille.documents_urbanisme` (1 ligne, `alerte_id` renseigné sur cette unique ligne).

Aucune de ces 8 tables ne diffère fortement du schéma attendu par le cahier des charges — condition de STOP n°1 non déclenchée. La seule différence est nominale : le cahier des charges parle de « profils », la table réelle s'appelle `profiles` (anglicisme déjà en usage dans tout le projet depuis Sprint 0).

## 2. Découverte hors périmètre : un second pipeline legacy indépendant

Le schéma `public` (distinct de `veille`) contient neuf tables supplémentaires, plus anciennes, appartenant visiblement à un pipeline de veille budgétaire/OFGL et RAA (arrêtés préfectoraux) antérieur ou parallèle à celui du schéma `veille` :
`veille_ofgl_runs` (2), `collectivites_detectees` (10), `postes_budgetaires` (21), `alertes_opportunites` (21), `arretes_prefectoraux` (8), `arretes_entreprises_concernees` (8), `veille_raa_runs` (1), `veille_articles_associations` (8), `veille_associations_identifiees` (7).

Ces tables ne font pas partie du périmètre explicite du Sprint 10 (le cahier des charges ne cite que les 8 tables du schéma `veille`) et ne sont donc **pas** traitées dans le mapping/import de ce sprint. Elles sont mentionnées ici pour complétude de l'audit, avec une alerte de sécurité importante :

**⚠️ Alerte de sécurité pré-existante, indépendante du Sprint 10 :** ces 9 tables ont RLS **désactivé** sur Production — elles sont donc intégralement lisibles et modifiables par n'importe quel détenteur de la clé `anon`. Le conseil de l'outil d'audit Supabase est de ne jamais activer RLS sans politique définie au préalable (cela bloquerait tout accès), donc aucune action n'a été prise automatiquement. Cette alerte est simplement remontée pour votre décision — elle est sans lien avec la migration d'alertes de ce sprint.

## 3. `veille.alertes` (375 lignes) — analyse détaillée

**Distribution par statut :** NOUVEAU 365, ASSIGNE 6, TRAITE 2, ARCHIVE 2.

**Distribution par catégorie de veille :** ICPE 166, Marchés publics & renouvellements 64, Presse locale 46, Délibérations 20, Maîtrise foncière 16, Documents administratifs 15, Articles associations 14, Budgets collectivités/investissements 12, Arrêtés préfectoraux 13, Urbanisme (compatibilité) 9. Aucune ligne sur "8. Actualisation de données" ni "11. Élus locaux".

**Distribution par priorité :** Moyenne 185, Haute 159, Basse 11, non renseignée 20.

**Plage de dates :** `date_publication` de 2020-01-07 à 2026-12-23 (une partie des publications est datée dans le futur proche — cohérent avec des échéances/délibérations à venir, pas une anomalie). `date_detection` de 2026-07-03 à 2026-07-17.

**Taux de champs renseignés (sur 375) :**

| Champ | Valeurs manquantes | Taux renseigné |
|---|---|---|
| `resume` | 0 | 100 % |
| `date_publication` | 0 | 100 % |
| `lien_source_url` | 6 | 98,4 % |
| `acteur_entite` | 28 | 92,5 % |
| `reference_officielle` | 91 | 75,7 % |
| `airtable_id` | 168 | 55,2 % |
| `texte_extrait_document` | 193 | 48,5 % |
| `montant` | 303 | 19,2 % |
| `contact_decideur_email` | 362 | 3,5 % |
| `assigne_email` | 370 | 1,3 % |
| `decideur_id` | 375 | **0 %** |

**Champ exploitable mais vide à 100 % :** `decideur_id` sur `alertes` n'est renseigné sur aucune des 375 lignes — le lien alerte→décideur passe exclusivement par la table de liaison `alerte_decideurs` (203 lignes), jamais par la colonne directe. Point important pour le mapping (Phase 2) : ne pas s'appuyer sur `alertes.decideur_id`, utiliser `alerte_decideurs`.

**Doublons potentiels — analyse fine, pas de faux positif :**
9 groupes de `lien_source_url` identiques ont été détectés, mais l'inspection manuelle montre qu'il ne s'agit **pas** de doublons de signal : ce sont des URLs de portails ou d'API génériques (ex. `georisques.gouv.fr/api/v1/installations_classees?departement=16`, une page générique `usinenouvelle.com/ile-de-france/`) partagées comme référence par plusieurs alertes concernant des sujets réellement différents (ex. deux arrêtés ICPE distincts dans le même département, ou deux projets industriels distincts couverts par le même journal). **Aucun doublon exact d'`airtable_id` ni de `reference_officielle` n'a été trouvé.** Conclusion : il n'existe pas de doublon strict évident dans `alertes` ; la détection de doublons du Sprint 10 (Phase 4) devra donc s'appuyer sur une comparaison de contenu (acteur + commune + date + résumé), pas sur une simple égalité d'URL source.

**Candidats de regroupement réels (plusieurs signaux sur un même acteur) :** `acteur_entite = 'Thales'` apparaît sur 8 lignes (toutes en catégorie "Budgets collectivités/investissements"), `Grand Port Maritime de Marseille` sur 4, `Région Île-de-France` sur 4, `France Nature Environnement (FNE)` sur 3, et une douzaine d'autres acteurs sur 2 lignes chacun (ANTARGAZ, Arkema, MBDA Systems, Newcleo, Ville de Paris, etc.). Ce sont de bons candidats pour illustrer le regroupement en Phase 5, sous réserve de vérification manuelle de la cohérence business avant tout regroupement automatique.

**Données sensibles dans `alertes` :** `contact_decideur_email`/`contact_decideur_telephone`/`contact_decideur_linkedin` (13 lignes renseignées sur 375) contiennent des données à caractère personnel identifiables — à traiter avec la même prudence RLS que le reste du domaine Opportunités en Staging (jamais de service_role côté frontend, jamais d'exposition croisée entre entreprises).

## 4. `veille.pertinence_entreprise` (379 lignes) — analyse détaillée

**Statut :** 379/379 = `Actif` (aucune ligne `Écarté` dans ce jeu de données).

**Score de pertinence :** Très Haute 56, Haute 140, Moyenne 140, Basse 39, À confirmer 4.

**Client déjà connu (`donneur_ordre_deja_client`) :** Non - prospect nouveau 205, Oui - client actif 23, Oui - client/référence passée 1, À vérifier 8, non renseigné 142 (37,5 %).

**Intégrité référentielle :** 0 ligne orpheline sur `alerte_id`, 0 ligne orpheline sur `entreprise_id` — toutes les clés étrangères sont valides.

**Point clé pour le mapping :** 101 alertes ont plus d'une ligne de pertinence (plusieurs entreprises concernées par la même alerte) — confirmé sans doublon strict de paire (alerte_id, entreprise_id). C'est la preuve que le modèle "un signal peut concerner plusieurs entreprises" est déjà présent nativement dans les données historiques, et doit être respecté dans le mapping (une alerte ne se traduit pas forcément en une seule opportunité par entreprise).

## 5. `veille.entreprises` (3 lignes)

Trois entreprises actives : **Ekium**, **Etamine**, **Cetim**. Seule Cetim a terminé son onboarding (`onboarding_complete = true`) ; Ekium et Etamine ne l'ont pas terminé. Aucune donnée manquante bloquante sur cette table (peu de lignes, toutes exploitables).

## 6. `veille.decideurs` (203 lignes)

**Statut :** À jour 161, À revérifier 41, Introuvable sur le site officiel 1.

**Taux de champs renseignés :**

| Champ | Manquant | Taux renseigné |
|---|---|---|
| `email` | 190 | 6,4 % |
| `telephone` | 189 | 6,9 % |
| `linkedin` | 72 | 64,5 % |
| `fonction_poste` | 10 | 95,1 % |
| `nom_personne` | 23 | 88,7 % |
| `role_achat` = « Non catégorisé » ou vide | 95 | 53,2 % qualifié |

**Doublons :** aucun doublon d'email (0 groupe). Aucune anomalie de duplication détectée.

**Données sensibles :** cette table contient nativement des données à caractère personnel (nom, prénom, email, téléphone, LinkedIn de personnes physiques identifiées — élus, dirigeants, fonctionnaires). C'est déjà le cas en Production actuellement (RLS activé) ; le mapping Sprint 10 ne doit rien changer à ce traitement, uniquement réutiliser la table `decideurs` déjà existante côté Staging sans dupliquer les données personnelles dans le nouveau domaine Opportunités (voir Phase 2 — `opportunite_decideurs` est une table de liaison par `id`, jamais une copie des champs personnels).

## 7. `veille.alerte_decideurs` (203 lignes)

Table de liaison pure (clé composite `alerte_id`+`decideur_id`), 0 ligne orpheline des deux côtés. C'est la voie fiable pour retrouver les décideurs liés à une alerte (voir point 3 ci-dessus : `alertes.decideur_id` est toujours NULL).

## 8. `veille.attachments` (123 lignes)

118 fichiers avec une extension reconnue (pdf/doc(x)/xls(x)), 118 `storage_path` distincts (pas de doublon de chemin), 0 ligne sans `alerte_id` NULL bloquante et 0 orpheline. Table propre, exploitable directement comme source de "preuves" au sens du Sprint 10 (Phase 2).

## 9. `veille.profiles` (4 lignes) et `veille.abonnements_alertes` (4 lignes)

`profiles` : 1 admin, 3 members, tous rattachés à `auth.users` (4 comptes au total sur Production, cohérent). `abonnements_alertes` : 4 abonnements, tous au statut `Actif`. Aucune anomalie, aucun doublon d'email.

## 10. Table connexe `veille.documents_urbanisme` (1 ligne)

Une seule ligne, rattachée à une alerte via `alerte_id`. Volume trop faible pour être significatif dans l'échantillon Sprint 10 mais mentionné pour complétude — elle pourra être incluse dans le mapping si l'alerte concernée fait partie de l'échantillon retenu en Phase 5 (catégorie "Urbanisme").

## 11. Conditions de STOP — vérification explicite

| Condition de STOP | Déclenchée ? | Justification |
|---|---|---|
| Les tables réelles diffèrent fortement du schéma attendu | Non | Les 8 tables demandées existent avec les colonnes attendues ; seul écart nominal « profils »/`profiles`. |
| Les variables d'environnement nécessaires manquent | Non | Accès direct confirmé aux deux projets Supabase (`mhsbwabrvcqnxnwamvwc` lecture, `gcitqpgucepgroermzti` lecture/écriture) via l'outil MCP dédié ; aucune variable manquante pour cette phase d'audit. |
| L'environnement de destination n'est pas clairement identifié | Non | Staging = `gcitqpgucepgroermzti`, confirmé et déjà utilisé sur les sprints précédents. |
| Un risque de modification Production existe | Non | Toutes les requêtes de cette phase sont des `SELECT` purs ; aucune écriture, aucune DDL exécutée sur `mhsbwabrvcqnxnwamvwc`. |

**Aucune condition de STOP n'est déclenchée. Le Sprint 10 peut se poursuivre en Phase 2 (mapping documenté).**

## 12. Schéma cible déjà existant côté Staging (pour information, prépare la Phase 2)

Le domaine Opportunités existe déjà côté Staging (`gcitqpgucepgroermzti`, issu des Sprints 1 à 9.1) : `veille.opportunites` (14 lignes actuelles, données de démonstration), `veille.opportunite_alertes`, `veille.opportunite_decideurs`, `veille.opportunite_preuves`, `veille.opportunite_notes`, `veille.opportunite_activity_log`, `veille.engine_settings`. Aucune de ces tables ne possède aujourd'hui de colonne de traçabilité (`source_system`, `source_project`, `source_record_id`, `import_batch_id`, etc.) — confirmant que la migration additive prévue en Phase 3 est bien nécessaire et n'est pas redondante avec l'existant.
