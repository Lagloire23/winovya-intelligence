/**
 * Garde-fou d'isolation des environnements.
 *
 * Objectif : empêcher qu'un build ne pointe jamais silencieusement vers le
 * mauvais projet Supabase (ex. un build "staging" ou "development" qui
 * écrirait par erreur dans la base de PRODUCTION, ou l'inverse — un build
 * étiqueté "production" qui pointerait vers un projet non-production).
 *
 * Ce fichier ne contient aucun secret : la seule constante en dur est la
 * référence publique du projet Supabase de production (visible dans son URL,
 * https://mhsbwabrvcqnxnwamvwc.supabase.co), utilisée uniquement comme point
 * de comparaison.
 */

export type AppEnv = 'production' | 'staging' | 'development'

const PRODUCTION_PROJECT_REF = 'mhsbwabrvcqnxnwamvwc'

/**
 * Extrait la référence de projet (ex. "mhsbwabrvcqnxnwamvwc") d'une URL
 * Supabase de la forme https://<ref>.supabase.co
 */
export function extractProjectRef(url: string | undefined): string | null {
  if (!url) return null
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)
  return match ? match[1].toLowerCase() : null
}

/**
 * Vérifie la cohérence entre VITE_APP_ENV et le projet Supabase réellement
 * ciblé par VITE_SUPABASE_URL. Lève une erreur bloquante (l'app ne doit pas
 * démarrer) si une incohérence dangereuse est détectée.
 */
export function assertEnvironmentIsolation(
  appEnv: string | undefined,
  supabaseUrl: string | undefined
): void {
  if (!appEnv) {
    throw new Error(
      "[env] VITE_APP_ENV est manquant. Défini-le explicitement à 'production', 'staging' ou 'development' avant de démarrer l'application."
    )
  }

  const normalizedEnv = appEnv.trim().toLowerCase()
  if (!['production', 'staging', 'development'].includes(normalizedEnv)) {
    throw new Error(
      `[env] VITE_APP_ENV="${appEnv}" n'est pas une valeur valide. Valeurs attendues : production | staging | development.`
    )
  }

  const projectRef = extractProjectRef(supabaseUrl)
  if (!projectRef) {
    throw new Error(
      '[env] VITE_SUPABASE_URL est manquant ou mal formé. Une URL Supabase valide (https://<ref>.supabase.co) est requise.'
    )
  }

  const targetsProduction = projectRef === PRODUCTION_PROJECT_REF

  if (normalizedEnv !== 'production' && targetsProduction) {
    throw new Error(
      `[env] Build étiqueté "${normalizedEnv}" mais VITE_SUPABASE_URL pointe vers le projet Supabase de PRODUCTION (${projectRef}). ` +
        'Ce build est bloqué pour éviter toute écriture accidentelle en production. Vérifie les variables d\'environnement.'
    )
  }

  if (normalizedEnv === 'production' && !targetsProduction) {
    throw new Error(
      `[env] Build étiqueté "production" mais VITE_SUPABASE_URL pointe vers un projet Supabase différent du projet de production attendu (${PRODUCTION_PROJECT_REF}), reçu (${projectRef}). ` +
        "Ce build est bloqué : soit l'étiquette d'environnement est fausse, soit l'URL Supabase est fausse."
    )
  }
}
