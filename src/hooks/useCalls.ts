import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase, CHURCH_ID } from '@/lib/supabase'
import type { Call } from '@/store/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

function sendPush(payload: Record<string, unknown>) {
  fetch(`${SUPABASE_URL}/functions/v1/notify-call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify(payload),
  }).catch(() => {})
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

  const { data: calls = [], isLoading: loading } = useQuery({
    queryKey: ['calls', CHURCH_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('church_id', CHURCH_ID)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as CallRow[]).map(mapRow)
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel(`calls-${CHURCH_ID}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `church_id=eq.${CHURCH_ID}` },
        () => queryClient.invalidateQueries({ queryKey: ['calls', CHURCH_ID] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  const openCalls = calls.filter((c) => c.status === 'open' || c.status === 'reactivated')

  async function addCall(data: {
    childId: string
    childName: string
    braceletNumber: string
    roomId: string
    reason: string
    reasonIcon: string
  }): Promise<string> {
    const { data: row, error } = await supabase.from('calls').insert({
      church_id: CHURCH_ID,
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
    queryClient.setQueryData(['calls', CHURCH_ID], (old: Call[] = []) => [newCall, ...old])

    sendPush({
      church_id: CHURCH_ID,
      type: 'call_created',
      child_name: data.childName,
      bracelet_number: data.braceletNumber,
      reason: data.reason,
      room_id: data.roomId,
    })

    return row.id as string
  }

  async function answerCall(callId: string, answeredBy: 'reception' | 'tia', childName?: string) {
    const call = calls.find((c) => c.id === callId)
    const answeredAt = new Date().toISOString()

    const { error } = await supabase.rpc('answer_call', {
      p_call_id: callId,
      p_answered_by: answeredBy,
    })
    if (error) {
      // Fallback se a função RPC não existir: faz os 3 updates manualmente
      await supabase.from('calls').update({ status: 'answered', answered_at: answeredAt, answered_by: answeredBy }).eq('id', callId)
      if (call) {
        await supabase.from('children').update({ status: 'present' }).eq('id', call.childId)
        await supabase.from('bracelets').update({ status: 'available', guardian_name: null, child_id: null }).eq('church_id', CHURCH_ID).eq('number', call.braceletNumber)
      }
    }

    // Atualiza caches locais imediatamente
    queryClient.setQueryData(['calls', CHURCH_ID], (old: Call[] = []) =>
      old.map((c) => c.id === callId ? { ...c, status: 'answered' as const, answeredBy, answeredAt } : c)
    )
    if (call) {
      queryClient.setQueryData(['children', CHURCH_ID], (old: Call[] = []) =>
        old.map((c: any) => c.id === call.childId ? { ...c, status: 'present' } : c)
      )
    }
    queryClient.invalidateQueries({ queryKey: ['bracelets', CHURCH_ID] })

    if (childName && call) {
      sendPush({
        church_id: CHURCH_ID,
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
