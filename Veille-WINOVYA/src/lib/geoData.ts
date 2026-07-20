// French administrative geography, backed by the official public API
// https://geo.api.gouv.fr (IGN / data.gouv.fr, no auth, CORS-enabled).
// Régions are static reference data (name + INSEE code never change) so
// they're hardcoded. Départements / EPCI (communautés de communes,
// d'agglomération, etc.) / communes are fetched on demand and cached in
// memory for the session, since walking the full tree eagerly would be
// tens of thousands of rows.

export const FRANCE_ENTIERE = 'France entière / national'

export interface GeoNode {
  code: string
  nom: string
}

// Régions de France (nom + code INSEE), ordre d'affichage figé.
export const REGIONS: GeoNode[] = [
  { nom: 'Île-de-France', code: '11' },
  { nom: 'Auvergne-Rhône-Alpes', code: '84' },
  { nom: 'Bourgogne-Franche-Comté', code: '27' },
  { nom: 'Bretagne', code: '53' },
  { nom: 'Centre-Val de Loire', code: '24' },
  { nom: 'Corse', code: '94' },
  { nom: 'Grand Est', code: '44' },
  { nom: 'Hauts-de-France', code: '32' },
  { nom: 'Normandie', code: '28' },
  { nom: 'Nouvelle-Aquitaine', code: '75' },
  { nom: 'Occitanie', code: '76' },
  { nom: 'Pays de la Loire', code: '52' },
  { nom: "Provence-Alpes-Côte d'Azur", code: '93' },
  { nom: 'Guadeloupe', code: '01' },
  { nom: 'Martinique', code: '02' },
  { nom: 'Guyane', code: '03' },
  { nom: 'La Réunion', code: '04' },
  { nom: 'Mayotte', code: '06' },
]

const GEO_API = 'https://geo.api.gouv.fr'

const departementsCache = new Map<string, GeoNode[]>()
const epcisCache = new Map<string, GeoNode[]>()
const communesCache = new Map<string, GeoNode[]>()

async function fetchJson(url: string): Promise<GeoNode[]> {
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    return (await res.json()) as GeoNode[]
  } catch {
    return []
  }
}

function sortByNom(list: GeoNode[]): GeoNode[] {
  return [...list].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

export async function getDepartements(regionCode: string): Promise<GeoNode[]> {
  if (departementsCache.has(regionCode)) return departementsCache.get(regionCode)!
  const data = sortByNom(await fetchJson(`${GEO_API}/regions/${regionCode}/departements?fields=nom,code`))
  departementsCache.set(regionCode, data)
  return data
}

export async function getEpcis(departementCode: string): Promise<GeoNode[]> {
  if (epcisCache.has(departementCode)) return epcisCache.get(departementCode)!
  const data = sortByNom(await fetchJson(`${GEO_API}/epcis?codeDepartement=${departementCode}&fields=nom,code`))
  epcisCache.set(departementCode, data)
  return data
}

export async function getCommunes(epciCode: string): Promise<GeoNode[]> {
  if (communesCache.has(epciCode)) return communesCache.get(epciCode)!
  const data = sortByNom(await fetchJson(`${GEO_API}/communes?codeEpci=${epciCode}&fields=nom,code`))
  communesCache.set(epciCode, data)
  return data
}

// Full list of type_opportunite values as they currently exist in the DB
// (kept verbatim, including apparent near-duplicates with "/" vs "-"
// separators — these are distinct stored values, not a data-entry bug we
// should silently merge here).
export const TYPE_OPPORTUNITE_OPTIONS: string[] = [
  'Appel à projet subventionné',
  'Audit environnemental obligatoire',
  'Biodiversité / compensation écologique',
  'Biodiversité-compensation écologique',
  'Friche / foncier à réhabiliter',
  'Friche-foncier à réhabiliter',
  "Ingénierie-maîtrise d'œuvre industrielle",
  'Maintenance-essais-contrôles techniques',
  'Mise en conformité ICPE',
  "Nouvelle implantation industrielle / construction d'usine",
  'R&D collaborative-innovation industrielle',
  'RSE / reporting extra-financier',
  'Risque environnemental / pollution',
  'Risque environnemental-pollution',
  'Rénovation énergétique bâtiment',
  'Transition énergétique / décarbonation',
  'À évaluer',
  'Économie circulaire / déchets',
  'Économie circulaire-déchets',
]
