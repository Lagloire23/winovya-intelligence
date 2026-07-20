-- Sprint 6 — durcissement défensif (non fonctionnel, aucune règle
-- métier) : les fonctions de journalisation ne sont censées être
-- invoquées que par le mécanisme de trigger PostgreSQL lui-même (qui ne
-- requiert aucun privilège EXECUTE explicite de l'appelant). On retire
-- donc le privilège EXECUTE implicite accordé à PUBLIC par défaut à la
-- création de toute fonction, afin qu'elles ne soient plus listées comme
-- directement appelables via /rest/v1/rpc/... (signalé par l'advisor de
-- sécurité Supabase). Aucun changement de comportement des triggers.
revoke execute on function veille.log_opportunite_activity() from public, anon, authenticated;
revoke execute on function veille.log_opportunite_note_activity() from public, anon, authenticated;
