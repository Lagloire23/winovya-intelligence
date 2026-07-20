import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, LogOut, ChevronDown, Users, MapPin, BellRing } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useUI } from '../contexts/UIContext'
import { SubscribeModal } from './SubscribeModal'
import { AppSidebar } from './AppSidebar'
import logoFull from '../assets/logo-full.png'

function getInitials(fullName?: string | null, email?: string | null): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('')
  }
  if (email) return email[0]?.toUpperCase() || '?'
  return '?'
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const { subscribeOpen, presetEntrepriseId, openSubscribe, closeSubscribe } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const showSidebar = location.pathname.startsWith('/dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const contactsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (contactsRef.current && !contactsRef.current.contains(e.target as Node)) setContactsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
      isActive ? 'bg-brand-neutral text-brand-primary' : 'text-[hsl(217,4%,46%)] hover:bg-brand-neutral/60'
    }`

  const initials = getInitials(profile?.full_name, profile?.email)

  return (
    <div className="min-h-screen bg-brand-neutral/40">
      <header className="bg-white border-b border-[hsl(217,6%,90%)] sticky top-0 z-20">
        <div className="flex items-stretch">
          {/* Logo zone — same width as the sidebar below, so the brand mark sits directly above it */}
          <div className="hidden lg:flex items-center w-56 shrink-0 px-4 border-r border-[hsl(217,6%,90%)]">
            <NavLink to="/dashboard/cockpit" className="flex items-center">
              <img src={logoFull} alt="WINOVYA Market Intelligence" className="h-9 w-auto" />
            </NavLink>
          </div>

          <div className="flex-1 min-w-0 px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <NavLink to="/dashboard/cockpit" className="flex items-center lg:hidden">
                <img src={logoFull} alt="WINOVYA Market Intelligence" className="h-9 w-auto" />
              </NavLink>

              <nav className="hidden md:flex items-center gap-1">
                <div className="relative" ref={contactsRef}>
                  <button
                    onClick={() => setContactsOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-[hsl(217,4%,46%)] hover:bg-brand-neutral/60 transition"
                  >
                    Contacts
                    <ChevronDown size={14} className={`transition-transform ${contactsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {contactsOpen && (
                    <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-lg shadow-xl border border-[hsl(217,6%,90%)] overflow-hidden z-30 py-1">
                      <button
                        onClick={() => {
                          setContactsOpen(false)
                          navigate('/dashboard/elus')
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[hsl(217,10%,25%)] hover:bg-brand-neutral/60 transition text-left"
                      >
                        <MapPin size={15} />
                        Trouver le maire ou élu(e) d'une commune
                      </button>
                      <button
                        onClick={() => {
                          setContactsOpen(false)
                          navigate('/dashboard/decideurs')
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[hsl(217,10%,25%)] hover:bg-brand-neutral/60 transition text-left"
                      >
                        <Users size={15} />
                        Décideurs &amp; organigrammes
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={() => openSubscribe()} className={navLinkClass({ isActive: false })}>
                  <BellRing size={16} />
                  Alertes
                </button>

                {profile?.role === 'admin' && (
                  <NavLink to="/admin" className={navLinkClass}>
                    <ShieldCheck size={16} />
                    Admin
                  </NavLink>
                )}
              </nav>
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 hover:bg-brand-neutral/60 rounded-full pr-1.5 pl-0.5 py-0.5 transition"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {initials}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-[hsl(217,4%,46%)] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-[hsl(217,6%,90%)] overflow-hidden z-30">
                  <div className="px-4 py-3 border-b border-[hsl(217,6%,90%)] flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      {profile?.full_name && (
                        <p className="text-sm font-semibold text-brand-navy truncate">{profile.full_name}</p>
                      )}
                      <p className="text-xs text-[hsl(217,4%,46%)] truncate">{profile?.email}</p>
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[hsl(217,10%,25%)] hover:bg-brand-neutral/60 transition text-left"
                    >
                      <LogOut size={15} />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* mobile nav */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-2 flex-wrap">
          <button
            onClick={() => navigate('/dashboard/decideurs')}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[hsl(217,4%,46%)] hover:bg-brand-neutral/60 transition"
          >
            <Users size={16} />
            Décideurs
          </button>
          <button
            onClick={() => navigate('/dashboard/elus')}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[hsl(217,4%,46%)] hover:bg-brand-neutral/60 transition"
          >
            <MapPin size={16} />
            Élu(e)s
          </button>
          <button
            onClick={() => openSubscribe()}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[hsl(217,4%,46%)] hover:bg-brand-neutral/60 transition"
          >
            <BellRing size={16} />
            Alertes
          </button>
          {profile?.role === 'admin' && (
            <NavLink to="/admin" className={navLinkClass}>
              <ShieldCheck size={16} />
              Admin
            </NavLink>
          )}
        </div>
      </header>
      <div className="flex">
        {showSidebar && (
          <aside className="hidden lg:block w-56 shrink-0 sticky top-[61px] h-[calc(100vh-61px)] border-r border-[hsl(217,6%,90%)] bg-white overflow-y-auto px-3 py-6">
            <AppSidebar />
          </aside>
        )}
        <main className="flex-1 min-w-0 container-custom max-w-[1440px] mx-auto px-4 md:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {subscribeOpen && <SubscribeModal presetEntrepriseId={presetEntrepriseId} onClose={closeSubscribe} />}
    </div>
  )
}
