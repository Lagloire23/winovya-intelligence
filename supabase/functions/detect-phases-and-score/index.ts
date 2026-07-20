// ============================================================================
// Supabase Edge Function: detect-phases-and-score
// ============================================================================
// Purpose:
//   1. Analyser résumé/notes d'une alerte → détecter la phase du projet
//   2. Calculer le scoring d'opportunité (Très haute/Haute/Moyenne/Basse)
//   3. Mettre à jour phases_projet et scoring_global dans opportunites
// Déclenché: après clustering OU lors de chaque nouvelle alerte pertinente
// Returns: {opportunities_scored, phases_detected}
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ============================================================================
// PHASE DETECTION PATTERNS (Indicateurs clés par phase)
// ============================================================================

const phasePatterns: Record<string, { keywords: string[]; confidence_boost: number }> = {
  // Signaux macro/politiques
  "Signaux macro/politiques": {
    keywords: [
      "loi programmation",
      "budget gouvernement",
      "stratégie publique",
      "augmentation commandes",
      "investissement état",
      "relocalisation",
    ],
    confidence_boost: 30,
  },

  // Intentions stratégiques
  "Intentions stratégiques": {
    keywords: [
      "roadmap",
      "prévoit expansion",
      "augmentation capacités",
      "investissement stratégique",
      "nouvelles usines",
      "croissance",
      "développement",
    ],
    confidence_boost: 25,
  },

  // Acquisitions foncières
  "Acquisitions foncières": {
    keywords: [
      "terrain acquis",
      "mutation foncière",
      "DVF",
      "délibération achat",
      "site historique retenu",
      "acquisition terrain",
    ],
    confidence_boost: 35,
  },

  // Études/autorisations
  "Études/autorisations pré-démarrage": {
    keywords: [
      "demande d'autorisation",
      "études d'impact",
      "consultation publique",
      "permis en cours",
      "dossier ICPE",
      "arrêté demandé",
      "enquête publique",
    ],
    confidence_boost: 40,
  },

  // Recrutements clés
  "Recrutements clés": {
    keywords: [
      "directeur site",
      "recrutements massifs",
      "offre d'emploi",
      "responsable production",
      "centre de recrutement",
    ],
    confidence_boost: 20,
  },

  // Appels d'offres
  "Appels d'offres publics": {
    keywords: ["appel d'offres", "BOAMP", "marché public", "consultation fournisseurs", "RFQ"],
    confidence_boost: 15,
  },

  // Annonce officielle
  "Annonce officielle": {
    keywords: [
      "inauguration",
      "mise en service",
      "démarrage production",
      "annonce officielle",
      "inauguré",
      "premier ministre",
    ],
    confidence_boost: 5,
  },

  // Besoin politique
  "Besoin politique identifié": {
    keywords: ["délibération", "politique achat", "stratégie collectivité", "mandat électoral"],
    confidence_boost: 25,
  },

  // Budget voté
  "Budget voté/budgétisé": {
    keywords: ["budget voté", "enveloppe investissement", "budget 2026", "programme d'achat"],
    confidence_boost: 30,
  },

  // Changement ICPE
  "Changement signalé ICPE": {
    keywords: [
      "modification plan",
      "nouveau classement Seveso",
      "changement exploitant",
      "nouvelle activité ICPE",
    ],
    confidence_boost: 35,
  },

  // Audit/Étude lancée
  "Audit/Étude lancée": {
    keywords: [
      "audit lancé",
      "diagnostic énergétique",
      "consultant retenu",
      "étude de faisabilité",
      "bureau d'études",
    ],
    confidence_boost: 30,
  },

  // Modernisation annoncée
  "Modernisation annoncée": {
    keywords: [
      "investissement modernisation",
      "nouvel équipement",
      "upgrade ligne",
      "modernisation installation",
    ],
    confidence_boost: 25,
  },
};

// ============================================================================
// DETECTER PHASE
// ============================================================================

function detectPhase(resumé: string, notes: string): {
  phase: string;
  confidence: number;
} {
  const text = (resumé + " " + (notes || "")).toLowerCase();

  let bestPhase = "À évaluer";
  let bestConfidence = 0;

  for (const [phase, pattern] of Object.entries(phasePatterns)) {
    let confidence = 0;

    for (const keyword of pattern.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        confidence += pattern.confidence_boost;
      }
    }

    // Normaliser confiance entre 0-100
    confidence = Math.min(100, confidence);

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestPhase = phase;
    }
  }

  // Si confiance très faible, laisser "À évaluer"
  if (bestConfidence < 10) {
    return { phase: "À évaluer", confidence: 0 };
  }

  return { phase: bestPhase, confidence: bestConfidence };
}

// ============================================================================
// CALCULER SCORING OPPORTUNITÉ
// ============================================================================

function calculateOpportunityScore(
  phaseType: string,
  nbAlerts: number,
  daysSpan: number,
  hasRecents: boolean
): string {
  // Phases très précoces (beaucoup de temps avant appel d'offres)
  const earlyPhases = [
    "Signaux macro/politiques",
    "Intentions stratégiques",
    "Besoin politique identifié",
    "Budget voté/budgétisé",
  ];

  // Phases trop tardives (pas d'intérêt pour prospecter)
  const latePhases = ["Appels d'offres publics", "Annonce officielle"];

  // Phases intermédiaires (actionables)
  const midPhases = [
    "Acquisitions foncières",
    "Études/autorisations pré-démarrage",
    "Recrutements clés",
    "Changement signalé ICPE",
    "Audit/Étude lancée",
    "Modernisation annoncée",
  ];

  // Critères
  let score = "À confirmer"; // défaut

  // Si trop tard, toujours basse
  if (latePhases.includes(phaseType)) {
    return "Basse"; // Pas d'intérêt pour prospecter
  }

  // Logique scoring
  if (earlyPhases.includes(phaseType)) {
    // Très tôt = Très haute (si plusieurs signaux)
    if (nbAlerts >= 2) {
      score = "Très haute";
    } else {
      score = "Haute";
    }
  } else if (midPhases.includes(phaseType)) {
    // Intermédiaire = Haute/Moyenne
    if (nbAlerts >= 3 && daysSpan > 60) {
      score = "Très haute"; // Progression observable
    } else if (nbAlerts >= 2) {
      score = "Haute";
    } else {
      score = "Moyenne";
    }
  } else if (phaseType === "Recrutements clés" && nbAlerts >= 2) {
    // Recrutements = confirmation, donc Haute
    score = "Haute";
  }

  // Si signaux récents (< 30 jours), booster un cran
  if (hasRecents && score !== "Très haute") {
    if (score === "Haute") score = "Très haute";
    else if (score === "Moyenne") score = "Haute";
  }

  return score;
}

// ============================================================================
// MAIN: Traiter opportunités
// ============================================================================

async function detectPhasesAndScore() {
  console.log("Starting phase detection and scoring...");

  // Étape 1: Récupérer opportunités sans scoring
  const { data: opportunities, error: oppError } = await supabase
    .from("opportunites")
    .select("*")
    .eq("scoring_global", "À confirmer"); // Non encore scorées

  if (oppError || !opportunities) {
    throw new Error(`Failed to fetch opportunities: ${oppError?.message}`);
  }

  console.log(`Loaded ${opportunities.length} opportunities to score`);

  const scored = [];
  const phaseDetected = [];

  // Étape 2: Pour chaque opportunité
  for (const opp of opportunities) {
    // Récupérer les alertes liées
    const { data: alerts, error: alertsError } = await supabase
      .from("alertes")
      .select("resume, notes, date_publication")
      .in("id", opp.alerte_ids || []);

    if (alertsError || !alerts) {
      console.error(`Failed to fetch alerts for opportunity ${opp.id}:`, alertsError?.message);
      continue;
    }

    // Détecter phase (en prenant le plus récent)
    if (alerts.length === 0) continue;

    const latestAlert = alerts[0]; // Déjà triées par date_publication DESC
    const { phase, confidence } = detectPhase(latestAlert.resume || "", latestAlert.notes || "");

    // Calculer jours entre première et dernière alerte
    const dates = alerts.map((a) => new Date(a.date_publication || new Date()).getTime());
    const daysSpan = Math.floor((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24));

    // Vérifier s'il y a des signaux récents (< 30 jours)
    const hasRecents = alerts.some((a) => {
      const alertDate = new Date(a.date_publication || new Date());
      const daysSince = (Date.now() - alertDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince < 30;
    });

    // Calculer score
    const scoringGlobal = calculateOpportunityScore(phase, alerts.length, daysSpan, hasRecents);

    // Créer entrée phase_projet
    const { error: phaseError } = await supabase.from("phases_projet").insert({
      opportunite_id: opp.id,
      phase_type: phase,
      phase_niveau_maturity: mapPhaseToMaturity(phase),
      alerte_id: alerts[0].id, // FK vers l'alerte qui a révélé la phase
      detected_date: new Date(latestAlert.date_publication || new Date()).toISOString().split("T")[0],
      confidence,
    });

    if (phaseError) {
      console.error(`Failed to create phase for opportunity ${opp.id}:`, phaseError.message);
    } else {
      phaseDetected.push({
        opportunity_id: opp.id,
        phase,
        confidence,
      });
    }

    // Mettre à jour scoring_global dans opportunites
    const { error: updateError } = await supabase
      .from("opportunites")
      .update({
        scoring_global: scoringGlobal,
        phase_detectee: phase,
        justification_scoring: `Phase détectée: ${phase} (confiance: ${confidence}%). ${alerts.length} alertes, ${daysSpan} jours d'écart.`,
      })
      .eq("id", opp.id);

    if (updateError) {
      console.error(`Failed to update opportunity ${opp.id}:`, updateError.message);
    } else {
      scored.push({
        opportunity_id: opp.id,
        scoring_global: scoringGlobal,
        phase,
      });
    }
  }

  console.log(`Phase detection complete. Scored ${scored.length} opportunities`);

  return {
    opportunities_scored: scored.length,
    phases_detected: phaseDetected.length,
    details: { scored, phaseDetected },
  };
}

// ============================================================================
// HELPER: Map phase string to maturity level (1-7)
// ============================================================================

function mapPhaseToMaturity(phase: string): number {
  const phaseMaturity: Record<string, number> = {
    "Signaux macro/politiques": 1,
    "Intentions stratégiques": 1,
    "Besoin politique identifié": 1,
    "Budget voté/budgétisé": 2,
    "Acquisitions foncières": 2,
    "Consultation fournisseurs": 3,
    "Études/autorisations pré-démarrage": 3,
    "Recrutements clés": 4,
    "Audit/Étude lancée": 3,
    "Modernisation annoncée": 2,
    "Appels d'offres publics": 5,
    "Annonce officielle": 6,
    "À évaluer": 0,
  };

  return phaseMaturity[phase] || 0;
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
    const result = await detectPhasesAndScore();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Phase detection error:", error);
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
