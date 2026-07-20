import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Edge Function: process-alert-opportunity
//
// Point d'entrée serveur du backend déterministe du moteur d'opportunités
// (Sprint 2). Aucune IA : les 7 sous-scores d'adéquation et l'étape de
// projet sont des ENTRÉES fournies par l'appelant (calculées en amont,
// hors de cette fonction). Cette fonction :
//   1. vérifie l'authentification (JWT) ET le rôle admin de l'appelant ;
//   2. respecte le coupe-circuit OPPORTUNITY_ENGINE_ENABLED (secret Edge
//      Function ; absent ou différent de "true" => refus explicite) ;
//   3. valide strictement le payload ;
//   4. calcule les indicateurs (formules identiques à
//      src/lib/opportunities/engine/ScoreEngine.ts / scoringConfig.ts et
//      CorrelationEngine.ts — dupliquées ici car les Edge Functions de ce
//      projet sont des scripts Deno autonomes, non bundlés avec le code
//      Vite ; toute modification d'une pondération doit être répercutée
//      des deux côtés et revalidée par les mêmes cas de test, Sprint 2
//      Phase 9 / Sprint 2.1 Phase 6) ;
//
//   Sprint 2.1 (stabilisation) : la clé de corrélation n'inclut plus de
//      fenêtre temporelle mensuelle (voir CorrelationEngine.ts pour la
//      justification complète — l'ancienne stratégie fragmentait un même
//      projet en plusieurs opportunités dès que ses signaux dépassaient
//      un mois calendaire, ex: MBDA / nouvelle usine / Bourges détecté en
//      Mars/Mai/Juillet/Septembre).
//   5. délègue la partie critique en concurrence (find-or-create +
//      liaisons + recalcul des agrégats réels) à la fonction Postgres
//      transactionnelle veille.process_alert_opportunity, appelée avec
//      le rôle service_role (seul rôle disposant du EXECUTE sur cette
//      fonction, cf. migration 20260717000100) ;
//   6. persiste convergence_score/priorite_score/score_details en un
//      second UPDATE, à partir des agrégats renvoyés par le RPC.
//
// Sécurité : verify_jwt=true au déploiement (aucun appel anonyme possible
// au niveau plateforme). En plus de cela, l'appelant doit être un profil
// "admin" (vérifié ici via son JWT + son profil `veille.profiles`) — ce
// n'est pas un endpoint utilisable par un compte client standard. La clé
// service_role n'est utilisée que côté serveur, jamais exposée au
// frontend. Il n'existe aucun mode de contournement de ces contrôles :
// le "mode de test manuel" consiste simplement, pour un admin
// authentifié, à appeler cette fonction avec des données fictives qu'il
// a lui-même créées — aucun chemin de code séparé ne désactive
// l'authentification, le rôle admin ou le coupe-circuit.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ---------------------------------------------------------------------------
// ScoreEngine (miroir de src/lib/opportunities/engine/ScoreEngine.ts +
// scoringConfig.ts) — toutes les pondérations sont regroupées ici, dans
// UN SEUL bloc contigu (Phase 3, centralisation Sprint 2.1).
// ---------------------------------------------------------------------------

const SCORE_VERSION = "sprint2-v1";

const ADEQUATION_WEIGHTS: Record<string, number> = {
  competences: 0.3,
  types_opportunite: 0.25,
  secteurs: 0.15,
  references: 0.1,
  geographie: 0.1,
  mots_cles: 0.05,
  compte_strategique: 0.05,
};
const ADEQUATION_KEYS = Object.keys(ADEQUATION_WEIGHTS);

function roundScore(v: number): number {
  return Math.round(v);
}

function computeAdequationScore(subScores: Record<string, unknown>): number {
  for (const key of ADEQUATION_KEYS) {
    const value = subScores[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`SUBSCORE_MISSING: ${key}`);
    }
    if (value < 0 || value > 100) {
      throw new Error(`SUBSCORE_OUT_OF_RANGE: ${key}=${value}`);
    }
  }
  const weighted = ADEQUATION_KEYS.reduce((sum, key) => sum + (subScores[key] as number) * ADEQUATION_WEIGHTS[key], 0);
  return roundScore(weighted);
}

const CONVERGENCE_WEIGHTS = { signalCount: 0.4, sourceDiversity: 0.25, temporalProximity: 0.2, coherence: 0.15 };

function signalCountComponent(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 40;
  if (n === 3) return 70;
  if (n === 4) return 90;
  return 100;
}
function sourceDiversityComponent(distinct: number, n: number): number {
  if (n <= 1) return 0;
  return roundScore(Math.min(1, distinct / n) * 100);
}
function temporalProximityComponent(spanDays: number): number {
  if (spanDays <= 7) return 100;
  if (spanDays <= 30) return 70;
  if (spanDays <= 90) return 40;
  if (spanDays <= 180) return 20;
  return 0;
}
function coherenceComponent(entiteMatch: boolean, geoMatch: boolean): number {
  if (entiteMatch && geoMatch) return 100;
  if (entiteMatch || geoMatch) return 50;
  return 0;
}
function computeConvergenceScore(inputs: {
  nombreSignaux: number;
  distinctCategories: number;
  spanDays: number;
  entiteMatch: boolean;
  geoMatch: boolean;
}) {
  const signal = signalCountComponent(inputs.nombreSignaux);
  const diversity = sourceDiversityComponent(inputs.distinctCategories, inputs.nombreSignaux);
  const temporal = temporalProximityComponent(inputs.spanDays);
  const coherence = coherenceComponent(inputs.entiteMatch, inputs.geoMatch);
  const weighted =
    signal * CONVERGENCE_WEIGHTS.signalCount +
    diversity * CONVERGENCE_WEIGHTS.sourceDiversity +
    temporal * CONVERGENCE_WEIGHTS.temporalProximity +
    coherence * CONVERGENCE_WEIGHTS.coherence;
  return { score: roundScore(weighted), components: { signalCount: signal, sourceDiversity: diversity, temporalProximity: temporal, coherence } };
}

const ANTICIPATION_TABLE: Record<string, number> = {
  INTENTION: 100,
  ETUDE: 86,
  FONCIER: 71,
  AUTORISATION: 57,
  RECRUTEMENT: 43,
  CONSULTATION: 29,
  ANNONCE: 14,
  APPEL_OFFRES: 0,
};

function computeAnticipationScore(etape: string): number {
  const value = ANTICIPATION_TABLE[etape];
  if (value === undefined) throw new Error(`INVALID_ETAPE_PROJET: ${etape}`);
  return value;
}

const PRIORITE_WEIGHTS = { adequation: 0.45, convergence: 0.35, anticipation: 0.2 };

function computePrioriteScore(adequation: number, convergence: number, anticipation: number): number {
  return roundScore(adequation * PRIORITE_WEIGHTS.adequation + convergence * PRIORITE_WEIGHTS.convergence + anticipation * PRIORITE_WEIGHTS.anticipation);
}

// --- CorrelationEngine (miroir de src/lib/opportunities/engine/CorrelationEngine.ts) ---
// Stratégie B (Sprint 2.1) : entreprise + entité + type + géographie,
// SANS fenêtre temporelle. Voir CorrelationEngine.ts pour la comparaison
// complète des stratégies A/B/C et la justification du choix.

function normalizeForCorrelation(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateCorrelationKey(input: {
  entrepriseId: string;
  alerteId: string;
  entiteCible: string | null;
  typeOpportunite: string | null;
  geographie: string | null;
}): { key: string; confidence: "high" | "low" } {
  const entite = normalizeForCorrelation(input.entiteCible);
  const type = normalizeForCorrelation(input.typeOpportunite);
  const geo = normalizeForCorrelation(input.geographie);
  const hasSufficientData = entite.length > 0 && type.length > 0 && geo.length > 0;
  if (!hasSufficientData) {
    return { key: `${input.entrepriseId}|alerte-${input.alerteId}`, confidence: "low" };
  }
  return { key: `${input.entrepriseId}|${entite}|${type}|${geo}`, confidence: "high" };
}

function firstNonEmpty(...values: (string | null | undefined)[]): string | null {
  for (const v of values) {
    if (v && v.trim().length > 0) return v;
  }
  return null;
}

const VALID_ETAPES = new Set(Object.keys(ANTICIPATION_TABLE));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const engineEnabled = (Deno.env.get("OPPORTUNITY_ENGINE_ENABLED") ?? "false").toLowerCase() === "true";

  if (!engineEnabled) {
    return json({ error: "OPPORTUNITY_ENGINE_DISABLED" }, 503);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser();
    if (callerErr || !caller) return json({ error: "Non authentifié" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileErr } = await admin.schema("veille").from("profiles").select("id, role").eq("id", caller.id).single();
    if (profileErr || !profile) return json({ error: "Profil introuvable" }, 404);
    if (profile.role !== "admin") return json({ error: "Réservé aux administrateurs" }, 403);

    const body = await req.json();
    const alerteId = typeof body?.alerteId === "string" ? body.alerteId : null;
    const entrepriseId = typeof body?.entrepriseId === "string" ? body.entrepriseId : null;
    const subScores = body?.subScores;
    const etapeProjet = typeof body?.etapeProjet === "string" ? body.etapeProjet : null;
    const correlationMetadata = body?.correlationMetadata ?? {};
    const titreOverride = typeof body?.titre === "string" ? body.titre : null;

    if (!alerteId) return json({ error: "alerteId requis" }, 400);
    if (!entrepriseId) return json({ error: "entrepriseId requis" }, 400);
    if (!subScores || typeof subScores !== "object") return json({ error: "subScores requis" }, 400);
    if (!etapeProjet || !VALID_ETAPES.has(etapeProjet)) return json({ error: `etapeProjet invalide (attendu: ${[...VALID_ETAPES].join(", ")})` }, 400);

    let adequationScore: number;
    let anticipationScore: number;
    try {
      adequationScore = computeAdequationScore(subScores);
      anticipationScore = computeAnticipationScore(etapeProjet);
    } catch (e) {
      return json({ error: String((e as Error).message ?? e) }, 400);
    }

    // Charger l'alerte réelle (aucune colonne inventée : mapping Phase 1).
    const { data: alerte, error: alerteErr } = await admin
      .schema("veille")
      .from("alertes")
      .select("id, acteur_entite, type_opportunite, commune_collectivite, departement, region, pays, date_detection, lien_source_url, resume, reference_officielle, name")
      .eq("id", alerteId)
      .maybeSingle();
    if (alerteErr) return json({ error: alerteErr.message }, 500);
    if (!alerte) return json({ error: "ALERTE_NOT_FOUND" }, 404);

    const { data: entreprise, error: entrepriseErr } = await admin.schema("veille").from("entreprises").select("id").eq("id", entrepriseId).maybeSingle();
    if (entrepriseErr) return json({ error: entrepriseErr.message }, 500);
    if (!entreprise) return json({ error: "ENTREPRISE_NOT_FOUND" }, 404);

    const { data: pertinence, error: pertinenceErr } = await admin
      .schema("veille")
      .from("pertinence_entreprise")
      .select("id, statut")
      .eq("alerte_id", alerteId)
      .eq("entreprise_id", entrepriseId)
      .maybeSingle();
    if (pertinenceErr) return json({ error: pertinenceErr.message }, 500);
    if (!pertinence || pertinence.statut !== "Actif") return json({ error: "ALERTE_NOT_RELEVANT_FOR_ENTREPRISE" }, 409);

    const { data: decideurLinks, error: decideurErr } = await admin.schema("veille").from("alerte_decideurs").select("decideur_id").eq("alerte_id", alerteId);
    if (decideurErr) return json({ error: decideurErr.message }, 500);
    const decideurIds = (decideurLinks ?? []).map((d: { decideur_id: string }) => d.decideur_id);

    const entiteCible = firstNonEmpty(correlationMetadata.entiteCible, alerte.acteur_entite);
    const typeOppArray = Array.isArray(alerte.type_opportunite) ? alerte.type_opportunite : [];
    const typeOpportunite = firstNonEmpty(correlationMetadata.typeOpportunite, typeOppArray[0] ?? null);
    const secteur = firstNonEmpty(correlationMetadata.secteur, null);
    const regionArray = Array.isArray(alerte.region) ? alerte.region : [];
    const geographie = firstNonEmpty(correlationMetadata.geographie, alerte.commune_collectivite, alerte.departement, regionArray[0] ?? null, alerte.pays);

    const dateSignal = new Date(alerte.date_detection as string);
    const correlation = generateCorrelationKey({ entrepriseId, alerteId, entiteCible, typeOpportunite, geographie });

    const titre = titreOverride ?? firstNonEmpty(alerte.name, alerte.resume, alerte.reference_officielle) ?? `Opportunité — ${alerteId}`;

    const { data: rpcRows, error: rpcErr } = await admin.schema("veille").rpc("process_alert_opportunity", {
      p_alerte_id: alerteId,
      p_entreprise_id: entrepriseId,
      p_correlation_key: correlation.key,
      p_titre: titre,
      p_entite_cible: entiteCible,
      p_type_opportunite: typeOpportunite,
      p_secteur: secteur,
      p_geographie: geographie,
      p_decideur_ids: decideurIds,
      p_preuve_source: alerte.reference_officielle, // pas de repli sur alerte.name (pas une source citable)
      p_preuve_citation: alerte.resume,
      p_preuve_url: alerte.lien_source_url,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);
    const rpcResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    if (!rpcResult) return json({ error: "RPC_EMPTY_RESULT" }, 500);

    const opportuniteId = rpcResult.opportunite_id as string;
    const action = rpcResult.action as string;
    const nombreSignaux = rpcResult.nombre_signaux as number;
    const distinctCategories = rpcResult.distinct_categories as number;
    const datePremier = rpcResult.date_premier_signal ? new Date(rpcResult.date_premier_signal as string) : dateSignal;
    const dateDernier = rpcResult.date_dernier_signal ? new Date(rpcResult.date_dernier_signal as string) : dateSignal;
    const spanDays = Math.max(0, Math.round((dateDernier.getTime() - datePremier.getTime()) / (1000 * 60 * 60 * 24)));

    const { data: opp, error: oppErr } = await admin.schema("veille").from("opportunites").select("entite_cible, geographie").eq("id", opportuniteId).maybeSingle();
    if (oppErr) return json({ error: oppErr.message }, 500);

    const entiteMatch = Boolean(entiteCible) && opp?.entite_cible === entiteCible;
    const geoMatch = Boolean(geographie) && opp?.geographie === geographie;

    const convergenceInputs = { nombreSignaux, distinctCategories, spanDays, entiteMatch, geoMatch };
    const convergence = computeConvergenceScore(convergenceInputs);
    const prioriteScore = computePrioriteScore(adequationScore, convergence.score, anticipationScore);

    const scoreDetails = {
      adequation: { subScores },
      convergence: { components: convergence.components, inputs: convergenceInputs },
      anticipation: { etapeProjet },
      correlation: { key: correlation.key, confidence: correlation.confidence },
    };

    const { error: updateErr } = await admin
      .schema("veille")
      .from("opportunites")
      .update({
        adequation_score: adequationScore,
        convergence_score: convergence.score,
        anticipation_score: anticipationScore,
        priorite_score: prioriteScore,
        score_details: scoreDetails,
        score_version: SCORE_VERSION,
      })
      .eq("id", opportuniteId);
    if (updateErr) return json({ error: updateErr.message }, 500);

    // Log structuré, sans secret (aucune clé/JWT loggée).
    console.log(
      JSON.stringify({
        event: "process_alert_opportunity",
        opportuniteId,
        action,
        alerteId,
        entrepriseId,
        adequationScore,
        convergenceScore: convergence.score,
        anticipationScore,
        prioriteScore,
        confidence: correlation.confidence,
      })
    );

    return json({
      opportuniteId,
      action,
      indicators: {
        adequationScore,
        convergenceScore: convergence.score,
        anticipationScore,
        prioriteScore,
        scoreDetails,
        scoreVersion: SCORE_VERSION,
      },
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
