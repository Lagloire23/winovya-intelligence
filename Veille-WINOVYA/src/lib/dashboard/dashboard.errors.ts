// Sprint 9 — Gestion d'erreur du cockpit. Ne réimplémente rien : le
// module Opportunités (Sprint 8) a déjà construit un traducteur d'erreur
// générique (jamais de message Postgres/RLS brut affiché, voir
// src/lib/opportunities/errorMessages.ts). Ce fichier est un adaptateur
// fin qui réexporte ces fonctions pour le module dashboard, afin que
// dashboard.repository.ts / composants n'aient jamais besoin d'importer
// depuis ../opportunities directement (frontière de module propre).
//
// Import direct du fichier concret (pas du barrel ../opportunities/index)
// pour éviter d'entraîner transitivement des imports Supabase réels dans
// les scripts de test Node (voir scripts/sprint8-mvp-tests.ts et la même
// règle déjà appliquée dans errorMessages.ts lui-même).
export { translateError, isSessionExpiredError, GENERIC_ERROR_MESSAGE } from '../opportunities/errorMessages'
