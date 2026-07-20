#!/bin/bash
# Script pour pousser la structure monorepo vers GitHub

echo "🚀 Synchronisation vers GitHub..."

# Vérifier que Git est disponible
if ! command -v git &> /dev/null; then
    echo "❌ Git n'est pas installé"
    exit 1
fi

# Aller dans le dossier du repo (si le repo local existe)
# Sinon, cloner le repo public
if [ -d ".git" ]; then
    echo "✅ Repo Git trouvé"
else
    echo "📦 Clonage du repo GitHub..."
    git clone https://github.com/Lagloire23/winovya-intelligence.git
    cd winovya-intelligence
fi

# Configurer Git
git config user.name "WINOVYA Deploy"
git config user.email "deploy@winovya.com"

# Créer la structure monorepo
echo "📁 Création de la structure..."

# Créer les dossiers
mkdir -p apps/web/{src/{pages,components,styles},public}
mkdir -p supabase/{migrations,functions/{cluster-alerts,detect-phases-and-score,match-offres}}
mkdir -p .github/workflows

# Copier les fichiers source
echo "📋 Copie des fichiers..."

# Récupérer le dossier source
SOURCE_DIR="$(dirname "$(pwd)")/.."

# Database migration
cp "$SOURCE_DIR/001_migration_create_opportunites_tables.sql" supabase/migrations/ 2>/dev/null || echo "⚠️  Migration non trouvée"

# Edge Functions
cp "$SOURCE_DIR/cluster-alerts.ts" supabase/functions/cluster-alerts/index.ts 2>/dev/null || echo "⚠️  cluster-alerts.ts non trouvé"
cp "$SOURCE_DIR/detect-phases-and-score.ts" supabase/functions/detect-phases-and-score/index.ts 2>/dev/null || echo "⚠️  detect-phases-and-score.ts non trouvé"
cp "$SOURCE_DIR/match-offres.ts" supabase/functions/match-offres/index.ts 2>/dev/null || echo "⚠️  match-offres.ts non trouvé"

# Frontend
cp "$SOURCE_DIR/App.tsx" apps/web/src/ 2>/dev/null || echo "⚠️  App.tsx non trouvé"
cp "$SOURCE_DIR/api-endpoints.ts" apps/web/src/ 2>/dev/null || echo "⚠️  api-endpoints.ts non trouvé"

# Config files
cp "$SOURCE_DIR/netlify.toml" . 2>/dev/null || echo "⚠️  netlify.toml non trouvé"
cp "$SOURCE_DIR/.env.example" . 2>/dev/null || echo "⚠️  .env.example non trouvé"

# GitHub Actions
cp "$SOURCE_DIR/deploy-supabase.yml" .github/workflows/ 2>/dev/null || echo "⚠️  deploy-supabase.yml non trouvé"
cp "$SOURCE_DIR/deploy-netlify.yml" .github/workflows/ 2>/dev/null || echo "⚠️  deploy-netlify.yml non trouvé"

# Créer .gitignore
cat > .gitignore << 'GITIGNORE'
node_modules/
dist/
build/
.env
.env.local
.env.*.local
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store
Thumbs.db
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.supabase/
supabase/.branches/
.tmp/
temp/
GITIGNORE

# Créer package.json racine
cat > package.json << 'PACKAGEJSON'
{
  "name": "winovya-intelligence",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "cd apps/web && npm run dev",
    "build": "cd apps/web && npm run build",
    "preview": "cd apps/web && npm run preview"
  },
  "keywords": ["winovya", "intelligence", "opportunities", "clustering"],
  "author": "WINOVYA",
  "license": "MIT"
}
PACKAGEJSON

# Ajouter tous les fichiers
echo "📤 Préparation du commit..."
git add -A

# Vérifier s'il y a des changements
if git diff --cached --quiet; then
    echo "✅ Repo déjà à jour!"
else
    # Faire le commit
    git commit -m "feat: Restructure repo with proper monorepo layout

- Created apps/web with React + Vite + TypeScript
- Created supabase/migrations and supabase/functions
- Added .github/workflows for CI/CD
- Added netlify.toml configuration
- Configured package.json and build scripts
- Ready for Netlify deployment"

    # Pousser vers GitHub
    echo "🚀 Push vers GitHub..."
    git push origin main

    if [ $? -eq 0 ]; then
        echo "✅ Push réussi!"
    else
        echo "❌ Erreur lors du push. Vérifiez vos credentials GitHub."
        echo "   Vous pouvez aussi faire: git push origin main"
    fi
fi

echo ""
echo "=== Prochaines étapes ==="
echo "1. Attendez quelques secondes"
echo "2. Allez sur https://app.netlify.com/sites/winovya-intelligence"
echo "3. Cliquez 'Retry' pour re-déclencher le deploy"
echo ""
