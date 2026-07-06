import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Room, AppSettings } from '@/store/types'

const DEFAULT_SETTINGS: AppSettings = {
  churchName: 'Igreja',
  reactivateMinutes: 5,
  dailyCode: '0000',
}

export function useChurch() {
  const queryClient = useQueryClient()
  const { churchId, isStaff } = useAuth()

  const { data: church, isLoading: loadingChurch } = useQuery({
    queryKey: ['church', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('churches')
        .select('id, name, slug')
        .eq('id', churchId!)
        .single()
      if (error) throw error
      return data
    },
  })

  // Só staff pode ler church_settings (RLS); a tia não vê o código do dia
  const { data: churchSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['church_settings', churchId],
    enabled: !!churchId && isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_settings')
        .select('daily_code, reactivate_minutes')
        .eq('church_id', churchId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('church_id', churchId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data.map((r): Room => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        ageRange: r.age_range,
      }))
    },
  })

  const settings: AppSettings = {
    churchName: church?.name ?? DEFAULT_SETTINGS.churchName,
    dailyCode: churchSettings?.daily_code ?? DEFAULT_SETTINGS.dailyCode,
    reactivateMinutes: churchSettings?.reactivate_minutes ?? DEFAULT_SETTINGS.reactivateMinutes,
  }

  async function updateSettings(updates: Partial<AppSettings>) {
    if (!churchId) throw new Error('Sessão expirada')
    if (updates.churchName !== undefined) {
      const { error } = await supabase.from('churches').update({ name: updates.churchName }).eq('id', churchId)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['church', churchId] })
    }
    const settingsUpdates: Record<string, unknown> = {}
    if (updates.dailyCode !== undefined) settingsUpdates.daily_code = updates.dailyCode
    if (updates.reactivateMinutes !== undefined) settingsUpdates.reactivate_minutes = updates.reactivateMinutes
    if (Object.keys(settingsUpdates).length > 0) {
      const { error } = await supabase.from('church_settings').update(settingsUpdates).eq('church_id', churchId)
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['church_settings', churchId] })
    }
  }

  async function generateDailyCode() {
    const code = Math.floor(1000 + Math.random() * 9000).toString()
    await updateSettings({ dailyCode: code })
    return code
  }

  async function addRoom(room: Omit<Room, 'id'>) {
    if (!churchId) throw new Error('Sessão expirada')
    const { error } = await supabase.from('rooms').insert({
      church_id: churchId,
      name: room.name,
      emoji: room.emoji,
      age_range: room.ageRange,
    })
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['rooms', churchId] })
  }

  async function removeRoom(id: string) {
    const { error } = await supabase.from('rooms').delete().eq('id', id)
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['rooms', churchId] })
  }

  async function updateRoom(id: string, updates: Partial<Room>) {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji
    if (updates.ageRange !== undefined) dbUpdates.age_range = updates.ageRange

    const { error } = await supabase.from('rooms').update(dbUpdates).eq('id', id)
    if (error) throw error
    queryClient.invalidateQueries({ queryKey: ['rooms', churchId] })
  }

  async function novoCulto() {
    if (!churchId) throw new Error('Sessão expirada')
    // Para termos Cadastro Recorrente, não podemos deletar as crianças,
    // então faremos os updates diretamente ao invés de usar a antiga RPC close_service que excluía os dados.
    const [childrenRes, callsRes] = await Promise.all([
      supabase.from('children').select('id', { count: 'exact' }).eq('church_id', churchId).neq('status', 'left'),
      supabase.from('calls').select('id', { count: 'exact' }).eq('church_id', churchId)
    ])

    await supabase.from('service_history').insert({
      church_id: churchId,
      service_date: new Date().toISOString().split('T')[0],
      service_name: 'Culto',
      children_count: childrenRes.count || 0,
      calls_count: callsRes.count || 0,
    })

    // Apaga as chamadas pendentes/antigas para limpar os relatórios do dia
    await supabase.from('calls').delete().eq('church_id', churchId)

    // Libera todas as pulseiras e reseta o status das crianças (mas MANTÉM OS CADASTROS)
    await supabase.from('bracelets').update({ status: 'available', guardian_name: null, child_id: null }).eq('church_id', churchId).eq('status', 'in-use')
    await supabase.from('children').update({ status: 'left', bracelet_number: null }).eq('church_id', churchId).neq('status', 'left')

    queryClient.invalidateQueries({ queryKey: ['children', churchId] })
    queryClient.invalidateQueries({ queryKey: ['calls', churchId] })
    queryClient.invalidateQueries({ queryKey: ['bracelets', churchId] })
  }

  return {
    settings,
    rooms,
    loading: loadingChurch || loadingSettings || loadingRooms,
    updateSettings,
    generateDailyCode,
    addRoom,
    removeRoom,
    updateRoom,
    novoCulto,
  }
}
