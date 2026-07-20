// Sprint 11B — Contrats et validation du retrait/réintégration logique
// d'une alerte liée à une opportunité (P11.1 §10/§11).
//
// Aucune IA, aucune valeur inventée : le motif est une taxonomie fermée
// (même esprit que dossier/roleCorrelation.ts, Sprint 11A) et la
// validation vit ici, jamais seulement côté frontend.

export type MotifRetrait =
  | 'hors_sujet'
  | 'mauvaise_entite'
  | 'mauvais_projet'
  | 'doublon'
  | 'temporalite_incoherente'
  | 'mauvaise_localisation'
  | 'mauvais_rapprochement_semantique'
  | 'autre'

const VALID_MOTIFS: readonly string[] = [
  'hors_sujet',
  'mauvaise_entite',
  'mauvais_projet',
  'doublon',
  'temporalite_incoherente',
  'mauvaise_localisation',
  'mauvais_rapprochement_semantique',
  'autre',
]

export function isValidMotifRetrait(value: unknown): value is MotifRetrait {
  return typeof value === 'string' && VALID_MOTIFS.includes(value)
}

/** Lecture défensive (même principe que sanitizeRoleCorrelation, Sprint 11A) : une valeur hors taxonomie ne devient jamais une fabrication, elle redevient null. */
export function sanitizeMotifRetrait(value: unknown): MotifRetrait | null {
  return isValidMotifRetrait(value) ? value : null
}

export interface RetraitInput {
  motif: MotifRetrait
  commentaire?: string | null
}

/** Erreur dédiée : un motif vide/inconnu, ou 'autre' sans commentaire. */
export class MotifRetraitInvalideError extends Error {
  constructor(reason: string) {
    super(`Motif de retrait invalide : ${reason}`)
    this.name = 'MotifRetraitInvalideError'
  }
}

/**
 * Validation de domaine explicite (règle métier, pas seulement une
 * contrainte de formulaire) : un motif vide ou inconnu est rejeté ; pour
 * 'autre', un commentaire non vide est obligatoire.
 */
export function assertRetraitInputValide(input: RetraitInput): void {
  if (!input || !isValidMotifRetrait(input.motif)) {
    throw new MotifRetraitInvalideError(`valeur reçue "${input?.motif}" hors taxonomie`)
  }
  if (input.motif === 'autre') {
    const commentaire = (input.commentaire ?? '').trim()
    if (commentaire.length === 0) {
      throw new MotifRetraitInvalideError('un commentaire est obligatoire pour le motif "autre"')
    }
  }
}

/** État courant du lien alerte-opportunité (Sprint 1 + rôles Sprint 11A + retrait Sprint 11B). */
export interface LienAlerteOpportuniteDto {
  opportuniteId: string
  alerteId: string
  isActive: boolean
  roleCorrelation: string | null
  raisonCorrelation: string | null
  retireAt: string | null
  retirePar: string | null
  motifRetrait: MotifRetrait | null
  commentaireRetrait: string | null
}

export class OpportuniteIntrouvableError extends Error {
  constructor(public readonly opportuniteId: string) {
    super(`Opportunité ${opportuniteId} introuvable.`)
    this.name = 'OpportuniteIntrouvableError'
  }
}

export class LienAlerteOpportuniteIntrouvableError extends Error {
  constructor(public readonly opportuniteId: string, public readonly alerteId: string) {
    super(`Aucun lien entre l'alerte ${alerteId} et l'opportunité ${opportuniteId}.`)
    this.name = 'LienAlerteOpportuniteIntrouvableError'
  }
}

export class AlerteDejaRetireeError extends Error {
  constructor(public readonly opportuniteId: string, public readonly alerteId: string) {
    super(`L'alerte ${alerteId} est déjà retirée de l'opportunité ${opportuniteId}.`)
    this.name = 'AlerteDejaRetireeError'
  }
}

export class AlerteDejaActiveError extends Error {
  constructor(public readonly opportuniteId: string, public readonly alerteId: string) {
    super(`L'alerte ${alerteId} est déjà active sur l'opportunité ${opportuniteId} (rien à réintégrer).`)
    this.name = 'AlerteDejaActiveError'
  }
}

/**
 * L'opération de mutation n'a affecté aucune ligne alors que l'état
 * attendu (actif/inactif) était confirmé juste avant : la cause la plus
 * probable est un refus RLS (utilisateur non autorisé) ou une
 * modification concurrente. Jamais présentée comme un succès silencieux.
 */
export class RetraitNonAppliqueError extends Error {
  constructor(public readonly opportuniteId: string, public readonly alerteId: string) {
    super(
      `La modification du lien alerte ${alerteId} / opportunité ${opportuniteId} n'a été appliquée à aucune ligne (droits insuffisants ou état modifié entre-temps).`
    )
    this.name = 'RetraitNonAppliqueError'
  }
}
