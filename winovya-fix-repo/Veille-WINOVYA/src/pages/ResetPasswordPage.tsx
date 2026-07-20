import { FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoFull from '../assets/logo-full.png'

// Reached either via the "invite" email link (new user setting their first
// password) or the "forgot password" recovery link — Supabase Auth handles
// both the same way once the recovery session is established client-side.
// When reached via an alert-assignment invite, `?next=` carries the deep
// link back to the specific alerte (e.g. /dashboard?alert=<id>) so the
// person lands directly on it instead of the generic dashboard.
export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('8 caractères minimum.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) setError(error)
    else setDone(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-neutral/50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logoFull} alt="WINOVYA Market Intelligence" className="h-12 w-auto" />
        </div>
        <div className="card-winovya p-6">
          <h2 className="text-base font-heading font-bold mb-4">Choisir un mot de passe</h2>
          {done ? (
            <div className="space-y-4">
              <p className="text-sm text-brand-green-deep bg-brand-green-light/10 border border-brand-green-light/30 rounded-md p-3">
                Mot de passe mis à jour.
              </p>
              <button className="btn-primary w-full" onClick={() => navigate(nextPath)}>
                Aller au tableau de bord
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-winovya"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Confirmer</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-winovya"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 className="animate-spin" size={16} />}
                Valider
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
