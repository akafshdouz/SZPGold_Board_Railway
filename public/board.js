// Railway Server URL - CHANGE THIS WHEN RAILWAY URL CHANGES
const SERVER_URL = "szpgoldboardrailway-production.up.railway.app";

let currentSizes = { lgTitle: 7.0, lgPrice: 10.5, mqTitle: 6.0, mqPrice: 9.0, smTitle: 3.2, smPrice: 5.0 };
let lastUpdateTs = 0;
let serverConnected = false;
let socket = null;
let pingInterval = null;
let githubConnected = true;

let commissions = { 
  g_buy: 0,          g_sell: -1500000,
  m_buy: 0,          m_sell: -6500000,
  f_buy: 15000000,   f_sell: -15000000,
  h_buy: 10000000,   h_sell: -10000000,
  q_buy: 10000000,   q_sell: -10000000
};

let rawPrices = { g_buy: 0, g_sell: 0, m_buy: 0, m_sell: 0, f_buy: 0, f_sell: 0, h_buy: 0, h_sell: 0, q_buy: 0, q_sell: 0 };
let itemStatuses = { g_buy: 1, g_sell: 1, m_buy: 1, m_sell: 1, f_buy: 1, f_sell: 1, h_buy: 1, h_sell: 1, q_buy: 1, q_sell: 1 };

let firstMessageReceived = false;  
let firstRealDataReceived = false; 

const priceAudio = new Audio('notification.mp3');

function playChangeSound() {
    try {
        priceAudio.currentTime = 0;
        priceAudio.volume = 0.5; 
        priceAudio.play().catch(err => { console.log("مانع پخش صدا توسط مرورگر:", err); });
    } catch (e) { console.log("خطا در پخش صدا:", e); }
}

function formatAndPersianize(num) {
  if (num === undefined || num === null || num === '---' || String(num).includes('---')) return '---';
  let val = Math.round(parseFloat(num.toString().replace(/,/g, '')));
  if (isNaN(val)) return '---';
  return new Intl.NumberFormat('fa-IR', { useGrouping: true }).format(val);
}

function toPersianDigits(str) {
  const farsi = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, d => farsi[parseInt(d)]);
}

function addSocketLog(text, type = 'info') {
  const container = document.getElementById('socket-log-container');
  if (!container) return;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  const p = document.createElement('p');
  p.className = `log-line ${type}`;
  p.innerText = `[${timeStr}] ${text}`;
  container.appendChild(p);
  container.scrollTop = container.scrollHeight;
}

function updateSocketStateLabel(state, color) {
  const lbl = document.getElementById('socket-state-lbl');
  if (lbl) {
    lbl.innerText = state;
    lbl.style.backgroundColor = color;
  }
}

// ============================================
// Fetch Initial Data from Railway Server
// ============================================
async function fetchInitialData() {
  try {
    addSocketLog(`Fetching initial data from ${SERVER_URL}...`, 'info');
    const response = await fetch(`https://${SERVER_URL}/api/last-data`, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    addSocketLog(`Initial data received`, 'success');
    
    // اعمال وضعیت بازار
    if (data.marketStatus) {
      processMarketStatus(data.marketStatus.goldClosed, data.marketStatus.coinClosed);
    }
    
    // اعمال پکت قیمت
    if (data.pricingPacket) {
      processPricingPacket(data.pricingPacket);
      firstRealDataReceived = true;
      renderCalculatedPrices();
    }
    
    lastUpdateTs = Date.now();
    return true;
  } catch (err) {
    addSocketLog(`Failed to fetch initial data: ${err.message}`, 'error');
    return false;
  }
}

function processMarketStatus(goldClosed, coinClosed) {
  const gOverlay = document.getElementById('gold-status-overlay');
  const mOverlay = document.getElementById('mithqal-status-overlay');
  const cOverlay1 = document.getElementById('coin-status-overlay-1');
  const cOverlay2 = document.getElementById('coin-status-overlay-2');
  const cOverlay3 = document.getElementById('coin-status-overlay-3');
  
  if (gOverlay) gOverlay.style.opacity = goldClosed ? "1" : "0";
  if (mOverlay) mOverlay.style.opacity = goldClosed ? "1" : "0";
  if (cOverlay1) cOverlay1.style.opacity = coinClosed ? "1" : "0";
  if (cOverlay2) cOverlay2.style.opacity = coinClosed ? "1" : "0";
  if (cOverlay3) cOverlay3.style.opacity = coinClosed ? "1" : "0";
}

function processPricingPacket(pricing) {
  const currencies = pricing.currencies || [];
  let priceChanged = false;

  currencies.forEach(item => {
    const title = (item.title || "").replace(/ /g, "");
    let p_sell = (item.sell_price || 0) * 10000;
    let p_buy = (item.buy_price || 0) * 10000;
    if (p_sell === 0 || p_buy === 0) return;

    let b_stat = item.buy_status !== undefined ? item.buy_status : 1;
    let s_stat = item.sell_status !== undefined ? item.sell_status : 1;

    const updateRaw = (keyBuy, keySell, bVal, sVal, currentBuyStatus, currentSellStatus) => {
      let buyRound = Math.ceil(bVal / 1000.0) * 1000;
      let sellRound = Math.floor(sVal / 1000.0) * 1000;
      
      if (rawPrices[keyBuy] !== buyRound || rawPrices[keySell] !== sellRound || 
          itemStatuses[keyBuy] !== currentBuyStatus || itemStatuses[keySell] !== currentSellStatus) {
        rawPrices[keyBuy] = buyRound;
        rawPrices[keySell] = sellRound;
        itemStatuses[keyBuy] = currentBuyStatus;
        itemStatuses[keySell] = currentSellStatus;
        priceChanged = true;
      }
    };

    if ((item.title || "").includes("آبشده نقد") && (item.title || "").includes("24")) {
      updateRaw('g_buy', 'g_sell', p_sell / 4.3318, p_buy / 4.3318, b_stat, s_stat);
      updateRaw('m_buy', 'm_sell', p_sell, p_buy, b_stat, s_stat);
    } else if (title.includes("تمامامامی86")) {
      updateRaw('f_buy', 'f_sell', p_sell, p_buy, b_stat, s_stat);
    } else if (title.includes("نیمسکه86")) {
      updateRaw('h_buy', 'h_sell', p_sell, p_buy, b_stat, s_stat);
    } else if (title.includes("ربعسکه86")) {
      updateRaw('q_buy', 'q_sell', p_sell, p_buy, b_stat, s_stat);
    }
  });

  return priceChanged;
}

function renderCalculatedPrices() {
  const gOverlay = document.getElementById('gold-status-overlay');
  const cOverlay = document.getElementById('coin-status-overlay-1');
  const goldClosed = gOverlay ? gOverlay.style.opacity === "1" : false;
  const coinClosed = cOverlay ? cOverlay.style.opacity === "1" : false;

  const applyCommissionAndRender = (keyBuy, keySell, buyElId, sellElId, commissionBuy, commissionSell, isClosed) => {
    const buyEl = document.getElementById(buyElId);
    const sellEl = document.getElementById(sellElId);
    if (!buyEl || !sellEl) return;

    let buyPrice = rawPrices[keyBuy];
    let sellPrice = rawPrices[keySell];
    let buyStatus = itemStatuses[keyBuy];
    let sellStatus = itemStatuses[keySell];

    if (buyPrice > 0 && buyStatus === 1 && !isClosed) {
      buyEl.innerText = toPersianDigits(formatAndPersianize(buyPrice + commissionBuy));
      buyEl.style.opacity = "1";
    } else {
      buyEl.innerText = "---";
      buyEl.style.opacity = "0.4";
    }

    if (sellPrice > 0 && sellStatus === 1 && !isClosed) {
      sellEl.innerText = toPersianDigits(formatAndPersianize(sellPrice + commissionSell));
      sellEl.style.opacity = "1";
    } else {
      sellEl.innerText = "---";
      sellEl.style.opacity = "0.4";
    }
  };

  applyCommissionAndRender('g_buy', 'g_sell', 'gold_buy', 'gold_sell', commissions.g_buy, commissions.g_sell, goldClosed);
  applyCommissionAndRender('m_buy', 'm_sell', 'mithqal_buy', 'mithqal_sell', commissions.m_buy, commissions.m_sell, goldClosed);
  applyCommissionAndRender('f_buy', 'f_sell', 'full_buy', 'full_sell', commissions.f_buy, commissions.f_sell, coinClosed);
  applyCommissionAndRender('h_buy', 'h_sell', 'half_buy', 'half_sell', commissions.h_buy, commissions.h_sell, coinClosed);
  applyCommissionAndRender('q_buy', 'q_sell', 'quarter_buy', 'quarter_sell', commissions.q_buy, commissions.q_sell, coinClosed);
}

function calculatePassedTime() {
  if (lastUpdateTs === 0) return;
  const passed = Math.floor((Date.now() - lastUpdateTs) / 1000);
  const m = Math.floor(passed / 60);
  const s = passed % 60;
  const timerEl = document.getElementById('timer-status-text');
  if (timerEl) {
    timerEl.innerText = m > 0 ? `${m} دقیقه و ${s} ثانیه پیش` : `${s} ثانیه پیش`;
  }
}

setInterval(async () => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    serverConnected = false;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#ff4757';
  }

  try {
    const response = await fetch('index.html', { cache: 'no-store', method: 'HEAD' });
    githubConnected = response.ok;
  } catch (e) {
    githubConnected = false;
  }

  const ghDot = document.getElementById('github-dot');
  if (ghDot) {
    ghDot.style.backgroundColor = githubConnected ? '#2ed573' : '#ff4757';
    ghDot.style.boxShadow = githubConnected ? '0 0 14px #2ed573' : '0 0 14px #ff4757';
  }

  const gOverlay = document.getElementById('gold-status-overlay');
  const cOverlay = document.getElementById('coin-status-overlay-1');
  renderCalculatedPrices(
    gOverlay ? gOverlay.style.opacity === "1" : false,
    cOverlay ? cOverlay.style.opacity === "1" : false
  );
  calculatePassedTime();
}, 5000); 

function connectPusherSocket() {
  if (pingInterval) {
    clearTimeout(pingInterval);
    pingInterval = null;
  }
  if (socket) {
    socket.onopen = null;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onerror = null;
    try { socket.close(); } catch(e) {}
    socket = null;
  }

  updateSocketStateLabel("CONNECTING", "#f1c40f");
  addSocketLog("Attempting to connect to Pusher WebSocket server...", "info");

  socket = new WebSocket("wss://pusher.goldab.ir:443/app/app-key?protocol=7&client=js&version=8.4.0&flash=false");

  socket.onopen = () => {
    serverConnected = true;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#2ed573';
    
    updateSocketStateLabel("CONNECTED", "#2ed573");
    addSocketLog("WebSocket Connection Established successfully.", "success");

    socket.send(JSON.stringify({"event": "pusher:subscribe", "data": {"auth": "", "channel": "deniz"}}));
    addSocketLog("Sent: pusher:subscribe to channel 'deniz'", "info");
    
    const setupFixedPing = () => {
      const fixedDelay = 30000;
      pingInterval = setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({"event": "pusher:ping", "data": {}}));
          addSocketLog("Sent: pusher:ping (Heartbeat packet)", "info");
          setupFixedPing();
        }
      }, fixedDelay);
    };
    setupFixedPing();
  };

  socket.onerror = (error) => {
    addSocketLog(`WebSocket Error occurred. Network or SSL issue suspected.`, "error");
  };

  socket.onclose = (event) => {
    serverConnected = false;
    const sDot = document.getElementById('server-dot');
    if (sDot) sDot.style.backgroundColor = '#ff4757';
    if (pingInterval) clearTimeout(pingInterval);
    
    updateSocketStateLabel("CLOSED", "#ff4757");
    
    let reason = `Code: ${event.code}. `;
    if (event.code === 1006) {
      reason += "Abnormal Closure (Server dropped connection, network lost, or ping timeout).";
    } else if (event.code === 1000) {
      reason += "Normal Closure.";
    } else if (event.code === 1001) {
      reason += "Going Away (Server is shutting down or client navigated away).";
    } else {
      reason += event.reason || "Unknown reason.";
    }
    
    addSocketLog(`Socket Connection Disconnected! Reason: ${reason}`, "warning");
    addSocketLog("Scheduling reconnection in 3000ms...", "info");
    
    setTimeout(connectPusherSocket, 3000);
  };

  socket.onmessage = (event) => {
    window.lastIncomingEvent = event;
    const packet = JSON.parse(event.data);
    
    if (packet.event === "pusher:pong") {
      addSocketLog("Received: pusher:pong (Heartbeat response acknowledged)", "success");
    }

    if (!firstMessageReceived) {
      firstMessageReceived = true;
      const shutter = document.getElementById('first-load-shutter');
      if (shutter) {
        shutter.style.opacity = '0';
        setTimeout(() => shutter.remove(), 600);
      }
    }

    if (packet.event === "app" || packet.event === "new-panel") {
      const payload = JSON.parse(packet.data || "{}");
      const msg = payload.message || {};
      const p_type = msg.type;

      if (p_type === "homepage_data_updated") {
        addSocketLog(`Received Event: homepage_data_updated`, "info");
        const inner = msg.data || {};
        const goldClosed = inner.molten_trade_status !== 1;
        const coinClosed = inner.coin_trade_status !== 1;
        processMarketStatus(goldClosed, coinClosed);
      }

      if (p_type === "all_systems_pricing_updated") {
        addSocketLog(`Received Event: all_systems_pricing_updated (New pricing payload)`, "success");
        const pricing = msg.data?.pricing || [];
        if (pricing.length > 0) {
          const priceChanged = processPricingPacket(pricing[0]);
          if (priceChanged || !firstRealDataReceived) {
            firstRealDataReceived = true;
            renderCalculatedPrices();
            lastUpdateTs = Date.now();
            if (priceChanged) playChangeSound();
          }
        }
      }
    }
  };
}

// ============================================
// Initialize: Fetch initial data, then connect WebSocket
// ============================================
async function init() {
  await fetchInitialData();
  connectPusherSocket();
}

document.addEventListener('DOMContentLoaded', init);