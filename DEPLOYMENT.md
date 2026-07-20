# 🚀 Guide de Déploiement Complet — WINOVYA Intelligence Platform

## Phase 1: Préparation Supabase

### 1.1 Créer project Supabase
```bash
# Aller à https://supabase.com et créer un nouveau project
# Project ID: winovya-intelligence (ou similaire)
# Region: Frankfurt (europe-west1) ou US East si vous préférez
# Password: générer une password forte
```

### 1.2 Cloner le repo et configurer local

```bash
git clone https://github.com/your-org/winovya-intelligence-platform.git
cd winovya-intelligence-platform

# Installer Supabase CLI
npm install -g supabase

# Créer fichier .env.local
cp .env.example .env.local

# Remplir les variables:
# SUPABASE_URL = https://your-project.supabase.co
# SUPABASE_KEY = ey... (anon key depuis Supabase settings)
# SUPABASE_ACCESS_TOKEN = sbp_... (personal access token depuis account settings)
```

### 1.3 Lancer Supabase localement (optionnel, pour dev)

```bash
supabase start   # Lance PostgreSQL + Studio localement

# Vérifier que c'est ok:
supabase status
```

### 1.4 Appliquer migrations SQL

```bash
# Développement local
supabase db push

# Production (après vérification)
supabase db remote-push
```

**La migration 001 crée:**
- Table `opportunites`
- Table `phases_projet`
- Table `opportunite_pertinence_entreprise`
- Table `entreprise_offres`
- Column `offres_services` dans `entreprises`
- Enums: `scoring_opportunite`, `phase_type`, `pattern_type`

### 1.5 Vérifier les migrations

```bash
# Login à https://your-project.supabase.co
# Studio → SQL Editor
# Vérifier les tables dans le schéma `veille`

SELECT table_name FROM information_schema.tables WHERE table_schema = 'veille';
-- Devrait retourner: opportunites, phases_projet, opportunite_pertinence_entreprise, entreprise_offres
```

---

## Phase 2: Déployer Edge Functions

### 2.1 Déployer les 3 Edge Functions

```bash
supabase functions deploy cluster-alerts
supabase functions deploy detect-phases-and-score
supabase functions deploy match-offres
supabase functions deploy on-new-alert  # Webhook trigger
```

### 2.2 Tester les Edge Functions

```bash
# Tester cluster-alerts
curl -X POST https://your-project.supabase.co/functions/v1/cluster-alerts \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json"

# Devrait retourner: {created_opportunities: N, clustered_alerts: 414}
```

### 2.3 Configurer webhooks (optionnel, pour automation)

Dans Supabase Studio → Database → webhooks:
```
Event: INSERT on alertes
Webhook URL: https://your-project.supabase.co/functions/v1/on-new-alert
Method: POST
```

---

## Phase 3: Préparer Frontend

### 3.1 Installer dépendances

```bash
cd apps/web
npm install
```

### 3.2 Créer .env.local

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=ey... (from Supabase)
VITE_API_BASE_URL=https://your-project.supabase.co
```

### 3.3 Tester localement

```bash
npm run dev  # Devrait lancer sur http://localhost:5173
```

Tester:
- ✓ Page Home charge
- ✓ Tableau opportunités affiche les données
- ✓ Clicker sur une opportunité montre le détail

### 3.4 Build production

```bash
npm run build
# Génère `dist/` folder

npm run preview  # Prévisualiser la build de prod
```

---

## Phase 4: GitHub Setup

### 4.1 Créer le repo GitHub

```bash
# Si pas fait:
git init
git remote add origin https://github.com/your-org/winovya-intelligence-platform.git
git branch -M main
git add .
git commit -m "Initial commit: Full stack intelligence platform"
git push -u origin main
```

### 4.2 Ajouter Secrets GitHub

Aller à: Settings → Secrets and variables → Actions

Ajouter:
```
SUPABASE_ACCESS_TOKEN = sbp_... (from account settings)
SUPABASE_DB_PASSWORD = (your Supabase DB password)
NETLIFY_AUTH_TOKEN = (from Netlify account)
NETLIFY_SITE_ID = (from Netlify site settings)
```

### 4.3 Vérifier workflows

Fichiers:
- `.github/workflows/deploy-supabase.yml` — Déclenche les migrations
- `.github/workflows/deploy-netlify.yml` — Déclenche la build Netlify

---

## Phase 5: Netlify Deployment

### 5.1 Connecter repo Netlify

1. Aller à https://app.netlify.com
2. Click "New site from Git"
3. Sélectionner GitHub + votre repo
4. Branch: `main`
5. Build command: `npm run build`
6. Publish directory: `apps/web/dist`

### 5.2 Ajouter environment variables Netlify

Site settings → Build & deploy → Environment:
```
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = ey...
VITE_API_BASE_URL = https://your-project.supabase.co
```

### 5.3 Trigger première build

```bash
git push origin main  # Déclenche GitHub Actions + Netlify build
```

Vérifier:
- ✓ GitHub Actions run (Settings → Actions)
- ✓ Netlify deploy en cours (Netlify → Deployments)

### 5.4 Vérifier le site live

Une fois build OK, votre site est à: `https://your-site.netlify.app`

Test:
- ✓ Page Home charge
- ✓ Tableau affiche opportunités
- ✓ Clicker détail fonctionne
- ✓ Pas d'erreurs console

---

## Phase 6: Peuplement données

### 6.1 Seed entreprise_offres

Créer et exécuter `supabase/migrations/002_seed_entreprise_offres.sql`:
```sql
-- Ekium offres
INSERT INTO veille.entreprise_offres (entreprise_id, code_offre, nom_offre, description, mots_cles, type_opportunite_applicables)
VALUES (
  (SELECT id FROM veille.entreprises WHERE name = 'EKIUM'),
  'ekium-engineering-construction',
  'Ingénierie & Construction d''usines',
  'Services complets ingénierie pour construction usines et sites industriels',
  ARRAY['ingénierie', 'construction', 'usine'],
  ARRAY['Nouvelle implantation industrielle / construction d''usine', 'Extension site existant']
);

-- Cetim offres
INSERT INTO veille.entreprise_offres (...)
VALUES (...);

-- Etamine offres
INSERT INTO veille.entreprise_offres (...)
VALUES (...);
```

### 6.2 Lancer clustering sur alertes existantes

```bash
# POST vers Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/cluster-alerts \
  -H "Authorization: Bearer service-role-key" \
  -H "Content-Type: application/json"

# Devrait créer 50-80 opportunités à partir des 414 alertes
```

### 6.3 Lancer phase detection

```bash
curl -X POST https://your-project.supabase.co/functions/v1/detect-phases-and-score \
  -H "Authorization: Bearer service-role-key" \
  -H "Content-Type: application/json"

# Devrait scorer toutes les opportunités
```

---

## Phase 7: Post-Deployment Checks

### Checklist Final

- [ ] Supabase migrations appliquées (vérifier via Studio)
- [ ] Edge Functions déployées (vérifier via Functions UI)
- [ ] Frontend build réussi (Netlify Deployments OK)
- [ ] Site live accessible (no 404, no errors)
- [ ] Dashboard charge et affiche opportunités
- [ ] Clicker opportunité montre détail + timeline
- [ ] Contacts décideurs affichés (si remplis)
- [ ] Mobile responsive (tester sur mobile)
- [ ] Performance acceptable (Lighthouse score > 80)

### Monitoring

Configuration:
- Netlify: Settings → Analytics pour traffic
- Supabase: Monitoring → Logs pour Edge Functions
- GitHub Actions: Settings → Actions pour CI/CD status

---

## Phase 8: Mise en Production

### 8.1 First Run Workflow

```bash
# Après tout est OK en staging:
git push origin main

# Cela déclenche automatiquement:
# 1. GitHub Actions → run tests, migrations
# 2. Netlify → build + deploy frontend
# 3. Supabase Edge Functions → sync latest
```

### 8.2 Monitoring Post-Deploy

Surveiller:
- Logs erreurs Supabase (Functions → Logs)
- Erreurs frontend (Netlify → Logs)
- Performance (Lighthouse)
- Taux d'erreur API

### 8.3 Données réelles

Une fois en prod:
```bash
# Les 3x/jour scheduled tasks populateront les alertes automatiquement
# Les Edge Functions clusterizeront et scoreront en temps quasi-réel
```

---

## Troubleshooting

### Edge Functions deploy échoue
```bash
supabase functions list  # Voir le statut
supabase functions logs cluster-alerts  # Voir les erreurs
```

### Netlify build échoue
```
Vérifier:
- Build command (npm run build)
- Publish directory (apps/web/dist)
- Environment variables VITE_*
- Node version (18+)
```

### Pas de données dans Dashboard
```sql
-- Vérifier qu'il y a des alertes
SELECT COUNT(*) FROM veille.alertes;

-- Vérifier qu'il y a des opportunités
SELECT COUNT(*) FROM veille.opportunites;

-- Si 0 opportunités, lancer clustering manuellement (voir Phase 6.2)
```

### Erreur migration SQL
```bash
supabase db reset  # Réinitialise la DB locale
supabase db push   # Re-applique les migrations
```

---

## Succès ✓

Une fois tout OK:

1. **Dashboard**: Affiche ~50-80 opportunités (clustered depuis 414 alertes)
2. **Opportunités**: Chacune a phase détectée, scoring, et chronologie
3. **Performance**: Chargement < 2s, Lighthouse > 85
4. **Automation**: Les tasks programmées populatent les alertes 3x/jour
5. **Maintenance**: Logs monitored, erreurs alertées

---

## Support & Maintenance

### Rollback (si problème)
```bash
git revert HEAD
git push origin main  # Rollback auto vers version précédente
```

### Mise à jour Edge Functions
```bash
# Editer /supabase/functions/function-name/index.ts
git push origin main  # Auto-deploie via GitHub Actions
```

### Seed nouvelles données
```bash
supabase db push --create-migrations  # Pour nouvelle migration
```

---

**Questions? Contact: tech@winovya.com**
