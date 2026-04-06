import { supabase, CHURCH_ID } from './supabase'

export async function acionarPulseira(braceletId: string, reason?: string) {
  try {
    const { error } = await supabase.from('gateway_commands').insert({
      church_id: CHURCH_ID,
      bracelet_id: braceletId,
      command: 'acionar',
      reason: reason || null,
      status: 'pending',
    })
    return !error
  } catch {
    return false
  }
}

export async function encerrarPulseira(braceletId: string) {
  try {
    const { error } = await supabase.from('gateway_commands').insert({
      church_id: CHURCH_ID,
      bracelet_id: braceletId,
      command: 'encerrar',
      reason: null,
      status: 'pending',
    })
    return !error
  } catch {
    return false
  }
}
