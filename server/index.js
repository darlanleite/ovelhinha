const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const STATE_FILE = path.join(__dirname, 'state.json');

app.use(cors());
app.use(express.json());

// --- Estado persistido ---

const defaultBracelets = Array.from({ length: 20 }, (_, i) => ({
  id: `b${i + 1}`,
  number: String(i + 1).padStart(2, '0'),
  status: 'available',
  guardianName: null,
  childId: null,
}));

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[STATE] Erro ao carregar state.json:', e.message);
  }
  return { children: [], calls: [], bracelets: defaultBracelets };
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[STATE] Erro ao salvar state.json:', e.message);
  }
}

let state = loadState();
// Garante que bracelets sempre tem os 20 padrão se não existirem
if (!state.bracelets || state.bracelets.length === 0) {
  state.bracelets = defaultBracelets;
}

console.log(`[STATE] Carregado: ${state.children.length} crianças, ${state.calls.length} chamadas`);

// --- Aplicar mutações no estado do servidor ---

function applySync(msg) {
  switch (msg.type) {
    case 'addChild': {
      if (!state.children.find((c) => c.id === msg.payload.id)) {
        state.children.push(msg.payload);
        if (msg.payload.braceletNumber) {
          const b = state.bracelets.find((b) => b.number === msg.payload.braceletNumber);
          if (b) {
            b.status = 'in-use';
            b.guardianName = msg.payload.guardians?.[0]?.name || null;
            b.childId = msg.payload.id;
          }
        }
      }
      break;
    }
    case 'updateChild': {
      state.children = state.children.map((c) =>
        c.id === msg.payload.id ? { ...c, ...msg.payload.updates } : c
      );
      break;
    }
    case 'addCall': {
      if (!state.calls.find((c) => c.id === msg.payload.id)) {
        state.calls.push(msg.payload);
      }
      break;
    }
    case 'answerCall': {
      const call = state.calls.find((c) => c.id === msg.payload.callId);
      state.calls = state.calls.map((c) =>
        c.id === msg.payload.callId
          ? { ...c, status: 'answered', answeredAt: new Date().toISOString(), answeredBy: msg.payload.answeredBy }
          : c
      );
      if (call) {
        state.children = state.children.map((ch) =>
          ch.id === call.childId ? { ...ch, status: 'present' } : ch
        );
        const b = state.bracelets.find((b) => b.number === call.braceletNumber);
        if (b) { b.status = 'available'; b.guardianName = null; b.childId = null; }
      }
      break;
    }
    case 'reactivateCall': {
      state.calls = state.calls.map((c) =>
        c.id === msg.payload.callId
          ? { ...c, status: 'reactivated', answeredAt: null, answeredBy: null }
          : c
      );
      break;
    }
    case 'checkout': {
      const { childId, braceletNumber } = msg.payload;
      state.children = state.children.map((ch) =>
        ch.id === childId ? { ...ch, status: 'left', braceletNumber: null } : ch
      );
      if (braceletNumber) {
        const b = state.bracelets.find((b) => b.number === braceletNumber);
        if (b) { b.status = 'available'; b.guardianName = null; b.childId = null; }
      }
      break;
    }
    case 'novoCulto': {
      state.children = [];
      state.calls = [];
      state.bracelets = state.bracelets.map((b) => ({
        ...b,
        status: b.status === 'in-use' ? 'available' : b.status,
        guardianName: null,
        childId: null,
      }));
      break;
    }
  }
  saveState();
}

// --- WebSocket ---

const activeBracelets = new Map();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const allClients = new Set();

wss.on('connection', (ws) => {
  allClients.add(ws);
  console.log(`[WS] Cliente conectado (total: ${allClients.size})`);

  // Envia estado atual para o novo cliente
  ws.send(JSON.stringify({
    _init: true,
    children: state.children,
    calls: state.calls,
    bracelets: state.bracelets,
  }));

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg._sync) {
      applySync(msg);
      // Broadcast para todos os outros clientes
      for (const client of allClients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(msg));
        }
      }
    }
  });

  ws.on('close', () => {
    allClients.delete(ws);
    console.log(`[WS] Cliente desconectado (total: ${allClients.size})`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Erro:', err.message);
    allClients.delete(ws);
  });
});

function broadcastToAll(payload) {
  const message = JSON.stringify(payload);
  for (const client of allClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// --- REST API ---

app.post('/api/acionar', (req, res) => {
  const { braceletId, reason } = req.body;
  if (!braceletId) return res.status(400).json({ error: 'braceletId é obrigatório' });

  activeBracelets.set(String(braceletId), { reason: reason || 'chamada', acionadoAt: new Date().toISOString() });
  broadcastToAll({ command: 'acionar', braceletId: String(braceletId), reason: reason || 'chamada' });

  console.log(`[API] Acionando pulseira #${braceletId} — motivo: ${reason}`);
  res.json({ ok: true, braceletId, reason });
});

app.post('/api/encerrar', (req, res) => {
  const { braceletId } = req.body;
  if (!braceletId) return res.status(400).json({ error: 'braceletId é obrigatório' });

  activeBracelets.delete(String(braceletId));
  broadcastToAll({ command: 'encerrar', braceletId: String(braceletId) });

  console.log(`[API] Encerrando pulseira #${braceletId}`);
  res.json({ ok: true, braceletId });
});

app.get('/api/status', (req, res) => {
  const status = [];
  for (const [braceletId, info] of activeBracelets.entries()) {
    status.push({ braceletId, ...info });
  }
  res.json({ clientesConectados: allClients.size, pulseirasAtivas: status });
});

server.listen(PORT, () => {
  console.log(`[SERVER] Ovelhinha backend rodando em http://localhost:${PORT}`);
  console.log(`[SERVER] WebSocket disponível em ws://localhost:${PORT}`);
});
