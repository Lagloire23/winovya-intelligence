_# 🚀 PRODUCTION DEPLOYMENT GUIDE — WINOVYA Intelligence Platform

**Status**: Ready to Deploy (Task 4 Complete)  
**Estimated Time**: 45 minutes  
**Audience**: DevOps / Infrastructure team

---

## 📋 Pre-Flight Checklist

Before starting, verify you have:

- [ ] Supabase account (free tier OK) at https://supabase.com
- [ ] GitHub account with repo already created
- [ ] Netlify account at https://netlify.com
- [ ] Node.js 18+ installed locally
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] All 3 Edge Functions ready (cluster-alerts, detect-phases-and-score, match-offres)
- [ ] Frontend code ready (React + Vite)
- [ ] Database migration SQL ready (001_migration_create_opportunites_tables.sql)

---

## PHASE 1: Supabase Setup (10 min)

### Step 1.1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Fill in:
   - **Project name**: `winovya-intelligence` (or your choice)
   - **Database password**: Generate strong password (save this!)
   - **Region**: eu-west-1 (or closest to your users)
4. Click **Create new project** → wait 2-3 min for startup
5. Copy **Project URL** and **Anon Key** from Settings → API

### Step 1.2: Configure Local CLI

```bash
# Install Supabase CLI globally
npm install -g supabase@latest

# Login to your Supabase account
supabase login

# Link to your project (you'll be prompted for project ID)
supabase link --project-ref <your-project-id>

# Verify connection
supabase status
```

### Step 1.3: Apply Database Migrations

```bash
# Copy migration file to correct location
mkdir -p supabase/migrations
cp 001_migration_create_opportunites_tables.sql supabase/migrations/

# Push migrations to Supabase
supabase db push

# Verify tables created
# Go to https://supabase.com/dashboard → SQL Editor
# SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```

---

## PHASE 2: Deploy Edge Functions (8 min)

### Step 2.1: Create Function Directories

```bash
mkdir -p supabase/functions/cluster-alerts
mkdir -p supabase/functions/detect-phases-and-score
mkdir -p supabase/functions/match-offres
```

### Step 2.2: Copy Function Files

```bash
# Copy each function to its directory
cp cluster-alerts.ts supabase/functions/cluster-alerts/index.ts
cp detect-phases-and-score.ts supabase/functions/detect-phases-and-score/index.ts
cp match-offres.ts supabase/functions/match-offres/index.ts
```

### Step 2.3: Deploy Functions

```bash
# Deploy cluster-alerts
supabase functions deploy cluster-alerts \
  --project-ref <your-project-id>

# Deploy detect-phases-and-score
supabase functions deploy detect-phases-and-score \
  --project-ref <your-project-id>

# Deploy match-offres
supabase functions deploy match-offres \
  --project-ref <your-project-id>

# Verify all deployed
curl https://<your-project-id>.supabase.co/functions/v1/cluster-alerts \
  -H "Authorization: Bearer <your-anon-key>"
```

---

## PHASE 3: Frontend Build (5 min)

### Step 3.1: Setup Environment Variables

```bash
cd apps/web

# Create .env.local
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
EOF
```

### Step 3.2: Build Frontend

```bash
# Install dependencies
npm install

# Test local dev server
npm run dev
# Go to http://localhost:3000 and verify no console errors

# Build for production
npm run build

# Test production build locally
npm run preview
```

### Step 3.3: Verify Build Output

```bash
# Check dist directory exists with all files
ls -la dist/
# Should have: index.html, assets/*, favicon.ico

# Check size (should be <500KB gzipped)
du -sh dist/
```

---

## PHASE 4: GitHub Setup (5 min)

### Step 4.1: Create GitHub Repo (if not already done)

```bash
# If starting from scratch:
git init
git add .
git commit -m "Initial commit: WINOVYA Intelligence Platform"

# Create repo on GitHub at https://github.com/new
# Copy repo URL

# Add remote and push
git remote add origin https://github.com/YOUR-ORG/winovya-intelligence.git
git branch -M main
git push -u origin main
```

### Step 4.2: Add GitHub Secrets

Go to https://github.com/YOUR-ORG/winovya-intelligence/settings/secrets/actions

Add these secrets:

```
SUPABASE_ACCESS_TOKEN
  → Get from: https://supabase.com/dashboard/account/tokens
  → Click "Generate new token"
  → Scope: all

SUPABASE_PROJECT_ID
  → Get from: Supabase dashboard Settings → General → Project ID

SUPABASE_DB_PASSWORD
  → The password you set in Phase 1.1

NETLIFY_AUTH_TOKEN
  → Get from: https://app.netlify.com/user/applications
  → Click "New access token"
  → Name: GitHub Actions

NETLIFY_SITE_ID
  → Get from: Netlify dashboard → Site settings → General → Site ID
  → (You'll get this in Phase 5 after connecting to Netlify)

VITE_SUPABASE_URL
  → Your Supabase project URL (https://xxx.supabase.co)

VITE_SUPABASE_ANON_KEY
  → Your Supabase anon key from Settings → API
```

### Step 4.3: Add GitHub Actions Workflows

```bash
# Copy workflow files
mkdir -p .github/workflows
cp deploy-supabase.yml .github/workflows/
cp deploy-netlify.yml .github/workflows/

# Push to GitHub
git add .github/
git commit -m "Add CI/CD workflows"
git push origin main

# Verify workflows appear in:
# https://github.com/YOUR-ORG/winovya-intelligence/actions
```

---

## PHASE 5: Netlify Setup (7 min)

### Step 5.1: Connect GitHub to Netlify

1. Go to https://app.netlify.com/
2. Click **Import an existing project** → **GitHub**
3. Authorize Netlify to access GitHub
4. Select repo: `winovya-intelligence`
5. Config:
   - **Base directory**: (leave empty)
   - **Build command**: `npm run build`
   - **Publish directory**: `apps/web/dist`

### Step 5.2: Add Environment Variables to Netlify

In Netlify dashboard → Site settings → Build & deploy → Environment:

```
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
NODE_VERSION=18
```

### Step 5.3: Deploy

1. Click **Deploy site**
2. Wait ~3-5 min for build + deploy
3. Netlify assigns you a random URL (e.g., `abcd1234.netlify.app`)
4. Verify site loads at that URL

### Step 5.4: Update GitHub Secret

Go back to GitHub → Settings → Secrets → Add:

```
NETLIFY_SITE_ID=<your-netlify-site-id>
```

---

## PHASE 6: Initial Data Processing (10 min)

### Step 6.1: Seed Enterprise Offres

```bash
# Create SQL file with offre mappings
# This example maps Ekium's services to opportunity types

supabase db push <<'SQL'
INSERT INTO entreprise_offres (
  entreprise_id, code_offre, nom_offre, description,
  type_opportunite_applicables, active
) VALUES
  (
    1,
    'ENG-CONST',
    'Ingénierie de Construction d\'Usine',
    'Services complets de conception et construction d\'usines industrielles',
    ARRAY['Expansion industrielle', 'Extension de site', 'Conformité industrielle'],
    true
  ),
  (
    1,
    'ENG-PROC',
    'Ingénierie Procédés',
    'Expertise en procédés industriels et optimisation d\'usines existantes',
    ARRAY['Expansion industrielle', 'Conformité ICPE'],
    true
  );
SQL
```

### Step 6.2: Trigger Clustering on Existing Alerts

```bash
# Call cluster-alerts Edge Function manually
curl -X POST \
  https://<your-project-id>.supabase.co/functions/v1/cluster-alerts \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json"

# Wait ~30s for clustering to complete
# Check results:
# SELECT COUNT(*) FROM opportunites;
# Expected: 50-80 opportunities from 414 alerts
```

### Step 6.3: Detect Phases & Score

```bash
# Call detect-phases-and-score
curl -X POST \
  https://<your-project-id>.supabase.co/functions/v1/detect-phases-and-score \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json"

# Wait ~1 min for phase detection
# Check results:
# SELECT phase_detectee, COUNT(*) FROM opportunites
#   GROUP BY phase_detectee;
# Expected: 90%+ have detected phase
```

### Step 6.4: Match Offres

```bash
# Call match-offres
curl -X POST \
  https://<your-project-id>.supabase.co/functions/v1/match-offres \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json"

# Check results:
# SELECT COUNT(*) FROM opportunite_pertinence_entreprise
#   WHERE offres_recommandees IS NOT NULL;
```

---

## PHASE 7: Verification & Go-Live (5 min)

### Step 7.1: Test Dashboard

1. Open your Netlify site: `https://your-site.netlify.app`
2. Verify:
   - [ ] Page loads in <2s
   - [ ] No console errors (F12 → Console tab)
   - [ ] Dashboard shows 50-80 opportunities
   - [ ] Can click an opportunity → shows details
   - [ ] Can see phases timeline
   - [ ] Scoring badges display (Très haute/Haute/Moyenne/Basse)

### Step 7.2: Test API Endpoints

```bash
# Get opportunities list
curl https://<your-netlify-site>/api/opportunites?limit=10

# Get single opportunity detail
curl https://<your-netlify-site>/api/opportunites/<opp-id>

# Get phases timeline
curl https://<your-netlify-site>/api/opportunites/<opp-id>/phases
```

### Step 7.3: Verify Data Flow

```sql
-- Check database metrics
SELECT 'Alertes' as type, COUNT(*) as count FROM alertes
UNION ALL
SELECT 'Opportunites', COUNT(*) FROM opportunites
UNION ALL
SELECT 'Phases detectees', COUNT(*) FROM phases_projet
UNION ALL
SELECT 'Pertinences', COUNT(*) FROM opportunite_pertinence_entreprise
```

### Step 7.4: Enable Monitoring

**Supabase Logs**:
- Go to Supabase dashboard → Logs
- Check Function logs for errors

**Netlify Analytics**:
- Netlify dashboard → Analytics
- Track page views, build times

**GitHub Actions**:
- https://github.com/YOUR-ORG/winovya-intelligence/actions
- Verify workflows pass

---

## 🎯 Production Success Metrics

After go-live, track these KPIs:

| Metric | Target | How to Check |
|--------|--------|-------------|
| Dashboard load time | <2s | DevTools → Network tab |
| Opportunities found | 50-80 | Dashboard → count displayed |
| Phases detected | 90%+ | SQL: `SELECT phase_detectee FROM opportunites WHERE phase_detectee IS NOT NULL` |
| Scoring distribution | Mix of all levels | Dashboard → filter by scoring |
| API error rate | <1% | Netlify dashboard → Analytics |
| Build success rate | 100% | GitHub → Actions → workflow runs |
| Function uptime | 99.9%+ | Supabase → Logs → check function health |

---

## 🚨 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **Migration fails** | SQL syntax error | Run locally first: `supabase db push --dry-run` |
| **No opportunities shown** | Clustering not triggered | Manually call `POST /api/cluster` |
| **Edge Function 500 error** | Missing env vars | Verify SUPABASE_SERVICE_ROLE_KEY in function |
| **Netlify build fails** | Node version mismatch | Set `NODE_VERSION=18` in Netlify env vars |
| **CORS errors in console** | Missing headers | Verify `netlify.toml` headers config |
| **API returns 404** | Function not deployed | Run `supabase functions deploy <name>` |
| **Blank dashboard** | Frontend env vars wrong | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |

---

## 🔄 Post-Launch Operations

### Daily
- [ ] Check Supabase logs for function errors
- [ ] Monitor Netlify build status
- [ ] Spot-check a few opportunities on dashboard

### Weekly
- [ ] Review analytics on Netlify
- [ ] Check GitHub Actions workflow success rate
- [ ] Verify clustering/scoring are running on schedule (via automated task)

### Monthly
- [ ] Backup database (Supabase → Settings → Backups)
- [ ] Review phase detection accuracy (sample 20 opportunities)
- [ ] Check for data quality issues (orphaned records, etc)

---

## 📞 Support Contacts

**Supabase Issues**:
- Docs: https://supabase.com/docs
- Support: https://supabase.com/support
- Status: https://status.supabase.com

**Netlify Issues**:
- Docs: https://docs.netlify.com
- Support: https://support.netlify.com
- Status: https://www.netlifystatus.com

**GitHub Issues**:
- Docs: https://docs.github.com
- Support: https://support.github.com

---

## ✅ Sign-Off Checklist

Before declaring production-ready:

- [ ] All 3 phases of Supabase deployed (DB + Edge Functions)
- [ ] Frontend builds without errors
- [ ] GitHub Actions workflows passing
- [ ] Netlify site live and accessible
- [ ] Dashboard loads with 50-80 opportunities
- [ ] 90%+ of opportunities have detected phases
- [ ] No API errors in console
- [ ] Mobile responsive (tested on phone)
- [ ] Monitoring configured (Netlify, Supabase, GitHub)
- [ ] Team trained on dashboard usage
- [ ] Backup plan documented

---

**Status: PRODUCTION READY 🚀**

Once this checklist is complete, your WINOVYA Intelligence Platform is live and ready for your sales & prospecting teams to start using!

Next steps:
1. Share dashboard URL with team
2. Provide access to Supabase for admins
3. Set up weekly monitoring schedule
4. Plan Phase 2 evolution (ML, CRM integration, notifications)

---

**For questions, refer to README_COMPLETE.md or IMPLEMENTATION_SUMMARY.md**
