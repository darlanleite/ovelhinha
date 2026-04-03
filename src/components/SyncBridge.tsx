import { useEffect } from 'react';
import { initSync, onSyncEvent } from '@/lib/syncClient';
import { useStore } from '@/store/useStore';

// Inicializa conexão uma vez
let initialized = false;

export function SyncBridge() {
  const addCall      = useStore((s) => s.addCall);
  const answerCall   = useStore((s) => s.answerCall);
  const reactivateCall = useStore((s) => s.reactivateCall);
  const addChild     = useStore((s) => s.addChild);
  const updateChild  = useStore((s) => s.updateChild);
  const updateBracelet = useStore((s) => s.updateBracelet);
  const bracelets    = useStore((s) => s.bracelets);

  useEffect(() => {
    if (!initialized) {
      initSync();
      initialized = true;
    }

    const unsub = onSyncEvent((event) => {
      console.log('[SYNC] Evento recebido:', event.type);

      switch (event.type) {
        case 'addCall':
          addCall(event.payload);
          break;
        case 'answerCall':
          answerCall(event.payload.callId, event.payload.answeredBy);
          break;
        case 'reactivateCall':
          reactivateCall(event.payload.callId);
          break;
        case 'addChild':
          addChild(event.payload);
          break;
        case 'updateChild':
          updateChild(event.payload.id, event.payload.updates);
          break;
        case 'checkout': {
          const { childId, braceletNumber } = event.payload;
          updateChild(childId, { status: 'left', braceletNumber: null });
          if (braceletNumber) {
            const b = bracelets.find((b) => b.number === braceletNumber);
            if (b) updateBracelet(b.id, { status: 'available', guardianName: null, childId: null });
          }
          break;
        }
      }
    });

    return unsub;
  }, []);

  return null;
}
