import { useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { braceletOfflineSince } from '@/store/types';

export function useHeartbeatSimulator() {
  const bracelets = useStore((s) => s.bracelets);
  const settings = useStore((s) => s.settings);
  const gateways = useStore((s) => s.gateways);
  const updateHeartbeat = useStore((s) => s.updateHeartbeat);
  const markBraceletUnreachable = useStore((s) => s.markBraceletUnreachable);
  const updateBracelet = useStore((s) => s.updateBracelet);

  const onlineGatewayIds = useMemo(
    () => gateways.filter((g) => g.status === 'online').map((g) => g.id),
    [gateways]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const interval = settings.heartbeatIntervalSeconds * 1000;

    const tick = () => {
      const snap = useStore.getState().bracelets;
      snap.forEach((b) => {
        if (b.status !== 'in-use') return;

        const roll = Math.random();
        const gatewayId = onlineGatewayIds[Math.floor(Math.random() * onlineGatewayIds.length)] ?? 'gateway-1';

        if (b.connectivityStatus === 'unreachable') {
          // 30% de chance de voltar
          if (roll < 0.3) updateHeartbeat(b.id, gatewayId);
        } else {
          // 90% de chance de responder
          if (roll < 0.9) {
            updateHeartbeat(b.id, gatewayId);
          }
          // 10% não responde — recalcula abaixo
        }
      });

      // Recalcula connectivityStatus de todas as pulseiras in-use baseado no tempo
      const afterSnap = useStore.getState().bracelets;
      afterSnap.forEach((b) => {
        if (b.status !== 'in-use') return;
        const secs = braceletOfflineSince(b);
        if (secs === null) return;

        const warnAt = settings.heartbeatIntervalSeconds * settings.heartbeatWarningThreshold;
        const offlineAt = settings.heartbeatIntervalSeconds * settings.heartbeatOfflineThreshold;

        let next: 'online' | 'warning' | 'unreachable';
        if (secs < warnAt) next = 'online';
        else if (secs < offlineAt) next = 'warning';
        else next = 'unreachable';

        if (next !== b.connectivityStatus) {
          if (next === 'unreachable') {
            markBraceletUnreachable(b.id);
          } else {
            updateBracelet(b.id, { connectivityStatus: next });
          }
        }
      });
    };

    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [settings.heartbeatIntervalSeconds, settings.heartbeatWarningThreshold, settings.heartbeatOfflineThreshold, onlineGatewayIds]);

  const online      = bracelets.filter((b) => b.status === 'in-use' && b.connectivityStatus === 'online').length;
  const warning     = bracelets.filter((b) => b.status === 'in-use' && b.connectivityStatus === 'warning').length;
  const unreachable = bracelets.filter((b) => b.status === 'in-use' && b.connectivityStatus === 'unreachable').length;

  return { onlineBracelets: online, warningBracelets: warning, unreachableBracelets: unreachable };
}
