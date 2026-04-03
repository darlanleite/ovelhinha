const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const activeBracelets = new Map();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Todos os clientes conectados (gateways + apps)
const allClients = new Set();

wss.on('connection', (ws) => {
  allClients.add(ws);
  console.log(`[WS] Cliente conectado (total: ${allClients.size})`);

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    // Evento de sync do app — faz broadcast para todos os OUTROS clientes
    if (msg._sync) {
      for (const client of allClients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(msg));
        }
      }
      return;
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
