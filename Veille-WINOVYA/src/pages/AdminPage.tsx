import { FormEvent, useEffect, useState } from 'react'
import { Loader2, UserPlus, Users, Building2, Check, Pencil, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Entreprise, Profile, ProfileRole } from '../lib/types'

export function AdminPage() {
  const [tab, setTab] = useState<'users' | 'entreprises' | 'clustering'>('users')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-brand-navy mb-1">Administration WINOVYA</h1>
        <p className="text-sm text-[hsl(217,4%,46%)]">Comptes utilisateurs et profils entreprises clientes.</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'users' ? 'bg-brand-primary text-white' : 'bg-white border border-[hsl(217,6%,90%)] hover:bg-brand-neutral'
          }`}
        >
          <Users size={15} />
          Utilisateurs
        </button>
        <button
          onClick={() => setTab('entreprises')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'entreprises' ? 'bg-brand-primary text-white' : 'bg-white border border-[hsl(217,6%,90%)] hover:bg-brand-neutral'
          }`}
        >
          <Building2 size={15} />
          Entreprises
        </button>
        <button
          onClick={() => setTab('clustering')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            tab === 'clustering' ? 'bg-brand-primary text-white' : 'bg-white border border-[hsl(217,6%,90%)] hover:bg-brand-neutral'
          }`}
        >
          <Zap size={15} />
          Clustering
        </button>
      </div>

      {tab === 'users' ? <UsersTab /> : tab === 'entreprises' ? <EntreprisesTab /> : <ClusteringTab />}
    </div>
  )
}

function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: p }, { data: e }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('entreprises').select('*').order('name'),
    ])
    setProfiles((p as Profile[]) || [])
    setEntreprises((e as Entreprise[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-[hsl(217,4%,46%)]">{profiles.length} compte(s)</p>
        <button onClick={() => setShowInvite(true)} className="btn-primary !py-2">
          <UserPlus size={15} />
          Inviter un utilisateur
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-primary" size={24} />
        </div>
      ) : (
        <div className="card-winovya overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-brand-neutral text-left text-xs text-[hsl(217,4%,46%)] uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Nom</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Rôle</th>
                <th className="px-4 py-3 font-semibold">Entreprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(217,6%,90%)]">
              {profiles.map((p) => (
                <UserRow key={p.id} profile={p} entreprises={entreprises} onUpdated={load} />
              ))}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[hsl(217,4%,46%)]">
                    Aucun compte pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showInvite && (
        <InviteModal entreprises={entreprises} onClose={() => setShowInvite(false)} onInvited={load} />
      )}
    </div>
  )
}

function UserRow({
  profile,
  entreprises,
  onUpdated,
}: {
  profile: Profile
  entreprises: Entreprise[]
  onUpdated: () => void
}) {
  const [saving, setSaving] = useState(false)

  async function updateRole(role: ProfileRole) {
    setSaving(true)
    await supabase.from('profiles').update({ role }).eq('id', profile.id)
    setSaving(false)
    onUpdated()
  }

  async function updateEntreprise(entreprise_id: string) {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ entreprise_id: entreprise_id || null })
      .eq('id', profile.id)
    setSaving(false)
    onUpdated()
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium">{profile.full_name || '—'}</td>
      <td className="px-4 py-3 text-[hsl(217,4%,46%)]">{profile.email || '—'}</td>
      <td className="px-4 py-3">
        <select
          value={profile.role}
          disabled={saving}
          onChange={(e) => updateRole(e.target.value as ProfileRole)}
          className="input-winovya !py-1 !text-xs w-auto"
        >
          <option value="member">member</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={profile.entreprise_id || ''}
          disabled={saving}
          onChange={(e) => updateEntreprise(e.target.value)}
          className="input-winovya !py-1 !text-xs w-auto"
        >
          <option value="">—</option>
          {entreprises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}

function InviteModal({
  entreprises,
  onClose,
  onInvited,
}: {
  entreprises: Entreprise[]
  onClose: () => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<ProfileRole>('member')
  const [entrepriseId, setEntrepriseId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.functions.invoke('admin-invite-user', {
      body: { email, full_name: fullName || null, role, entreprise_id: entrepriseId || null },
    })
    setLoading(false)
    if (error || (data as any)?.error) {
      setError((data as any)?.error || error?.message || 'Erreur inconnue')
      return
    }
    setSuccess(true)
    onInvited()
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-heading font-bold mb-4">Inviter un utilisateur</h2>
        {success ? (
          <div className="space-y-4">
            <p className="text-sm text-brand-green-deep bg-brand-green-light/10 border border-brand-green-light/30 rounded-md p-3">
              Invitation envoyée à {email}. La personne recevra un email pour choisir son mot de passe.
            </p>
            <button className="btn-primary w-full" onClick={onClose}>
              <Check size={16} />
              Terminé
            </button>
          </div>
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
            <div>
              <label className="block text-sm font-medium mb-1">Nom complet</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-winovya" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Rôle</label>
                <select value={role} onChange={(e) => setRole(e.target.value as ProfileRole)} className="input-winovya">
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Entreprise</label>
                <select value={entrepriseId} onChange={(e) => setEntrepriseId(e.target.value)} className="input-winovya">
                  <option value="">—</option>
                  {entreprises.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Annuler
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading && <Loader2 className="animate-spin" size={16} />}
                Envoyer l'invitation
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function EntreprisesTab() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('entreprises').select('*').order('name')
    setEntreprises((data as Entreprise[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-brand-primary" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {entreprises.map((ent) =>
        editingId === ent.id ? (
          <EntrepriseEditCard
            key={ent.id}
            entreprise={ent}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null)
              load()
            }}
          />
        ) : (
          <div key={ent.id} className="card-winovya p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-heading font-bold text-sm mb-1">{ent.name}</h3>
                <p className="text-xs text-[hsl(217,4%,46%)]">
                  {ent.secteur_clients || 'Secteur non renseigné'} · {ent.status}
                </p>
              </div>
              <button onClick={() => setEditingId(ent.id)} className="btn-secondary !px-3 !py-1.5 !text-xs">
                <Pencil size={13} />
                Modifier
              </button>
            </div>
            {ent.competences && <p className="text-sm mt-2 text-[hsl(240,10%,20%)]">{ent.competences}</p>}
          </div>
        )
      )}
    </div>
  )
}

function EntrepriseEditCard({
  entreprise,
  onCancel,
  onSaved,
}: {
  entreprise: Entreprise
  onCancel: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ ...entreprise })
  const [saving, setSaving] = useState(false)

  function field<K extends keyof Entreprise>(key: K, label: string, textarea = false) {
    const Comp = textarea ? 'textarea' : 'input'
    return (
      <div>
        <label className="block text-xs font-medium mb-1 text-[hsl(217,4%,46%)]">{label}</label>
        <Comp
          value={(form[key] as string) || ''}
          onChange={(e: any) => setForm({ ...form, [key]: e.target.value })}
          className="input-winovya"
          rows={textarea ? 3 : undefined}
        />
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    await supabase
      .from('entreprises')
      .update({
        name: form.name,
        competences: form.competences,
        references_clients: form.references_clients,
        secteurs_intervention: form.secteurs_intervention,
        zone_geographique: form.zone_geographique,
        mots_cles_metiers: form.mots_cles_metiers,
        effectif_taille: form.effectif_taille,
        secteur_clients: form.secteur_clients,
        status: form.status,
        site_web: form.site_web,
        description_courte: form.description_courte,
      })
      .eq('id', entreprise.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="card-winovya p-4 border-brand-primary/40">
      <div className="grid grid-cols-2 gap-3 mb-3">
        {field('name', 'Nom')}
        <div>
          <label className="block text-xs font-medium mb-1 text-[hsl(217,4%,46%)]">Secteur clients</label>
          <select
            value={form.secteur_clients || ''}
            onChange={(e) => setForm({ ...form, secteur_clients: e.target.value as any })}
            className="input-winovya"
          >
            <option value="">—</option>
            <option value="Majoritairement privé">Majoritairement privé</option>
            <option value="Majoritairement public">Majoritairement public</option>
            <option value="Mixte (public et privé)">Mixte (public et privé)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 mb-3">
        {field('competences', 'Compétences', true)}
        {field('references_clients', 'Références clients', true)}
        {field('secteurs_intervention', "Secteurs d'intervention")}
        {field('mots_cles_metiers', 'Mots-clés métiers')}
        {field('zone_geographique', 'Zone géographique')}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary">
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving && <Loader2 className="animate-spin" size={16} />}
          Enregistrer
        </button>
      </div>
    </div>
  )
}

function ClusteringTab() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function runClustering() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/run-clustering', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors du clustering')
        return
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-winovya p-6">
        <h2 className="text-lg font-heading font-bold mb-2">Pipeline de Clustering</h2>
        <p className="text-sm text-[hsl(217,4%,46%)] mb-4">
          Déclenche le clustering intelligent de tous les alertes pour créer des opportunités
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 rounded text-sm text-green-800 space-y-1">
            <p className="font-medium">✓ Clustering réussi</p>
            <p>Alertes traitées: {result.data?.total_alerts_processed}</p>
            <p>Patterns utilisés: {result.data?.total_patterns}</p>
            <p>Entreprises: {result.data?.enterprises_processed}</p>
          </div>
        )}

        <button
          onClick={runClustering}
          disabled={loading}
          className="btn-primary"
        >
          {loading && <Loader2 className="animate-spin" size={16} />}
          {loading ? 'Clustering en cours...' : 'Lancer le clustering'}
        </button>
      </div>
    </div>
  )
}
