# Sprint 10 — Mapping documenté : anciennes tables → domaine Opportunités (Phase 2)

Ce document définit, champ par champ, comment une ligne des anciennes tables (Production, `mhsbwabrvcqnxnwamvwc`, schéma `veille`) devient une entrée du domaine Opportunités existant côté Staging (`gcitqpgucepgroermzti`, schéma `veille`, tables issues des Sprints 1 à 6). Aucune ligne legacy n'est modifiée ou supprimée : ce mapping décrit uniquement ce qui est **lu** en Production et **créé** en Staging.

## 0. Décision préalable non demandée explicitement mais nécessaire : les entreprises

Le cahier des charges ne liste pas `entreprises` comme cible de mapping, en supposant implicitement que les entreprises destinataires existent déjà côté Staging. Ce n'est pas le cas : Staging ne contient aujourd'hui qu'une seule entreprise de démonstration (« SPRINT8-DEMO Entreprise Cliente »), alors que Production contient 3 vraies entreprises (Ekium, Etamine, Cetim) auxquelles les alertes legacy sont réellement rattachées via `pertinence_entreprise`.

Pour permettre une revue Produit fidèle à la réalité (et pour pouvoir vérifier en Phase 6 la règle « aucune donnée d'une autre entreprise »), ce sprint importe donc aussi les 3 entreprises réelles dans Staging, avec traçabilité complète, **en plus** de la structure demandée. Elles restent strictement additives : la société de démonstration existante n'est ni modifiée ni supprimée.

| Champ `entreprises` (Staging) | Statut | Source | Règle |
|---|---|---|---|
| `id` | transformed | — | nouvel UUID généré à l'import (jamais réutilisation de l'UUID Production, pour ne jamais créer de collision avec un futur id Staging) |
| `name` | direct | `entreprises.name` | copié tel quel |
| `status` | direct | `entreprises.status` | copié tel quel |
| `onboarding_complete` | direct | `entreprises.onboarding_complete` | copié tel quel |
| `competences`, `references_clients`, `site_web`, `description_courte`, `secteurs_intervention`, `zone_geographique`, `mots_cles_metiers`, `effectif_taille`, `secteur_clients`, `pays`, `regions_suivies`, `departements_suivis`, `types_opportunite_suivis` | direct | mêmes colonnes | copiés tels quels (aucune transformation) |
| `airtable_id` | ignored | — | non réutilisé côté Staging (l'`airtable_id` d'origine reste consultable en Production si besoin ; il n'a pas de sens fonctionnel dans le nouveau domaine) |
| traçabilité (`source_system`…) | voir Phase 3 | — | chaque entreprise importée porte les mêmes 7 colonnes de traçabilité que toutes les autres tables importées |

## 1. `veille.alertes` (legacy) → `veille.alertes` (Staging, table de signaux déjà existante)

Le pipeline cible ne saute pas directement à `opportunites` : le signal brut est d'abord importé tel quel dans la table `alertes` de Staging (déjà utilisée par le moteur de corrélation des Sprints 2/3), avec traçabilité. C'est le moteur d'opportunités existant (Sprint 2, `CorrelationEngine`/`OpportunityEngineService`, réutilisé sans modification de sa logique de scoring) qui consomme ensuite ces alertes pour produire les opportunités — conformément au principe fondamental du sprint : *une ancienne alerte n'est pas automatiquement une opportunité*.

| Champ `alertes` (Staging) | Statut | Source legacy | Règle |
|---|---|---|---|
| `id` | transformed | — | nouvel UUID Staging |
| `name` | direct | `alertes.name` | copié tel quel (trim des espaces superflus observés en Production, ex. espace de début) |
| `notes` | direct | `alertes.notes` | copié tel quel |
| `categorie_veille` | direct | `alertes.categorie_veille` | même enum des deux côtés (vérifié identique) |
| `pays`, `departement`, `region`, `commune_collectivite` | direct | mêmes colonnes | copiés tels quels |
| `date_publication` | direct | `alertes.date_publication` | copié tel quel, jamais recalculé |
| `date_detection` | direct | `alertes.date_detection` | copié tel quel (date **observée** d'origine, pas la date d'import — voir `imported_at` en Phase 3 pour la date d'import) |
| `lien_source_url` | direct | `alertes.lien_source_url` | copié tel quel — c'est la preuve d'origine, jamais réécrite |
| `resume` | direct | `alertes.resume` | copié tel quel |
| `acteur_entite` | direct | `alertes.acteur_entite` | copié tel quel |
| `montant` | direct | `alertes.montant` | copié tel quel si renseigné, sinon NULL (jamais estimé) |
| `reference_officielle` | direct | `alertes.reference_officielle` | copié tel quel |
| `echeance_date_limite` | direct | `alertes.echeance_date_limite` | copié tel quel |
| `priorite` | direct | `alertes.priorite` | copié tel quel, NULL si absent (jamais déduit) |
| `mots_cles`, `type_opportunite` | direct | mêmes colonnes | copiés tels quels |
| `contact_decideur_*` (5 colonnes) | direct | mêmes colonnes | copiés tels quels s'ils existent (rares : 13/375 lignes) |
| `notes_equipe`, `assigne_email` | ignored | — | champs de suivi opérationnel Production, non pertinents pour un import Staging à but de revue ; jamais copiés |
| `texte_extrait_document` | direct | `alertes.texte_extrait_document` | copié tel quel si présent (48,5 % des lignes) |
| `statut` | transformed | `alertes.statut` | réinitialisé à `NOUVEAU` côté Staging quel que soit le statut Production (ASSIGNE/TRAITE/ARCHIVE de Production reflètent un traitement qui n'a jamais eu lieu dans le nouveau domaine) — le statut Production d'origine est conservé tel quel dans `details` de l'entrée `opportunite_activity_log` créée à l'import, pour ne perdre aucune information |
| `decideur_id` | unavailable | `alertes.decideur_id` | toujours NULL en Production (voir audit Phase 1) — non copié ; le lien réel passe par `alerte_decideurs` (voir §3) |
| `created_at`, `updated_at` | transformed | — | horodatage réel de l'import Staging (jamais l'horodatage Production, qui devient `source_*` en traçabilité) |
| `airtable_id` | ignored | `alertes.airtable_id` | non réutilisé (contrainte d'unicité Staging potentiellement déjà occupée par les données de démo) |

## 2. Normalisation, dédoublonnage, regroupement (avant consolidation en opportunité)

- **Normalisation :** trim des champs texte, uniformisation des valeurs vides (`''` → `NULL`) pour ne pas fausser les taux de champs renseignés côté cockpit.
- **Détection de doublons :** l'audit Phase 1 a montré que `lien_source_url` ne suffit pas (portails génériques partagés par des signaux distincts). Le script d'import (Phase 4) détecte un doublon **strict** uniquement sur `reference_officielle` non vide identique, ou sur `airtable_id` identique — les deux seuls identifiants fiables trouvés en Phase 1 (0 doublon détecté actuellement dans les 375 lignes, mais la règle reste appliquée pour tout futur import).
- **Regroupement (plusieurs signaux → une opportunité) :** délégué au moteur existant `CorrelationEngine` (Sprint 2), qui calcule une `correlation_key` déterministe. Le Sprint 10 n'invente pas de nouvelle logique de regroupement : il fournit seulement des signaux normalisés et traçables au moteur déjà validé. Un signal isolé qui ne correspond à aucune clé de corrélation existante produit une opportunité provisoire (statut `NEW`, `nombre_signaux = 1`), conformément à la règle métier du cahier des charges.
- **Explicabilité du regroupement :** chaque regroupement reste visible via `opportunite_alertes` (table de liaison N-N déjà existante, jamais modifiée) — pour toute opportunité, la liste des alertes Staging importées qui la composent est directement consultable, donc explicable.

## 3. `veille.alerte_decideurs` + `veille.decideurs` → `veille.opportunite_decideurs` + `veille.decideurs` (Staging)

| Élément | Statut | Règle |
|---|---|---|
| `decideurs` (Staging) | direct (import préalable) | Les décideurs réellement liés aux alertes de l'échantillon (via `alerte_decideurs`) sont importés tels quels dans `veille.decideurs` de Staging — mêmes colonnes, aucune donnée personnelle inventée. Traçabilité appliquée (voir Phase 3). |
| `opportunite_decideurs.decideur_id` | direct | Lien recréé automatiquement à la consolidation : chaque décideur legacy lié (via `alerte_decideurs`) à une alerte important dans une opportunité devient une ligne `opportunite_decideurs` pour cette opportunité. |
| Décideurs sans alerte importée dans l'échantillon | ignored | Non importés — seuls les décideurs réellement rattachés à l'échantillon de 30-50 alertes sont copiés, jamais l'intégralité des 203. |

## 4. `veille.attachments` + `alertes.lien_source_url` → `veille.opportunite_preuves`

| Champ `opportunite_preuves` | Statut | Source legacy | Règle |
|---|---|---|---|
| `source` | transformed | `attachments.filename` (si présent) ou `alertes.categorie_veille` | libellé factuel de la nature de la preuve, jamais une reformulation commerciale |
| `citation` | direct | `alertes.resume` (tronqué à 500 caractères s'il dépasse) | extrait textuel réellement observé, jamais résumé/reformulé par une IA |
| `url` | direct | `attachments.url` si présent, sinon `alertes.lien_source_url` | toujours l'URL réelle d'origine ; si aucune des deux n'existe, aucune ligne `opportunite_preuves` n'est créée pour ce signal plutôt que d'inventer une URL |
| lien vers l'opportunité | transformed | — | une ligne de preuve par alerte importée rattachée à l'opportunité consolidée (et par pièce jointe le cas échéant) |

## 5. `veille.pertinence_entreprise` (legacy) → réutilisation directe du modèle existant + rattachement `opportunites.entreprise_id`

`pertinence_entreprise` existe déjà, à l'identique, des deux côtés (même schéma exact). Le Sprint 10 ne crée pas de nouveau modèle : il importe les lignes de pertinence réellement observées pour l'échantillon retenu, en réécrivant les clés étrangères vers les nouveaux `id` Staging (alerte importée, entreprise importée).

| Champ | Statut | Règle |
|---|---|---|
| `score_pertinence` | direct | copié tel quel — jamais recalculé, jamais inventé si absent |
| `type_opportunite` | direct | copié tel quel |
| `lien_business` | direct | copié tel quel si renseigné |
| `donneur_ordre_deja_client` | direct | copié tel quel, NULL sinon (37,5 % des lignes Production, taux préservé) |
| `statut` | direct | copié tel quel (`Actif`/`Écarté`) |
| `opportunites.entreprise_id` | transformed | déduit de `pertinence_entreprise.entreprise_id` réécrit vers l'`id` Staging de l'entreprise importée correspondante — c'est ce lien qui garantit la séparation stricte par entreprise en Phase 6 |

Une alerte liée à plusieurs entreprises dans `pertinence_entreprise` (101 cas identifiés en Phase 1) produit une opportunité distincte par entreprise concernée — jamais une opportunité partagée entre plusieurs entreprises, pour respecter l'étanchéité déjà en vigueur dans tout le reste du produit.

## 6. Historique des signaux → `veille.opportunite_activity_log`

Chaque import crée une entrée `event_type = 'created'` par opportunité nouvellement consolidée, avec `details` contenant : `{"source": "legacy-import", "batch_id": "...", "statut_legacy_origine": "..."}`. `acteur_id` reste NULL (import automatique, pas d'utilisateur humain dans le contexte, même convention que le pipeline automatique du Sprint 3).

## 7. Champs jamais migrés (`ignored`) — récapitulatif

`alertes.notes_equipe`, `alertes.assigne_email`, tout `airtable_id` (Production comme Staging), et tout champ de suivi opérationnel Production (statut réel ASSIGNE/TRAITE/ARCHIVE, préservé uniquement en traçabilité/activity log, jamais comme statut actif du nouveau domaine).

## 8. Champs indisponibles (`unavailable`) — récapitulatif

`alertes.decideur_id` (toujours NULL en Production — le vrai lien passe par `alerte_decideurs`), `budget_estime`/`budget_fiabilite`/`phase_projet`/`niveau_confiance` sur `opportunites` (ces colonnes existent déjà côté Staging depuis le Sprint 4 mais sont peuplées **uniquement** par un passage ultérieur du `DossierEnrichmentService` existant, jamais directement par l'import Sprint 10 — principe : ne jamais inventer une valeur pour remplir l'interface).

## 9. Aucune valeur fictive

Conformément à la contrainte n°10 du cahier des charges, aucun champ ci-dessus n'introduit de valeur inventée : chaque champ `transformed` ou `inferred` est calculé de façon déterministe à partir d'une donnée réellement présente en Production, et tout champ sans donnée source reste `NULL` (jamais une chaîne de remplissage, jamais un score fictif, jamais un budget estimé sans preuve).
