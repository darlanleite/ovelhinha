import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Call } from '@/store/types'

function sendPush(payload: Record<string, unknown>) {
  // functions.invoke envia o JWT da sessão automaticamente
  supabase.functions.invoke('notify-call', { body: payload }).catch(() => {})
}

type CallRow = {
  id: string
  child_id: string
  bracelet_number: string
  room_id: string
  reason: string
  reason_icon: string
  status: 'open' | 'answered' | 'reactivated'
  answered_by: 'reception' | 'tia' | null
  created_at: string
  answered_at: string | null
}

function mapRow(row: CallRow): Call {
  return {
    id: row.id,
    childId: row.child_id,
    braceletNumber: row.bracelet_number,
    roomId: row.room_id,
    reason: row.reason,
    reasonIcon: row.reason_icon,
    status: row.status,
    answeredBy: row.answered_by,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  }
}

export function useCalls() {
  const queryClient = useQueryClient()
  const { churchId } = useAuth()

  const { data: calls = [], isLoading: loading } = useQuery({
    queryKey: ['calls', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('church_id', churchId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as CallRow[]).map(mapRow)
    },
  })

  useEffect(() => {
    if (!churchId) return
    const channel = supabase
      .channel(`calls-${churchId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `church_id=eq.${churchId}` },
        () => queryClient.invalidateQueries({ queryKey: ['calls', churchId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient, churchId])

  const openCalls = calls.filter((c) => c.status === 'open' || c.status === 'reactivated')

  async function addCall(data: {
    childId: string
    childName: string
    braceletNumber: string
    roomId: string
    reason: string
    reasonIcon: string
  }): Promise<string> {
    if (!churchId) throw new Error('Sessão expirada')
    const { data: row, error } = await supabase.from('calls').insert({
      church_id: churchId,
      child_id: data.childId,
      bracelet_number: data.braceletNumber,
      room_id: data.roomId,
      reason: data.reason,
      reason_icon: data.reasonIcon,
      status: 'open',
    }).select('id, created_at').single()
    if (error) throw error

    // Injeta a chamada no cache local imediatamente — não espera o ciclo realtime
    const newCall: Call = {
      id: row.id,
      childId: data.childId,
      braceletNumber: data.braceletNumber,
      roomId: data.roomId,
      reason: data.reason,
      reasonIcon: data.reasonIcon,
      status: 'open',
      answeredBy: null,
      createdAt: row.created_at,
      answeredAt: null,
    }
    queryClient.setQueryData(['calls', churchId], (old: Call[] = []) => [newCall, ...old])

    sendPush({
      type: 'call_created',
      child_name: data.childName,
      bracelet_number: data.braceletNumber,
      reason: data.reason,
      room_id: data.roomId,
    })

    return row.id as string
  }

  async function answerCall(callId: string, answeredBy: 'reception' | 'tia', childName?: string) {
    if (!churchId) throw new Error('Sessão expirada')
    const call = calls.find((c) => c.id === callId)
    const answeredAt = new Date().toISOString()

    const { error } = await supabase.rpc('answer_call', {
      p_call_id: callId,
      p_answered_by: answeredBy,
    })
    if (error) throw error

    // Atualiza caches locais imediatamente
    queryClient.setQueryData(['calls', churchId], (old: Call[] = []) =>
      old.map((c) => c.id === callId ? { ...c, status: 'answered' as const, answeredBy, answeredAt } : c)
    )
    if (call) {
      queryClient.setQueryData(['children', churchId], (old: { id: string }[] = []) =>
        old.map((c) => c.id === call.childId ? { ...c, status: 'present' } : c)
      )
    }
    queryClient.invalidateQueries({ queryKey: ['bracelets', churchId] })

    if (childName && call) {
      sendPush({
        type: 'call_answered',
        child_name: childName,
        bracelet_number: call.braceletNumber,
        room_id: call.roomId,
      })
    }
  }

  async function reactivateCall(callId: string) {
    const { error } = await supabase
      .from('calls')
      .update({ status: 'reactivated', answered_at: null, answered_by: null })
      .eq('id', callId)
    if (error) throw error
  }

  return { calls, openCalls, loading, addCall, answerCall, reactivateCall }
}
