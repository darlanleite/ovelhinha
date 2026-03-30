import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Child, Bracelet, Call, Room, ServiceHistory, AppSettings } from './types';
import { mockChildren, mockBracelets, mockCalls, mockRooms, mockHistory, mockSettings } from './mockData';

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

  // Actions
  addChild: (child: Child) => void;
  updateChild: (id: string, updates: Partial<Child>) => void;
  addCall: (call: Call) => void;
  answerCall: (callId: string) => void;
  reactivateCall: (callId: string) => void;
  updateBracelet: (id: string, updates: Partial<Bracelet>) => void;
  addBracelet: (bracelet: Bracelet) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  addRoom: (room: Room) => void;
  removeRoom: (id: string) => void;
  updateRoom: (id: string, updates: Partial<Room>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
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

      addChild: (child) => set((s) => ({ children: [...s.children, child] })),
      updateChild: (id, updates) => set((s) => ({
        children: s.children.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      addCall: (call) => set((s) => ({ calls: [...s.calls, call] })),
      answerCall: (callId) => set((s) => ({
        calls: s.calls.map((c) => c.id === callId ? { ...c, status: 'answered', answeredAt: new Date().toISOString() } : c),
      })),
      reactivateCall: (callId) => set((s) => ({
        calls: s.calls.map((c) => c.id === callId ? { ...c, status: 'open', createdAt: new Date().toISOString(), answeredAt: null } : c),
      })),
      updateBracelet: (id, updates) => set((s) => ({
        bracelets: s.bracelets.map((b) => b.id === id ? { ...b, ...updates } : b),
      })),
      addBracelet: (bracelet) => set((s) => ({ bracelets: [...s.bracelets, bracelet] })),
      updateSettings: (updates) => set((s) => ({ settings: { ...s.settings, ...updates } })),
      addRoom: (room) => set((s) => ({ rooms: [...s.rooms, room] })),
      removeRoom: (id) => set((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) })),
      updateRoom: (id, updates) => set((s) => ({
        rooms: s.rooms.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),
    }),
    { name: 'ovelhinha-storage' }
  )
);
