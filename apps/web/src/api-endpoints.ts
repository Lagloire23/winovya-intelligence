// ============================================================================
// API REST Endpoints — WINOVYA Intelligence Platform
// ============================================================================
// Utilisé par le frontend React pour charger/filtrer opportunités
// Déployé via Netlify Functions ou directement depuis Supabase
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ============================================================================
// HANDLER: GET /api/opportunites — Dashboard list
// ============================================================================

export async function getOpportunities(req: Request) {
  const url = new URL(req.url);

  // Query params: ?scoring=Très haute&pattern=A&statut=NOUVEAU&limit=50&offset=0
  const scoring = url.searchParams.get("scoring");
  const pattern = url.searchParams.get("pattern");
  const statut = url.searchParams.get("statut");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    let query = supabase
      .from("opportunites")
      .select(
        `
        id,
        nom,
        acteur_entite,
        pattern_type,
        scoring_global,
        phase_detectee,
        nb_alertes,
        date_derniere_alerte,
        statut
        `
      )
      .order("date_derniere_alerte", { ascending: false });

    // Apply filters
    if (scoring) {
      query = query.eq("scoring_global", scoring);
    }
    if (pattern) {
      query = query.eq("pattern_type", pattern);
    }
    if (statut) {
      query = query.eq("statut", statut);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        data,
        pagination: { offset, limit, total: count || 0 },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
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
}

// ============================================================================
// HANDLER: GET /api/opportunites/:id — Détail + chronologie
// ============================================================================

export async function getOpportunityDetail(req: Request, id: string) {
  try {
    // Récupérer opportunité
    const { data: opportunity, error: oppError } = await supabase
      .from("opportunites")
      .select("*")
      .eq("id", id)
      .single();

    if (oppError) {
      return new Response(
        JSON.stringify({ error: "Opportunity not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Récupérer les alertes liées
    const { data: alerts, error: alertError } = await supabase
      .from("alertes")
      .select(
        `
        id,
        name,
        resume,
        date_publication,
        categorie_veille,
        acteur_entite,
        contact_decideur_nom
        `
      )
      .in("id", opportunity.alerte_ids || [])
      .order("date_publication", { ascending: false });

    if (alertError) {
      console.error("Error fetching alerts:", alertError);
    }

    // Récupérer phases détectées
    const { data: phases, error: phaseError } = await supabase
      .from("phases_projet")
      .select("*")
      .eq("opportunite_id", id)
      .order("detected_date", { ascending: true });

    if (phaseError) {
      console.error("Error fetching phases:", phaseError);
    }

    // Récupérer pertinence par entreprise
    const { data: pertinences, error: pertError } = await supabase
      .from("opportunite_pertinence_entreprise")
      .select(
        `
        id,
        entreprise_id,
        score_global,
        lien_business,
        offres_recommandees,
        donneur_ordre_deja_client,
        entreprises (name)
        `
      )
      .eq("opportunite_id", id);

    if (pertError) {
      console.error("Error fetching pertinences:", pertError);
    }

    return new Response(
      JSON.stringify({
        opportunity,
        alerts: alerts || [],
        phases: phases || [],
        pertinences: pertinences || [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
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
}

// ============================================================================
// HANDLER: GET /api/phases/:opportunite_id — Timeline phases
// ============================================================================

export async function getPhasesTimeline(req: Request, opportuniteId: string) {
  try {
    const { data: phases, error } = await supabase
      .from("phases_projet")
      .select("*, alertes (name, date_publication)")
      .eq("opportunite_id", opportuniteId)
      .order("detected_date", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(phases), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
}

// ============================================================================
// HANDLER: POST /api/opportunites/:id/assign — Assigner à équipe
// ============================================================================

export async function assignOpportunity(req: Request, id: string) {
  try {
    const body = await req.json();
    const { statut, notes } = body;

    const { error } = await supabase
      .from("opportunites")
      .update({
        statut,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, opportunity_id: id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
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
}

// ============================================================================
// HANDLER: GET /api/entreprises/:id/offres — Offres d'une entreprise
// ============================================================================

export async function getEntrepriseOffres(req: Request, entrepriseId: string) {
  try {
    const { data: offres, error } = await supabase
      .from("entreprise_offres")
      .select("*")
      .eq("entreprise_id", entrepriseId)
      .eq("active", true);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(offres), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
}

// ============================================================================
// HANDLER: POST /api/cluster — Déclencher clustering manuel
// ============================================================================

export async function triggerClustering(req: Request) {
  try {
    // Appeler l'Edge Function cluster-alerts
    const response = await fetch(
      `${supabaseUrl}/functions/v1/cluster-alerts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Clustering failed: ${response.statusText}`);
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
}

// ============================================================================
// HANDLER: POST /api/score — Déclencher phase detection + scoring
// ============================================================================

export async function triggerScoring(req: Request) {
  try {
    // Appeler l'Edge Function detect-phases-and-score
    const response = await fetch(
      `${supabaseUrl}/functions/v1/detect-phases-and-score`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Scoring failed: ${response.statusText}`);
    }

    const result = await response.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
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
}

// ============================================================================
// ROUTER
// ============================================================================

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/opportunites/")) {
    const id = pathname.replace("/api/opportunites/", "").split("/")[0];

    if (pathname.includes("/assign")) {
      return await assignOpportunity(req, id);
    } else if (pathname.includes("/phases")) {
      return await getPhasesTimeline(req, id);
    } else {
      return await getOpportunityDetail(req, id);
    }
  } else if (pathname === "/api/opportunites" && req.method === "GET") {
    return await getOpportunities(req);
  } else if (pathname.startsWith("/api/entreprises/") && pathname.includes("/offres")) {
    const id = pathname.replace("/api/entreprises/", "").split("/")[0];
    return await getEntrepriseOffres(req, id);
  } else if (pathname === "/api/cluster" && req.method === "POST") {
    return await triggerClustering(req);
  } else if (pathname === "/api/score" && req.method === "POST") {
    return await triggerScoring(req);
  } else {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ============================================================================
// EXPORT for Netlify Functions
// ============================================================================

Deno.serve(handleRequest);
