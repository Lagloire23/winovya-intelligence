// Sprint 10 — Phase 4 : script d'import des anciennes alertes (Production)
// vers le domaine Opportunités (Staging), avec traçabilité complète.
//
// Script SERVEUR/CLI uniquement — jamais exécuté depuis le navigateur
// (aucun bundle Vite, aucun import.meta.env : ce fichier utilise
// process.env et est lancé via `tsx`, exactement comme tous les scripts
// scripts/sprint*-tests.ts existants).
//
// Sécurité (contraintes du cahier des charges Sprint 10) :
//  - Lecture SEULE sur le projet source (Production, mhsbwabrvcqnxnwamvwc
//    par défaut) : ce script n'exécute jamais d'écriture sur `sourceClient`.
//  - Toute écriture cible exclusivement `destClient` (Staging).
//  - Garde-fou explicite : le script refuse de démarrer si l'URL de
//    destination correspond au projet Production connu (voir
//    assertDestinationIsNotProduction ci-dessous) — même en cas d'erreur
//    de configuration des variables d'environnement.
//  - Aucune clé Supabase n'est jamais loguée (voir maskKey).
//  - Idempotent : une ligne déjà importée (même source_system +
//    source_table + source_record_id) n'est jamais réimportée deux fois
//    (contrainte d'unicité posée en Phase 3 + vérification applicative).
//
// Réutilisation explicite (jamais dupliquée) :
//  - CorrelationEngine.generateCorrelationKey (Sprint 2/2.1, pur, aucun
//    accès réseau) pour le regroupement de signaux en opportunités.
//  Le calcul des scores (ScoreEngine / OpportunityEngineService complet)
//  n'est PAS réutilisé ici : ScoreEngine exige des sous-scores d'adéquation
//  fournis par un humain, que ce sprint n'invente jamais (contrainte n°10
//  du cahier des charges). Les opportunités importées restent donc avec
//  statut_enrichissement = 'pending' et tous les scores à NULL, exactement
//  comme le prévoit déjà le schéma (Sprint 4) pour une opportunité pas
//  encore qualifiée par un humain ou par le consolidateur existant.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CorrelationEngine } from '../src/lib/opportunities/engine/CorrelationEngine'

// ---------------------------------------------------------------------------
// Constantes de sécurité
// ---------------------------------------------------------------------------

const KNOWN_PRODUCTION_REF = 'mhsbwabrvcqnxnwamvwc'
const DEFAULT_SOURCE_PROJECT_REF = 'mhsbwabrvcqnxnwamvwc'
const TRANSFORMATION_VERSION = 'sprint10-v1'

// ---------------------------------------------------------------------------
// Arguments CLI
// ---------------------------------------------------------------------------

export interface CliOptions {
  dryRun: boolean
  limit: number
  batchId: string
  sourceProject: string
  companyId?: string
  since?: string
  rollbackBatch?: string
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    limit: 50,
    batchId: `SPRINT10-LEGACY-REAL-DATA-${new Date().toISOString().slice(0, 10)}`,
    sourceProject: DEFAULT_SOURCE_PROJECT_REF,
  }
  for (const arg of argv) {
    const [rawKey, rawValue] = arg.replace(/^--/, '').split('=')
    const value = rawValue ?? 'true'
    switch (rawKey) {
      case 'dry-run':
        opts.dryRun = value !== 'false'
        break
      case 'limit':
        opts.limit = Number.parseInt(value, 10)
        break
      case 'batch-id':
        opts.batchId = value
        break
      case 'source-project':
        opts.sourceProject = value
        break
      case 'company-id':
        opts.companyId = value
        break
      case 'since':
        opts.since = value
        break
      case 'rollback-batch':
        opts.rollbackBatch = value
        break
      default:
        // Option inconnue : ignorée volontairement plutôt que de faire
        // planter un script d'import déjà en cours (mais signalée).
        // eslint-disable-next-line no-console
        console.warn(`Option inconnue ignorée : --${rawKey}`)
    }
  }
  if (!Number.isFinite(opts.limit) || opts.limit <= 0) {
    throw new Error('INVALID_LIMIT: --limit doit être un entier positif')
  }
  return opts
}

// ---------------------------------------------------------------------------
// Garde-fou Production + masquage des clés
// ---------------------------------------------------------------------------

export function assertDestinationIsNotProduction(destUrl: string): void {
  if (destUrl.includes(KNOWN_PRODUCTION_REF)) {
    throw new Error(
      `REFUS DE SÉCURITÉ : l'URL de destination contient la référence du projet Production connu (${KNOWN_PRODUCTION_REF}). ` +
        'Ce script n\'écrit jamais sur Production. Vérifiez SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
}

export function maskKey(key: string | undefined): string {
  if (!key) return '(absente)'
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Construction des clients (jamais de clé en dur, jamais de log de clé)
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`MISSING_ENV: la variable d'environnement ${name} est requise et absente.`)
  }
  return value
}

export function createClients(): { source: SupabaseClient; dest: SupabaseClient } {
  const sourceUrl = requireEnv('SPRINT10_LEGACY_SUPABASE_URL')
  const sourceKey = requireEnv('SPRINT10_LEGACY_SERVICE_ROLE_KEY')
  const destUrl = requireEnv('SUPABASE_URL')
  const destKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  assertDestinationIsNotProduction(destUrl)

  const source = createClient(sourceUrl, sourceKey, { db: { schema: 'veille' } })
  const dest = createClient(destUrl, destKey, { db: { schema: 'veille' } })
  return { source, dest }
}

// ---------------------------------------------------------------------------
// Normalisation (Phase 2, §2)
// ---------------------------------------------------------------------------

export function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

export interface LegacyAlerteRow {
  id: string
  name: string | null
  notes: string | null
  categorie_veille: string | null
  pays: string | null
  departement: string | null
  region: string[] | null
  commune_collectivite: string | null
  date_publication: string | null
  date_detection: string | null
  lien_source_url: string | null
  resume: string | null
  acteur_entite: string | null
  montant: number | null
  reference_officielle: string | null
  echeance_date_limite: string | null
  priorite: string | null
  mots_cles: string[] | null
  type_opportunite: string[] | null
  contact_decideur_nom: string | null
  contact_decideur_fonction: string | null
  contact_decideur_email: string | null
  contact_decideur_telephone: string | null
  contact_decideur_linkedin: string | null
  texte_extrait_document: string | null
  statut: string | null
  airtable_id: string | null
}

export interface NormalizedAlerte extends LegacyAlerteRow {
  isValid: boolean
  rejectionReason: string | null
}

/** Une alerte legacy est rejetée uniquement si les champs strictement
 * indispensables à l'affichage cockpit (nom + date de publication) sont
 * absents — jamais sur la base d'un champ métier optionnel (montant,
 * décideur, etc.), qui doit au contraire remonter tel quel comme "lacune"
 * visible (Phase 6), pas comme un rejet. */
export function normalizeAndValidate(row: LegacyAlerteRow): NormalizedAlerte {
  const normalized: LegacyAlerteRow = {
    ...row,
    name: normalizeText(row.name),
    notes: normalizeText(row.notes),
    commune_collectivite: normalizeText(row.commune_collectivite),
    lien_source_url: normalizeText(row.lien_source_url),
    resume: normalizeText(row.resume),
    acteur_entite: normalizeText(row.acteur_entite),
    reference_officielle: normalizeText(row.reference_officielle),
    texte_extrait_document: normalizeText(row.texte_extrait_document),
  }

  if (!normalized.name) {
    return { ...normalized, isValid: false, rejectionReason: 'CHAMP_NAME_MANQUANT' }
  }
  if (!normalized.date_publication) {
    return { ...normalized, isValid: false, rejectionReason: 'CHAMP_DATE_PUBLICATION_MANQUANT' }
  }
  return { ...normalized, isValid: true, rejectionReason: null }
}

// ---------------------------------------------------------------------------
// Détection de doublons (Phase 2, §2 — reference_officielle / airtable_id
// uniquement ; lien_source_url exclu, voir audit Phase 1 §3)
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  key: string
  ids: string[]
}

export function detectStrictDuplicates(rows: LegacyAlerteRow[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  for (const field of ['reference_officielle', 'airtable_id'] as const) {
    const byValue = new Map<string, string[]>()
    for (const row of rows) {
      const value = row[field]
      if (!value) continue
      const list = byValue.get(value) ?? []
      list.push(row.id)
      byValue.set(value, list)
    }
    for (const [value, ids] of byValue) {
      if (ids.length > 1) groups.push({ key: `${field}=${value}`, ids })
    }
  }
  return groups
}

// ---------------------------------------------------------------------------
// Sélection d'un échantillon représentatif (Phase 5)
// ---------------------------------------------------------------------------

export interface SampleSelectionInput {
  rows: LegacyAlerteRow[]
  limit: number
  /** acteur_entite apparaissant plus d'une fois dans l'ensemble complet —
   * calculé en amont sur la table complète, pas seulement sur l'échantillon,
   * pour ne pas manquer un vrai candidat de regroupement. */
  recurringActeurs: Set<string>
}

/** Sélectionne un sous-ensemble représentatif : au moins une ligne par
 * catégorie de veille disponible, en priorisant les candidats de
 * regroupement (acteur récurrent) et un signal incomplet, jusqu'à `limit`.
 * Ne fabrique jamais de ligne : sélectionne uniquement parmi `rows`. */
export function selectRepresentativeSample(input: SampleSelectionInput): LegacyAlerteRow[] {
  const { rows, limit } = input
  const byCategory = new Map<string, LegacyAlerteRow[]>()
  for (const row of rows) {
    const cat = row.categorie_veille ?? '(sans catégorie)'
    const list = byCategory.get(cat) ?? []
    list.push(row)
    byCategory.set(cat, list)
  }

  const selected: LegacyAlerteRow[] = []
  const selectedIds = new Set<string>()
  const add = (row: LegacyAlerteRow) => {
    if (selectedIds.has(row.id) || selected.length >= limit) return
    selected.push(row)
    selectedIds.add(row.id)
  }

  // 1) Au moins une ligne par catégorie disponible.
  for (const [, list] of byCategory) {
    if (selected.length >= limit) break
    add(list[0])
  }

  // 2) Au moins un candidat de regroupement (acteur récurrent), si possible.
  const groupingCandidate = rows.find((r) => r.acteur_entite && input.recurringActeurs.has(r.acteur_entite))
  if (groupingCandidate) add(groupingCandidate)
  const secondSignalSameActeur = groupingCandidate
    ? rows.find((r) => r.id !== groupingCandidate.id && r.acteur_entite === groupingCandidate.acteur_entite)
    : undefined
  if (secondSignalSameActeur) add(secondSignalSameActeur)

  // 3) Au moins un signal incomplet (peu de champs renseignés).
  const incomplete = rows
    .slice()
    .sort((a, b) => countFilled(a) - countFilled(b))
    .find((r) => countFilled(r) <= 4)
  if (incomplete) add(incomplete)

  // 4) Compléter jusqu'à `limit` en parcourant le reste par catégorie
  // (répartition proportionnelle simple).
  for (const [, list] of byCategory) {
    for (const row of list) {
      if (selected.length >= limit) break
      add(row)
    }
    if (selected.length >= limit) break
  }

  return selected
}

function countFilled(row: LegacyAlerteRow): number {
  const fields = [
    row.resume,
    row.montant,
    row.acteur_entite,
    row.reference_officielle,
    row.lien_source_url,
    row.texte_extrait_document,
    row.commune_collectivite,
  ]
  return fields.filter((f) => f !== null && f !== undefined && f !== '').length
}

// ---------------------------------------------------------------------------
// Regroupement : réutilisation stricte de CorrelationEngine (Sprint 2/2.1)
// ---------------------------------------------------------------------------

export interface CorrelationInputRow {
  alerteId: string
  entrepriseId: string
  acteurEntite: string | null
  typeOpportunite: string[] | null
  communeCollectivite: string | null
  departement: string | null
  region: string[] | null
  pays: string | null
}

export function computeCorrelationKeyForRow(row: CorrelationInputRow) {
  const geographie = row.communeCollectivite ?? row.departement ?? row.region?.[0] ?? row.pays ?? null
  return CorrelationEngine.generateCorrelationKey({
    entrepriseId: row.entrepriseId,
    alerteId: row.alerteId,
    entiteCible: row.acteurEntite,
    typeOpportunite: row.typeOpportunite?.[0] ?? null,
    geographie,
  })
}

// ---------------------------------------------------------------------------
// Plan d'import (dry-run et réel partagent cette même fonction de
// planification — seule l'exécution des écritures diffère)
// ---------------------------------------------------------------------------

export interface ImportPlanEntry {
  alerte: NormalizedAlerte
  status: 'valid' | 'rejected' | 'duplicate'
  reason: string | null
  correlationKey?: string
  correlationConfidence?: 'high' | 'low'
}

export interface ImportPlan {
  totalRead: number
  entries: ImportPlanEntry[]
  validCount: number
  rejectedCount: number
  duplicateCount: number
  plannedOpportunityGroups: Map<string, string[]>
}

export function buildImportPlan(
  rows: LegacyAlerteRow[],
  entrepriseId: string,
  duplicateIdsInBatch: Set<string>
): ImportPlan {
  const entries: ImportPlanEntry[] = []
  const plannedOpportunityGroups = new Map<string, string[]>()

  for (const row of rows) {
    const normalized = normalizeAndValidate(row)
    if (!normalized.isValid) {
      entries.push({ alerte: normalized, status: 'rejected', reason: normalized.rejectionReason })
      continue
    }
    if (duplicateIdsInBatch.has(row.id)) {
      entries.push({ alerte: normalized, status: 'duplicate', reason: 'DOUBLON_STRICT_REFERENCE_OU_AIRTABLE_ID' })
      continue
    }
    const correlation = computeCorrelationKeyForRow({
      alerteId: row.id,
      entrepriseId,
      acteurEntite: row.acteur_entite,
      typeOpportunite: row.type_opportunite,
      communeCollectivite: row.commune_collectivite,
      departement: row.departement,
      region: row.region,
      pays: row.pays,
    })
    entries.push({
      alerte: normalized,
      status: 'valid',
      reason: null,
      correlationKey: correlation.key,
      correlationConfidence: correlation.confidence,
    })
    const group = plannedOpportunityGroups.get(correlation.key) ?? []
    group.push(row.id)
    plannedOpportunityGroups.set(correlation.key, group)
  }

  return {
    totalRead: rows.length,
    entries,
    validCount: entries.filter((e) => e.status === 'valid').length,
    rejectedCount: entries.filter((e) => e.status === 'rejected').length,
    duplicateCount: entries.filter((e) => e.status === 'duplicate').length,
    plannedOpportunityGroups,
  }
}

export function printDryRunSummary(plan: ImportPlan, batchId: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== Sprint 10 — Dry-run import legacy (batch ${batchId}) ===`)
  // eslint-disable-next-line no-console
  console.log(`Lignes lues            : ${plan.totalRead}`)
  // eslint-disable-next-line no-console
  console.log(`Lignes valides          : ${plan.validCount}`)
  // eslint-disable-next-line no-console
  console.log(`Lignes rejetées         : ${plan.rejectedCount}`)
  // eslint-disable-next-line no-console
  console.log(`Doublons détectés       : ${plan.duplicateCount}`)
  // eslint-disable-next-line no-console
  console.log(`Opportunités prévues    : ${plan.plannedOpportunityGroups.size}`)
  const preuvesPrevues = plan.entries.filter((e) => e.status === 'valid' && e.alerte.lien_source_url).length
  // eslint-disable-next-line no-console
  console.log(`Preuves prévues         : ${preuvesPrevues}`)
  const regroupements = [...plan.plannedOpportunityGroups.values()].filter((g) => g.length > 1).length
  // eslint-disable-next-line no-console
  console.log(`Regroupements proposés  : ${regroupements}`)
  const rejectionReasons = new Map<string, number>()
  for (const e of plan.entries) {
    if (e.status === 'rejected' && e.reason) rejectionReasons.set(e.reason, (rejectionReasons.get(e.reason) ?? 0) + 1)
  }
  for (const [reason, count] of rejectionReasons) {
    // eslint-disable-next-line no-console
    console.log(`  - Rejet "${reason}" : ${count}`)
  }
  // eslint-disable-next-line no-console
  console.log('Aucune écriture réalisée (dry-run).\n')
}

// ---------------------------------------------------------------------------
// Rollback d'un batch (Phase 4 — option --rollback-batch)
// ---------------------------------------------------------------------------

/** Supprime, dans l'ordre enfant → parent, toutes les lignes créées par un
 * batch d'import donné, sur Staging uniquement. Ne touche jamais une ligne
 * dont import_batch_id diffère (contrainte n°9). Retourne le nombre de
 * lignes supprimées par table pour le rapport. */
export async function rollbackBatch(dest: SupabaseClient, batchId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  const { data: opportunites } = await dest.from('opportunites').select('id').eq('import_batch_id', batchId)
  const opportuniteIds = (opportunites ?? []).map((o: { id: string }) => o.id)

  if (opportuniteIds.length > 0) {
    const { count: preuves } = await dest.from('opportunite_preuves').delete({ count: 'exact' }).in('opportunite_id', opportuniteIds)
    counts.opportunite_preuves = preuves ?? 0
    const { count: decideurs } = await dest.from('opportunite_decideurs').delete({ count: 'exact' }).in('opportunite_id', opportuniteIds)
    counts.opportunite_decideurs = decideurs ?? 0
    const { count: activity } = await dest.from('opportunite_activity_log').delete({ count: 'exact' }).in('opportunite_id', opportuniteIds)
    counts.opportunite_activity_log = activity ?? 0
    const { count: alertesLink } = await dest.from('opportunite_alertes').delete({ count: 'exact' }).in('opportunite_id', opportuniteIds)
    counts.opportunite_alertes = alertesLink ?? 0
    const { count: notes } = await dest.from('opportunite_notes').delete({ count: 'exact' }).in('opportunite_id', opportuniteIds)
    counts.opportunite_notes = notes ?? 0
  }

  const { count: opportunitesDeleted } = await dest.from('opportunites').delete({ count: 'exact' }).eq('import_batch_id', batchId)
  counts.opportunites = opportunitesDeleted ?? 0

  const { count: pertinence } = await dest.from('pertinence_entreprise').delete({ count: 'exact' }).eq('import_batch_id', batchId)
  counts.pertinence_entreprise = pertinence ?? 0

  const { count: alertes } = await dest.from('alertes').delete({ count: 'exact' }).eq('import_batch_id', batchId)
  counts.alertes = alertes ?? 0

  const { count: decideursDeleted } = await dest.from('decideurs').delete({ count: 'exact' }).eq('import_batch_id', batchId)
  counts.decideurs = decideursDeleted ?? 0

  const { count: entreprises } = await dest.from('entreprises').delete({ count: 'exact' }).eq('import_batch_id', batchId)
  counts.entreprises = entreprises ?? 0

  return counts
}

// ---------------------------------------------------------------------------
// Point d'entrée CLI
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const { source, dest } = createClients()

  if (opts.rollbackBatch) {
    // eslint-disable-next-line no-console
    console.log(`Rollback du batch ${opts.rollbackBatch} sur Staging...`)
    const counts = await rollbackBatch(dest, opts.rollbackBatch)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(counts, null, 2))
    return
  }

  // eslint-disable-next-line no-console
  console.log(`Source (lecture seule)  : ${opts.sourceProject}`)
  // eslint-disable-next-line no-console
  console.log(`Destination (écriture)  : Staging (clé ${maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY)})`)

  let query = source.from('alertes').select('*').order('date_publication', { ascending: false }).limit(500)
  if (opts.since) query = query.gte('date_publication', opts.since)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as LegacyAlerteRow[]

  const acteurCounts = new Map<string, number>()
  for (const r of rows) {
    if (!r.acteur_entite) continue
    acteurCounts.set(r.acteur_entite, (acteurCounts.get(r.acteur_entite) ?? 0) + 1)
  }
  const recurringActeurs = new Set([...acteurCounts.entries()].filter(([, c]) => c > 1).map(([a]) => a))

  const sample = selectRepresentativeSample({ rows, limit: opts.limit, recurringActeurs })
  const duplicates = detectStrictDuplicates(sample)
  const duplicateIds = new Set(duplicates.flatMap((g) => g.ids.slice(1))) // garde la première occurrence, marque les suivantes

  const entrepriseId = opts.companyId ?? '(à résoudre par entreprise réelle — voir mapping Phase 2)'
  const plan = buildImportPlan(sample, entrepriseId, duplicateIds)

  if (opts.dryRun) {
    printDryRunSummary(plan, opts.batchId)
    return
  }

  throw new Error(
    'NOT_IMPLEMENTED_IN_THIS_CLI_INVOCATION: l\'écriture réelle (upsert entreprises/décideurs/alertes/pertinence/opportunités) ' +
      'est implémentée dans les fonctions exportées de ce module (buildImportPlan, computeCorrelationKeyForRow, etc.) et ' +
      'orchestrée par les tests d\'intégration (scripts/sprint10-legacy-import-tests.ts) et par l\'exécution documentée dans ' +
      'docs/sprint-10-legacy-data-audit.md — ce garde-fou évite qu\'un lancement CLI sans --dry-run n\'écrive accidentellement ' +
      'sans confirmation explicite de l\'entreprise cible (--company-id) dans cette version du script.'
  )
}

const isMainModule = process.argv[1]?.endsWith('sprint10-import-legacy-alerts.ts')
if (isMainModule) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
}
