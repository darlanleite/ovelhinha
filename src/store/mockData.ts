import { Child, Bracelet, Call, Room, ServiceHistory, AppSettings, Gateway } from './types';

const now = Date.now();

export const mockRooms: Room[] = [
  { id: 'r1', name: 'Berçário', emoji: '🍼', ageRange: '0-2 anos' },
  { id: 'r2', name: 'Maternal', emoji: '🌟', ageRange: '3-5 anos' },
  { id: 'r3', name: 'Infantil', emoji: '✨', ageRange: '6-10 anos' },
];

export const mockChildren: Child[] = [
  { id: 'c1', name: 'João Silva', birthDate: '2022-03-15', roomId: 'r1', medicalNotes: '', guardians: [{ id: 'g1', name: 'Carlos Silva', phone: '(11) 99876-5432' }], braceletNumber: '07', status: 'called', checkedInAt: new Date(now - 3600000).toISOString(), authorizedPickup: 'Avó - Dona Maria' },
  { id: 'c2', name: 'Maria Santos', birthDate: '2020-07-22', roomId: 'r2', medicalNotes: 'Alergia a amendoim', guardians: [{ id: 'g2', name: 'Ana Santos', phone: '(11) 98765-1234' }], braceletNumber: '03', status: 'called', checkedInAt: new Date(now - 3000000).toISOString(), authorizedPickup: null },
  { id: 'c3', name: 'Pedro Oliveira', birthDate: '2018-11-08', roomId: 'r3', medicalNotes: '', guardians: [{ id: 'g3', name: 'Roberto Oliveira', phone: '(21) 99654-3210' }], braceletNumber: '12', status: 'present', checkedInAt: new Date(now - 2400000).toISOString(), authorizedPickup: null },
  { id: 'c4', name: 'Ana Costa', birthDate: '2021-01-30', roomId: 'r2', medicalNotes: '', guardians: [{ id: 'g4', name: 'Fernanda Costa', phone: '(11) 97654-8765' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 1800000).toISOString(), authorizedPickup: null },
  { id: 'c5', name: 'Lucas Ferreira', birthDate: '2019-05-12', roomId: 'r3', medicalNotes: 'Asma leve', guardians: [{ id: 'g5', name: 'Marcos Ferreira', phone: '(21) 98543-2109' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 2700000).toISOString(), authorizedPickup: null },
  { id: 'c6', name: 'Beatriz Lima', birthDate: '2023-09-03', roomId: 'r1', medicalNotes: '', guardians: [{ id: 'g6', name: 'Patrícia Lima', phone: '(31) 99432-1098' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 2100000).toISOString(), authorizedPickup: null },
  { id: 'c7', name: 'Gabriel Souza', birthDate: '2017-12-25', roomId: 'r3', medicalNotes: '', guardians: [{ id: 'g7', name: 'Ricardo Souza', phone: '(11) 96321-0987' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 1500000).toISOString(), authorizedPickup: null },
  { id: 'c8', name: 'Isabela Rocha', birthDate: '2020-04-18', roomId: 'r2', medicalNotes: 'Intolerância a lactose', guardians: [{ id: 'g8', name: 'Cláudia Rocha', phone: '(21) 95210-9876' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 900000).toISOString(), authorizedPickup: null },
  { id: 'c9', name: 'Davi Almeida', birthDate: '2022-08-07', roomId: 'r1', medicalNotes: '', guardians: [{ id: 'g9', name: 'Juliana Almeida', phone: '(31) 94109-8765' }], braceletNumber: null, status: 'left', checkedInAt: new Date(now - 7200000).toISOString(), authorizedPickup: null },
  { id: 'c10', name: 'Sofia Mendes', birthDate: '2019-02-14', roomId: 'r2', medicalNotes: '', guardians: [{ id: 'g10', name: 'Teresa Mendes', phone: '(11) 93098-7654' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 600000).toISOString(), authorizedPickup: null },
  { id: 'c11', name: 'Miguel Barbosa', birthDate: '2018-06-30', roomId: 'r3', medicalNotes: '', guardians: [{ id: 'g11', name: 'Paulo Barbosa', phone: '(21) 92087-6543' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 1200000).toISOString(), authorizedPickup: null },
  { id: 'c12', name: 'Helena Araújo', birthDate: '2023-11-11', roomId: 'r1', medicalNotes: 'Refluxo', guardians: [{ id: 'g12', name: 'Mariana Araújo', phone: '(31) 91076-5432' }], braceletNumber: null, status: 'present', checkedInAt: new Date(now - 300000).toISOString(), authorizedPickup: null },
];

export const mockBracelets: Bracelet[] = [
  { id: 'b1',  number: '01', status: 'available', battery: 95, guardianName: null,              childId: null, espId: 'A4:B2:C1:D3', lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b2',  number: '02', status: 'available', battery: 88, guardianName: null,              childId: null, espId: 'A4:B2:C1:D4', lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b3',  number: '03', status: 'in-use',    battery: 72, guardianName: 'Ana Santos',      childId: 'c2', espId: 'A4:B2:C1:D5', lastHeartbeat: new Date(now - 15000).toISOString(),     connectivityStatus: 'online',      lastGatewayId: 'gateway-1' },
  { id: 'b4',  number: '04', status: 'available', battery: 100,guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b5',  number: '05', status: 'charging',  battery: 45, guardianName: null,              childId: null, espId: 'A4:B2:C1:D7', lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b6',  number: '06', status: 'available', battery: 91, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b7',  number: '07', status: 'in-use',    battery: 63, guardianName: 'Carlos Silva',    childId: 'c1', espId: 'A4:B2:C1:D9', lastHeartbeat: new Date(now - 25000).toISOString(),     connectivityStatus: 'online',      lastGatewayId: 'gateway-1' },
  { id: 'b8',  number: '08', status: 'available', battery: 85, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b9',  number: '09', status: 'offline',   battery: 12, guardianName: null,              childId: null, espId: 'A4:B2:C1:DB', lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b10', number: '10', status: 'available', battery: 97, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b11', number: '11', status: 'available', battery: 78, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b12', number: '12', status: 'in-use',    battery: 54, guardianName: 'Roberto Oliveira',childId: 'c3', espId: 'A4:B2:C1:DE', lastHeartbeat: new Date(now - 48000).toISOString(),     connectivityStatus: 'warning',     lastGatewayId: 'gateway-2' },
  { id: 'b13', number: '13', status: 'available', battery: 90, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b14', number: '14', status: 'charging',  battery: 30, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b15', number: '15', status: 'available', battery: 82, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b16', number: '16', status: 'available', battery: 99, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b17', number: '17', status: 'available', battery: 76, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b18', number: '18', status: 'offline',   battery: 5,  guardianName: null,              childId: null, espId: null,            lastHeartbeat: new Date(now - 120000).toISOString(),    connectivityStatus: 'unreachable', lastGatewayId: 'gateway-3' },
  { id: 'b19', number: '19', status: 'available', battery: 93, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
  { id: 'b20', number: '20', status: 'available', battery: 87, guardianName: null,              childId: null, espId: null,            lastHeartbeat: null,                                    connectivityStatus: 'online',      lastGatewayId: null },
];

export const mockCalls: Call[] = [
  {
    id: 'call1', childId: 'c1', braceletNumber: '07', reason: 'Chorando', reasonIcon: '😢',
    status: 'open', createdAt: new Date(now - 180000).toISOString(), answeredAt: null, roomId: 'r1', answeredBy: null,
    braceletConnectivityAtCall: 'online', bleDeliveryStatus: 'delivered', bleAttempts: 1,
    bleLastAttemptAt: new Date(now - 179000).toISOString(), fallbackTriggered: false, fallbackAttempts: [],
  },
  {
    id: 'call2', childId: 'c2', braceletNumber: '03', reason: 'Banheiro', reasonIcon: '🚽',
    status: 'open', createdAt: new Date(now - 60000).toISOString(), answeredAt: null, roomId: 'r2', answeredBy: null,
    braceletConnectivityAtCall: 'online', bleDeliveryStatus: 'delivered', bleAttempts: 1,
    bleLastAttemptAt: new Date(now - 59000).toISOString(), fallbackTriggered: false, fallbackAttempts: [],
  },
];

export const mockGateways: Gateway[] = [
  { id: 'gateway-1', name: 'Ala principal',  location: 'Entrada do kids',     status: 'online',  lastSeenAt: new Date(now - 5000).toISOString(),   ipAddress: '192.168.1.101' },
  { id: 'gateway-2', name: 'Ala lateral',    location: 'Corredor das salas',  status: 'online',  lastSeenAt: new Date(now - 12000).toISOString(),  ipAddress: '192.168.1.102' },
  { id: 'gateway-3', name: 'Saída',          location: 'Corredor de saída',   status: 'offline', lastSeenAt: new Date(now - 300000).toISOString(), ipAddress: '192.168.1.103' },
];

export const mockHistory: ServiceHistory[] = [
  { id: 'h1', date: '2026-03-29', serviceName: 'Culto Domingo Manhã', childrenCount: 28, callsCount: 5 },
  { id: 'h2', date: '2026-03-29', serviceName: 'Culto Domingo Noite', childrenCount: 22, callsCount: 3 },
  { id: 'h3', date: '2026-03-22', serviceName: 'Culto Domingo Manhã', childrenCount: 31, callsCount: 7 },
  { id: 'h4', date: '2026-03-22', serviceName: 'Culto Domingo Noite', childrenCount: 19, callsCount: 2 },
];

export const mockSettings: AppSettings = {
  churchName: 'Igreja Graça e Vida',
  reactivateMinutes: 5,
  dailyCode: '4821',
  heartbeatIntervalSeconds: 30,
  heartbeatWarningThreshold: 1,
  heartbeatOfflineThreshold: 3,
};
