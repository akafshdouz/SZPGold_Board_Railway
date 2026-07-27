const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS دستی - بدون پکیج اضافه
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

// ============================================
// حافظه (In-Memory)
// ============================================
let memory = {
  marketStatus: {
    goldClosed: true,
    coinClosed: true,
  },
  pricingPacket: null,
  lastUpdated: null,  // ISO timestamp آخرین پکت
  connected: false,
};

// ============================================
// WebSocket به سرور قیمت (pusher.goldab.ir)
// ============================================
function connectToPriceServer() {
  const wsUrl = 'wss://pusher.goldab.ir:443/app/app-key?protocol=7&client=js&version=8.4.0&flash=false';
  console.log('[Worker] Connecting to price server...');

  const ws = new WebSocket(wsUrl);
  let pingInterval = null;

  ws.on('open', () => {
    console.log('[Worker] Connected to price server');
    memory.connected = true;

    ws.send(JSON.stringify({
      event: 'pusher:subscribe',
      data: { auth: '', channel: 'deniz' }
    }));
    console.log('[Worker] Subscribed to channel: deniz');

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
      }
    }, 30000);
  });

  ws.on('message', (data) => {
    try {
      const packet = JSON.parse(data.toString());

      if (packet.event === 'pusher:pong') return;

      if (packet.event === 'app' || packet.event === 'new-panel') {
        const payload = JSON.parse(packet.data || '{}');
        const msg = payload.message || {};
        const p_type = msg.type;

        if (p_type === 'homepage_data_updated') {
          const inner = msg.data || {};
          memory.marketStatus = {
            goldClosed: inner.molten_trade_status !== 1,
            coinClosed: inner.coin_trade_status !== 1,
          };
          memory.lastUpdated = new Date().toISOString();
          console.log('[Worker] Market status updated:', memory.marketStatus);
        }

        if (p_type === 'all_systems_pricing_updated') {
          const pricing = msg.data?.pricing || [];
          if (pricing.length > 0) {
            memory.pricingPacket = pricing[0];
            memory.lastUpdated = new Date().toISOString();
            console.log('[Worker] Pricing updated, currencies:', pricing[0].currencies?.length || 0);
          }
        }
      }
    } catch (err) {
      console.error('[Worker] Parse error:', err.message);
    }
  });

  ws.on('close', (code) => {
    console.log('[Worker] Disconnected:', code);
    memory.connected = false;
    if (pingInterval) clearInterval(pingInterval);
    setTimeout(connectToPriceServer, 3000);
  });

  ws.on('error', (err) => {
    console.error('[Worker] WebSocket error:', err.message);
  });
}

// ============================================
// API Endpoints
// ============================================

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'SZPGold Board API', connected: memory.connected });
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    connected: memory.connected,
    lastUpdated: memory.lastUpdated,
    uptime: process.uptime()
  });
});

app.get('/api/last-data', (req, res) => {
  res.json({
    marketStatus: memory.marketStatus,
    pricingPacket: memory.pricingPacket,
    lastUpdated: memory.lastUpdated,
    connected: memory.connected,
  });
});

// شروع
app.listen(PORT, () => {
  console.log(`[Worker] Running on port ${PORT}`);
  connectToPriceServer();
});