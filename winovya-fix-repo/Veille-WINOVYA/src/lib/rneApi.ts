// Recherche d'élus locaux, en direct depuis des sources publiques
// officielles (aucune donnée fabriquée) :
// - geo.api.gouv.fr : résolution du nom de commune saisi -> code INSEE, et
//   résolution département -> région.
// - Répertoire National des Élus (RNE, Ministère de l'Intérieur), publié
//   sur data.gouv.fr et interrogé via l'API tabulaire officielle
//   (tabular-api.data.gouv.fr), directement sur les fichiers CSV sources —
//   PAS via un miroir tiers. C'est important : certains miroirs tiers du
//   RNE ne sont resynchronisés que ponctuellement et peuvent afficher des
//   élus qui ne sont plus en fonction après une élection (ex. municipales
//   de mars 2026). Les fichiers data.gouv.fr utilisés ici sont republiés en
//   continu par le Ministère de l'Intérieur (vus à jour au 09/06/2026,
//   intégrant le renouvellement général de mars 2026 au moment de
//   l'écriture de ce code).
// - Annuaire de l'administration (service-public.fr / DILA) : coordonnées
//   officielles (téléphone, email) de la mairie.
//
// Important : le RNE ne publie ni numéro de téléphone ni email personnel
// des élus (ces données ne sont pas des données ouvertes, pour des raisons
// de protection de la vie privée). Le téléphone/email affichés sont donc
// ceux du standard officiel de la mairie, pas la ligne directe de l'élu —
// c'est la voie de contact réelle et légitime pour joindre un élu local.

const GEO_API = 'https://geo.api.gouv.fr'
const TABULAR_API = 'https://tabular-api.data.gouv.fr/api'
const ANNUAIRE_API =
  'https://api-lannuaire.service-public.gouv.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records'

// Identifiants des ressources CSV du jeu de données officiel "Répertoire
// national des élus" sur data.gouv.fr (dataset 5c34c4d1634f4173183a64f1).
// Chaque type de mandat est publié dans un fichier distinct.
const RNE_RESOURCES = {
  municipal: 'd5f400de-ae3f-4966-8cb6-a85c70c6c24a', // conseillers municipaux (inclut maires + adjoints)
  epci: '41d95d7d-b172-4636-ac44-32656367cdc7', // conseillers communautaires (EPCI)
  departemental: '601ef073-d986-4582-8e1a-ed14dc857fba',
  regional: '430e13f9-834b-4411-a1a8-da0b4b6e715c',
} as const

export interface CommuneMatch {
  nom: string
  code: string
  codeDepartement: string | null
  codeRegion: string | null
  score: number
}

export interface Elu {
  prenom: string | null
  nom: string | null
  fonction: string | null
  mandat: string | null // "Municipal" | "Communautaire (EPCI)" | "Départemental" | "Régional"
  dateDebutMandat: string | null
  dateDebutFonction: string | null
  region: string | null
  departement: string | null
  epci: string | null
  commune: string | null
  comCode: string | null
  /** Usage interne : code département brut, pour résoudre `region` en différé. Non affiché. */
  deptCodeRaw?: string | null
}

export interface MairieContact {
  nom: string
  telephone: string | null
  email: string | null
  siteWeb: string | null
  adresse: string | null
}

async function fetchJson(url: string): Promise<any> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function queryTabular(resourceId: string, params: Record<string, string>): Promise<{ rows: any[]; total: number }> {
  const qs = new URLSearchParams(params).toString()
  const url = `${TABULAR_API}/resources/${resourceId}/data/?${qs}`
  const data = await fetchJson(url)
  return { rows: Array.isArray(data?.data) ? data.data : [], total: data?.meta?.total ?? 0 }
}

export async function searchCommunes(query: string): Promise<CommuneMatch[]> {
  const q = query.trim()
  if (!q) return []
  const url = `${GEO_API}/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codeDepartement,codeRegion&boost=population&limit=6`
  const data = await fetchJson(url)
  if (!Array.isArray(data)) return []
  return data.map((d: any) => ({
    nom: d.nom,
    code: d.code,
    codeDepartement: d.codeDepartement ?? null,
    codeRegion: d.codeRegion ?? null,
    score: d._score ?? 0,
  }))
}

// --- Résolution département -> région (mise en cache) ---------------------

const regionByDept = new Map<string, string | null>()

function padDeptCode(code: string): string {
  return code.length === 1 ? `0${code}` : code
}

async function getRegionForDept(deptCode: string): Promise<string | null> {
  const padded = padDeptCode(deptCode)
  if (regionByDept.has(padded)) return regionByDept.get(padded)!
  const data = await fetchJson(`${GEO_API}/departements/${padded}?fields=region`)
  const region = data?.region?.nom ?? null
  regionByDept.set(padded, region)
  return region
}

async function enrichRegions(elus: Elu[]): Promise<void> {
  const deptCodes = Array.from(new Set(elus.map((e) => e.deptCodeRaw).filter(Boolean))) as string[]
  await Promise.all(deptCodes.map((c) => getRegionForDept(c)))
  for (const e of elus) {
    if (!e.region && e.deptCodeRaw) {
      e.region = regionByDept.get(padDeptCode(e.deptCodeRaw)) ?? null
    }
    delete e.deptCodeRaw
  }
}

// --- Mapping des lignes CSV brutes vers le type Elu ------------------------

function mapMunicipal(r: any): Elu {
  return {
    prenom: r["Prénom de l'élu"] ?? null,
    nom: r["Nom de l'élu"] ?? null,
    fonction: r['Libellé de la fonction'] ?? null,
    mandat: 'Municipal',
    dateDebutMandat: r['Date de début du mandat'] ?? null,
    dateDebutFonction: r['Date de début de la fonction'] ?? null,
    region: null,
    departement: r['Libellé du département'] ?? null,
    epci: null,
    commune: r['Libellé de la commune'] ?? null,
    comCode: r['Code de la commune'] ?? null,
    deptCodeRaw: r['Code du département'] ?? null,
  }
}

function mapEpci(r: any): Elu {
  return {
    prenom: r["Prénom de l'élu"] ?? null,
    nom: r["Nom de l'élu"] ?? null,
    fonction: r['Libellé de la fonction'] ?? null,
    mandat: 'Communautaire (EPCI)',
    dateDebutMandat: r['Date de début du mandat'] ?? null,
    dateDebutFonction: r['Date de début de la fonction'] ?? null,
    region: null,
    departement: r['Libellé du département'] ?? null,
    epci: r["Libellé de l'EPCI"] ?? null,
    commune: r['Libellé de la commune de rattachement'] ?? null,
    comCode: r['Code de la commune de rattachement'] ?? null,
    deptCodeRaw: r['Code du département'] ?? null,
  }
}

function mapDepartemental(r: any): Elu {
  const canton = r['Libellé du canton'] ?? null
  return {
    prenom: r["Prénom de l'élu"] ?? null,
    nom: r["Nom de l'élu"] ?? null,
    fonction: r['Libellé de la fonction'] ?? null,
    mandat: 'Départemental',
    dateDebutMandat: r['Date de début du mandat'] ?? null,
    dateDebutFonction: r['Date de début de la fonction'] ?? null,
    region: null,
    departement: [r['Libellé du département'], canton ? `canton de ${canton}` : null].filter(Boolean).join(' — '),
    epci: null,
    commune: null,
    comCode: null,
    deptCodeRaw: r['Code du département'] ?? null,
  }
}

function mapRegional(r: any): Elu {
  return {
    prenom: r["Prénom de l'élu"] ?? null,
    nom: r["Nom de l'élu"] ?? null,
    fonction: r['Libellé de la fonction'] ?? null,
    mandat: 'Régional',
    dateDebutMandat: r['Date de début du mandat'] ?? null,
    dateDebutFonction: r['Date de début de la fonction'] ?? null,
    region: r['Libellé de la région'] ?? null,
    departement: r['Libellé de la section départementale'] ?? null,
    epci: null,
    commune: null,
    comCode: null,
    deptCodeRaw: null,
  }
}

const RESOURCES = [
  { id: RNE_RESOURCES.municipal, map: mapMunicipal },
  { id: RNE_RESOURCES.epci, map: mapEpci },
  { id: RNE_RESOURCES.departemental, map: mapDepartemental },
  { id: RNE_RESOURCES.regional, map: mapRegional },
] as const

function fonctionRank(fonction: string | null): number {
  if (!fonction) return 999
  if (fonction.trim().toLowerCase() === 'maire') return 0
  const m = fonction.match(/^(\d+)/)
  if (m) return Number(m[1])
  return 500
}

function mandatRank(mandat: string | null): number {
  switch (mandat) {
    case 'Municipal':
      return 0
    case 'Communautaire (EPCI)':
      return 1
    case 'Départemental':
      return 2
    case 'Régional':
      return 3
    default:
      return 9
  }
}

// Conseil municipal complet d'une commune (maire + adjoints + conseillers),
// maire et adjoints en tête, dans l'ordre protocolaire.
export async function getMunicipalCouncil(comCode: string): Promise<{ total: number; elus: Elu[] }> {
  const { rows, total } = await queryTabular(RNE_RESOURCES.municipal, {
    'Code de la commune__exact': comCode,
    page_size: '200',
  })
  const elus = rows.map(mapMunicipal)
  await enrichRegions(elus)
  elus.sort((a, b) => {
    const ra = fonctionRank(a.fonction)
    const rb = fonctionRank(b.fonction)
    if (ra !== rb) return ra - rb
    return (a.nom || '').localeCompare(b.nom || '', 'fr')
  })
  return { total: total || elus.length, elus }
}

// Recherche d'un·e élu·e par nom/prénom, sur l'ensemble du RNE (mandats
// municipal, communautaire/EPCI, départemental et régional confondus).
export async function searchElusByName(query: string): Promise<{ total: number; elus: Elu[] }> {
  const q = query.trim()
  if (!q) return { total: 0, elus: [] }
  const words = q.split(/\s+/).filter(Boolean)

  // Le RNE distingue nom et prénom : on tente plusieurs découpages
  // plausibles (le nom de famille étant généralement saisi en dernier, mais
  // parfois en premier), et pour un seul mot on cherche aussi bien côté nom
  // que côté prénom.
  const attempts: Array<Record<string, string>> = []
  if (words.length === 1) {
    attempts.push({ "Nom de l'élu__contains": words[0] })
    attempts.push({ "Prénom de l'élu__contains": words[0] })
  } else {
    const last = words[words.length - 1]
    const rest = words.slice(0, -1).join(' ')
    const first = words[0]
    const tail = words.slice(1).join(' ')
    attempts.push({ "Nom de l'élu__contains": last, "Prénom de l'élu__contains": rest })
    attempts.push({ "Nom de l'élu__contains": first, "Prénom de l'élu__contains": tail })
    attempts.push({ "Nom de l'élu__contains": last })
  }

  const calls = RESOURCES.flatMap((res) =>
    attempts.map((attempt) =>
      queryTabular(res.id, { ...attempt, page_size: '10' }).then(({ rows }) => rows.map(res.map))
    )
  )

  const results = await Promise.all(calls)
  const seen = new Set<string>()
  const elus: Elu[] = []
  for (const group of results) {
    for (const elu of group) {
      const key = `${elu.mandat}|${elu.nom}|${elu.prenom}|${elu.comCode || elu.departement || elu.region}`
      if (seen.has(key)) continue
      seen.add(key)
      elus.push(elu)
    }
  }

  elus.sort((a, b) => mandatRank(a.mandat) - mandatRank(b.mandat))
  const capped = elus.slice(0, 30)
  await enrichRegions(capped)
  return { total: elus.length, elus: capped }
}

const mairieContactCache = new Map<string, MairieContact | null>()

// Coordonnées officielles (téléphone/email/site) de la mairie d'une
// commune, via l'annuaire de l'administration (service-public.fr).
export async function getMairieContact(comCode: string): Promise<MairieContact | null> {
  if (mairieContactCache.has(comCode)) return mairieContactCache.get(comCode)!
  const where = encodeURIComponent(`code_insee_commune="${comCode}" and pivot like "mairie"`)
  const url = `${ANNUAIRE_API}?where=${where}&limit=1`
  const data = await fetchJson(url)
  const r = data?.results?.[0]
  if (!r) {
    mairieContactCache.set(comCode, null)
    return null
  }
  let telephone: string | null = null
  let siteWeb: string | null = null
  let adresse: string | null = null
  try {
    const tels = JSON.parse(r.telephone || '[]')
    telephone = tels[0]?.valeur || null
  } catch {
    /* noop */
  }
  try {
    const sites = JSON.parse(r.site_internet || '[]')
    siteWeb = sites[0]?.valeur || null
  } catch {
    /* noop */
  }
  try {
    const adr = JSON.parse(r.adresse || '[]')
    if (adr[0]) adresse = [adr[0].numero_voie, adr[0].code_postal, adr[0].nom_commune].filter(Boolean).join(', ')
  } catch {
    /* noop */
  }
  const contact: MairieContact = {
    nom: r.nom || 'Mairie',
    telephone,
    email: r.adresse_courriel || null,
    siteWeb,
    adresse,
  }
  mairieContactCache.set(comCode, contact)
  return contact
}
