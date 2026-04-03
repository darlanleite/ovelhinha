import type { Child, Call } from '@/store/types';

export type SyncEvent =
  | { _sync: true; type: 'addCall'; payload: Call }
  | { _sync: true; type: 'answerCall'; payload: { callId: string; answeredBy: 'reception' | 'tia' } }
  | { _sync: true; type: 'reactivateCall'; payload: { callId: string } }
  | { _sync: true; type: 'addChild'; payload: Child }
  | { _sync: true; type: 'updateChild'; payload: { id: string; updates: Partial<Child> } }
  | { _sync: true; type: 'checkout'; payload: { childId: string; braceletNumber: string | null } };

const WS_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws');

type Handler = (event: SyncEvent) => void;
const handlers = new Set<Handler>();
let socket: WebSocket | null = null;

function connect() {
  socket = new WebSocket(WS_URL);
  socket.onopen  = () => console.log('[SYNC] Conectado ao backend');
  socket.onclose = () => { console.log('[SYNC] Desconectado — reconectando...'); setTimeout(connect, 3000); };
  socket.onerror = () => {};
  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data) as SyncEvent;
      if (data._sync) handlers.forEach((h) => h(data));
    } catch {}
  };
}

export function initSync() {
  connect();
}

export function emitSync(event: Omit<SyncEvent, '_sync'>) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ ...event, _sync: true }));
  }
}

export function onSyncEvent(handler: Handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
