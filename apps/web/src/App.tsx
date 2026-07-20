import React from 'react'
import './styles/globals.css'

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            WINOVYA Intelligence Platform
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Découvrez les opportunités avant vos concurrents
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-blue-900 mb-2">Clustering</h2>
              <p className="text-gray-700">Groupement intelligent des alertes</p>
            </div>
            <div className="bg-indigo-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-indigo-900 mb-2">Scoring</h2>
              <p className="text-gray-700">Évaluation de la pertinence</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg">
              <h2 className="text-xl font-semibold text-purple-900 mb-2">Prospection</h2>
              <p className="text-gray-700">Identification des décideurs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
