// Row types mirroring the `veille` Postgres schema.
// Kept hand-written (not generated) so the app has no build-time dependency
// on running `generate_typescript_types` — regenerate manually if the
// schema changes.

export type Priorite = 'Haute' | 'Moyenne' | 'Basse'
export type ScorePertinence = 'Très Haute' | 'Haute' | 'Moyenne' | 'Basse' | 'À confirmer'
export type StatutClient =
  | 'Oui - client actif'
  | 'Oui - client / référence passée'
  | 'Non - prospect nouveau'
  | 'À vérifier'
export type StatutDecideur = 'À jour' | 'À revérifier' | 'Introuvable sur le site officiel'
export type RoleAchat =
  | 'Utilisateur final / terrain'
  | 'Décideur budgétaire (DAF/DSI/élu rapporteur)'
  | 'Service marchés / achats'
  | 'Dirigeant / représentant légal'
  | 'Non catégorisé'
export type NatureDecideur = 'Public' | 'Privé'
export type SecteurClients = 'Majoritairement privé' | 'Majoritairement public' | 'Mixte (public et privé)'
export type StatutAlerte = 'NOUVEAU' | 'ASSIGNE' | 'TRAITE' | 'ARCHIVE'
export type StatutPertinence = 'Actif' | 'Écarté'
export type ProfileRole = 'admin' | 'member'

export interface Entreprise {
  id: string
  name: string
  competences: string | null
  references_clients: string | null
  status: string
  site_web: string | null
  description_courte: string | null
  secteurs_intervention: string | null
  zone_geographique: string | null
  mots_cles_metiers: string | null
  effectif_taille: string | null
  secteur_clients: SecteurClients | null
  onboarding_complete: boolean
  pays: string[]
  regions_suivies: string[] | null
  departements_suivis: string[] | null
  types_opportunite_suivis: string[] | null
  created_at: string
  updated_at: string
}

export interface Decideur {
  id: string
  nom: string
  structure_entreprise: string | null
  nature: NatureDecideur | null
  type_structure: string | null
  departement: string | null
  region: string[] | null
  nom_personne: string | null
  prenom_personne: string | null
  fonction_poste: string | null
  service_direction: string | null
  email: string | null
  telephone: string | null
  linkedin: string | null
  source_url: string | null
  date_capture: string | null
  statut: StatutDecideur | null
  notes: string | null
  document_organigramme_url: string | null
  organigramme_page_web: string | null
  role_achat: RoleAchat | null
  created_at: string
  updated_at: string
}

export interface Alerte {
  id: string
  name: string
  notes: string | null
  categorie_veille: string | null
  pays: string
  departement: string | null
  region: string[] | null
  commune_collectivite: string | null
  date_publication: string | null
  date_detection: string
  lien_source_url: string | null
  resume: string | null
  acteur_entite: string | null
  montant: number | null
  reference_officielle: string | null
  echeance_date_limite: string | null
  priorite: Priorite | null
  mots_cles: string[] | null
  type_opportunite: string[] | null
  contact_decideur_nom: string | null
  contact_decideur_fonction: string | null
  contact_decideur_email: string | null
  contact_decideur_telephone: string | null
  contact_decideur_linkedin: string | null
  notes_equipe: string | null
  assigne_email: string | null
  texte_extrait_document: string | null
  statut: StatutAlerte
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  alerte_id: string | null
  filename: string | null
  storage_path: string | null
  url: string | null
  created_at: string
}

export interface PertinenceEntreprise {
  id: string
  nom: string | null
  alerte_id: string
  entreprise_id: string
  score_pertinence: ScorePertinence | null
  type_opportunite: string[] | null
  lien_business: string | null
  statut: StatutPertinence
  donneur_ordre_deja_client: StatutClient | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: ProfileRole
  entreprise_id: string | null
  created_at: string
}

// Composite shape used by the dashboard: an alerte joined with its
// pertinence rows (per entreprise) and its attachments/decideurs.
export interface AlerteWithRelations extends Alerte {
  pertinence_entreprise: (PertinenceEntreprise & { entreprises: Pick<Entreprise, 'id' | 'name'> })[]
  attachments: Attachment[]
  decideurs: Decideur[]
}
