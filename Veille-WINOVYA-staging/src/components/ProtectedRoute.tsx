import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute() {
  const { session, loading, needsOnboarding } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Tant que l'onboarding (profil entreprise + filtres de veille) n'est pas
  // complété, on bloque l'accès au reste de l'app -- sauf à /onboarding
  // elle-même, sous peine de boucle de redirection infinie.
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  if (!needsOnboarding && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard/cockpit" replace />
  }

  return <Outlet />
}

export function AdminRoute() {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!profile || profile.role !== 'admin') return <Navigate to="/dashboard/cockpit" replace />

  return <Outlet />
}
