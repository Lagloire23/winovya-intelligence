# Sprint 0B — Phase Git : baseline des 9 migrations versionnée

Statut : **phase Git terminée. Rien fusionné. Aucune migration appliquée sur Supabase Staging. Aucune modification de production.**

## ⚠️ Point d'attention — je n'ai pas pu vérifier `origin/staging`

Je n'ai toujours aucun accès GitHub authentifié depuis ce sandbox (confirmé à nouveau : `git fetch`/`git push` échouent avec "could not read Username for 'https://github.com'" — le dépôt est privé, donc même la lecture anonyme est refusée). Je n'ai donc **pas pu faire le fetch demandé en premier**, et j'ai créé la branche depuis mon `staging` local, dont le dernier commit connu est `ad76769` (`baseline: état du code correspondant à la production au 2026-07-15`).

**Avant de pousser ce que je te fournis**, vérifie toi-même :
```
git fetch origin
git log origin/staging -1 --format=%H
```
Si le résultat est `ad76769420b898fd1a6fcb6ce6b3241ca3e2b8ea`, tout est cohérent, tu peux pousser directement. Si c'est différent, il faudra rebaser ma branche sur le vrai `origin/staging` avant de pousser (je peux le refaire si tu me donnes le nouveau hash).

## Hash du commit

`2eb9f9db9c80fe5664063f1c28c404ae8d188a6e`

Sur la branche `feature/sprint-0b-schema-baseline`, créée depuis `staging` (`ad76769`).

## Liste exacte des 9 fichiers

```
supabase/migrations/20260711083008_001_veille_schema_enums_tables.sql
supabase/migrations/20260711083018_002_veille_indexes.sql
supabase/migrations/20260711083032_003_veille_rls_and_auth_trigger.sql
supabase/migrations/20260711083450_004_add_airtable_id_tracking.sql
supabase/migrations/20260712075546_fix_profiles_rls_recursion.sql
supabase/migrations/20260712075605_use_is_admin_helper_on_decideurs_entreprises.sql
supabase/migrations/20260713220751_add_onboarding_fields_to_entreprises.sql
supabase/migrations/20260716061409_create_veille_ofgl_schema.sql
supabase/migrations/20260716061441_create_arretes_prefectoraux_tables.sql
```

Plus : `.gitattributes` (`*.sql text eol=lf`) et `docs/backlog-securite.md` (note RLS, documentation uniquement).

## Hashes d'intégrité (SHA-256, texte source normalisé vs fichier écrit)

| Fichier | SHA-256 | Source = Fichier |
|---|---|---|
| `..._001_veille_schema_enums_tables.sql` | `270109e3b9e58b078d3fcd56c8e225a1e35036a0de433f0254677f91561c8798`* | ✅ |
| `..._002_veille_indexes.sql` | `a08e2d2ecd98bfd6e233fb14be6bc371261a5e8e76bc2dbd9af377f3d50bca6b`* | ✅ |
| `..._003_veille_rls_and_auth_trigger.sql` | `e12e78466d03475d08cddb47b012697080061fcb89fcb7e702085ff6b4c06337`* | ✅ |
| `..._004_add_airtable_id_tracking.sql` | `44e25a386d9c1cd7986d7d9944ad5884bfb88c2b9ceb7fd6489fabb40fc8f809`* | ✅ |
| `..._fix_profiles_rls_recursion.sql` | `28b918169f4c88d88d1019df7a990383a2ca9762683baac9d1380a407fc16690`* | ✅ |
| `..._use_is_admin_helper_on_decideurs_entreprises.sql` | `28384e2fba6c3d18d1ed989176a1ab983cc2ed40b2f0842d0d994f3fb6e5cdf3`* | ✅ |
| `..._add_onboarding_fields_to_entreprises.sql` | `4b406af4e4ae6c2ef535a0c1f6889c08e81ef03d97d31fbd96af369a7ea6d598`* | ✅ |
| `..._create_veille_ofgl_schema.sql` | `792026aef922325f9fdca97753d6c40c3e7b60440870408c09de074d7f6b6bb3`* | ✅ |
| `..._create_arretes_prefectoraux_tables.sql` | `5060e3fd5ea15bcba735c5660159da0aed99d94ff60f4f263e9c63c46d217578`* | ✅ |

*(hashes tronqués à 65 caractères pour l'affichage ; valeurs complètes calculées et comparées programmatiquement — les 9 correspondances source/fichier sont exactes, aucun écart)*

**9/9 fichiers : hash source = hash fichier. Aucune modification introduite lors de l'écriture.**

## Résultats des contrôles

- **Parsing/transcription** : le JSON brut extrait de la production a été validé par `json.loads` avant toute écriture (9 entrées, aucune erreur de parsing) — élimine le risque de transcription manuelle erronée.
- **Encodage** : UTF-8 sans BOM confirmé sur les 9 fichiers (vérification des 3 premiers octets — aucun BOM).
- **Fins de ligne** : 0 caractère `\r` (CR) trouvé dans aucun des 9 fichiers — LF uniquement.
- **Corruption** : 0 octet nul dans aucun des 9 fichiers.
- **Secrets** : recherche de motifs de clés/API/JWT sur les fichiers ajoutés — aucun trouvé.
- **Build local (TypeScript)** : ⚠️ non concluant — `tsc --noEmit` a expiré par timeout dans mon environnement d'exécution à plusieurs reprises (problème de performance du sandbox, déjà rencontré ponctuellement lors de sprints précédents, sans rapport avec ce changement). Ce point n'est cependant pas bloquant ici : **aucun fichier applicatif (`.ts`/`.tsx`) n'a été modifié dans ce commit** — uniquement des fichiers SQL et de la documentation, qui ne peuvent pas casser la compilation TypeScript.

## URL pour créer la Pull Request

Je n'ai pas d'accès GitHub pour l'ouvrir moi-même. Une fois la branche poussée, ouvre cette URL (format standard de comparaison GitHub) :

```
https://github.com/Lagloire23/Veille-WINOVYA/compare/staging...feature/sprint-0b-schema-baseline?expand=1
```

## Comment récupérer cette branche

Le fichier `sprint-0b-schema-baseline.bundle` est fourni ci-dessous (même mécanisme que les sprints précédents, puisque je n'ai pas d'accès GitHub direct). Depuis ton clone existant `Veille-WINOVYA` :

```
git fetch origin
git log origin/staging -1 --format=%H   # à comparer avec ad76769420b898fd1a6fcb6ce6b3241ca3e2b8ea
git fetch "chemin\vers\sprint-0b-schema-baseline.bundle" feature/sprint-0b-schema-baseline:feature/sprint-0b-schema-baseline
git push origin feature/sprint-0b-schema-baseline
```

## Commandes Supabase CLI à exécuter ensuite sur ton PC (après validation de la PR — pas encore maintenant)

Aucun mot de passe ni token ci-dessous — l'authentification se fait via ton navigateur au moment de `supabase login`.

```
supabase login
supabase link --project-ref gcitqpgucepgroermzti
supabase migration list --linked
supabase db push
supabase migration list --linked
```

- `supabase login` : ouvre ton navigateur pour t'authentifier.
- `supabase link --project-ref gcitqpgucepgroermzti` : relie ton dépôt local au projet Staging (jamais `mhsbwabrvcqnxnwamvwc`).
- `supabase migration list --linked` (1ʳᵉ fois) : doit montrer les 9 migrations comme "non appliquées" côté distant.
- `supabase db push` : applique les 9 fichiers de `supabase/migrations/` dans l'ordre de leurs noms, en conservant leurs versions d'origine dans `supabase_migrations.schema_migrations` du projet staging.
- `supabase migration list --linked` (2ᵉ fois) : doit maintenant montrer les 9 migrations comme appliquées, avec leurs versions d'origine.

Je m'arrête ici, comme demandé. Rien n'a été fusionné, aucune migration n'a été appliquée sur Supabase Staging, aucune ressource de production n'a été touchée.
