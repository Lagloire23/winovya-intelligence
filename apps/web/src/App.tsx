// App.tsx — Main React Component
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import OpportunityDetail from './pages/OpportunityDetail';
import Settings from './pages/Settings';
import Navigation from './components/Navigation';
import './styles/globals.css';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/opportunites/:id" element={<OpportunityDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <footer className="mt-16 border-t border-gray-200 bg-white py-8">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
            <p>WINOVYA Intelligence — Veille Commande Publique & IA | © 2026</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}
