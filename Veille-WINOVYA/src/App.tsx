import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { UIProvider } from './contexts/UIContext'
import { DashboardNavProvider } from './contexts/DashboardNavContext'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { CockpitPage } from './pages/CockpitPage'
import { AdminPage } from './pages/AdminPage'
import { DecideursPage } from './pages/DecideursPage'
import { ElusPage } from './pages/ElusPage'
import { CriteresOpportunitesPage } from './pages/CriteresOpportunitesPage'
import { OpportunitesPage } from './pages/OpportunitesPage'
import { OpportuniteDetailPage } from './pages/OpportuniteDetailPage'
import { EnvironmentBanner } from './components/EnvironmentBanner'

export default function App() {
  return (
    <BrowserRouter>
      <EnvironmentBanner />
      <AuthProvider>
        <UIProvider>
        <DashboardNavProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/cockpit" element={<CockpitPage />} />
              <Route path="/dashboard/decideurs" element={<DecideursPage />} />
              <Route path="/dashboard/elus" element={<ElusPage />} />
              <Route path="/dashboard/criteres-opportunites" element={<CriteresOpportunitesPage />} />
              <Route path="/dashboard/opportunites" element={<OpportunitesPage />} />
              <Route path="/dashboard/opportunites/:id" element={<OpportuniteDetailPage />} />
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard/cockpit" replace />} />
        </Routes>
        </DashboardNavProvider>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
