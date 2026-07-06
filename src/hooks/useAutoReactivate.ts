import { useEffect, useRef } from 'react'
import { acionarPulseira } from '@/lib/esp32'
import { useAuth } from '@/contexts/AuthContext'
import type { Call } from '@/store/types'

const CHECK_INTERVAL_MS = 30_000 // verifica a cada 30s

export function useAutoReactivate(
  openCalls: Call[],
  reactivateMinutes: number,
  reactivateCall: (callId: string) => Promise<void>
) {
  const { churchId } = useAuth()
  // Guarda IDs que já foram reacionados automaticamente nesta sessão
  // para não reacionar múltiplas vezes seguidas
  const reactivatedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const check = async () => {
      const now = Date.now()
      const limitMs = reactivateMinutes * 60 * 1000

      for (const call of openCalls) {
        const age = now - new Date(call.createdAt).getTime()

        // Só reaciona se: passou o tempo limite E ainda não reacionamos nesta sessão
        if (age >= limitMs && !reactivatedRef.current.has(call.id)) {
          reactivatedRef.current.add(call.id)
          console.log(`[AutoReactivate] Chamada ${call.id} aberta há ${Math.floor(age / 60000)}min — reacionando`)

          try {
            await reactivateCall(call.id)
            if (churchId) await acionarPulseira(churchId, call.braceletNumber ?? '', call.reason)
          } catch (e) {
            console.error('[AutoReactivate] Erro ao reacionar:', e)
            // Remove do set para tentar novamente no próximo ciclo
            reactivatedRef.current.delete(call.id)
          }
        }

        // Limpa do set quando a chamada for atendida (não está mais em openCalls)
      }

      // Remove IDs que não estão mais em openCalls (foram atendidas)
      const openIds = new Set(openCalls.map((c) => c.id))
      for (const id of reactivatedRef.current) {
        if (!openIds.has(id)) reactivatedRef.current.delete(id)
      }
    }

    check()
    const interval = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [openCalls, reactivateMinutes, reactivateCall, churchId])
}
