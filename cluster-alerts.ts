// ============================================================================
// Supabase Edge Function: cluster-alerts
// ============================================================================
// Purpose: Regrouper les alertes existantes en opportunités par clustering IA
// Déclenché: manuellement après migration SQL OU à chaque nouvelle alerte
// Returns: {created_opportunities, clustered_alerts, duplicates_detected}
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ============================================================================
// HELPERS: Fuzzy Matching
// ============================================================================

// Levenshtein distance pour fuzzy matching acteur_entite
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(0));

  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}

// Normaliser acteur_entite pour comparaison
function normalizeActeur(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

// Calculer similarité (0-100)
function calculateSimilarity(
  acteur1: string,
  acteur2: string,
  localite1: string | null,
  localite2: string | null
): number {
  const norm1 = normalizeActeur(acteur1);
  const norm2 = normalizeActeur(acteur2);

  // Acteur exact match
  if (norm1 === norm2) {
    // Localité améliore le score
    if (
      localite1 &&
      localite2 &&
      normalizeActeur(localite1) === normalizeActeur(localite2)
    ) {
      return 100;
    }
    return 85;
  }

  // Fuzzy match acteur
  const maxLen = Math.max(norm1.length, norm2.length);
  const distance = levenshteinDistance(norm1, norm2);
  const similarity = Math.max(0, 100 - (distance / maxLen) * 100);

  // Si distance ≤ 3 et localité identique, c'est probablement la même
  if (distance <= 3 && localite1 && localite2) {
    if (normalizeActeur(localite1) === normalizeActeur(localite2)) {
      return 75;
    }
  }

  return similarity;
}

// Temporal proximity (alertes dans fenêtre de temps)
function getTemporalScore(
  date1: string | null,
  date2: string | null,
  daysThreshold: number = 180
): number {
  if (!date1 || !date2) return 0;

  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 90) return 20; // Très proche
  if (diffDays < daysThreshold) return 10; // Proche
  return 0; // Trop éloigné
}

// Cohérence type_opportunite
function getTypeOpportuniteScore(
  types1: string[] | null,
  types2: string[] | null
): number {
  if (!types1 || !types2) return 0;

  // Intersection non-vide = cohérence
  const intersection = types1.filter((t) => types2.includes(t));
  if (intersection.length > 0) return 20; // Types en commun

  // Complémentarité logique (ex: Foncier + Construction)
  const complementary = [
    ["Friche-foncier à réhabiliter", "Nouvelle implantation industrielle / construction d'usine"],
    ["Transition énergétique-décarbonation", "Rénovation énergétique bâtiment"],
    ["Mise en conformité ICPE", "Maintenance-essais-contrôles techniques"],
  ];

  for (const [type_a, type_b] of complementary) {
    if (
      (types1.includes(type_a) && types2.includes(type_b)) ||
      (types1.includes(type_b) && types2.includes(type_a))
    ) {
      return 30; // Complémentaires
    }
  }

  return 0;
}

// ============================================================================
// MAIN: Clustering
// ============================================================================

async function clusterAlerts() {
  console.log("Starting alert clustering...");

  // Étape 1: Récupérer toutes les alertes
  const { data: alerts, error: alertsError } = await supabase
    .from("alertes")
    .select("id, acteur_entite, commune_collectivite, type_opportunite, date_publication, categorie_veille")
    .order("date_publication", { ascending: false });

  if (alertsError || !alerts) {
    throw new Error(`Failed to fetch alerts: ${alertsError?.message}`);
  }

  console.log(`Loaded ${alerts.length} alerts`);

  // Étape 2: Grouper par (acteur, localité, type) avec scoring
  const clusters: Map<string, any[]> = new Map();
  const processedAlerts = new Set<string>();
  const clusters_created = [];

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    if (processedAlerts.has(alert.id)) continue;

    const clusterId = `${alert.acteur_entite}_${alert.commune_collectivite || "unknown"}`;
    const clusterAlerts = [alert];

    // Chercher les alertes similaires
    for (let j = i + 1; j < alerts.length; j++) {
      const otherAlert = alerts[j];
      if (processedAlerts.has(otherAlert.id)) continue;

      // Calculer score de similarité (0-100)
      let score = 0;

      // Acteur + localité (60 points max)
      const actorScore = calculateSimilarity(
        alert.acteur_entite,
        otherAlert.acteur_entite,
        alert.commune_collectivite,
        otherAlert.commune_collectivite
      );
      score += (actorScore / 100) * 60;

      // Type d'opportunité (30 points max)
      const typeScore = getTypeOpportuniteScore(
        alert.type_opportunite,
        otherAlert.type_opportunite
      );
      score += typeScore;

      // Temporal proximity (10 points max)
      const temporalScore = getTemporalScore(
        alert.date_publication,
        otherAlert.date_publication
      );
      score += temporalScore;

      // Seuil: 100 points = même opportunité
      if (score >= 100) {
        clusterAlerts.push(otherAlert);
        processedAlerts.add(otherAlert.id);
      }
    }

    processedAlerts.add(alert.id);

    // Créer opportunité pour ce cluster
    if (clusterAlerts.length > 0) {
      const nom = `${alert.acteur_entite}${alert.commune_collectivite ? ` — ${alert.commune_collectivite}` : ""}`;
      const aggregatedTypes = Array.from(
        new Set(clusterAlerts.flatMap((a) => a.type_opportunite || []))
      );

      const { data: opportunity, error: createError } = await supabase
        .from("opportunites")
        .insert({
          nom,
          acteur_entite: alert.acteur_entite,
          commune_collectivite: alert.commune_collectivite,
          type_opportunite: aggregatedTypes,
          alerte_ids: clusterAlerts.map((a) => a.id),
          nb_alertes: clusterAlerts.length,
          date_premiere_alerte: clusterAlerts[clusterAlerts.length - 1].date_publication,
          date_derniere_alerte: clusterAlerts[0].date_publication,
          statut: "NOUVEAU",
          scoring_global: "À confirmer",
          pattern_type: inferPatternType(aggregatedTypes),
        })
        .select();

      if (createError) {
        console.error(`Failed to create opportunity for ${nom}:`, createError.message);
      } else if (opportunity && opportunity.length > 0) {
        clusters_created.push(opportunity[0]);
        console.log(`Created opportunity: ${nom} (${clusterAlerts.length} alerts)`);
      }
    }
  }

  console.log(`Clustering complete. Created ${clusters_created.length} opportunities`);

  return {
    created_opportunities: clusters_created.length,
    clustered_alerts: alerts.length,
    details: clusters_created,
  };
}

// ============================================================================
// HELPER: Infer pattern_type
// ============================================================================

function inferPatternType(types: string[]): string {
  if (
    types.some(
      (t) =>
        t.includes("Nouvelle implantation industrielle") ||
        t.includes("Extension site existant") ||
        t.includes("Ingénierie-maîtrise d'œuvre industrielle")
    )
  ) {
    return "A_expansion_industrielle";
  }
  if (
    types.some(
      (t) =>
        t.includes("Marchés publics") ||
        t.includes("Rénovation énergétique") ||
        t.includes("Audit environnemental")
    )
  ) {
    return "B_marches_publics_collectivites";
  }
  if (
    types.some((t) => t.includes("Mise en conformité ICPE") || t.includes("Risque environnemental"))
  ) {
    return "C_icpe_conformite";
  }
  if (
    types.some(
      (t) => t.includes("R&D collaborative") || t.includes("Appel à projet subventionné")
    )
  ) {
    return "D_partenariat_rd_innovation";
  }
  if (
    types.some(
      (t) => t.includes("Modernisation") || t.includes("Extension site existant")
    )
  ) {
    return "E_extension_site";
  }
  if (
    types.some(
      (t) =>
        t.includes("Transition énergétique") ||
        t.includes("Économie circulaire") ||
        t.includes("Biodiversité")
    )
  ) {
    return "F_conformite_transition_ecologique";
  }
  return "A_expansion_industrielle"; // défaut
}

// ============================================================================
// EXPORT: Deno Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await clusterAlerts();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Clustering error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
