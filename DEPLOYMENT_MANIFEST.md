# 📦 DEPLOYMENT MANIFEST — File Organization

**Complete file checklist for deploying WINOVYA Intelligence Platform**

---

## 🎯 Quick Copy Commands

```bash
# Clone the repo (if starting fresh)
git clone https://github.com/YOUR-ORG/winovya-intelligence.git
cd winovya-intelligence

# Copy all files from C:\Users\pc\Desktop\Logo winovya market intelligence\
# Into your repo using the structure below
```

---

## 📂 Repository Structure

```
winovya-intelligence/
├── supabase/
│   ├── migrations/
│   │   └── 001_create_opportunites_tables.sql
│   └── functions/
│       ├── cluster-alerts/
│       │   └── index.ts                      ← cluster-alerts.ts
│       ├── detect-phases-and-score/
│       │   └── index.ts                      ← detect-phases-and-score.ts
│       └── match-offres/
│           └── index.ts                      ← match-offres.ts
│
├── apps/
│   └── web/
│       ├── src/
│       │   ├── App.tsx                       ✅ Created
│       │   ├── pages/
│       │   │   ├── Home.tsx                  (template)
│       │   │   ├── OpportunityDetail.tsx     (template)
│       │   │   └── Settings.tsx              (template)
│       │   ├── components/
│       │   │   └── Navigation.tsx            (template)
│       │   └── styles/
│       │       └── globals.css               (template)
│       ├── public/
│       │   └── favicon.ico
│       ├── package.json                      (update deps)
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── index.html
│
├── .github/
│   └── workflows/
│       ├── deploy-supabase.yml               ✅ Created
│       └── deploy-netlify.yml                ✅ Created
│
├── .env.example                              ✅ Created
├── .gitignore                                ✅ Created
├── netlify.toml                              ✅ Created
├── README.md                                 (copy README_COMPLETE.md)
├── DEPLOYMENT.md                             (copy PRODUCTION_DEPLOYMENT.md)
├── package.json                              (root)
└── ...
```

---

## ✅ Files by Component

### 1. Database & Migrations

**To Copy**: `supabase/migrations/`

```
001_create_opportunites_tables.sql
  ← Copy from: 001_migration_create_opportunites_tables.sql
  
Location: supabase/migrations/001_create_opportunites_tables.sql
Size: ~1000 lines
```

---

### 2. Edge Functions

**To Copy**: `supabase/functions/`

```
cluster-alerts/index.ts
  ← Copy from: cluster-alerts.ts
  Location: supabase/functions/cluster-alerts/index.ts
  Size: ~400 lines

detect-phases-and-score/index.ts
  ← Copy from: detect-phases-and-score.ts
  Location: supabase/functions/detect-phases-and-score/index.ts
  Size: ~600 lines

match-offres/index.ts
  ← Copy from: match-offres.ts
  Location: supabase/functions/match-offres/index.ts
  Size: ~200 lines
```

**Command**:
```bash
mkdir -p supabase/functions/cluster-alerts
mkdir -p supabase/functions/detect-phases-and-score
mkdir -p supabase/functions/match-offres

cp cluster-alerts.ts supabase/functions/cluster-alerts/index.ts
cp detect-phases-and-score.ts supabase/functions/detect-phases-and-score/index.ts
cp match-offres.ts supabase/functions/match-offres/index.ts
```

---

### 3. API Endpoints

**To Copy**: `apps/web/src/`

```
api-endpoints.ts
  → Used by frontend to call REST API
  → Can be placed in: apps/web/src/lib/api.ts
  Location: apps/web/src/lib/api.ts
  Size: ~450 lines
```

**Command**:
```bash
mkdir -p apps/web/src/lib
cp api-endpoints.ts apps/web/src/lib/api.ts
```

---

### 4. Frontend (React)

**To Copy**: `apps/web/src/`

```
App.tsx
  → Main React component + routing
  Location: apps/web/src/App.tsx
  Size: ~300 lines

pages/
  ├── Home.tsx          (create if not exists)
  ├── OpportunityDetail.tsx (create if not exists)
  └── Settings.tsx      (create if not exists)

components/
  └── Navigation.tsx    (create if not exists)
```

**Command**:
```bash
mkdir -p apps/web/src/pages
mkdir -p apps/web/src/components

cp App.tsx apps/web/src/App.tsx
# Home.tsx, OpportunityDetail.tsx, Settings.tsx, Navigation.tsx are templates
# Create them if they don't exist
```

---

### 5. Configuration Files

**To Copy**: Root & config directories

```
netlify.toml
  → Netlify deployment config
  Location: ./netlify.toml
  Size: ~100 lines

.env.example
  → Template for environment variables
  Location: ./.env.example
  Size: ~30 lines

.gitignore_template
  → Git ignore rules
  Location: ./.gitignore (rename from template)
  Size: ~50 lines
```

**Command**:
```bash
cp netlify.toml ./netlify.toml
cp .env.example ./.env.example
cp .gitignore_template ./.gitignore
```

---

### 6. GitHub Actions CI/CD

**To Copy**: `.github/workflows/`

```
deploy-supabase.yml
  → Auto-deploy Supabase migrations on push
  Location: .github/workflows/deploy-supabase.yml
  Size: ~50 lines

deploy-netlify.yml
  → Auto-build & deploy frontend on push
  Location: .github/workflows/deploy-netlify.yml
  Size: ~60 lines
```

**Command**:
```bash
mkdir -p .github/workflows
cp deploy-supabase.yml .github/workflows/deploy-supabase.yml
cp deploy-netlify.yml .github/workflows/deploy-netlify.yml
```

---

### 7. Documentation

**To Copy**: Root documentation

```
README.md
  ← Copy from: README_COMPLETE.md
  Location: ./README.md
  Purpose: Quick start + architecture overview

DEPLOYMENT.md
  ← Copy from: PRODUCTION_DEPLOYMENT.md
  Location: ./DEPLOYMENT.md
  Purpose: Step-by-step production deployment (7 phases, 45 min)

IMPLEMENTATION_SUMMARY.md
  Location: ./IMPLEMENTATION_SUMMARY.md
  Purpose: Project overview + checklist

FINAL_STATUS_TASK_4_5_COMPLETE.md
  Location: ./FINAL_STATUS_TASK_4_5_COMPLETE.md
  Purpose: Complete status report

PROMPT_TACHE_PROGRAMMEE_V2_SIGNAUX_PRECOCES.md
  Location: ./docs/PROMPT_TACHE_PROGRAMMEE_V2_SIGNAUX_PRECOCES.md
  Purpose: Automated surveillance task prompt (for sub-agents)
```

**Command**:
```bash
cp README_COMPLETE.md README.md
cp PRODUCTION_DEPLOYMENT.md DEPLOYMENT.md
cp IMPLEMENTATION_SUMMARY.md ./IMPLEMENTATION_SUMMARY.md
cp FINAL_STATUS_TASK_4_5_COMPLETE.md ./FINAL_STATUS_TASK_4_5_COMPLETE.md
mkdir -p docs
cp PROMPT_TACHE_PROGRAMMEE_V2_SIGNAUX_PRECOCES.md docs/
```

---

## 📋 Complete Copy Script

Run this one-liner to copy all files:

```bash
#!/bin/bash

# Set source directory
SRC="/sessions/eloquent-amazing-ramanujan/mnt/Logo winovya market intelligence/"

# Copy supabase files
mkdir -p supabase/migrations supabase/functions/{cluster-alerts,detect-phases-and-score,match-offres}
cp "$SRC/001_migration_create_opportunites_tables.sql" supabase/migrations/001_create_opportunites_tables.sql
cp "$SRC/cluster-alerts.ts" supabase/functions/cluster-alerts/index.ts
cp "$SRC/detect-phases-and-score.ts" supabase/functions/detect-phases-and-score/index.ts
cp "$SRC/match-offres.ts" supabase/functions/match-offres/index.ts

# Copy frontend
mkdir -p apps/web/src/{lib,pages,components}
cp "$SRC/App.tsx" apps/web/src/App.tsx
cp "$SRC/api-endpoints.ts" apps/web/src/lib/api.ts

# Copy config files
cp "$SRC/netlify.toml" ./netlify.toml
cp "$SRC/.env.example" ./.env.example
cp "$SRC/.gitignore_template" ./.gitignore

# Copy GitHub Actions
mkdir -p .github/workflows
cp "$SRC/deploy-supabase.yml" .github/workflows/deploy-supabase.yml
cp "$SRC/deploy-netlify.yml" .github/workflows/deploy-netlify.yml

# Copy documentation
cp "$SRC/README_COMPLETE.md" README.md
cp "$SRC/PRODUCTION_DEPLOYMENT.md" DEPLOYMENT.md
cp "$SRC/IMPLEMENTATION_SUMMARY.md" ./IMPLEMENTATION_SUMMARY.md
cp "$SRC/FINAL_STATUS_TASK_4_5_COMPLETE.md" ./FINAL_STATUS_TASK_4_5_COMPLETE.md
mkdir -p docs
cp "$SRC/PROMPT_TACHE_PROGRAMMEE_V2_SIGNAUX_PRECOCES.md" docs/

echo "✅ All files copied successfully!"
```

---

## 📦 Package.json Configuration

Your `package.json` should have these scripts:

```json
{
  "name": "winovya-intelligence",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "cd apps/web && vite",
    "build": "cd apps/web && vite build",
    "preview": "cd apps/web && vite preview",
    "deploy:supabase": "supabase functions deploy cluster-alerts && supabase functions deploy detect-phases-and-score && supabase functions deploy match-offres",
    "deploy:all": "npm run build && npm run deploy:supabase"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.0.0",
    "@supabase/supabase-js": "^2.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "vite": "^4.0.0"
  }
}
```

---

## ✅ Pre-Flight Verification

Before pushing to GitHub, verify all files are in place:

```bash
# Check supabase files
ls -la supabase/migrations/001_create_opportunites_tables.sql
ls -la supabase/functions/cluster-alerts/index.ts
ls -la supabase/functions/detect-phases-and-score/index.ts
ls -la supabase/functions/match-offres/index.ts

# Check frontend files
ls -la apps/web/src/App.tsx
ls -la apps/web/src/lib/api.ts

# Check config files
ls -la netlify.toml
ls -la .env.example
ls -la .gitignore

# Check GitHub Actions
ls -la .github/workflows/deploy-supabase.yml
ls -la .github/workflows/deploy-netlify.yml

# Check documentation
ls -la README.md
ls -la DEPLOYMENT.md

echo "✅ All files present!"
```

---

## 🚀 Next Steps

1. **Copy all files** using the script above
2. **Update package.json** with proper dependencies
3. **Add .env.local** (copy from .env.example)
4. **Test locally**: `npm run dev`
5. **Commit & push**: `git add . && git commit -m "Initial commit: WINOVYA Intelligence Platform" && git push origin main`
6. **Follow DEPLOYMENT.md** for production deployment (7 phases, 45 min)

---

## 📊 File Checklist

- [x] `001_migration_create_opportunites_tables.sql` — Database schema
- [x] `cluster-alerts.ts` — Edge Function for clustering
- [x] `detect-phases-and-score.ts` — Edge Function for phase detection
- [x] `match-offres.ts` — Edge Function for offres matching
- [x] `App.tsx` — React main component
- [x] `api-endpoints.ts` — REST API endpoints
- [x] `netlify.toml` — Netlify configuration
- [x] `.env.example` — Environment variables template
- [x] `.gitignore` — Git ignore rules
- [x] `deploy-supabase.yml` — GitHub Actions: Supabase deploy
- [x] `deploy-netlify.yml` — GitHub Actions: Netlify deploy
- [x] `README.md` — Quick start guide
- [x] `DEPLOYMENT.md` — Production deployment guide
- [x] `IMPLEMENTATION_SUMMARY.md` — Implementation overview
- [x] `FINAL_STATUS_TASK_4_5_COMPLETE.md` — Project status

**Total: 15 core files + documentation**

---

## 🎯 Success Criteria

After copying all files:

- [ ] No missing files (run verification commands above)
- [ ] Git repo initialized (`git init`)
- [ ] All files committed (`git add . && git commit -m "..."`)
- [ ] GitHub remote added (`git remote add origin ...`)
- [ ] Code pushed to main branch (`git push -u origin main`)
- [ ] GitHub Actions workflows visible in Actions tab
- [ ] `.env.local` created locally (from `.env.example`)
- [ ] Ready for Phase 1: Supabase setup

---

**You're now ready to deploy! Follow DEPLOYMENT.md for step-by-step instructions (45 min total).**
