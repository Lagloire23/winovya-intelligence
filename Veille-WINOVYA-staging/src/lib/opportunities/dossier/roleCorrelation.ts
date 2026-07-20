// Sprint 11A — Vocabulaire et validation du rôle d'une alerte dans la
// corrélation d'une opportunité (P11.1 §5.3 : déclencheur / confirmant /
// contextuel / hors sujet).
//
// Ce module ne CALCULE aucun rôle : c'est le Sprint 12 (moteur de
// cohérence des regroupements) qui décidera quel rôle attribuer à quelle
// alerte, en réutilisant/enrichissant CorrelationEngine (Sprint 2/2.1,
// inchangé). Ce module se limite à définir la taxonomie autorisée et des
// fonctions de lecture défensive, sur le même principe que
// dossier/types.ts (NiveauConfiance, StatutEnrichissement) : le contrat
// TypeScript documente les valeurs possibles, il ne les produit pas.
//
// 'non_classe' est une valeur explicitement autorisée par la contrainte
// SQL mais non utilisée par ce sprint (aucun code n'écrit encore
// role_correlation) : elle est réservée pour un futur passage du moteur
// de cohérence qui aurait évalué une alerte sans lui trouver de rôle
// clair. NULL reste la seule valeur produite par CE sprint pour les
// liens existants et nouveaux : "jamais évalué", jamais une fabrication.

export type RoleCorrelation = 'declencheur' | 'confirmant' | 'contextuel' | 'hors_sujet' | 'non_classe'

export type SourceRole = 'moteur' | 'manuel'

const VALID_ROLES: readonly string[] = ['declencheur', 'confirmant', 'contextuel', 'hors_sujet', 'non_classe']
const VALID_SOURCES: readonly string[] = ['moteur', 'manuel']

export function isValidRoleCorrelation(value: unknown): value is RoleCorrelation {
  return typeof value === 'string' && VALID_ROLES.includes(value)
}

export function isValidSourceRole(value: unknown): value is SourceRole {
  return typeof value === 'string' && VALID_SOURCES.includes(value)
}

/**
 * Lecture défensive d'une valeur venant de la base (colonne `text`, sans
 * garantie de type au niveau TypeScript) : ne renvoie jamais une valeur
 * hors taxonomie. Une valeur inattendue redevient `null` ("non évalué"),
 * jamais une fabrication — même principe que `sanitizeRaisons` (Sprint 10,
 * correctif écran blanc) : mieux vaut une absence de rôle affichée
 * explicitement qu'une donnée corrompue silencieusement acceptée.
 */
export function sanitizeRoleCorrelation(value: unknown): RoleCorrelation | null {
  return isValidRoleCorrelation(value) ? value : null
}

export function sanitizeSourceRole(value: unknown): SourceRole | null {
  return isValidSourceRole(value) ? value : null
}
