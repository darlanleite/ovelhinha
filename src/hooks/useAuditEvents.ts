import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Json } from '@/lib/database.types'

export interface AuditEvent {
  id: number
  actorRole: string
  eventType: string
  childId: string | null
  details: Record<string, Json | undefined>
  createdAt: string
}

/** Rótulos amigáveis por tipo de evento */
export const AUDIT_LABELS: Record<string, { icon: string; label: string }> = {
  check_in: { icon: '✅', label: 'Check-in' },
  check_out: { icon: '🚪', label: 'Saída registrada' },
  check_out_denied: { icon: '🚫', label: 'Saída NEGADA (pulseira errada)' },
  call_created: { icon: '🔔', label: 'Pai chamado' },
  call_answered: { icon: '👋', label: 'Pai chegou' },
  call_reactivated: { icon: '🔁', label: 'Chamada reacionada' },
  novo_culto: { icon: '🗂️', label: 'Novo culto iniciado' },
  consent_given: { icon: '📝', label: 'Consentimento LGPD registrado' },
  child_deleted: { icon: '🗑️', label: 'Cadastro removido' },
}

export function useAuditEvents(limit = 100) {
  const { churchId, isStaff } = useAuth()

  const { data: events = [], isLoading: loading } = useQuery({
    queryKey: ['audit_events', churchId, limit],
    enabled: !!churchId && isStaff,
    refetchInterval: 30_000,
    queryFn: async (): Promise<AuditEvent[]> => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('id, actor_role, event_type, child_id, details, created_at')
        .eq('church_id', churchId!)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        actorRole: r.actor_role,
        eventType: r.event_type,
        childId: r.child_id,
        details: (r.details ?? {}) as Record<string, Json | undefined>,
        createdAt: r.created_at,
      }))
    },
  })

  return { events, loading }
}
