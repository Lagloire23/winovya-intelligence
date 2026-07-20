# Sprint 0B — Méthode révisée (v2) — avant toute écriture

Statut : **rien n'est encore écrit ni exécuté.** Ce document répond précisément à tes 6 points de correction et à ta demande finale (commande CLI, preuve de conservation des versions, nom de branche, méthode de normalisation/hash, ordre d'exécution). J'attends ta validation avant d'agir.

---

## ⚠️ Point à trancher avec toi avant tout : le CLI Supabase n'est pas disponible dans cet environnement

Tu demandes d'utiliser "la procédure Supabase CLI permettant d'appliquer les migrations versionnées depuis `supabase/migrations/` et de conserver leurs versions". Je dois être transparent : **le binaire `supabase` (CLI) n'est pas installé dans le bac à sable où j'exécute mes commandes, et je n'ai aucun jeton d'accès (`SUPABASE_ACCESS_TOKEN`) permettant de l'authentifier.** L'authentification de la CLI Supabase nécessite soit un navigateur (`supabase login`, flux interactif impossible depuis cette session non-interactive), soit un jeton d'accès personnel que je n'ai pas et que je ne dois pas te demander de coller dans le chat (règle de sécurité que je respecte strictement).

**Ce que la CLI ferait, pour référence (comportement documenté, indépendant de moi)** :
- Commande : `supabase db push --linked` (ou `supabase migration up --linked`), exécutée depuis la racine du dépôt une fois celui-ci lié au projet staging (`supabase link --project-ref gcitqpgucepgroermzti`).
- Comportement exact : la CLI lit chaque fichier de `supabase/migrations/`, extrait le préfixe `<timestamp>_` du **nom de fichier** comme numéro de version, et applique les fichiers dans l'ordre croissant de ce numéro. Pour chaque fichier appliqué avec succès, elle insère une ligne dans `supabase_migrations.schema_migrations` avec **exactement** ce numéro de version (celui du nom de fichier, jamais un nouvel horodatage), le nom (reste du nom de fichier), et le contenu SQL comme `statements`. C'est la preuve que la CLI conserve les versions d'origine : c'est le nom du fichier qui fait foi, pas l'heure d'exécution.

**Méthode de remplacement que je propose, à valider par toi**, puisque je ne peux pas exécuter la CLI moi-même : reproduire manuellement, via l'outil SQL dont je dispose réellement (`execute_sql` sur le projet staging), exactement ce que la CLI aurait écrit :
1. Exécuter le DDL du fichier de migration tel quel.
2. Insérer ensuite, dans la même transaction si possible, une ligne dans `supabase_migrations.schema_migrations` avec `version = '<version originale exacte du nom de fichier>'`, `name = '<nom original exact>'`, `statements = ARRAY['<contenu SQL exact du fichier>']`.

Résultat final identique à ce qu'aurait produit la CLI : la table `supabase_migrations.schema_migrations` de staging contiendra les 9 mêmes couples (version, nom) que la production, dans le même ordre, avec le même contenu — sans dépendre d'un accès CLI que je n'ai pas.

**Si tu préfères que ce soit réellement fait via la CLI officielle** (par exemple parce que tu veux que l'historique staging soit géré ensuite par `supabase migration list` / `supabase db diff` de façon native), il faudra que ce soit toi qui exécutes la CLI sur ta machine (je peux te donner les commandes exactes), ou que tu m'indiques un moyen de l'authentifier ici. Dans ce cas, dis-le-moi et j'ajuste le plan en conséquence — sinon, je poursuis avec la méthode de remplacement ci-dessus.

---

## 1. Nom de la branche Git

`feature/sprint-0b-schema-baseline`, créée depuis `staging` (qui est à jour avec `origin/staging` @ `942dde6`).

## 2. Méthode de normalisation et de hash

Normalisation appliquée **avant tout calcul de hash**, sur le texte extrait et sur le fichier écrit :
- Encodage : UTF-8, **sans BOM**.
- Fins de ligne : **LF uniquement** (`\n`), aucune conversion CRLF.
- **Aucune modification du contenu SQL lui-même** — ni reformattage, ni suppression de commentaires, ni ré-indentation.

Procédure de hash :
1. Extraction du texte SQL exact depuis `supabase_migrations.schema_migrations.statements` (production).
2. Normalisation immédiate du texte extrait selon les règles ci-dessus (remplacement `\r\n`/`\r` isolés par `\n` uniquement si la source en contenait — le contenu SQL lui-même n'est pas touché, seule la fin de ligne est normalisée) → c'est le **texte de référence**.
3. Calcul du hash SHA-256 du texte de référence → **hash source**.
4. Écriture du texte de référence, tel quel, dans le fichier `supabase/migrations/<version>_<name>.sql` (encodage UTF-8 sans BOM, LF).
5. Lecture du fichier tel qu'il existe réellement sur disque après écriture, calcul de son hash SHA-256 → **hash fichier**.
6. **hash source = hash fichier**, exigé pour chacune des 9 migrations, sans exception. Le moindre écart interrompt tout avant le commit.
7. `.gitattributes` (ajouté avant le commit) :
   ```
   *.sql text eol=lf
   ```
   garantit que Git ne réécrira jamais ces fichiers en CRLF, sur aucune machine (y compris la tienne sous Windows).

## 3. Vérification "projet vide" (corrigée selon ton point 4)

Je ne vérifie pas que le schéma `public` est vide au sens strict (Supabase y place des objets gérés par la plateforme). Je vérifie uniquement l'**absence des 15 tables applicatives** que les 9 migrations vont créer, sur le projet staging (`gcitqpgucepgroermzti`), avant toute application :
- Schéma `veille` (migrations 1–7) : `entreprises`, `alertes`, `pertinence_entreprise`, `decideurs`, `alerte_decideurs`, `attachments`, `abonnements_alertes`, `profiles`.
- Schéma `public` (migrations 8–9) : `veille_ofgl_runs`, `collectivites_detectees`, `postes_budgetaires`, `alertes_opportunites`, `arretes_prefectoraux`, `arretes_entreprises_concernees`, `veille_raa_runs`.

## 4. Ordre final d'exécution (en attente de ta validation, rien n'est encore fait)

1. Créer la branche `feature/sprint-0b-schema-baseline` depuis `staging`.
2. Extraire les 9 migrations depuis la production (lecture seule), normaliser, calculer les hash source.
3. Écrire les 9 fichiers dans `supabase/migrations/` avec leurs noms de version d'origine (ex. `20260711083008_001_veille_schema_enums_tables.sql` … `20260716061441_create_arretes_prefectoraux_tables.sql`).
4. Vérifier l'intégrité (hash fichier = hash source) pour les 9 fichiers, un par un.
5. Ajouter `.gitattributes` avec `*.sql text eol=lf`.
6. Committer (fichiers de migration + `.gitattributes` + note de backlog sécurité, en documentation uniquement).
7. Pousser la branche `feature/sprint-0b-schema-baseline`.
8. Ouvrir une Pull Request vers `staging`.
9. Vérifier que la CI passe et relire le diff avec toi.
10. **Attendre ta validation explicite.**
11. Seulement après validation : vérifier l'absence des 15 tables sur `gcitqpgucepgroermzti`, puis appliquer les 9 migrations une par une, exclusivement à partir des fichiers du commit Git validé (jamais recopiés depuis la conversation), avec enregistrement des versions d'origine dans `supabase_migrations.schema_migrations` de staging (méthode décrite plus haut).
12. En cas d'échec d'une migration : arrêt immédiat, aucune migration suivante, rapport précis, aucune modification de production.
13. Vérification post-application (tables, contraintes, index, fonctions, triggers, policies RLS) + exécution de l'audit de sécurité informatif (`get_advisors`) sur staging.
14. Rapport de clôture.

Aucune étape ci-dessus n'est exécutée à ce stade.

---

**J'attends ta validation — en particulier sur le point CLI (méthode de remplacement proposée vs. CLI réelle exécutée par toi) — avant d'écrire le moindre fichier.**
