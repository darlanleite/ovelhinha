import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase, CHURCH_ID } from '@/lib/supabase'
import type { Child, Guardian } from '@/store/types'

type ChildRow = {
  id: string
  name: string
  birth_date: string
  room_id: string
  medical_notes: string | null
  bracelet_number: string | null
  authorized_pickup: string | null
  status: 'present' | 'called' | 'left'
  checked_in_at: string
  guardians: { id: string; name: string; phone: string; is_primary: boolean }[]
}

function mapRow(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    roomId: row.room_id,
    medicalNotes: row.medical_notes || '',
    braceletNumber: row.bracelet_number,
    authorizedPickup: row.authorized_pickup,
    status: row.status,
    checkedInAt: row.checked_in_at,
    guardians: (row.guardians || []).map((g) => ({ id: g.id, name: g.name, phone: g.phone })),
  }
}

export function useChildren() {
  const queryClient = useQueryClient()

  const { data: children = [], isLoading: loading } = useQuery({
    queryKey: ['children', CHURCH_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('children')
        .select('*, guardians(*)')
        .eq('church_id', CHURCH_ID)
        .order('checked_in_at', { ascending: true })
      if (error) throw error
      return (data as ChildRow[]).map(mapRow)
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel(`children-${CHURCH_ID}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children', filter: `church_id=eq.${CHURCH_ID}` },
        () => queryClient.invalidateQueries({ queryKey: ['children', CHURCH_ID] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guardians' },
        () => queryClient.invalidateQueries({ queryKey: ['children', CHURCH_ID] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  async function addChild(
    child: Omit<Child, 'id' | 'guardians' | 'status' | 'checkedInAt'>,
    guardians: Omit<Guardian, 'id'>[]
  ) {
    const { data, error } = await supabase
      .from('children')
      .insert({
        church_id: CHURCH_ID,
        name: child.name,
        birth_date: child.birthDate,
        room_id: child.roomId,
        medical_notes: child.medicalNotes || null,
        bracelet_number: child.braceletNumber || null,
        authorized_pickup: child.authorizedPickup || null,
        status: 'present',
        checked_in_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error

    if (guardians.length > 0) {
      await supabase.from('guardians').insert(
        guardians.map((g, i) => ({ child_id: data.id, name: g.name, phone: g.phone, is_primary: i === 0 }))
      )
    }

    if (child.braceletNumber) {
      await supabase
        .from('bracelets')
        .update({ status: 'in-use', guardian_name: guardians[0]?.name || null, child_id: data.id })
        .eq('church_id', CHURCH_ID)
        .eq('number', child.braceletNumber)
    }

    return data.id as string
  }

  async function updateChild(id: string, updates: Partial<Child>) {
    const dbUpdates: Record<string, unknown> = {}
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.braceletNumber !== undefined) dbUpdates.bracelet_number = updates.braceletNumber
    if (updates.roomId !== undefined) dbUpdates.room_id = updates.roomId
    if (updates.medicalNotes !== undefined) dbUpdates.medical_notes = updates.medicalNotes

    const { error } = await supabase.from('children').update(dbUpdates).eq('id', id)
    if (error) throw error
  }

  async function checkInChild(id: string, braceletNumber: string, roomId: string) {
    const dbUpdates = {
      status: 'present',
      checked_in_at: new Date().toISOString(),
      bracelet_number: braceletNumber,
      room_id: roomId
    }
    const { error } = await supabase.from('children').update(dbUpdates).eq('id', id)
    if (error) throw error

    // Atualiza a pulseira
    const { data: guardianData } = await supabase.from('guardians').select('name').eq('child_id', id).limit(1)
    await supabase
      .from('bracelets')
      .update({ status: 'in-use', guardian_name: guardianData?.[0]?.name || null, child_id: id })
      .eq('church_id', CHURCH_ID)
      .eq('number', braceletNumber)
  }

  return { children, loading, addChild, updateChild, checkInChild }
}
