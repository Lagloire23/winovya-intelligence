import React, { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { mockOpportunities } from './data/mockOpportunities'
import './styles/globals.css'

type UserRole = 'admin' | 'user'

export default function App() {
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const userId = userRole === 'user' ? 'user-001' : undefined

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">WINOVYA Intelligence</h1>
              <p className="text-xs text-gray-500">Plateforme de veille stratégique</p>
            </div>
          </div>

          {/* Role Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setUserRole('admin')}
              className={`px-4 py-2 rounded font-semibold transition ${
                userRole === 'admin'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👨‍💼 Admin
            </button>
            <button
              onClick={() => setUserRole('user')}
              className={`px-4 py-2 rounded font-semibold transition ${
                userRole === 'user'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👤 Utilisateur
            </button>
          </div>
        </div>
      </nav>

      {/* Main Dashboard */}
      <Dashboard
        opportunities={mockOpportunities}
        userRole={userRole}
        userId={userId}
      />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold mb-4">Produit</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Dashboard</a></li>
                <li><a href="#" className="hover:text-white">Opportunités</a></li>
                <li><a href="#" className="hover:text-white">Signaux</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Ressources</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
                <li><a href="#" className="hover:text-white">Support</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Entreprise</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">À propos</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Carrières</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4">Légal</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Confidentialité</a></li>
                <li><a href="#" className="hover:text-white">Conditions</a></li>
                <li><a href="#" className="hover:text-white">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex justify-between items-center text-gray-400 text-sm">
            <p>&copy; 2026 WINOVYA. Tous droits réservés.</p>
            <p>Version MVP — GitHub Pages</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
