// ============================================================================
// Supabase Edge Function: match-offres
// ============================================================================
// Purpose: Croiser offres entreprise avec type_opportunite détecté
// Déclenché: Après phase detection OU lors de new alert pertinente
// Returns: {matched_opportunities, offres_recommandees}
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ============================================================================
// MATCH OFFRES TO OPPORTUNITIES
// ============================================================================

async function matchOffres() {
  console.log("Starting offres matching...");

  // Étape 1: Récupérer opportunités sans offres_recommandees
  const { data: opportunities, error: oppError } = await supabase
    .from("opportunite_pertinence_entreprise")
    .select("id, opportunite_id, entreprise_id, offres_recommandees")
    .filter("offres_recommandees", "is", null);

  if (oppError || !opportunities) {
    throw new Error(`Failed to fetch opportunities: ${oppError?.message}`);
  }

  console.log(`Loaded ${opportunities.length} opportunities to match offres`);

  const matched = [];

  // Étape 2: Pour chaque ligne pertinence, récupérer offres entreprise + type_opportunite
  for (const pertinence of opportunities) {
    // Récupérer type_opportunite de l'opportunité
    const { data: opp, error: oppTypeError } = await supabase
      .from("opportunites")
      .select("type_opportunite")
      .eq("id", pertinence.opportunite_id)
      .single();

    if (oppTypeError || !opp) {
      console.warn(
        `Failed to fetch opportunity types for ${pertinence.opportunite_id}`
      );
      continue;
    }

    // Récupérer offres_services de l'entreprise (JSONB)
    const { data: entreprise, error: entError } = await supabase
      .from("entreprises")
      .select("offres_services")
      .eq("id", pertinence.entreprise_id)
      .single();

    if (entError || !entreprise) {
      console.warn(`Failed to fetch entreprise offres for ${pertinence.entreprise_id}`);
      continue;
    }

    // Récupérer aussi les offres_services depuis table entreprise_offres
    const { data: offresByTable, error: offresError } = await supabase
      .from("entreprise_offres")
      .select("code_offre, nom_offre, type_opportunite_applicables")
      .eq("entreprise_id", pertinence.entreprise_id)
      .eq("active", true);

    if (offresError) {
      console.warn(`Failed to fetch entreprise_offres: ${offresError.message}`);
      continue;
    }

    // Matcher les offres avec type_opportunite
    const recommendedOffres = matchOffresToOpportunities(
      opp.type_opportunite || [],
      entreprise.offres_services || {},
      offresByTable || []
    );

    if (recommendedOffres.length > 0) {
      // Mettre à jour pertinence avec offres recommandées
      const { error: updateError } = await supabase
        .from("opportunite_pertinence_entreprise")
        .update({
          offres_recommandees: recommendedOffres,
        })
        .eq("id", pertinence.id);

      if (updateError) {
        console.error(
          `Failed to update pertinence ${pertinence.id}:`,
          updateError.message
        );
      } else {
        matched.push({
          pertinence_id: pertinence.id,
          offres_recommandees: recommendedOffres,
        });
      }
    }
  }

  console.log(`Matched offres for ${matched.length} opportunities`);

  return {
    matched_opportunities: matched.length,
    total_processed: opportunities.length,
    details: matched,
  };
}

// ============================================================================
// HELPER: Match offres to opportunitiy types
// ============================================================================

function matchOffresToOpportunities(
  typeOpportunite: string[],
  offresServices: Record<string, unknown>,
  offresByTable: Array<{
    code_offre: string;
    nom_offre: string;
    type_opportunite_applicables: string[];
  }>
): string[] {
  const recommendedOffres: Set<string> = new Set();

  // Chercher dans offres_services (JSONB)
  if (offresServices && typeof offresServices === "object") {
    const offres = offresServices.offres || [];
    if (Array.isArray(offres)) {
      for (const offre of offres) {
        const applicableTypes = offre.types_opportunite_applicables || [];
        const hasMatch = applicableTypes.some((t: string) =>
          typeOpportunite.some((opp) => normalizeString(opp) === normalizeString(t))
        );

        if (hasMatch) {
          recommendedOffres.add(offre.id || offre.nom);
        }
      }
    }
  }

  // Chercher dans entreprise_offres (table)
  for (const offre of offresByTable) {
    const hasMatch = offre.type_opportunite_applicables.some((t) =>
      typeOpportunite.some((opp) => normalizeString(opp) === normalizeString(t))
    );

    if (hasMatch) {
      recommendedOffres.add(offre.code_offre);
    }
  }

  return Array.from(recommendedOffres);
}

// Normaliser strings pour comparaison
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
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
    const result = await matchOffres();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Offres matching error:", error);
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
