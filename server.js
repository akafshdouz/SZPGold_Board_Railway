const express = require('express');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// حافظه در حافظه (In-Memory Storage)
// ============================================
let memory = {
  marketStatus: {
    goldClosed: true,
    coinClosed: true,
  },
  pricingPacket: null, // کل پکت pricing ذخیره میشه
  lastUpdated: null,
  connected: false,
};

// ============================================
// WebSocket به سرور اصلی قیمت (pusher.goldab.ir)
// ============================================
function connectToPriceServer() {
  const wsUrl = 'wss://pusher.goldab.ir:443/app/app-key?protocol=7&client=js&version=8.4.0&flash=false';
  
  console.log('[Worker] Connecting to price server...', wsUrl);
  
  const ws = new WebSocket(wsUrl);
  
  let pingInterval = null;
  
  ws.on('open', () => {
    console.log('[Worker] Connected to price server');
    memory.connected = true;
    
    // سابسکرایب به کانال deniz
    ws.send(JSON.stringify({
      event: 'pusher:subscribe',
      data: { auth: '', channel: 'deniz' }
    }));
    console.log('[Worker] Subscribed to channel: deniz');
    
    // پینگ هر ۳۰ ثانیه
    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
      }
    }, 30000);
  });
  
  ws.on('message', (data) => {
    try {
      const packet = JSON.parse(data.toString());
      
      // پونگ - فقط لاگ
      if (packet.event === 'pusher:pong') {
        console.log('[Worker] Pong received');
        return;
      }
      
      // پکت‌های داده
      if (packet.event === 'app' || packet.event === 'new-panel') {
        const payload = JSON.parse(packet.data || '{}');
        const msg = payload.message || {};
        const p_type = msg.type;
        
        if (p_type === 'homepage_data_updated') {
          // پکت ۱: وضعیت کلی بازار
          const inner = msg.data || {};
          memory.marketStatus = {
            goldClosed: inner.molten_trade_status !== 1,
            coinClosed: inner.coin_trade_status !== 1,
          };
          memory.lastUpdated = new Date().toISOString();
          console.log('[Worker] Market status updated:', memory.marketStatus);
        }
        
        if (p_type === 'all_systems_pricing_updated') {
          // پکت ۲: قیمت‌ها + وضعیت تکی
          const pricing = msg.data?.pricing || [];
          if (pricing.length > 0) {
            memory.pricingPacket = pricing[0]; // کل آبجکت pricing ذخیره میشه
            memory.lastUpdated = new Date().toISOString();
            console.log('[Worker] Pricing packet updated, currencies:', pricing[0].currencies?.length || 0);
          }
        }
      }
    } catch (err) {
      console.error('[Worker] Error parsing message:', err.message);
    }
  });
  
  ws.on('close', (code, reason) => {
    console.log('[Worker] Disconnected from price server:', code, reason.toString());
    memory.connected = false;
    if (pingInterval) clearInterval(pingInterval);
    
    // riconnect بعد از ۳ ثانیه
    setTimeout(connectToPriceServer, 3000);
  });
  
  ws.on('error', (err) => {
    console.error('[Worker] WebSocket error:', err.message);
  });
}

// ============================================
// API Endpoints
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    connected: memory.connected,
    lastUpdated: memory.lastUpdated,
    uptime: process.uptime()
  });
});

// آخرین داده‌ها (برای تابلو)
app.get('/api/last-data', (req, res) => {
  res.json({
    marketStatus: memory.marketStatus,
    pricingPacket: memory.pricingPacket,
    lastUpdated: memory.lastUpdated,
    connected: memory.connected,
  });
});

// سرو فایل‌های استاتیک (HTML/JS/CSS)
app.use(express.static(path.join(__dirname, 'public')));

// شروع سرور
app.listen(PORT, () => {
  console.log(`[Worker] HTTP server running on port ${PORT}`);
  console.log(`[Worker] Health: http://localhost:${PORT}/health`);
  console.log(`[Worker] API: http://localhost:${PORT}/api/last-data`);
  
  // اتصال به سرور قیمت
  connectToPriceServer();
});