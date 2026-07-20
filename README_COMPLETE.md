# 🎯 WINOVYA Intelligence Platform — Full Stack

**Plateforme de veille et clustering IA pour détecter les opportunités d'affaires via signaux faibles**

- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Deployment**: Netlify (frontend) + Supabase Cloud (backend)
- **CI/CD**: GitHub Actions (automated migrations & deploys)

---

## 📊 Vue d'ensemble

### Problème résolu

Les directeurs commerciaux (Ekium, Cetim, Etamine) doivent prospecter leurs clients **avant** que les appels d'offres ne sortent publiquement. Une fois qu'un projet est annoncé en BOAMP ou en presse, il est trop tard — les fournisseurs sont déjà sélectionnés.

**Solution**: Détecter les signaux faibles et précoces (macro/politique, stratégique, foncier, autorisations) qui indiquent qu'un projet est en préparation 6-18 mois avant l'annonce publique.

### Fonctionnalités principales

1. **Clustering IA**: Regroupe ~414 alertes existantes en ~50-80 opportunités par fuzzy matching (acteur + localité + type)
2. **Phase Detection**: Analyse texte → détecte quelle phase du projet (macro → foncier → autorisation → etc)
3. **Scoring d'opportunité**: Attribue score "Très haute" ↔ "Basse" selon phase + timeline
4. **Chronologie interactive**: Affiche timeline d'alertes et phases pour chaque opportunité
5. **Matching services**: Croise offres de l'entreprise (Ekium/Cetim) avec type d'opportunité détecté

### Données

- **Sources**: 13 sources de veille (ICPE, BOAMP, presse, DVF, urbanisme, etc) + scanning 3x/jour
- **Volume**: 414 alertes existantes (via tâche programmée), +~20-30/jour en flux continu
- **Entreprises**: 3 actives (CETIM, EKIUM, ETAMINE) + flexibility pour ajouter d'autres

---

## 🚀 Quick Start (5 min)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/winovya-intelligence-platform.git
cd winovya-intelligence-platform
npm install
cd apps/web && npm install
```

### 2. Supabase Setup

```bash
# Créer project sur https://supabase.com
# Copier les clés et créer .env.local

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=ey...
SUPABASE_ACCESS_TOKEN=sbp_...
```

### 3. Appliquer migrations

```bash
npm install -g supabase
supabase link --project-ref your-project-id
supabase db push
```

### 4. Lancer localement

```bash
npm run dev   # Lance frontend sur http://localhost:5173
              # Utilise Supabase cloud automatiquement
```

### 5. Déployer Netlify

```bash
git push origin main  # Auto-deploy via GitHub Actions
```

**Prêt?** Aller à http://localhost:5173 → Dashboard charge les opportunités

---

## 📐 Architecture

### Database Schema (Supabase PostgreSQL)

```
alertes (414)
  ├── opportunites (50-80 clustered)
  │   ├── phases_projet (détection phases)
  │   └── opportunite_pertinence_entreprise (scoring par entreprise)
  │
  ├── decideurs (contacts)
  │   └── alerte_decideurs (jonction 1:N)
  │
  ├── entreprises (3)
  │   └── entreprise_offres (services disponibles)
  │
  └── attachments (documents)
```

### Edge Functions (Supabase)

1. **cluster-alerts**: Regroupe alertes en opportunités (fuzzy matching)
2. **detect-phases-and-score**: Détecte phases du projet + scoring
3. **match-offres**: Croise offres entreprise avec type d'opportunité

### Frontend Pages

1. **Home** (`/`): Dashboard tableau opportunités + filtres
2. **Detail** (`/opportunites/:id`): Détail + chronologie alertes + phases
3. **Settings** (`/settings`): Gérer offres entreprise

---

## 🔄 Workflow de détection

```
Alerte entrante (414/mois)
        ↓
Clustering IA (fuzzy match acteur + localité)
        ↓
Créer/Mettre à jour Opportunité
        ↓
Phase Detection (texte → phase du projet)
        ↓
Scoring (phase + timeline → "Très haute" ↔ "Basse")
        ↓
Match Services (offres Ekium/Cetim applicables)
        ↓
Dashboard affiche Opportunité avec scoring + timeline
```

---

## 📋 Tables & Colonnes clés

### opportunites

| Colonne | Type | Notes |
|---------|------|-------|
| id | UUID | PK |
| nom | TEXT | "Gigafactory AESC Douai" |
| acteur_entite | TEXT | "AESC (Nissan)" |
| pattern_type | ENUM | A_expansion_industrielle, etc |
| alerte_ids | UUID[] | Alertes regroupées |
| phase_detectee | ENUM | Phase actuellement détectée |
| scoring_global | ENUM | "Très haute", "Haute", "Moyenne", "Basse", "À confirmer" |
| statut | VARCHAR | NOUVEAU, ASSIGNE, TRAITE, ARCHIVE |

### phases_projet

| Colonne | Type | Notes |
|---------|------|-------|
| opportunite_id | UUID | FK |
| phase_type | ENUM | "Signaux macro/politiques", "Foncier acquis", etc |
| detected_date | DATE | Quand détectée |
| confidence | INT | 0-100 % confiance |

### opportunite_pertinence_entreprise

| Colonne | Type | Notes |
|---------|------|-------|
| opportunite_id | UUID | FK |
| entreprise_id | UUID | FK |
| score_global | ENUM | "Très haute" ↔ "Basse" |
| lien_business | TEXT | Compétence + besoin + client status |
| offres_recommandees | TEXT[] | Services Ekium/Cetim applicables |

---

## 🎯 Modèle de phases (6 patterns)

### Pattern A: Expansion industrielle (Thales, AESC, Verkor)

| Phase | Timing | Pertinence | Indicateurs |
|-------|--------|-----------|-------------|
| Signaux macro/politiques | -18m | ⭐⭐⭐⭐⭐ | "loi programmation", "budget gouvernement" |
| Intentions stratégiques | -12m | ⭐⭐⭐⭐⭐ | "roadmap", "augmentation capacités" |
| Acquisitions foncières | -12m à -6m | ⭐⭐⭐⭐ | "DVF", "terrain acquis" |
| Études/autorisations | -9m à -3m | ⭐⭐⭐ | "permis en cours", "dossier ICPE" |
| Recrutements clés | -6m à 0 | ⭐⭐ | "directeur site", "embauche massive" |
| Appels d'offres publics | -3m à +3m | ❌ TROP TARD | "BOAMP", "appel d'offres" |
| Annonce officielle | +0m à +3m | ❌ TROP TARD | "inauguration", "mise en service" |

*Autres patterns B-F (marchés publics, ICPE, R&D, extension, conformité) dans DEPLOYMENT.md*

---

## 📊 Metrics de succès

Après déploiement en prod, on attend:

| Métrique | Cible |
|----------|-------|
| Opportunités clustered | 50-80 (depuis 414 alertes) |
| Chacune a phase détectée | 100% |
| Scoring "Très haute" pour signaux tôt | >60% |
| Scoring "Basse" pour annonces tardives | >70% |
| Dashboard load time | <2s |
| Mobile responsive | ✓ |
| Lighthouse score | >85 |

---

## 🛠️ Development

### Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, React Router
- **Backend**: PostgreSQL (Supabase), Node.js (Edge Functions)
- **Build**: Vite, npm
- **Deploy**: Netlify (frontend), Supabase Cloud (backend)
- **CI/CD**: GitHub Actions

### Commands

```bash
# Development
npm run dev          # Frontend dev server + Supabase
npm run build        # Production build
npm run preview      # Preview production build

# Database
supabase start       # Local PostgreSQL
supabase db push     # Apply migrations locally
supabase db remote-push  # Push to production

# Edge Functions
supabase functions deploy cluster-alerts
supabase functions deploy detect-phases-and-score
supabase functions deploy match-offres

# Deployments
git push origin main  # Auto-triggers GitHub Actions + Netlify
```

### File Structure

```
winovya-intelligence-platform/
├── supabase/
│   ├── migrations/        # SQL migrations
│   └── functions/         # Edge Functions (TypeScript)
├── apps/web/
│   ├── src/
│   │   ├── pages/         # React pages
│   │   ├── components/    # React components
│   │   ├── api/           # Supabase client + API calls
│   │   └── styles/        # Tailwind CSS
│   └── package.json
├── .github/workflows/     # GitHub Actions
├── netlify.toml          # Netlify config
├── .env.example          # Environment template
└── DEPLOYMENT.md         # Deployment guide
```

---

## 🔐 Security & Best Practices

### Environment Variables

```
✓ VITE_SUPABASE_ANON_KEY is OK in frontend (limited read-only)
✗ SUPABASE_SERVICE_ROLE_KEY must NEVER be in frontend (full privileges)
✗ SUPABASE_ACCESS_TOKEN must NEVER be in frontend (deploy access)
```

### Deployment Secrets

Store in GitHub Secrets (Settings → Secrets), NOT in .env:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `NETLIFY_AUTH_TOKEN`

### RLS Policies (optional)

Add Row-Level Security if multiple teams need access.

---

## 📞 Troubleshooting

### Dashboard shows "No opportunities"

```bash
# Check if clustering ran
supabase functions invoke cluster-alerts

# Check if phases were detected
supabase functions invoke detect-phases-and-score

# Verify data in DB
SELECT COUNT(*) FROM veille.opportunites;
```

### Edge Function errors

```bash
supabase functions logs cluster-alerts
```

### Build fails on Netlify

- Check: Node version >= 18
- Check: Build command = `npm run build`
- Check: Publish dir = `apps/web/dist`
- Check: Environment variables set in Netlify UI

---

## 📚 Full Deployment Guide

See **DEPLOYMENT.md** for step-by-step production deployment.

---

## 🚀 Next Steps

1. **Supabase Setup**: Create project + apply migrations (Phase 1)
2. **Edge Functions**: Deploy cluster-alerts, detect-phases, match-offres (Phase 2)
3. **Frontend Dev**: Test locally at http://localhost:5173 (Phase 3)
4. **GitHub**: Push code + add Secrets (Phase 4)
5. **Netlify**: Connect repo + deploy (Phase 5)
6. **Data**: Seed entreprise_offres + run clustering (Phase 6)
7. **Monitor**: Check dashboards + logs (Phase 7)

---

## 📧 Support

Questions? Contact: tech@winovya.com

---

**WINOVYA Intelligence Platform © 2026**  
*Veille Commande Publique & IA — Détection de signaux faibles pour opportunités d'affaires*
