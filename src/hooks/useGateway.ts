import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type GatewayStatus = 'online' | 'warning' | 'offline' | 'unknown'

export function computeStatus(lastSeen: string | null): GatewayStatus {
  if (!lastSeen) return 'unknown'
  const secs = (Date.now() - new Date(lastSeen).getTime()) / 1000
  if (secs < 90) return 'online'
  return 'offline'
}

export interface GatewayInfo {
  name: string
  status: GatewayStatus
  lastSeen: string | null
  secsAgo: number | null
}

export function useGateway() {
  const { churchId } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['gateways', churchId],
    enabled: !!churchId,
    queryFn: async () => {
      const { data } = await supabase
        .from('gateways')
        .select('name, last_seen')
        .eq('church_id', churchId!)
        .order('name', { ascending: true })
      return data ?? []
    },
    refetchInterval: 15_000,
  })

  const gateways: GatewayInfo[] = (data ?? []).map((g) => {
    const lastSeen = g.last_seen ?? null
    const secsAgo = lastSeen ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000) : null
    return { name: g.name, status: computeStatus(lastSeen), lastSeen, secsAgo }
  })

  // Compatibilidade retroativa — retorna o status do "pior" gateway para alertas globais
  const anyOffline = gateways.some((g) => g.status === 'offline')
  const allUnknown = gateways.length === 0
  const globalStatus: GatewayStatus = allUnknown ? 'unknown' : anyOffline ? 'offline' : 'online'

  // Campos legados (usado por código antigo que esperava um único gateway)
  const first = gateways[0]
  return {
    gateways,
    status: globalStatus,
    lastSeen: first?.lastSeen ?? null,
    secsAgo: first?.secsAgo ?? null,
    name: first?.name ?? 'Gateway-01',
    isLoading,
  }
}
