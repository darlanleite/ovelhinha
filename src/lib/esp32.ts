import { supabase } from './supabase'

// Insere comandos na fila gateway_commands via cliente Supabase autenticado.
// O gateway ESP32 faz poll dessa tabela e entrega via BLE.

async function getBraceletUUID(churchId: string, braceletNumber: string): Promise<string | null> {
  const { data } = await supabase
    .from('bracelets')
    .select('id')
    .eq('church_id', churchId)
    .eq('number', braceletNumber)
    .single()
  return data?.id ?? null
}

async function insertGatewayCommand(
  churchId: string,
  braceletId: string,
  command: 'acionar' | 'encerrar',
  reason?: string
): Promise<boolean> {
  const { error } = await supabase.from('gateway_commands').insert({
    church_id: churchId,
    bracelet_id: braceletId,
    command,
    reason: reason || null,
    status: 'pending',
  })
  return !error
}

export async function acionarPulseira(churchId: string, braceletNumber: string, reason?: string) {
  try {
    const braceletId = await getBraceletUUID(churchId, braceletNumber)
    if (!braceletId) return false
    return await insertGatewayCommand(churchId, braceletId, 'acionar', reason)
  } catch {
    return false
  }
}

export async function encerrarPulseira(churchId: string, braceletNumber: string) {
  try {
    const braceletId = await getBraceletUUID(churchId, braceletNumber)
    if (!braceletId) return false
    return await insertGatewayCommand(churchId, braceletId, 'encerrar')
  } catch {
    return false
  }
}
