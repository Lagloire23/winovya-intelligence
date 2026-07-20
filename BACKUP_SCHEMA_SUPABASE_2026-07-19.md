# 🔐 BACKUP SCHÉMA SUPABASE — WINOVYA Market Intelligence

**Date** : 2026-07-19  
**Project ID** : mhsbwabrvcqnxnwamvwc  
**Schema** : veille  

---

## 📋 TABLES ACTUELLES (9 tables)

### 1. **alertes** (414 enregistrements)
Colonnes principales :
- `id` (uuid, PK)
- `name`, `resume`, `notes`
- `acteur_entite`, `commune_collectivite`, `departement`, `region`, `pays`
- `date_publication`, `date_detection`, `created_at`, `updated_at`
- `categorie_veille` (enum), `priorite` (enum), `statut` (enum: NOUVEAU/ASSIGNE/TRAITE/ARCHIVE)
- `type_opportunite` (text[] array)
- `contact_decideur_nom`, `contact_decideur_fonction`, `contact_decideur_email`, `contact_decideur_telephone`, `contact_decideur_linkedin`
- `lien_source_url`, `reference_officielle`, `montant`, `echeance_date_limite`
- `texte_extrait_document`
- `mots_cles` (text[] array)
- `decideur_id` (uuid, FK — OBSOLÈTE, ne pas utiliser)
- `notes_equipe`, `assigne_email` (réservés pour suivi manuel)
- `airtable_id` (héritage migration)

**Constraints** : 
- PK: id
- FK: decideur_id (non utilisé), alerte_id dans attachments et pertinence_entreprise
- NO unique constraint métier → anti-doublon applicatif via SELECT avant INSERT

---

### 2. **entreprises** (3 enregistrements : CETIM, EKIUM, ETAMINE)
- `id` (uuid, PK)
- `name` (unique métier)
- `competences`, `references_clients`, `secteurs_intervention`, `mots_cles_metiers`
- `description_courte`, `site_web`, `effectif_taille`
- `zone_geographique`, `pays` (array), `departements_suivis` (array), `regions_suivies` (array)
- `types_opportunite_suivis` (array)
- `secteur_clients` (enum: "Majoritairement privé"/"Majoritairement public"/"Mixte")
- `status` (enum), `onboarding_complete` (boolean)
- `created_at`, `updated_at`
- `airtable_id` (héritage)

**TODO** : Ajouter colonne `offres_services` (JSONB) pour le matching

---

### 3. **pertinence_entreprise** (joins alertes ↔ entreprises)
- `id` (uuid, PK)
- `alerte_id` (uuid, FK → alertes)
- `entreprise_id` (uuid, FK → entreprises)
- `nom` (text, "{Entreprise} — {Alerte}")
- `score_pertinence` (enum: "Très Haute"/"Haute"/"Moyenne"/"Basse"/"À confirmer")
- `type_opportunite` (text[] array)
- `lien_business` (text, 2-4 phrases obligatoires)
- `donneur_ordre_deja_client` (enum)
- `statut` (enum: "Actif"/"Écarté")
- `created_at`, `updated_at`
- `airtable_id` (héritage)

**Constraint** : UNIQUE(alerte_id, entreprise_id)

---

### 4. **decideurs** (contacts identifiés)
- `id` (uuid, PK)
- `nom` (text, "{Prénom} {Nom} — {Fonction}")
- `structure_entreprise` (text)
- `nature` (enum: "Public"/"Privé")
- `type_structure` (text)
- `departement`, `region` (array)
- `nom_personne`, `prenom_personne`, `fonction_poste`, `service_direction`
- `email`, `telephone`, `linkedin`
- `role_achat` (enum: "Utilisateur final"/"Décideur budgétaire"/"Service marchés"/"Dirigeant"/"Non catégorisé")
- `document_organigramme_url` (Supabase Storage URL)
- `organigramme_page_web` (URL page web)
- `source_url`, `date_capture`
- `statut` (enum: "À jour"/"À revérifier"/"Introuvable")
- `notes`
- `created_at`, `updated_at`
- `airtable_id` (héritage)

**Constraint** : UNIQUE(airtable_id)

---

### 5. **alerte_decideurs** (table de jonction — lien 1:N)
- `alerte_id` (uuid, FK)
- `decideur_id` (uuid, FK)

**Constraint** : PK composite (alerte_id, decideur_id)  
**Usage** : `INSERT ... ON CONFLICT DO NOTHING` pour éviter doublons en écriture concurrente

---

### 6. **attachments** (pièces jointes Supabase Storage)
- `id` (uuid, PK)
- `alerte_id` (uuid, FK)
- `filename` (text)
- `storage_path` (text, ex: "alertes/{alerte_id}/{name}.pdf")
- `url` (text, URL publique permanente)
- `created_at`

**Note** : Fichiers hébergés dans bucket `veille-attachments` via Edge Function `upload-attachment`

---

### 7. **documents_urbanisme** (documents GPU/urbanisme)
- `id` (uuid, PK)
- `commune_collectivite`, `code_insee`, `departement`, `region` (array)
- `type_document`, `reference_officielle`, `titre_document`
- `date_publication`, `date_detection`, `date_approbaison`
- `lien_source_url`, `resume`, `texte_extrait`
- `mots_cles` (array), `secteurs_industriels` (array), `enjeux_environnementaux` (array)
- `source_geoportail` (boolean)
- `alerte_id` (FK, peut être lié à une alerte)
- `statut`, `notes`
- `created_at`, `updated_at`

---

### 8. **abonnements_alertes** (subscriptions utilisateurs)
- `id` (uuid, PK)
- `email` (text, NOT NULL)
- `nom` (text)
- `entreprises_suivies` (array), `regions` (array), `departements` (array)
- `types_opportunite_suivis` (array), `categories_veille_suivies` (array)
- `communes_suivies` (array), `epci_suivis` (array)
- `score_minimum` (enum)
- `statut` (text, default 'Actif')
- `token_desinscription` (text)
- `created_at`
- `airtable_id` (héritage)

---

### 9. **profiles** (utilisateurs Supabase Auth)
- `id` (uuid, FK → auth.users, PK)
- `email` (text)
- `full_name` (text)
- `role` (enum, default 'member')
- `entreprise_id` (uuid, FK → entreprises)
- `created_at`

---

## 📊 ENUMS DÉFINIS

| Enum | Valeurs |
|------|---------|
| `categorie_veille` | '1. Documents administratifs', '2. Presse locale', '3. Maîtrise foncière', '4. Urbanisme (compatibilité)', '5. Marchés publics & renouvellements', '6. Délibérations', '7. ICPE', '8. Actualisation de données', '9. Arrêtés préfectoraux', '10. Articles associations', '11. Élus locaux', '12. Budgets collectivités / investissements' |
| `priorite` | 'Haute', 'Moyenne', 'Basse' |
| `score_pertinence` | 'Très Haute', 'Haute', 'Moyenne', 'Basse', 'À confirmer' |
| `statut_alerte` | 'NOUVEAU', 'ASSIGNE', 'TRAITE', 'ARCHIVE' |
| `statut_pertinence` | 'Actif', 'Écarté' |
| `statut_client` | 'Oui - client actif', 'Oui - client / référence passée', 'Non - prospect nouveau', 'À vérifier' |
| `statut_decideur` | 'À jour', 'À revérifier', 'Introuvable sur le site officiel' |
| `role_achat` | 'Utilisateur final / terrain', 'Décideur budgétaire (DAF/DSI/élu rapporteur)', 'Service marchés / achats', 'Dirigeant / représentant légal', 'Non catégorisé' |
| `nature_decideur` | 'Public', 'Privé' |
| `secteur_clients` | 'Majoritairement privé', 'Majoritairement public', 'Mixte (public et privé)' |
| `profile_role` | 'admin', 'member' (+ autres si nécessaire) |

---

## 🔗 RELATIONS

```
entreprises (1) ──── (N) pertinence_entreprise ──── (N) alertes
                                                        │
                                                    alerte_decideurs
                                                        │
                                                    (N) decideurs

alertes ──── (N) attachments
         ──── (N) documents_urbanisme (via alerte_id)

profiles ──── (1) entreprises
```

---

## 📈 STATISTIQUES (2026-07-19)

- **Alertes totales** : 414
- **Acteurs distincts** : 341
- **Types d'opportunité distincts** : 168
- **Entreprises actives** : 3 (CETIM, EKIUM, ETAMINE)
- **Profils utilisateurs** : ? (non compté)

---

## ⚠️ NOTES IMPORTANTES

1. **Colonne obsolète** : `alertes.decideur_id` — jamais utiliser, utiliser `alerte_decideurs` à la place
2. **Colonnes verrouillées** : `alertes.notes_equipe`, `alertes.assigne_email` — réservées suivi manuel, ne pas écrire
3. **Anti-doublon** : `alertes` n'a PAS de constraint unique métier → vérification applicative obligatoire
4. **Dollar-quoting** : Tout texte libre avec apostrophes doit être écrit via `$txt$...$txt$` en Postgres
5. **Casting enum** : Utiliser `'Valeur'::schema.enum_type` explicitement

---

## 🔐 RLS POLICIES

À vérifier si actives sur chacune des tables. L'outil `execute_sql` utilise les privilèges service_role (pas soumis aux policies).

---

## 🚀 PROCHAINES ÉTAPES (REFONTE)

Cette sauvegarde sert de **référence stable**. La refonte introduira :
- Table `opportunites` (regroupement d'alertes)
- Table `phases_projet` (phases détectées)
- Table `opportunite_pertinence_entreprise` (scoring nouveau modèle)
- Table `entreprise_offres` (services de chaque entreprise)
- Colonnes additionnelles pour clustering et scoring

**Schéma reste FLEXIBLE et ADAPTABLE à tout moment.**

---

*Sauvegarde créée automatiquement le 2026-07-19 avant refonte architecture*
