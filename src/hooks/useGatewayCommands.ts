import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface GatewayCommandLog {
  id: string
  command: string
  reason: string | null
  status: string
  bracelet_id: string
  gateway_id: string | null
  gateway_name: string | null
  delivered_at: string | null
  attempts: number
  created_at: string
}

export function useGatewayCommands() {
  const { churchId } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['gateway_commands_log', churchId],
    enabled: !!churchId,
    queryFn: async (): Promise<GatewayCommandLog[]> => {
      const [{ data: commands }, { data: gateways }] = await Promise.all([
        supabase
          .from('gateway_commands')
          .select('id, command, reason, status, bracelet_id, gateway_id, delivered_at, attempts, created_at')
          .eq('church_id', churchId!)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('gateways').select('id, name').eq('church_id', churchId!),
      ])

      const gwMap = Object.fromEntries((gateways ?? []).map((g) => [g.id, g.name]))
      return (commands ?? []).map((c) => ({
        ...c,
        gateway_name: c.gateway_id ? gwMap[c.gateway_id] ?? null : null,
      }))
    },
    refetchInterval: 15_000,
  })

  return { commands: data ?? [], isLoading }
}
