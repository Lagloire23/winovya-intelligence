import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

interface DashboardNavContextValue {
  bucket: string
  categorie: string
  bucketCounts: Record<string, number>
  categorieCounts: Record<string, number>
  selectBucket: (value: string) => void
  selectCategorie: (value: string) => void
  setCategorieFilter: (value: string) => void
  reset: () => void
  setCounts: (bucketCounts: Record<string, number>, categorieCounts: Record<string, number>) => void
  // Entreprise actuellement sélectionnée dans le sélecteur "Entreprise" du
  // tableau de bord ('' = pas encore chargé, '__all' = toutes). Remonté au
  // niveau du contexte (plutôt que gardé en state local de DashboardPage) pour
  // que d'autres pages -- notamment "Critères" -- sachent pour quelle
  // entreprise afficher/éditer le profil.
  activeEntrepriseId: string
  setActiveEntrepriseId: (id: string | ((prev: string) => string)) => void
}

const DashboardNavContext = createContext<DashboardNavContextValue | undefined>(undefined)

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const [bucket, setBucket] = useState('__all')
  const [categorie, setCategorie] = useState('__all')
  const [bucketCounts, setBucketCounts] = useState<Record<string, number>>({})
  const [categorieCounts, setCategorieCounts] = useState<Record<string, number>>({})
  const [activeEntrepriseId, setActiveEntrepriseId] = useState('')

  const selectBucket = useCallback((value: string) => {
    setBucket(value)
    setCategorie('__all')
  }, [])

  const selectCategorie = useCallback((value: string) => {
    setCategorie(value)
    setBucket('__all')
  }, [])

  const setCategorieFilter = useCallback((value: string) => {
    setCategorie(value)
  }, [])

  const reset = useCallback(() => {
    setBucket('__all')
    setCategorie('__all')
  }, [])

  const setCounts = useCallback((bc: Record<string, number>, cc: Record<string, number>) => {
    setBucketCounts(bc)
    setCategorieCounts(cc)
  }, [])

  const value: DashboardNavContextValue = {
    bucket,
    categorie,
    bucketCounts,
    categorieCounts,
    selectBucket,
    selectCategorie,
    setCategorieFilter,
    reset,
    setCounts,
    activeEntrepriseId,
    setActiveEntrepriseId,
  }

  return <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>
}

export function useDashboardNav() {
  const ctx = useContext(DashboardNavContext)
  if (!ctx) throw new Error('useDashboardNav must be used within a DashboardNavProvider')
  return ctx
}
