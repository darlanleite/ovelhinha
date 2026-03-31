import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Child, Bracelet, Call, Room, ServiceHistory, AppSettings, Gateway } from './types';
import { mockChildren, mockBracelets, mockCalls, mockRooms, mockHistory, mockSettings, mockGateways } from './mockData';

interface AppState {
  // Auth
  userRole: 'reception' | 'tia' | null;
  tiaRoom: string | null;
  login: (role: 'reception' | 'tia', roomId?: string) => void;
  logout: () => void;

  // Data
  children: Child[];
  bracelets: Bracelet[];
  calls: Call[];
  rooms: Room[];
  history: ServiceHistory[];
  settings: AppSettings;
  gateways: Gateway[];

  // Actions — children
  addChild: (child: Child) => void;
  updateChild: (id: string, updates: Partial<Child>) => void;

  // Actions — calls
  addCall: (call: Omit<Call, 'braceletConnectivityAtCall' | 'bleDeliveryStatus' | 'bleAttempts' | 'bleLastAttemptAt' | 'fallbackTriggered' | 'fallbackAttempts'>) => void;
  answerCall: (callId: string, answeredBy: 'reception' | 'tia') => void;
  reactivateCall: (callId: string) => void;
  updateBleDelivery: (callId: string, status: Call['bleDeliveryStatus'], attempts: number) => void;
  triggerFallback: (callId: string, attempt: Call['fallbackAttempts'][number]) => void;

  // Actions — bracelets
  updateBracelet: (id: string, updates: Partial<Bracelet>) => void;
  addBracelet: (bracelet: Bracelet) => void;
  updateHeartbeat: (braceletId: string, gatewayId: string) => void;
  markBraceletUnreachable: (braceletId: string) => void;

  // Actions — settings & rooms
  updateSettings: (updates: Partial<AppSettings>) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;

  // Actions — gateways
  addGateway: (gateway: Gateway) => void;
  updateGateway: (id: string, updates: Partial<Gateway>) => void;
  removeGateway: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      userRole: null,
      tiaRoom: null,
      login: (role, roomId) => set({ userRole: role, tiaRoom: roomId || null }),
      logout: () => set({ userRole: null, tiaRoom: null }),

      children: mockChildren,
      bracelets: mockBracelets,
      calls: mockCalls,
      rooms: mockRooms,
      history: mockHistory,
      settings: mockSettings,
      gateways: mockGateways,

      addChild: (child) => set((s) => ({ children: [...s.children, child] })),
      updateChild: (id, updates) => set((s) => ({
        children: s.children.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),

      addCall: (callData) => set((s) => {
        const bracelet = s.bracelets.find((b) => b.number === callData.braceletNumber);
        const call: Call = {
          ...callData,
          braceletConnectivityAtCall: bracelet?.connectivityStatus ?? 'online',
          bleDeliveryStatus: 'pending',
          bleAttempts: 0,
          bleLastAttemptAt: null,
          fallbackTriggered: false,
          fallbackAttempts: [],
        };
        return { calls: [...s.calls, call] };
      }),

      answerCall: (callId, answeredBy) => set((s) => {
        const call = s.calls.find((c) => c.id === callId);
        return {
          calls: s.calls.map((c) =>
            c.id === callId
              ? { ...c, status: 'answered' as const, answeredAt: new Date().toISOString(), answeredBy }
              : c
          ),
          children: call
            ? s.children.map((ch) =>
                ch.id === call.childId ? { ...ch, status: 'present' as const } : ch
              )
            : s.children,
          bracelets: call
            ? s.bracelets.map((b) =>
                b.number === call.braceletNumber
                  ? { ...b, status: 'available' as const, guardianName: null, childId: null }
                  : b
              )
            : s.bracelets,
        };
      }),

      reactivateCall: (callId) => set((s) => ({
        calls: s.calls.map((c) =>
          c.id === callId
            ? { ...c, status: 'reactivated' as const, createdAt: new Date().toISOString(), answeredAt: null, answeredBy: null }
            : c
        ),
      })),

      updateBleDelivery: (callId, status, attempts) => set((s) => ({
        calls: s.calls.map((c) =>
          c.id === callId
            ? { ...c, bleDeliveryStatus: status, bleAttempts: attempts, bleLastAttemptAt: new Date().toISOString() }
            : c
        ),
      })),

      triggerFallback: (callId, attempt) => set((s) => ({
        calls: s.calls.map((c) =>
          c.id === callId
            ? { ...c, fallbackTriggered: true, fallbackAttempts: [...c.fallbackAttempts, attempt] }
            : c
        ),
      })),

      updateBracelet: (id, updates) => set((s) => ({
        bracelets: s.bracelets.map((b) => b.id === id ? { ...b, ...updates } : b),
      })),

      addBracelet: (bracelet) => set((s) => ({ bracelets: [...s.bracelets, bracelet] })),

      updateHeartbeat: (braceletId, gatewayId) => set((s) => ({
        bracelets: s.bracelets.map((b) =>
          b.id === braceletId
            ? { ...b, lastHeartbeat: new Date().toISOString(), lastGatewayId: gatewayId, connectivityStatus: 'online' as const }
            : b
        ),
      })),

      markBraceletUnreachable: (braceletId) => set((s) => ({
        bracelets: s.bracelets.map((b) =>
          b.id === braceletId
            ? { ...b, connectivityStatus: 'unreachable' as const }
            : b
        ),
      })),

      updateSettings: (updates) => set((s) => ({ settings: { ...s.settings, ...updates } })),
      addRoom: (room) => set((s) => ({ rooms: [...s.rooms, room] })),
      removeRoom: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
      updateRoom: (id, updates) => set((s) => ({
        rooms: s.rooms.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),

      addGateway: (gateway) => set((s) => ({ gateways: [...s.gateways, gateway] })),
      updateGateway: (id, updates) => set((s) => ({
        gateways: s.gateways.map((g) => g.id === id ? { ...g, ...updates } : g),
      })),
      removeGateway: (id) => set((s) => ({ gateways: s.gateways.filter((g) => g.id !== id) })),
    }),
    { name: 'ovelhinha-storage' }
  )
);
