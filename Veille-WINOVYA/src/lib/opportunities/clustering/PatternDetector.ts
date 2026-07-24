/**
 * Phase 1 — Pattern Detection Engine
 *
 * Analyzes each alert to detect:
 * 1. Which pattern (A-F) it belongs to
 * 2. Which lifecycle stage (INTENTION, ETUDE, FONCIER, etc.)
 * 3. Confidence score for the detection (0-100)
 * 4. Source reliability (Officiel, Probable, À vérifier)
 *
 * Uses keyword matching, category mapping, and heuristics.
 * No ML model — deterministic rules for reproducibility.
 */

import type {
  Alerte,
  Pattern,
  PatternCode,
  EtapeProjet,
  SourceReliability,
  DetectionResult,
} from './types'

export class PatternDetector {
  private patterns: Map<PatternCode, Pattern>

  constructor(patterns: Pattern[]) {
    this.patterns = new Map(patterns.map((p) => [p.pattern_code, p]))
  }

  /**
   * Detect pattern + lifecycle stage for a single alert.
   * Returns null if no confident match found.
   */
  detect(alerte: Alerte): DetectionResult | null {
    // Try each pattern (A-F) in order
    const patternA = this.detectExpansionIndustrielle(alerte)
    if (patternA) return patternA

    const patternB = this.detectMarchesPublics(alerte)
    if (patternB) return patternB

    const patternC = this.detectICPEConformite(alerte)
    if (patternC) return patternC

    const patternD = this.detectRDInnovation(alerte)
    if (patternD) return patternD

    const patternE = this.detectExtensionSite(alerte)
    if (patternE) return patternE

    const patternF = this.detectTransitionEcologique(alerte)
    if (patternF) return patternF

    return null
  }

  // ========================================================================
  // PATTERN A: Expansion Industrielle
  // ========================================================================
  private detectExpansionIndustrielle(alerte: Alerte): DetectionResult | null {
    const keywords = ['usine', 'expansion', 'site', 'construction', 'nouvelle ligne', 'production']
    const score = this.keywordMatchScore(alerte, keywords)

    if (score < 50) return null

    // Etape detection
    let etape: EtapeProjet = 'INTENTION'
    let confidence = score

    // Check for specific etape indicators
    if (this.hasKeywords(alerte, ['acquisition', 'terrain', 'foncier', 'dvf'])) {
      etape = 'FONCIER'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['permis', 'autorisation', 'icpe', 'arrêté'])) {
      etape = 'AUTORISATION'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['recrutement', 'directeur site', 'embauche'])) {
      etape = 'RECRUTEMENT'
      confidence = Math.min(100, score + 10)
    } else if (this.hasKeywords(alerte, ['appel d\'offres', 'boamp', 'marché public'])) {
      etape = 'APPEL_OFFRES'
      confidence = Math.min(100, score + 5)
    }

    return {
      pattern_id: this.patterns.get('A')!.id,
      pattern_code: 'A',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `Expansion industrielle detected at ${etape} stage (keywords + category match)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // PATTERN B: Marchés Publics
  // ========================================================================
  private detectMarchesPublics(alerte: Alerte): DetectionResult | null {
    // Strong signal: category is "Marchés publics"
    const isMarches = alerte.categorie_veille?.includes('Marchés publics')

    const keywords = ['boamp', 'marché public', 'appel d\'offres', 'collectivité', 'achat']
    const score = this.keywordMatchScore(alerte, keywords)

    const categoryBoost = isMarches ? 30 : 0
    const totalScore = Math.min(100, score + categoryBoost)

    if (totalScore < 50) return null

    let etape: EtapeProjet = 'CONSULTATION'
    let confidence = totalScore

    if (this.hasKeywords(alerte, ['budget', 'enveloppe', 'investissement', 'voté'])) {
      etape = 'INTENTION' // Budget stage maps to INTENTION
      confidence = Math.min(100, totalScore + 15)
    } else if (this.hasKeywords(alerte, ['appel d\'offres', 'boamp'])) {
      etape = 'APPEL_OFFRES'
      confidence = Math.min(100, totalScore + 10)
    }

    return {
      pattern_id: this.patterns.get('B')!.id,
      pattern_code: 'B',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `Marchés publics detected (BOAMP/collectivité signals)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // PATTERN C: Conformité ICPE
  // ========================================================================
  private detectICPEConformite(alerte: Alerte): DetectionResult | null {
    const isICPE = alerte.categorie_veille?.includes('ICPE')

    const keywords = ['icpe', 'classée', 'installation classée', 'conformité', 'seveso']
    const score = this.keywordMatchScore(alerte, keywords)

    const categoryBoost = isICPE ? 25 : 0
    const totalScore = Math.min(100, score + categoryBoost)

    if (totalScore < 50) return null

    let etape: EtapeProjet = 'ETUDE' // Changed signal maps to ETUDE
    let confidence = totalScore

    if (this.hasKeywords(alerte, ['dossier', 'déposé', 'demande'])) {
      etape = 'ETUDE'
      confidence = Math.min(100, totalScore + 15)
    } else if (this.hasKeywords(alerte, ['enquête', 'consultation', 'avis'])) {
      etape = 'AUTORISATION'
      confidence = Math.min(100, totalScore + 15)
    } else if (this.hasKeywords(alerte, ['arrêté', 'modifié', 'notification'])) {
      etape = 'AUTORISATION'
      confidence = Math.min(100, totalScore + 20)
    }

    return {
      pattern_id: this.patterns.get('C')!.id,
      pattern_code: 'C',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `ICPE conformité detected (installation classée signals)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // PATTERN D: R&D / Innovation
  // ========================================================================
  private detectRDInnovation(alerte: Alerte): DetectionResult | null {
    const keywords = [
      'appel à projets',
      'france 2030',
      'ademe',
      'innovation',
      'r&d',
      'piiec',
      'collaboration',
      'partenariat',
    ]
    const score = this.keywordMatchScore(alerte, keywords)

    if (score < 50) return null

    let etape: EtapeProjet = 'CONSULTATION' // Call launched maps to CONSULTATION
    let confidence = score

    if (this.hasKeywords(alerte, ['appel lancé', 'candidatures', 'deadline'])) {
      etape = 'CONSULTATION'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['sélection', 'retenue', 'désigné'])) {
      etape = 'CONSULTATION'
      confidence = Math.min(100, score + 20)
    } else if (this.hasKeywords(alerte, ['signé', 'convention', 'mou'])) {
      etape = 'RECRUTEMENT' // Custom: partnership signed
      confidence = Math.min(100, score + 25)
    }

    return {
      pattern_id: this.patterns.get('D')!.id,
      pattern_code: 'D',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `R&D/Innovation detected (appel à projets signals)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // PATTERN E: Extension Site
  // ========================================================================
  private detectExtensionSite(alerte: Alerte): DetectionResult | null {
    const keywords = [
      'modernisation',
      'upgrade',
      'extension',
      'nouvelle capacité',
      'ligne production',
      'équipement',
    ]
    const score = this.keywordMatchScore(alerte, keywords)

    if (score < 50) return null

    let etape: EtapeProjet = 'INTENTION'
    let confidence = score

    if (this.hasKeywords(alerte, ['études', 'faisabilité', 'bureau d\'études'])) {
      etape = 'ETUDE'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['permis', 'autorisation', 'accord'])) {
      etape = 'AUTORISATION'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['chantier', 'démarré', 'travaux'])) {
      etape = 'CONSULTATION' // Closest: active implementation
      confidence = Math.min(100, score + 20)
    }

    return {
      pattern_id: this.patterns.get('E')!.id,
      pattern_code: 'E',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `Extension site detected (modernisation/upgrade signals)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // PATTERN F: Transition Écologique
  // ========================================================================
  private detectTransitionEcologique(alerte: Alerte): DetectionResult | null {
    const keywords = [
      'audit énergétique',
      'transition écologique',
      'conformité',
      'bilan carbone',
      'rénovation',
      'énergie',
      'environnement',
    ]
    const score = this.keywordMatchScore(alerte, keywords)

    if (score < 50) return null

    let etape: EtapeProjet = 'INTENTION'
    let confidence = score

    if (this.hasKeywords(alerte, ['audit', 'diagnostic', 'lancé'])) {
      etape = 'ETUDE'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['plan', 'action', 'voté', 'budget'])) {
      etape = 'ETUDE'
      confidence = Math.min(100, score + 15)
    } else if (this.hasKeywords(alerte, ['marché', 'appel d\'offres', 'travaux'])) {
      etape = 'CONSULTATION'
      confidence = Math.min(100, score + 20)
    }

    return {
      pattern_id: this.patterns.get('F')!.id,
      pattern_code: 'F',
      detected_etape: etape,
      confidence: Math.round(confidence),
      reason: `Transition écologique detected (audit/conformité signals)`,
      reliability: this.getCategoryReliability(alerte.categorie_veille),
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private keywordMatchScore(alerte: Alerte, keywords: string[]): number {
    const searchText = this.normalizeText(
      `${alerte.name} ${alerte.resume || ''} ${alerte.mots_cles?.join(' ') || ''}`
    )

    const matches = keywords.filter((kw) => searchText.includes(this.normalizeText(kw))).length

    // Score: % of keywords matched, max 100
    return Math.round((matches / keywords.length) * 100)
  }

  private hasKeywords(alerte: Alerte, keywords: string[]): boolean {
    const searchText = this.normalizeText(
      `${alerte.name} ${alerte.resume || ''} ${alerte.mots_cles?.join(' ') || ''}`
    )

    return keywords.some((kw) => searchText.includes(this.normalizeText(kw)))
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Remove accents
      .replace(/[^\w\s]/g, '') // Remove punctuation
  }

  private getCategoryReliability(category: string | null): SourceReliability {
    if (!category) return 'À vérifier'

    // Officiels sources
    if (
      ['Documents administratifs', 'Marchés publics', 'Délibérations', 'Arrêtés préfectoraux', 'Budgets collectivités'].some(
        (c) => category.includes(c)
      )
    ) {
      return 'Officiel'
    }

    // Probable sources
    if (
      [
        'Maîtrise foncière',
        'Urbanisme',
        'ICPE',
      ].some((c) => category.includes(c))
    ) {
      return 'Probable'
    }

    // À vérifier
    return 'À vérifier'
  }
}
