/**
 * Feature flag MVP — inerte tant qu'il n'est pas explicitement activé par
 * variable d'environnement. Contrôle uniquement l'affichage frontend de la
 * couche "dossiers d'opportunité" (aucun composant réel n'y est encore
 * branché). `false`/absent en production tant que non validé ; `true`
 * uniquement sur staging pour test.
 *
 * Le second flag MVP, OPPORTUNITY_ENGINE_ENABLED (exécution backend du
 * moteur d'opportunités), est un flag backend uniquement — il vit dans les
 * variables d'environnement des edge functions (jamais préfixé VITE_, donc
 * jamais exposé ici) et sera consommé directement côté serveur au Sprint 1.
 * Voir docs/environments.md.
 */
export const FEATURE_OPPORTUNITIES_ENABLED =
  import.meta.env.VITE_FEATURE_OPPORTUNITIES_ENABLED === 'true'
