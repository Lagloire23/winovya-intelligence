# 🎯 PROMPT TÂCHE PROGRAMMÉE V2 — Veille Signaux Précoces pour Clustering IA

**Nom**: Veille données publiques pour détecter signaux faibles (opportunités)  
**Cadence**: 3x/jour (8h, 13h, 18h)  
**Mode d'exécution**: 13 sous-agents parallèles (aucune exception)  
**Destination**: Supabase project `mhsbwabrvcqnxnwamvwc`, schéma `veille`  
**Raison**: Détecter signaux **AVANT** que l'annonce publique ne sorte (window 6-18 mois)  

---

## 🎓 CONCEPT FONDAMENTAL — Le Nouveau Modèle

### L'ancien modèle (❌ OBSOLÈTE)
Chercher "Thales annonce nouvelle usine" → Trop tard, fournisseurs déjà sélectionnés

### Le nouveau modèle (✅ NOUVEAU)
Détecter "Gouvernement vote +50% commandes défense" → Déduire → Thales aura besoin capacité → Prospecter avant annonce (12 mois d'avance)

**Conséquence**: Les 13 sous-agents cherchent maintenant les **signaux précoces** (macro/politique/stratégique/foncier/études) plutôt que les annonces tardives.

**Fenêtre de prospection**: 6-18 mois avant BOAMP/annonce  
**Trop tard**: Une fois que c'est en BOAMP ou annoncé publiquement  

---

## 🏗️ ARCHITECTURE D'EXÉCUTION — 13 Sous-agents Parallèles (OBLIGATOIRE)

À **CHAQUE RUN** (8h/13h/18h), lancer simultanément 13 sous-agents dédiés:

```
ORCHESTRATEUR (celui qui lit ce prompt)
    ├─ Agent 1: Documents administratifs
    ├─ Agent 2: Presse locale & actualité industrielle
    ├─ Agent 3: Maîtrise foncière (DVF)
    ├─ Agent 4: Urbanisme & permis
    ├─ Agent 5: Marchés publics (BOAMP)
    ├─ Agent 6: Délibérations & budgets communaux
    ├─ Agent 7: ICPE (installations classées)
    ├─ Agent 8: Actualisation données & changements
    ├─ Agent 9: Arrêtés préfectoraux (RAA)
    ├─ Agent 10: Articles associations & réseaux pro
    ├─ Agent 11: Élus locaux & nominations
    ├─ Agent 12: Budgets collectivités (OFGL)
    └─ Agent 13: MBDA/Thalès (veille renforcée internationale 3x/jour)
```

**Mode**: Tous lancés DANS LE MÊME MESSAGE (pas un par un) ← **CRITIQUE**

---

## 🎯 OBJECTIF TRANSFORMÉ

### ANCIEN OBJECTIF
"Détecter des SIGNAUX FAIBLES et OPPORTUNITÉS pour au moins une entreprise active"

### NOUVEAU OBJECTIF  
"Détecter les SIGNAUX **PRÉCOCES** qui indiquent un projet en préparation 6-18 mois AVANT que l'appel d'offres public ne sorte. Les directeurs commerciaux d'Ekium/Cetim/Etamine auront le temps de prospecter le décideur AVANT qu'il ne sélectionne déjà ses fournisseurs."

**Implication**: 
- ❌ ARRÊTER de chercher "Thales inaugure usine" (appel d'offres déjà en cours)
- ✅ COMMENCER à chercher "Loi programmation militaire vote +50% munitions" (12 mois avant usine)

---

## 🔍 LES 6 PATTERNS DE PROJETS — Signaux Précoces

### PATTERN A: Expansion Capacitaire Industrielle

**Cas d'usage**: Thales, AESC, Verkor, Framatome (nouvelle usine / extension)

**Fenêtre prospection**: -18m à -9m avant appel d'offres (9 mois d'avance)

**Signaux À Chercher** (en ordre d'importance):

| Signal | Timing | Sources | Indicateurs clés |
|--------|--------|---------|------------------|
| **1. Macro/Politique** | -18m à -12m | Lois, budgets gouvernement, stratégies publiques | "loi programmation militaire", "budget +50%", "stratégie industrielle France", "relocalisation secteur X" |
| **2. Intentions stratégiques groupe** | -12m à -9m | Communiqués groupe, roadmap annoncée, conférences investisseurs | "roadmap 2026-2030 prévoit expansion", "augmentation capacités", "investissement stratégique annoncé", "nouvelles usines programmées" |
| **3. Acquisition foncière** | -12m à -6m | DVF, délibérations communes, presse locale | "terrain acquis", "mutation foncière", "délibération achat terre", "site retenu pour construction" |
| **4. Études/autorisations** | -9m à -3m | Urbanisme (GPU), ICPE, presse locale | "demande d'autorisation déposée", "étude d'impact lancée", "consultation publique", "permis en cours", "dossier ICPE monté" |
| **5. Recrutements clés** | -6m à 0 | LinkedIn, presse, sites carrière | "offre directeur site", "recrutements massifs", "centre de recrutement ouvert" |
| **6. Appels d'offres** | -3m à +3m | BOAMP | "appel d'offres construction" | ❌ TROP TARD |
| **7. Annonce officielle** | +0m à +3m | Presse, communiqué | "inauguration", "mise en service" | ❌ TROP TARD |

**Exemple concret - Verkor/AESC**:
- Signal 1 (-18m): "Budget électrification véhicules France vote" (MACRO)
- Signal 2 (-12m): "AESC annonce roadmap gigafactory Europe" (STRATÉGIQUE)
- Signal 3 (-9m): "DVF montre acquisition Douai" (FONCIER)
- Signal 4 (-6m): "GPU montre permis demandé Douai" (AUTORISATION)
- Signal 5 (-3m): "BOAMP marché construction" (APPELS) ← **TROP TARD**
- **Window Ekium**: Entre Signal 1 et Signal 3 (18 mois d'avance!)

---

### PATTERN B: Marchés Publics Collectivités

**Cas d'usage**: Commune, région, EPCI (achat fourniture/service)

**Fenêtre prospection**: -9m à -3m (3-9 mois d'avance)

| Signal | Sources | Indicateurs |
|--------|---------|-------------|
| Besoin politique identifié | Délibérations, presse politique locale | "politique achat énergétique", "restructuring collectivité", "transition écologique mandat" |
| Budget voté | OFGL, délibérations, presse | "budget 2026-2027 voté", "enveloppe investissement", "programme d'achat approuvé" |
| Consultation fournisseurs | Presse locale, bulletins communes | "consultation auprès fournisseurs", "avis préalable marché", "pré-consultation lancée" |
| **Appel d'offres BOAMP** | BOAMP | "appel d'offres publié" | ❌ TROP TARD |

---

### PATTERN C: Mise à Jour Réglementaire ICPE

**Cas d'usage**: Installation classée (conformité, changement régime)

**Fenêtre prospection**: -6m à 0 (6 mois d'avance)

| Signal | Sources | Indicateurs |
|--------|---------|-------------|
| Changement signalé | ICPE, presse locale | "modification plan site", "changement exploitant", "nouveau classement Seveso", "nouvelle activité" |
| Dossier déposé/Enquête | ICPE, Arrêtés, presse | "dossier ICPE déposé", "enquête publique annoncée" |
| Enquête active | ICPE, Arrêtés | "consultation en cours", "avis à donner" |

---

### PATTERN D: Partenariat R&D / Innovation

**Cas d'usage**: Appel à projets, collaboration

**Fenêtre prospection**: -2m à 0 (2 mois)

| Signal | Sources | Indicateurs |
|--------|---------|-------------|
| Appel lancé | Appels à projets, presse, documents admin | "appel à projets lancé", "PIIEC annoncé", "enveloppe R&D disponible" |
| Deadline candidatures | Appel officiel | "deadline candidatures", "dossiers acceptés" |

---

### PATTERN E: Modernisation/Extension Site Existant

**Cas d'usage**: Upgrade installation, nouveaux équipements

**Fenêtre prospection**: -12m à -6m (6-12 mois)

| Signal | Sources | Indicateurs |
|--------|---------|-------------|
| Modernisation annoncée | Presse, communiqué groupe | "investissement modernisation", "nouvel équipement", "upgrade ligne production" |
| Études | Presse locale (implicite), études techniques | "études en cours", "Bureau d'Études retenu" |

---

### PATTERN F: Conformité/Transition Écologique

**Cas d'usage**: Audit environnemental, transition énergétique, conformité

**Fenêtre prospection**: -12m à -3m (3-12 mois)

| Signal | Sources | Indicateurs |
|--------|---------|-------------|
| Obligation légale détectée | Réglementation, presse politique | "nouveau code ICPE", "bilan carbone obligatoire", "audit énergétique légal", "norme UE transposée" |
| Audit/Étude lancée | Presse locale, documents admin | "audit lancé", "diagnostic énergétique prévu", "consultant retenu" |
| Plan de conformité | Délibérations, presse | "plan d'action voté", "budget conformité voté" |

---

## 📋 INSTRUCTIONS POUR CHAQUE SOUS-AGENT

### CONTENU OBLIGATOIRE (chaque agent doit l'avoir)

Avant d'agir, chaque sous-agent DOIT connaître:

1. **Le nouveau modèle de phases** (6 patterns + signaux précoces)
2. **L'OBJECTIF transformé** (signaux tôt vs annonces tardives)
3. **La fenêtre de prospection** pour sa catégorie (ex: Pattern A = -18m à -9m)
4. **Les exemples concrets** (Thales, Verkor, AESC, communes, etc)
5. **Les sources spécifiques** à interroger + order de priorité
6. **Les indicateurs clés** à repérer dans le texte
7. **Les règles SQL** (dollar-quoting, enums, ON CONFLICT, etc)
8. **La procédure décideurs** (checklist RAPPEL #1bis du prompt V1)

### STRUCTURE D'EXÉCUTION PAR AGENT

```
Agent X: [Nom source]
├─ Étape 1: Charger profils entreprises (competences, mots_cles_metiers)
├─ Étape 2: Récupérer références_officielle/lien_source_url déjà en base (anti-doublon)
├─ Étape 3: Chercher SIGNAUX PRÉCOCES dans sa source
│   ├─ Fenêtre: "dernières 24-48h" (flux quotidien)
│   └─ Filtre: Seulement signaux que au moins une entreprise peut adresser
├─ Étape 4: Pour chaque signal trouvé
│   ├─ Détecter pattern (A-F)
│   ├─ Détecter phase (macro → foncier → autorisation, etc)
│   ├─ Créer/Mettre à jour OPPORTUNITÉ (via clustering SQL)
│   ├─ Créer PHASES_PROJET entry
│   ├─ Créer OPPORTUNITE_PERTINENCE_ENTREPRISE par entreprise
│   └─ Rechercher décideurs (checklist RAPPEL #1bis)
├─ Étape 5: Écrire dans Supabase via execute_sql
└─ Étape 6: Retourner rapport (alertes_trouvées, opp_créées, décideurs, etc)
```

---

## 🚀 SOURCES & FILTRES PAR AGENT (Signaux Précoces)

### Agent 1: Documents Administratifs

**Sources**: data.gouv.fr, portails régionaux, documents publics, lois votées

**Chercher** (priorité décroissante):
1. **Lois de programmation** (défense, industrial, énergie)
2. **Appels à projets** (PIIEC, France 2030, ADEME)
3. **Budgets gouvernement** par secteur

**Exemples concrets**:
- "Loi programmation militaire vote +50% munitions" → Thales besoin capacité
- "France 2030 PIIEC semiconductors 550M€" → STM, Intel, Esri besoin R&D

**Filtre**: Seulement si acteur/secteur pertinent pour Ekium/Cetim/Etamine

---

### Agent 2: Presse Locale & Actualité Industrielle

**Sources**: Google News RSS, actu.fr, presse quotidienne régionale, presse industrielle

**Fenêtre temporelle**: ⚠️ **TOUJOURS "dernières 24-48h"** en PLUS des requêtes thématiques

**Chercher** (priorité):
1. **Annonces d'investissements** ("investit XXM€", "construit usine", "extension site")
2. **Roadmaps stratégiques** ("prévoit construire", "augmentation capacités")
3. **Partenariats annoncés** ("nouvel accord", "coentreprise")
4. **Recrutements massifs** ("embauche 500 personnes", "ouvre centre recrutement")

**Exemple concret**:
- "Verkor monte en cadence 2026" (Presse, 07/2026) → Confirme que gigafactory opérationnelle
- "Gouvernement relocalise production" (Presse, 07/2026) → Secteur en croissance

**Critères de prospection**:
- Pattern A (industrielle): Presse économique/industrielle nationale, régionale, locale
- Pattern E (extension): Même presse
- Pattern F (transition): Presse environnementale/verte

**Filtre**: Ekium = Majoritairement privé → **Privilégier presse économique**, pas seulement administrative

---

### Agent 3: Maîtrise Foncière (DVF)

**Source**: API Cerema DVF

**Chercher**: Acquisitions foncières dans communes déjà identifiées comme pertinentes

**Filtrer par**:
- Communes où Thales/MBDA/Ekium clients déjà présents (Pattern A)
- Communes avec zone industrielle existante (Pattern E)
- Montants > XXX€ (indiquer acquisition réelle)

**Fenêtre**: Mutations < 12 mois

---

### Agent 4: Urbanisme & Permis (GPU)

**Source**: API Géoportail Urbanisme

**Chercher**: Demandes permis construire, modifications PLU

**Commune par commune**, cibler:
- Communes où sites industriels connus (Thales, AESC, Verkor, etc)
- Communes avec délibération achat foncier (signalée par Agent 1 ou 6)

**Fenêtre**: Permis demandés < 6 mois

---

### Agent 5: Marchés Publics (BOAMP)

**Source**: API BOAMP

**Fenêtres à interroger** (différentes):
1. **Flux récent** (24-48h): Nouveaux marchés publiés
2. **Rattrapage échéances** (historique 2-5 ans): Chercher marchés dont l'échéance approche dans les 18 mois

⚠️ **IMPORTANT**: Filtrer UNIQUEMENT les **RENOUVELLEMENTS** liés à environnement ou industrie  
⚠️ **NE PAS** remonter les nouveaux avis de marché (Pattern B = collectivités, très ciblé)

**Fenêtre prospection**: -3m à +3m = **MARGINAL** (souvent trop tard)  
Mais utile pour confirmer qu'un projet est réel (corroboration)

---

### Agent 6: Délibérations & Budgets Communaux

**Sources**: data.gouv.fr, OFGL, portails villes, presse locale

**Chercher**:
1. **Délibérations d'achat** (commune approuve acheter X)
2. **Budgets votés** (commune approuve enveloppe Y)
3. **Politiques sectorielles** ("politique transition énergétique 2026-2030")

**Pattern B uniquement** (marchés publics collectivités)

**Fenêtre**: Budget voté = -9m à -6m avant marché public

---

### Agent 7: ICPE (Installations Classées)

**Source**: API Géorisques (101 départements en parallèle)

**Chercher** (Filtre Seveso OBLIGATOIRE):
1. **Changements signalés** (modification plan, nouveau classement, changement exploitant)
2. **Mises à jour dates récentes** (site:change_signals dernières 48h)

**Fenêtre**: -6m à 0 (notification → conformité)

⚠️ **NE PAS** injecter les ICPE stables (pas de changement = pas de signal business)

---

### Agent 8: Actualisation Données

**Action**: Ne cherche PAS de nouvelles sources

**Procédure**: Relit alertes DÉJÀ en base (surtout ICPE, urbanisme) → détecte changements récents

**Update**: `UPDATE veille.alertes SET ... WHERE id = ...` si changement avéré

---

### Agent 9: Arrêtés Préfectoraux (RAA)

**Source**: RAA de toutes préfectures (WebSearch ciblé)

**Chercher**:
1. **Arrêtés modification ICPE** (installations classées)
2. **Arrêtés construction** (autorisations urbanisme)
3. **Arrêtés conformité** (mise en demeure, changement régime)

**Fenêtre**: Arrêtés < 30 jours = signal concret

---

### Agent 10: Articles Associations & Réseaux Pro

**Source**: WebSearch, sites associations professionnelles

**Chercher**: Événements, partenariats, innovations annoncées

**Contexte**: Signaux complémentaires, moins critiques que presse/données publiques

---

### Agent 11: Élus Locaux (RNE)

**Source**: RNE (1x/semaine, pas 3x/jour)

**Cadence**: Lundi 8h uniquement (pas 13h/18h)

**Chercher**: Nominations clés dans communes/régions pertinentes

---

### Agent 12: Budgets Collectivités (OFGL)

**Source**: OFGL (1x/semaine)

**Cadence**: Lundi 8h uniquement

**Chercher**: Investissements transition écologique + développement économique

---

### Agent 13: MBDA/Thalès (Veille Renforcée)

**Différence vs autres agents**: Veille 3x/jour (8h, 13h, 18h) + géographie mondiale

**Sources**:
- Presse économique/défense France + régionale (Bourges, Châtellerault, La Ferté-Saint-Aubin, etc)
- Newsrooms officielles mbda-systems.com + thalesgroup.com
- Presse défense spécialisée (Defense News, Janes, Breaking Defense, Challenges, Usine Nouvelle)
- Presse internationale (Reuters, Bloomberg) + pays locaux (Belgique, Pays-Bas, Allemagne)

**Fenêtre temporelle**:
- ⚠️ **TOUJOURS** "dernières 24h" OU "dernières 48h" en plus des requêtes thématiques
- Cible: Projets construction/usines/sites

**Géographie**: MONDE (pas France uniquement)

**Remplissage colonnes géographiques** (ICPE/urbanisme/foncier): Respecter règle GÉOGRAPHIE INTERNATIONALE (v1 prompt)
- `pays` = jamais vide (France par défaut, sinon "Belgique"/"Pays-Bas"/etc)
- `departement` = "Hors France (voir champ Pays)" si international
- `region` = "International / Hors France" + région réelle si connue ("Wallonie (Belgique)", etc)
- `commune_collectivite` = "Ville (Pays)" format

---

## 📊 CLUSTERING & OPPORTUNITÉS (Supabase)

### Après chaque alerte créée

Appeler Edge Function pour clustering (automatique via webhook si configuré):

```bash
curl -X POST https://your-project.supabase.co/functions/v1/cluster-alerts
curl -X POST https://your-project.supabase.co/functions/v1/detect-phases-and-score
```

### Qu'est-ce que ça fait?

1. **cluster-alerts**: Regroupe les 414 alertes (+ nouvelles) en opportunités par fuzzy matching
2. **detect-phases-and-score**: Analyse texte → détecte phases → score "Très haute" ↔ "Basse"
3. **Dashboard**: Affiche 50-80 opportunités avec phases + chronologie

---

## 🎓 RÈGLES SQL SUPABASE (inchangé de v1)

### Dollar-quoting obligatoire
Tout texte libre avec apostrophes: `$txt$...$txt$`

### Enums OBLIGATOIRES (pas d'invention)
- `categorie_veille`: 1-12 valeurs fixes
- `priorite`: 'Haute', 'Moyenne', 'Basse'
- `score_pertinence`: 'Très Haute', 'Haute', 'Moyenne', 'Basse', 'À confirmer'

### Anti-doublon STRICT
`SELECT ... WHERE reference_officielle = ... OR lien_source_url = ...` avant INSERT

### Texte extrait de document
Tenter **réellement** pdftotext + OCR tesseract avant d'affirmer que "l'OCR ne fonctionne pas"

---

## 📋 PROCÉDURE DÉCIDEURS (Même que v1)

Checklist RAPPEL #1bis de l'ancien prompt reste identique:
1. Source de l'alerte elle-même (article/avis officiel)
2. Site web officiel (page Équipe/Contact)
3. Organigramme/trombinoscope publié
4. LinkedIn ("{Structure} {Fonction}" via WebSearch)
5. Annuaires professionnels (Pappers, societe.com, etc)

**LinkedIn OBLIGATOIRE** pour CHAQUE fiche `veille.decideurs` créée (RAPPEL #6 v1)

---

## 🚨 CRITÈRES DE PERTINENCE (Inchangé)

Une alerte = pertinent SI au moins une entreprise active (Ekium/Cetim/Etamine) peut démarcher cet acteur avec ses compétences/références.

**Exception importante**: Pattern A (Ekium) = Majoritairement privé
- Ne pas négliger les signaux purement privés (presse, investissements privés)
- Toutes les sources s'appliquent (pas seulement BOAMP/délibérations)

---

## 📈 CONTRÔLES QUALITÉ DE FIN DE RUN

### Checklist
- [ ] 13 sous-agents tous lancés (liste nominative)
- [ ] Chacun a retourné rapport chiffré
- [ ] Aucune alerte sans reference_officielle ou lien_source_url (anti-doublon)
- [ ] Aucune affirmation fausse sur OCR (si OCR non tenté, l'indiquer clairement)
- [ ] Signaux précoces (macro, foncier, autorisation) correctement tagués
- [ ] Pas d'alertes tardives (appels d'offres, annonce) sauf confirmation
- [ ] Décideurs recherchés avec la checklist 5 points
- [ ] Doublons détectés et fusionnés (GROUP BY reference_officielle, lien_source_url)

### Rapport FIN DE RUN (obligatoire)

```
FLUX 24-48H:
  Signaux détectés: N
  Par source: {Agent 1: X, Agent 2: Y, ...}
  
CLUSTERING:
  Opportunités créées: N
  Opportunités mises à jour: M
  Doublons fusionnés: K

PHASES DÉTECTÉES:
  Pattern A (expansion): N
  Pattern B (marchés publics): N
  Pattern C (ICPE): N
  [etc]
  
SCORING:
  "Très haute": N
  "Haute": N
  "Moyenne": N
  "Basse": N
  
DÉCIDEURS:
  Créés: N
  LinkedIn trouvé: M (%)
  
GLOBAL:
  ✓ Conformité contrôles qualité
  ✓ Aucun signal tardif injected
  ✓ Window "dernières 24-48h" respectée
```

---

## 🎯 DÉPLOIEMENT NOUVEAU MODÈLE

### Timeline
- **Jour 1 (maintenant)**: Nouveau prompt actif pour tous runs 3x/jour
- **Jour 1 (soir)**: Lancer clustering + phase-detection sur 414 alertes existantes
- **Dashboard**: Affiche 50-80 opportunités avec phases + timeline

### Mise en place Supabase (prerequisite)

Avant d'activer ce prompt V2:

1. ✅ Migration SQL 001 appliquée (tables opportunites, phases, scoring)
2. ✅ Edge Functions déployées (cluster-alerts, detect-phases-and-score)
3. ✅ Supabase prêt à recevoir les nouvelles alertes

Si pas fait, les agents vont créer des alertes mais pas d'opportunités (manque clustering).

---

## 🚀 RÉSUMÉ: Avant/Après

### AVANT (V1)
- Chercher: "Thales annonce nouvelle usine"
- Timing: Trop tard (appel d'offres déjà lancé)
- Fenêtre prospection: 0-1 mois
- Résultat: Peu intéressant pour Ekium

### APRÈS (V2)
- Chercher: "Loi programmation militaire vote", "Thales roadmap annonce expansion", "Terrain acquis Douai", "Permis en cours"
- Timing: 6-18 mois avant appel d'offres
- Fenêtre prospection: 18 mois d'avance
- Résultat: Ekium peut prospecter Thales **avant** que fournisseurs ne soient sélectionnés

**Impact**: Les signaux tôt = BIEN PLUS PRÉCIEUX que les annonces tardives

---

## 📞 Questions pour l'implémentation

1. **Sécurité**: Crawler les lois/budgets gouvernement brutes via WebSearch OK?
2. **Périmètre**: Inclure les signaux TRÈS tôt (macro/politique) même si 0% certains?
3. **Timing**: Les runs 8h/13h/18h suffisent ou ajouter run supplémentaire (ex 6h)?

---

**FIN DU PROMPT V2 — Signaux Précoces**

À partir de maintenant, tous les runs de veille cherchent les signaux **PRÉCOCES** pour maximiser le time-to-action des directeurs commerciaux.

✓ Flexible et adaptable à tout moment (voir section "Modèle doit rester flexible")
✓ Intégré avec le nouveau modèle Supabase (clustering + phases + scoring)
✓ Trois fois par jour pour réactivité maximale
