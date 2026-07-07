import { useGateway } from '@/hooks/useGateway'

/**
 * Banner fixo quando algum gateway BLE está offline — sem gateway,
 * as pulseiras não recebem comandos. Complementa o push enviado pelo
 * vigia do banco (check_gateways_offline).
 */
export function GatewayAlertBanner() {
  const { gateways } = useGateway()
  const offline = gateways.filter((g) => g.status === 'offline')

  if (offline.length === 0) return null

  return (
    <div className="bg-urgent text-urgent-foreground px-4 py-2.5 flex items-center gap-3 text-sm font-medium animate-pulse-urgent">
      <span className="text-lg leading-none">⚠️</span>
      <span>
        <strong>{offline.map((g) => g.name).join(', ')}</strong>{' '}
        {offline.length === 1 ? 'está offline' : 'estão offline'} — as pulseiras podem não
        receber comandos. Verifique a tomada e o Wi-Fi do gateway.
      </span>
    </div>
  )
}
