// Sprint 9 — Affichage d'un score de priorité déterministe (0-100).
// Jamais qualifié "IA" dans le libellé (Phase 4/15) : c'est un score de
// règles, explicable via les `reasons` associées (voir PriorityList.tsx).
export function ScoreBadge({ score }: { score: number }) {
  const style =
    score >= 70
      ? 'bg-brand-green-deep/10 text-brand-green-deep border-brand-green-deep/30'
      : score >= 40
        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
        : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 rounded-md border text-xs font-bold ${style}`}
      title="Score de priorité déterministe (règles : confiance, budget, signaux, récence)"
    >
      {score}
    </span>
  )
}
