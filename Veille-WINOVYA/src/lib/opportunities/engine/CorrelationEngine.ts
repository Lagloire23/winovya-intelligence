// Sprint 2 / 2.1 — Génération déterministe de la clé de corrélation
// (correlation_key). Aucune IA, aucune dépendance à la locale runtime.
//
// STRATÉGIE (revue Sprint 2.1, remplace la version Sprint 2) :
//
//   correlation_key = entreprise | entité cible | type d'opportunité | géographie
//
// La version Sprint 2 initiale ajoutait une fenêtre temporelle mensuelle
// (AAAA-MM de la date du premier signal) au calcul de la clé. Réexamen
// demandé (Sprint 2.1, Phase 2) avec l'exemple suivant :
//
//   MBDA — "nouvelle usine" — Bourges — signaux détectés en Mars, Mai,
//   Juillet, Septembre.
//
// Avec la fenêtre mensuelle, ces 4 signaux (même entité, même type, même
// géographie, seule la date diffère) produisaient 4 clés de corrélation
// DIFFÉRENTES ("...|2026-03", "...|2026-05", "...|2026-07", "...|2026-09"),
// donc 4 opportunités distinctes — alors qu'il s'agit manifestement d'un
// seul et même projet dont la maturité progresse sur plusieurs mois.
// C'est un FAUX NÉGATIF avéré : l'écrasante majorité des projets publics/
// industriels que ce moteur doit détecter s'étalent sur plusieurs mois,
// voire plusieurs années, entre l'intention et l'appel d'offres. Une
// fenêtre mensuelle fragmente donc le cas normal, pas le cas rare.
//
// Stratégies comparées :
//
//   A) entreprise + entité + type + géographie + fenêtre temporelle
//      (version Sprint 2 initiale) — REJETÉE. Produit des faux négatifs
//      systématiques sur tout projet dont les signaux successifs
//      dépassent un mois calendaire, ce qui est le cas courant, pas
//      l'exception. Documenté ci-dessus avec l'exemple MBDA.
//
//   B) entreprise + entité + type + géographie (site), sans fenêtre
//      temporelle — RETENUE. Élimine le faux négatif MBDA (les 4 signaux
//      partagent la même clé, quel que soit l'écart de plusieurs mois).
//      "Géographie" ici correspond déjà, dans le mapping Phase 1 du
//      Sprint 2, à la valeur la plus précise disponible sur l'alerte
//      (commune_collectivite en priorité, donc de facto la notion de
//      "site" quand cette donnée existe) — aucune nouvelle colonne
//      "site" n'est nécessaire.
//
//   C) entreprise + entité + type + géographie + phase projet — REJETÉE.
//      Réintroduit exactement le même défaut que la stratégie A, sous
//      une autre forme : un projet qui progresse dans le temps change
//      quasi systématiquement de phase (INTENTION → ÉTUDE → FONCIER →
//      AUTORISATION → ... → APPEL_OFFRES) à chaque nouveau signal. Inclure
//      la phase dans la clé fragmenterait donc le même projet à chaque
//      transition de phase — le problème MBDA se reproduirait, déclenché
//      par un changement de phase plutôt que par un changement de mois.
//      Si un même acteur a réellement deux projets distincts et
//      simultanés au même endroit, c'est un problème de granularité de
//      "géographie"/entité, pas un problème que la phase doive résoudre.
//
// LIMITE RÉSIDUELLE ACCEPTÉE (stratégie B) : sans fenêtre temporelle,
// deux projets réellement distincts et non liés, portés par le même
// acteur, de même type, au même endroit, mais séparés de plusieurs
// années (ex: un projet clos/perdu en 2024 et un nouveau projet sans
// rapport en 2027) partageraient la même correlation_key et seraient
// donc regroupés à tort dans la même opportunité. Ce risque est jugé
// moins dommageable que la fragmentation systématique de la stratégie A
// (sous-groupement silencieux d'un même dossier actif) et n'est PAS
// corrigé dans ce sprint de stabilisation : le résoudre proprement
// nécessiterait une règle métier nouvelle (ex: réinitialiser la clé si
// l'opportunité existante est déjà WON/LOST/ARCHIVED depuis longtemps),
// ce qui constituerait un changement de comportement/périmètre, hors
// scope du Sprint 2.1. Documenté comme candidat pour un sprint futur.

/**
 * Normalise une chaîne pour la corrélation : décomposition NFD +
 * suppression des diacritiques (accents), minuscules, toute suite de
 * caractères non alphanumériques réduite à un unique tiret, tirets de
 * bord supprimés. Déterministe et stable pour une même entrée.
 */
export function normalizeForCorrelation(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface CorrelationKeyInput {
  entrepriseId: string
  alerteId: string
  entiteCible: string | null | undefined
  typeOpportunite: string | null | undefined
  geographie: string | null | undefined
}

export interface CorrelationKeyResult {
  key: string
  confidence: 'high' | 'low'
}

/**
 * Génère une clé de corrélation déterministe à partir de l'entreprise,
 * de l'entité cible, du type d'opportunité et de la géographie (voir
 * stratégie B ci-dessus — pas de fenêtre temporelle). Ne suppose et ne
 * force jamais un regroupement hasardeux : si l'entité cible, le type
 * d'opportunité ou la géographie sont absents/vides, la confiance est
 * jugée insuffisante ("low") et un dossier distinct est créé pour cette
 * alerte précise (clé incorporant l'identifiant de l'alerte, ne pouvant
 * donc jamais entrer en collision avec une autre clé). Le niveau de
 * confiance est retourné pour être documenté dans
 * score_details.correlation.
 */
export function generateCorrelationKey(input: CorrelationKeyInput): CorrelationKeyResult {
  const entite = normalizeForCorrelation(input.entiteCible)
  const type = normalizeForCorrelation(input.typeOpportunite)
  const geo = normalizeForCorrelation(input.geographie)

  const hasSufficientData = entite.length > 0 && type.length > 0 && geo.length > 0

  if (!hasSufficientData) {
    return {
      key: `${input.entrepriseId}|alerte-${input.alerteId}`,
      confidence: 'low',
    }
  }

  return {
    key: `${input.entrepriseId}|${entite}|${type}|${geo}`,
    confidence: 'high',
  }
}

/**
 * Espace de noms utilisé par OpportunityEngineService (Phase 4, revue
 * d'architecture Sprint 2.1) : le service appelle
 * `CorrelationEngine.generateCorrelationKey(...)` plutôt que la fonction
 * nue, pour que la dépendance soit explicite et nommée exactement comme
 * dans le diagramme d'architecture cible.
 */
export const CorrelationEngine = {
  generateCorrelationKey,
  normalizeForCorrelation,
}
