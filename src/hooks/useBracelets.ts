import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Bracelet } from '@/store/types'

export type BraceletRow = {
  id: string
  number: string
  esp_id: string | null
  status: 'available' | 'in-use' | 'charging' | 'offline' | 'missing'
  battery: number
  guardian_name: string | null
  child_id: string | null
  last_seen_at: string | null
}

export function deriveConnectivity(row: Pick<BraceletRow, 'status' | 'last_seen_at'>): 'online' | 'warning' | 'unreachable' {
  if (row.status !== 'in-use') return 'online'
  if (!row.last_seen_at) return 'unreachable'
  const secs = Math.floor((Date.now() - new Date(row.last_seen_at).getTime()) / 1000)
  if (secs > 90) return 'unreachable'
  if (secs > 30) return 'warning'
  return 'online'
}

function mapRow(row: BraceletRow): Bracelet {
  return {
    id: row.id,
    number: row.number,
    espId: row.esp_id,
    status: row.status,
    battery: row.battery,
    guardianName: row.guardian_name,
    childId: row.child_id,
    lastHeartbeat: row.last_seen_at,
    connectivityStatus: deriveConnectivity(row),
    lastGatewayId: null,
  }
}

export function useBracelets() {
  const queryClient = useQueryClient()
  const { churchId } = useAuth()

  const { data: bracelets = [], isLoading: loading } = useQuery({
    queryKey: ['bracelets', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bracelets')
        .select('*')
        .eq('church_id', churchId!)
        .order('number', { ascending: true })
      if (error) throw error
      return (data as BraceletRow[]).map(mapRow)
    },
  })

  useEffect(() => {
    if (!churchId) return
    const channel = supabase
      // randomUUID: Date.now() colidia quando 2 componentes montavam no mesmo ms
      .channel(`bracelets-${churchId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bracelets', filter: `church_id=eq.${churchId}` },
        () => queryClient.invalidateQueries({ queryKey: ['bracelets', churchId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient, churchId])

  const stats = {
    available: bracelets.filter((b) => b.status === 'available').length,
    inUse: bracelets.filter((b) => b.status === 'in-use').length,
    charging: bracelets.filter((b) => b.status === 'charging').length,
    offline: bracelets.filter((b) => b.status === 'offline').length,
    missing: bracelets.filter((b) => b.status === 'missing').length,
    lowBattery: bracelets.filter((b) => b.battery < 20).length,
  }

  async function updateBracelet(id: string, updates: Partial<Bracelet>) {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.espId !== undefined) dbUpdates.esp_id = updates.espId
    if (updates.battery !== undefined) dbUpdates.battery = updates.battery
    if (updates.guardianName !== undefined) dbUpdates.guardian_name = updates.guardianName
    if (updates.childId !== undefined) dbUpdates.child_id = updates.childId
    if (updates.lastHeartbeat !== undefined) dbUpdates.last_seen_at = updates.lastHeartbeat

    const { error } = await supabase.from('bracelets').update(dbUpdates).eq('id', id)
    if (error) throw error
  }

  async function addBracelet(bracelet: Omit<Bracelet, 'id'>) {
    if (!churchId) throw new Error('Sessão expirada')
    const { error } = await supabase.from('bracelets').insert({
      church_id: churchId,
      number: bracelet.number,
      esp_id: bracelet.espId || null,
      status: bracelet.status,
      battery: bracelet.battery,
      guardian_name: bracelet.guardianName || null,
      child_id: bracelet.childId || null,
    })
    if (error) throw error
  }

  return { bracelets, stats, loading, updateBracelet, addBracelet }
}
