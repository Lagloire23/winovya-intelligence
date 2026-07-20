# WINOVYA Market Intelligence — Guide de l'environnement STAGING

## Objectif

L'environnement **Staging** permet de développer, tester et valider toutes les nouvelles fonctionnalités avant leur mise en production.

Aucun développement ne doit être réalisé directement sur la Production.

---

# Architecture

## Production

Utilisée par les utilisateurs réels.

### Frontend

Netlify Production

### Backend

Supabase Production

Project ID

```
mhsbwabrvcqnxnwamvwc
```

---

## Staging

Utilisée uniquement pour les développements et les tests.

### Frontend

https://winovya-market-intelligence-staging.netlify.app

### Backend

Supabase Staging

Project ID

```
gcitqpgucepgroermzti
```

Toutes les nouvelles fonctionnalités doivent être testées ici avant leur promotion vers la Production.

---

# Workflow Git

## Branches

```
main
```

Production.

```
staging
```

Pré-production.

Toutes les validations passent par cette branche.

```
feature/xxxxx
```

Une branche par Sprint ou par fonctionnalité.

Exemples :

```
feature/sprint-1
feature/opportunity-engine
feature/import-airtable
```

---

# Cycle de développement

1. Créer une branche depuis `staging`

```bash
git checkout staging
git pull origin staging

git checkout -b feature/ma-fonctionnalite
```

---

2. Développer

Coder uniquement sur la branche feature.

---

3. Tester localement

```bash
npm install

npm run dev
```

---

4. Tester sur Supabase Staging

Toutes les migrations sont exécutées uniquement sur Staging.

Jamais directement sur Production.

---

5. Commit

```bash
git add .

git commit -m "feat: description"
```

---

6. Push

```bash
git push origin feature/ma-fonctionnalite
```

---

7. Pull Request

Créer une Pull Request

```
feature/*
↓

staging
```

---

8. Validation

Une fois la recette terminée :

Merge

```
feature/*
↓

staging
```

---

9. Promotion Production

Créer ensuite une Pull Request

```
staging
↓

main
```

Après validation uniquement.

---

# Déploiement STAGING

Le site Staging est connecté à GitHub.

Branche déployée :

```
staging
```

Chaque Push sur cette branche déclenche automatiquement :

- Build Vite
- Déploiement Netlify
- Publication

URL

```
https://winovya-market-intelligence-staging.netlify.app
```

---

# Déploiement PRODUCTION

La Production ne reçoit jamais de code directement.

Toujours :

```
feature
↓

staging

↓

validation

↓

main
```

Puis :

Merge

```
staging

↓

main
```

Netlify Production déploie automatiquement.

---

# Variables d'environnement STAGING

## Frontend

```
VITE_APP_ENV=staging
```

```
VITE_SUPABASE_URL=https://gcitqpgucepgroermzti.supabase.co
```

```
VITE_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxx
```

```
VITE_FEATURE_OPPORTUNITIES_ENABLED=true
```

---

## Secrets Supabase

```
VEILLE_EXECUTION_MODE=test
```

```
OPPORTUNITY_ENGINE_ENABLED=false
```

Les secrets sont gérés uniquement via :

```
supabase secrets
```

Jamais dans le dépôt Git.

---

# Comptes de test

## Administrateur

```
admin.staging@example.com
```

Le mot de passe peut être régénéré à tout moment via l'API Admin Supabase.

---

## Utilisateur

```
user.staging@example.com
```

Le mot de passe peut également être régénéré via l'API Admin.

---

# Supabase

## Lier le projet

```bash
npx supabase link --project-ref gcitqpgucepgroermzti
```

---

## Vérifier les migrations

```bash
npx supabase migration list --db-url "$dbUrl"
```

---

## Push des migrations

```bash
npx supabase db push --db-url "$dbUrl"
```

---

## Dry Run

```bash
npx supabase db push --db-url "$dbUrl" --dry-run
```

---

## Lister les secrets

```bash
npx supabase secrets list --project-ref gcitqpgucepgroermzti
```

---

## Ajouter un secret

```bash
npx supabase secrets set \
--project-ref gcitqpgucepgroermzti \
NOM_DU_SECRET=valeur
```

---

## Déployer une Edge Function

```bash
npx supabase functions deploy nom-fonction
```

---

# Commandes Git utiles

## Etat

```bash
git status
```

---

## Historique

```bash
git log --oneline --graph --decorate --all
```

---

## Récupérer

```bash
git pull origin staging
```

---

## Envoyer

```bash
git push origin feature/ma-branche
```

---

## Créer une branche

```bash
git checkout -b feature/ma-branche
```

---

## Changer de branche

```bash
git checkout staging
```

---

## Voir les tags

```bash
git tag
```

---

## Créer un tag

```bash
git tag sprint-0b-complete
```

---

## Publier un tag

```bash
git push origin sprint-0b-complete
```

---

# Vérifications avant Merge

Toujours vérifier :

- application compilée
- aucun warning bloquant
- migrations appliquées sur Staging
- Storage fonctionnel
- Auth fonctionnelle
- Edge Functions concernées testées
- aucune erreur JavaScript
- aucun secret dans Git
- aucun accès à la base Production

---

# Sauvegarde

Avant chaque Sprint important :

Créer un tag Git.

Exemple :

```
sprint-0b-complete
```

Conserver également un bundle Git.

Exemple :

```
sprint-0b-cloud-staging-final.bundle
```

---

# Règles

Ne jamais :

- développer sur `main`
- modifier directement la Production
- committer un fichier `.env`
- committer une clé API
- committer une `service_role`
- utiliser la base Production pour les tests

Toujours :

- développer sur une branche feature
- tester sur Staging
- créer une Pull Request
- valider avant fusion
- promouvoir vers Production uniquement après validation complète