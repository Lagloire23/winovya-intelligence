import { FormEvent, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoFull from '../assets/logo-full.png'

export function LoginPage() {
  const { session, signIn, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  if (session) return <Navigate to="/dashboard/cockpit" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(traduireErreur(error))
    } else {
      const { error } = await requestPasswordReset(email)
      if (error) setError(traduireErreur(error))
      else setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-neutral/50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoFull} alt="WINOVYA Market Intelligence" className="h-12 w-auto mb-3" />
        </div>

        <div className="card-winovya p-6">
          {mode === 'login' ? (
            <>
              <h2 className="text-base font-heading font-bold mb-4">Connexion</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-winovya"
                    placeholder="prenom.nom@winovya.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-winovya"
                    placeholder="••••••••"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading && <Loader2 className="animate-spin" size={16} />}
                  Se connecter
                </button>
              </form>
              <button
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                }}
                className="text-sm text-brand-primary hover:underline mt-4 block mx-auto"
              >
                Mot de passe oublié ?
              </button>
            </>
          ) : (
            <>
              <h2 className="text-base font-heading font-bold mb-1">Mot de passe oublié</h2>
              <p className="text-sm text-[hsl(217,4%,46%)] mb-4">
                On t'envoie un lien pour choisir un nouveau mot de passe.
              </p>
              {resetSent ? (
                <p className="text-sm text-brand-green-deep bg-brand-green-light/10 border border-brand-green-light/30 rounded-md p-3">
                  Email envoyé si ce compte existe — vérifie ta boîte de réception (et les spams).
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-winovya"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading && <Loader2 className="animate-spin" size={16} />}
                    Envoyer le lien
                  </button>
                </form>
              )}
              <button
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setResetSent(false)
                }}
                className="text-sm text-brand-primary hover:underline mt-4 block mx-auto"
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function traduireErreur(msg: string): string {
  if (msg.toLowerCase().includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.toLowerCase().includes('email not confirmed')) return 'Email non confirmé — vérifie ta boîte de réception.'
  return msg
}
