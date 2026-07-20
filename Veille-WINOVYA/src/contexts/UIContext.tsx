import { createContext, useContext, useState, ReactNode } from 'react'

interface UIContextValue {
  subscribeOpen: boolean
  presetEntrepriseId: string | null
  openSubscribe: (entrepriseId?: string) => void
  closeSubscribe: () => void
}

const UIContext = createContext<UIContextValue | undefined>(undefined)

export function UIProvider({ children }: { children: ReactNode }) {
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [presetEntrepriseId, setPresetEntrepriseId] = useState<string | null>(null)

  function openSubscribe(entrepriseId?: string) {
    setPresetEntrepriseId(entrepriseId || null)
    setSubscribeOpen(true)
  }

  const value: UIContextValue = {
    subscribeOpen,
    presetEntrepriseId,
    openSubscribe,
    closeSubscribe: () => setSubscribeOpen(false),
  }

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI() {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used within a UIProvider')
  return ctx
}
