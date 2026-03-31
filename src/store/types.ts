export interface Child {
  id: string;
  name: string;
  birthDate: string;
  roomId: string;
  medicalNotes: string;
  guardians: Guardian[];
  braceletNumber: string | null;
  authorizedPickup: string | null;
  status: 'present' | 'called' | 'left';
  checkedInAt: string;
}

export interface Guardian {
  id: string;
  name: string;
  phone: string;
}

export interface Bracelet {
  id: string;
  number: string;
  espId: string | null;
  status: 'available' | 'in-use' | 'charging' | 'offline';
  battery: number;
  guardianName: string | null;
  childId: string | null;
  lastHeartbeat: string | null;
  connectivityStatus: 'online' | 'warning' | 'unreachable';
  lastGatewayId: string | null;
}

export interface Call {
  id: string;
  childId: string;
  braceletNumber: string;
  roomId: string;
  reason: string;
  reasonIcon: string;
  status: 'open' | 'answered' | 'reactivated';
  answeredBy: 'reception' | 'tia' | null;
  createdAt: string;
  answeredAt: string | null;
  braceletConnectivityAtCall: 'online' | 'warning' | 'unreachable';
  bleDeliveryStatus: 'pending' | 'delivered' | 'failed';
  bleAttempts: number;
  bleLastAttemptAt: string | null;
  fallbackTriggered: boolean;
  fallbackAttempts: Array<{
    channel: 'whatsapp' | 'microphone' | 'volunteer';
    attemptedAt: string;
    attemptedBy: string;
  }>;
}

export interface Gateway {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  lastSeenAt: string | null;
  ipAddress: string | null;
}

export interface Room {
  id: string;
  name: string;
  emoji: string;
  ageRange: string;
}

export interface ServiceHistory {
  id: string;
  date: string;
  serviceName: string;
  childrenCount: number;
  callsCount: number;
}

export interface AppSettings {
  churchName: string;
  reactivateMinutes: number;
  dailyCode: string;
  heartbeatIntervalSeconds: number;
  heartbeatWarningThreshold: number;
  heartbeatOfflineThreshold: number;
}

export function braceletOfflineSince(b: Bracelet): number | null {
  if (!b.lastHeartbeat) return null;
  return Math.floor((Date.now() - new Date(b.lastHeartbeat).getTime()) / 1000);
}

export function braceletIsRisky(b: Bracelet): boolean {
  return b.connectivityStatus !== 'online' || b.battery < 15;
}
