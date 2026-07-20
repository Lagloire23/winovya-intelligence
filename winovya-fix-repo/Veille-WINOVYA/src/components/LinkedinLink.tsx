import { Linkedin } from 'lucide-react'

// Icône LinkedIn cliquable réutilisée devant chaque contact/décideur affiché
// dans l'interface (alerte, Contact décideur, popup Décideurs & organigrammes,
// résultats de recherche d'élus…). Grisée et non cliquable si aucune URL
// LinkedIn n'est disponible pour ce contact.
export function LinkedinLink({ url, size = 14 }: { url: string | null | undefined; size?: number }) {
  if (!url) return <Linkedin size={size} className="text-[hsl(217,6%,80%)] shrink-0" />
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Voir le profil LinkedIn"
      className="text-[#0A66C2] hover:opacity-70 shrink-0"
    >
      <Linkedin size={size} fill="currentColor" />
    </a>
  )
}
