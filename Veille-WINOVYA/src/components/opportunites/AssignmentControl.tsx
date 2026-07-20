// Sprint 7 — Contrôle d'assignation (Phase 5). Les actions
// assigner/désassigner passent exclusivement par
// createOpportuniteCommercialService() (Sprint 6, inchangé) ; ce
// composant lit aussi veille.profiles (comme AuthContext.tsx le fait déjà
// ailleurs dans l'application — un profil n'est pas un objet du domaine
// Opportunités) uniquement pour proposer une liste d'assignation à un
// administrateur. Un utilisateur non-admin ne peut pas résoudre le nom
// d'un autre utilisateur (RLS `profiles`, héritée, non modifiée ici) :
// limitation documentée (docs/frontend-mvp.md).

import { useEffect, useState } from 'react'
import { Loader2, UserMinus, UserPlus, Users2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CommercialService } from '../../lib/opportunities/commercial'
import type { AssignmentDto } from '../../lib/opportunities/commercial/types'
import { translateError } from '../../lib/opportunities/errorMessages'
import { logDevError } from '../../lib/opportunities/devLog'

interface ProfileOption {
  id: string
  fullName: string | null
  email: string | null
}

export function AssignmentControl({
  opportuniteId,
  commercialService,
  isAdmin,
  currentUserId,
  disabled,
  refreshKey,
  onChanged,
}: {
  opportuniteId: string
  commercialService: CommercialService
  isAdmin: boolean
  currentUserId: string | null
  disabled: boolean
  refreshKey: number
  onChanged: () => void
}) {
  const [assignment, setAssignment] = useState<AssignmentDto | null>(null)
  const [profiles, setProfiles] = useState<ProfileOption[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    commercialService
      .getAssignment(opportuniteId)
      .then((a) => {
        if (!cancelled) setAssignment(a)
      })
      .catch((e) => {
        logDevError({ screen: 'AssignmentControl', operation: 'getAssignment' }, e)
        if (!cancelled) setError(translateError(e, "La lecture de l'assignation a échoué."))
      })
    return () => {
      cancelled = true
    }
  }, [opportuniteId, commercialService, refreshKey])

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          logDevError({ screen: 'AssignmentControl', operation: 'listProfiles' }, error)
          setProfiles([])
          return
        }
        setProfiles((data ?? []).map((p) => ({ id: String(p.id), fullName: p.full_name as string | null, email: p.email as string | null })))
      })
  }, [isAdmin])

  async function handleAssign(profileId: string) {
    if (!profileId || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await commercialService.assign(opportuniteId, profileId)
      setAssignment(result)
      onChanged()
    } catch (e) {
      logDevError({ screen: 'AssignmentControl', operation: 'assign' }, e)
      setError(translateError(e, "L'assignation a échoué."))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnassign() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await commercialService.unassign(opportuniteId)
      setAssignment(result)
      onChanged()
    } catch (e) {
      logDevError({ screen: 'AssignmentControl', operation: 'unassign' }, e)
      setError(translateError(e, 'La désassignation a échoué.'))
    } finally {
      setBusy(false)
    }
  }

  const assignedProfile = assignment?.assignedTo ? profiles?.find((p) => p.id === assignment.assignedTo) : null
  const assignedIsSelf = assignment?.assignedTo && assignment.assignedTo === currentUserId

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(217,4%,55%)] mb-1.5">Assignation</p>
      {!assignment ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Chargement…</p>
      ) : !assignment.assignedTo ? (
        <p className="text-sm text-[hsl(217,4%,46%)]">Non assignée</p>
      ) : (
        <p className="text-sm text-brand-navy dark:text-white flex items-center gap-1.5">
          <Users2 size={14} className="text-brand-primary" />
          {assignedProfile?.fullName || assignedProfile?.email || (assignedIsSelf ? 'Vous' : 'Utilisateur assigné')}
        </p>
      )}

      {isAdmin && !disabled && (
        <div className="flex items-center gap-2 mt-2">
          <select
            value=""
            aria-label="Assigner l'opportunité à un utilisateur"
            disabled={busy || profiles === null}
            onChange={(e) => e.target.value && handleAssign(e.target.value)}
            className="input-winovya w-auto text-xs py-1.5 focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:outline-none"
          >
            <option value="" disabled>
              {profiles === null ? 'Chargement des utilisateurs…' : 'Assigner à…'}
            </option>
            {profiles?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName || p.email}
              </option>
            ))}
          </select>
          {assignment?.assignedTo && (
            <button
              onClick={handleUnassign}
              disabled={busy}
              aria-label="Désassigner l'opportunité"
              title="Désassigner"
              className="btn-secondary py-1.5 px-2.5 text-xs"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
            </button>
          )}
        </div>
      )}
      {!isAdmin && assignment?.assignedTo && !assignedIsSelf && (
        <p className="text-[11px] text-[hsl(217,4%,60%)] mt-1">Seul un administrateur peut réassigner.</p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}
