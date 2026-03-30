export interface Child {
  id: string;
  name: string;
  birthDate: string;
  roomId: string;
  medicalNotes: string;
  guardians: Guardian[];
  braceletNumber: string | null;
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
  status: 'available' | 'in-use' | 'charging' | 'offline';
  battery: number;
  guardianName: string | null;
  childId: string | null;
}

export interface Call {
  id: string;
  childId: string;
  braceletNumber: string;
  reason: string;
  reasonIcon: string;
  status: 'open' | 'answered' | 'reactivated';
  createdAt: string;
  answeredAt: string | null;
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
}
