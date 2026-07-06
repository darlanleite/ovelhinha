const WebSocket = require('ws');

const BACKEND_URL = process.env.BACKEND_URL || 'ws://localhost:3001';

const SERVICE_UUID        = '12345678123412341234123456789012';
const CHARACTERISTIC_UUID = '87654321432143214321210987654321';

const REASON_TO_BYTE = {
  'Urgência':      0x01,
  'Banheiro':      0x02,
  'Passando mal':  0x03,
  'Chorando':      0x03,
  'Amamentação':   0x03,
  'Outro':         0x04,
};

const bracelets = {};    // { '08': { peripheral, characteristic, status } }
const commandQueue = {}; // { '08': [{byte}] }
const seen = new Set();  // endereços já processados neste ciclo de scan

let noble = null;
let bleReady = false;

try {
  noble = require('@stoprocent/noble');
  noble.on('stateChange', (state) => {
    console.log('[BLE] Estado:', state);
    bleReady = state === 'poweredOn';
    if (bleReady) {
      console.log('[BLE] Bluetooth pronto — iniciando scan...');
      noble.startScanning([SERVICE_UUID], true);
    } else if (state === 'poweredOff') {
      console.warn('[BLE] Bluetooth desligado');
      bleReady = false;
    }
  });
  noble.on('discover', onDiscover);
  console.log('[BLE] @stoprocent/noble carregado');
} catch (e) {
  console.warn('[GATEWAY] noble não disponível — modo simulado');
}

function onDiscover(peripheral) {
  const addr = peripheral.address || peripheral.id;
  const advName = peripheral.advertisement?.localName || '';
  const num = extractNum(advName);

  // Ignora se não tem número identificável
  if (!num) return;

  // Ignora se já está conectado ou conectando
  if (bracelets[num]?.status === 'connected' || bracelets[num]?.status === 'connecting') return;

  // Ignora se endereço já foi visto recentemente
  if (seen.has(addr)) return;
  seen.add(addr);
  // Remove do seen após 30s para permitir reconexão
  setTimeout(() => seen.delete(addr), 30000);

  console.log(`[BLE] Encontrado: ${advName} (${addr}) — conectando...`);
  bracelets[num] = { peripheral, characteristic: null, status: 'connecting' };

  peripheral.connect((err) => {
    if (err) {
      console.error(`[BLE] Falha ao conectar #${num}:`, err);
      bracelets[num].status = 'disconnected';
      seen.delete(addr);
      return;
    }

    peripheral.discoverSomeServicesAndCharacteristics(
      [SERVICE_UUID],
      [CHARACTERISTIC_UUID],
      (err, _services, characteristics) => {
        if (err || !characteristics?.length) {
          console.error(`[BLE] Characteristic não encontrada #${num}:`, err);
          peripheral.disconnect();
          bracelets[num].status = 'disconnected';
          seen.delete(addr);
          return;
        }

        bracelets[num].characteristic = characteristics[0];
        bracelets[num].status = 'connected';
        console.log(`[BLE] ✅ Pulseira #${num} conectada e pronta`);
        flushQueue(num);

        peripheral.once('disconnect', () => {
          console.log(`[BLE] Pulseira #${num} desconectou`);
          bracelets[num] = { peripheral, characteristic: null, status: 'disconnected' };
          seen.delete(addr);
        });
      }
    );
  });
}

function extractNum(name) {
  if (!name || !name.includes('Ovelhinha-')) return null;
  const num = name.split('Ovelhinha-')[1]?.trim();
  return num || null;
}

function sendBLECommand(braceletId, byte) {
  const num = String(braceletId).padStart(2, '0');
  if (!noble) { simulateBLE(num, byte); return; }
  const bracelet = bracelets[num];
  if (bracelet?.status === 'connected' && bracelet.characteristic) {
    writeToBracelet(num, bracelet.characteristic, byte);
  } else {
    const action = byte === 0x00 ? 'encerrar' : 'acionar';
    console.log(`[BLE] #${num} não conectada — enfileirando (${action})`);
    console.log(`[BLE] Conhecidas: ${Object.keys(bracelets).join(', ') || 'nenhuma'}`);
    if (!commandQueue[num]) commandQueue[num] = [];
    commandQueue[num].push({ byte });
  }
}

function writeToBracelet(num, characteristic, byte) {
  characteristic.write(Buffer.from([byte]), false, (err) => {
    if (err) {
      console.error(`[BLE] Falha ao escrever #${num}:`, err);
    } else {
      const action = byte === 0x00 ? 'ENCERRADA' : 'ACIONADA';
      console.log(`[BLE] Pulseira #${num} ${action} (0x${byte.toString(16).padStart(2,'0').toUpperCase()})`);
    }
  });
}

function flushQueue(num) {
  const queue = commandQueue[num];
  if (!queue?.length) return;
  console.log(`[BLE] Processando ${queue.length} comando(s) para #${num}`);
  while (queue.length > 0) {
    writeToBracelet(num, bracelets[num].characteristic, queue.shift().byte);
  }
}

function simulateBLE(num, byte) {
  console.log(`[BLE SIMULADO] Pulseira #${num} ${byte === 0x00 ? 'ENCERRADA' : 'ACIONADA'}`);
}

function connect() {
  console.log(`[GATEWAY] Conectando ao backend em ${BACKEND_URL}...`);
  const ws = new WebSocket(BACKEND_URL);
  ws.on('open', () => console.log('[GATEWAY] Conectado ao backend Ovelhinha'));
  ws.on('message', (data) => {
    let payload;
    try { payload = JSON.parse(data.toString()); } catch { return; }
    const { command, braceletId } = payload;
    if (!command || !braceletId) return;
    console.log(`[GATEWAY] Comando: ${command} — pulseira #${braceletId}`);
    if (command === 'acionar') sendBLECommand(braceletId, REASON_TO_BYTE[payload.reason] ?? 0x04);
    else if (command === 'encerrar') sendBLECommand(braceletId, 0x00);
  });
  ws.on('close', () => { console.log('[GATEWAY] Desconectado. Reconectando em 3s...'); setTimeout(connect, 3000); });
  ws.on('error', (err) => console.error('[GATEWAY] Erro WS:', err.message));
}

connect();
