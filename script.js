// ===========================
// Pulse — script.js
// Real-time UI | Task 6
// Features:
//  - WebSocket connection (real ws://echo.websocket.events)
//  - Simulated live event feed (auto-refresh without reload)
//  - Live notification panel
//  - Filter tabs, auto-scroll, uptime counter
// ===========================

document.addEventListener('DOMContentLoaded', () => {

  // ──────────────────────────
  // STATE
  // ──────────────────────────
  let ws              = null;
  let isPaused        = false;
  let autoScroll      = true;
  let currentFilter   = 'all';
  let totalReceived   = 0;
  let unreadCount     = 0;
  let startTime       = Date.now();
  let eventCounts     = { alert: 0, success: 0, info: 0, warning: 0 };
  let eventsThisMin   = 0;
  let allEvents       = [];       // full log for filter re-render
  let allNotifs       = [];
  let refreshInterval = 8000;    // ms between auto-data-refresh cycles
  let refreshTimer    = null;
  let refreshProgress = 0;

  // DOM refs
  const feed          = document.getElementById('feed');
  const feedEmpty     = document.getElementById('feedEmpty');
  const notifList     = document.getElementById('notifList');
  const notifEmpty    = document.getElementById('notifEmpty');
  const notifBadge    = document.getElementById('notifBadge');
  const statusDot     = document.getElementById('statusDot');
  const statusText    = document.getElementById('statusText');
  const pauseBtn      = document.getElementById('pauseBtn');
  const clearBtn      = document.getElementById('clearBtn');
  const markAllRead   = document.getElementById('markAllRead');
  const consoleLog    = document.getElementById('consoleLog');
  const consoleInput  = document.getElementById('consoleInput');
  const consoleSend   = document.getElementById('consoleSend');
  const clearConsole  = document.getElementById('clearConsole');
  const refreshFill   = document.getElementById('refreshFill');
  const autoScrollTgl = document.getElementById('autoScrollToggle');


  // ──────────────────────────
  // WEBSOCKET CONNECTION
  // Uses a free public echo server.
  // Falls back to simulation if blocked.
  // ──────────────────────────
  const WS_URL = 'wss://echo.websocket.events';

  function connectWS() {
    setStatus('connecting');
    logConsole('sys', `Connecting to ${WS_URL}…`);

    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      setStatus('disconnected');
      logConsole('err', 'WebSocket not supported. Running in simulation mode.');
      startSimulation();
      return;
    }

    const connTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        logConsole('sys', 'Connection timed out. Running in simulation mode.');
        ws.close();
        startSimulation();
      }
    }, 4000);

    ws.onopen = () => {
      clearTimeout(connTimeout);
      setStatus('connected');
      logConsole('sys', `Connected to ${WS_URL}`);
      ws.send(JSON.stringify({ type: 'hello', client: 'Pulse UI' }));
      startSimulation(); // drive events locally even with WS open
    };

    ws.onmessage = (e) => {
      logConsole('recv', truncate(e.data, 80));
      updateLastPing();
    };

    ws.onerror = () => {
      clearTimeout(connTimeout);
      logConsole('err', 'WebSocket error. Falling back to simulation.');
      setStatus('disconnected');
      startSimulation();
    };

    ws.onclose = () => {
      clearTimeout(connTimeout);
      if (statusDot.classList.contains('connected')) {
        setStatus('disconnected');
        logConsole('sys', 'Connection closed. Reconnecting in 5s…');
        setTimeout(connectWS, 5000);
      }
    };
  }


  // ──────────────────────────
  // STATUS
  // ──────────────────────────
  function setStatus(state) {
    statusDot.className  = 'status-dot ' + state;
    const labels = {
      connected:    '● Connected',
      disconnected: '○ Disconnected',
      connecting:   '◌ Connecting…',
    };
    statusText.textContent = labels[state] || state;
  }


  // ──────────────────────────
  // CONSOLE LOG
  // ──────────────────────────
  function logConsole(type, text) {
    const prefix = { sent: '↑', recv: '↓', sys: '·', err: '✕' };
    const line   = document.createElement('span');
    line.className   = `console-line console-line--${type}`;
    line.textContent = `${timestamp()}  ${prefix[type] || '·'} ${text}`;
    consoleLog.appendChild(line);
    consoleLog.scrollTop = consoleLog.scrollHeight;

    // Keep max 80 lines
    while (consoleLog.children.length > 80) {
      consoleLog.removeChild(consoleLog.firstChild);
    }
  }


  // ──────────────────────────
  // SIMULATION ENGINE
  // Generates realistic fake events every 1.5–4s
  // Auto-refresh: fetches a new "batch" every N seconds
  // ──────────────────────────
  let simRunning = false;
  let simTimeout = null;

  function startSimulation() {
    if (simRunning) return;
    simRunning = true;
    scheduleNextEvent();
    startAutoRefresh();
  }

  function scheduleNextEvent() {
    if (!simRunning) return;
    const delay = isPaused ? 1000 : randomBetween(1200, 3800);
    simTimeout = setTimeout(() => {
      if (!isPaused) generateEvent();
      scheduleNextEvent();
    }, delay);
  }

  // Event templates
  const eventTemplates = [
    { type: 'alert',   icon: '✕', title: 'CPU Spike Detected',       messages: ['CPU usage exceeded 90% on server-01', 'Core 3 at 98% for 30 seconds', 'Memory pressure critical on node-7'] },
    { type: 'alert',   icon: '✕', title: 'Payment Failed',           messages: ['Transaction #TX-8821 declined', 'Card verification failed for user #4401', 'Gateway timeout on order #9923'] },
    { type: 'alert',   icon: '✕', title: 'Service Unreachable',      messages: ['Health check failed for api-gateway', 'Timeout on /api/v2/users endpoint', 'Database connection refused on replica-2'] },
    { type: 'success', icon: '✓', title: 'Deployment Complete',      messages: ['v2.4.1 deployed to production', 'Build #482 passed all tests', 'Rollout finished — 0 errors'] },
    { type: 'success', icon: '✓', title: 'Payment Processed',        messages: ['$299 received from user #3309', 'Subscription renewed for team Nexe-Agent', 'Invoice #INV-0041 marked as paid'] },
    { type: 'success', icon: '✓', title: 'New User Registered',      messages: ['sana_dev joined the platform', 'Verification email sent to user #7721', 'Onboarding flow completed by user #8820'] },
    { type: 'success', icon: '✓', title: 'Backup Completed',         messages: ['Daily snapshot saved to S3 — 2.3 GB', 'Database backup verified successfully', 'Offsite sync complete at 03:00 UTC'] },
    { type: 'info',    icon: '◎', title: 'Config Updated',           messages: ['Feature flag dark_mode set to true', 'Rate limit threshold updated to 1000/hr', 'Cache TTL changed to 3600s'] },
    { type: 'info',    icon: '◎', title: 'Scheduled Job Started',    messages: ['Nightly report generation started', 'Cleanup job running on expired sessions', 'Analytics aggregation job queued'] },
    { type: 'info',    icon: '◎', title: 'API Request Received',     messages: ['POST /api/auth/login from 192.168.1.4', 'GET /api/v2/projects — 200 OK in 34ms', 'Webhook received from github.com'] },
    { type: 'warning', icon: '⚠', title: 'High Memory Usage',        messages: ['RAM at 78% on worker-node-3', 'Heap size growing on service auth-api', 'GC pressure detected — consider scaling'] },
    { type: 'warning', icon: '⚠', title: 'Rate Limit Approaching',   messages: ['IP 203.0.113.42 at 85% of quota', 'API key nx-prod-002 nearing limit', '950 of 1000 requests used this hour'] },
    { type: 'warning', icon: '⚠', title: 'Certificate Expiring',    messages: ['TLS cert for api.nexe.io expires in 7d', 'SSL renewal required for cdn.app.io', 'Let\'s Encrypt cert due for rotation'] },
  ];

  const sources = ['server-01', 'api-gw', 'worker-3', 'db-primary', 'cdn-edge', 'auth-svc', 'queue-proc'];

  function generateEvent() {
    const tmpl   = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
    const msg    = tmpl.messages[Math.floor(Math.random() * tmpl.messages.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const event  = {
      id:     Date.now() + Math.random(),
      type:   tmpl.type,
      icon:   tmpl.icon,
      title:  tmpl.title,
      msg,
      source,
      time:   timestamp(),
      ts:     Date.now(),
    };

    totalReceived++;
    eventsThisMin++;
    eventCounts[event.type]++;
    allEvents.push(event);

    // Keep max 200 events in memory
    if (allEvents.length > 200) allEvents.shift();

    updateCounters();
    updateTabCounts();
    renderEventToFeed(event);

    // Push alerts + important to notification panel
    if (event.type === 'alert' || (event.type === 'warning' && Math.random() > 0.4)) {
      addNotification(event);
    }

    // Log to console
    logConsole('recv', `[${event.type.toUpperCase()}] ${event.title} — ${event.source}`);
    updateLastPing();

    // Flash stat
    flashStat('totalReceived');
  }

  function renderEventToFeed(event, prepend = false) {
    if (currentFilter !== 'all' && event.type !== currentFilter) return;

    // Remove empty state
    if (feedEmpty && feedEmpty.parentNode) feedEmpty.remove();

    const el = document.createElement('div');
    el.className = `feed-event feed-event--${event.type}`;
    el.dataset.type = event.type;
    el.innerHTML = `
      <div class="feed-event__icon icon--${event.type}">${event.icon}</div>
      <div class="feed-event__body">
        <div class="feed-event__title">${escHtml(event.title)}</div>
        <div class="feed-event__msg">${escHtml(event.msg)}</div>
      </div>
      <div class="feed-event__meta">
        <span class="feed-event__time">${event.time}</span>
        <span class="feed-event__source">${escHtml(event.source)}</span>
      </div>
    `;

    if (prepend) {
      feed.insertBefore(el, feed.firstChild);
    } else {
      feed.appendChild(el);
    }

    // Auto-scroll
    if (autoScroll && !prepend) {
      feed.scrollTop = feed.scrollHeight;
    }

    // Keep DOM lean
    const maxDomEvents = 80;
    const domEvents = feed.querySelectorAll('.feed-event');
    if (domEvents.length > maxDomEvents) {
      domEvents[0].remove();
    }
  }


  // ──────────────────────────
  // AUTO-REFRESH (without reload)
  // Simulates periodic "data refresh" — refetches a batch of events
  // and updates all stats. No page reload needed.
  // ──────────────────────────
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    animateRefreshBar();
  }

  function animateRefreshBar() {
    let progress = 0;
    const step   = 100 / (refreshInterval / 100);

    const tick = setInterval(() => {
      if (isPaused) return;
      progress += step;
      refreshFill.style.width = Math.min(progress, 100) + '%';

      if (progress >= 100) {
        progress = 0;
        doAutoRefresh();
      }
    }, 100);

    refreshTimer = tick;
  }

  function doAutoRefresh() {
    // Simulate fetching updated data (no reload)
    logConsole('sys', 'Auto-refresh: syncing latest events…');

    // Flash all stats
    ['eventsPerMin', 'totalReceived', 'uptimeVal'].forEach(id => flashStat(id));

    // Generate a small burst of new events
    const burst = randomBetween(2, 5);
    for (let i = 0; i < burst; i++) {
      setTimeout(() => {
        if (!isPaused) generateEvent();
      }, i * 200);
    }

    logConsole('sys', `Auto-refresh complete. ${totalReceived} total events.`);
  }


  // ──────────────────────────
  // NOTIFICATIONS
  // ──────────────────────────
  function addNotification(event) {
    const notif = { ...event, read: false, notifId: Date.now() + Math.random() };
    allNotifs.unshift(notif);
    if (allNotifs.length > 30) allNotifs.pop();

    unreadCount++;
    updateNotifBadge();

    // Remove empty state
    if (notifEmpty && notifEmpty.parentNode) notifEmpty.remove();

    const el = document.createElement('div');
    el.className = `notif-item notif-item--${notif.type}`;
    el.dataset.id = notif.notifId;
    el.innerHTML = `
      <div class="notif-item__dot" style="background:${typeColor(notif.type)}"></div>
      <div class="notif-item__body">
        <div class="notif-item__title">${escHtml(notif.title)}</div>
        <div class="notif-item__msg">${escHtml(notif.msg)}</div>
      </div>
      <span class="notif-item__time">${notif.time}</span>
    `;

    el.addEventListener('click', () => {
      if (!el.classList.contains('read')) {
        el.classList.add('read');
        unreadCount = Math.max(0, unreadCount - 1);
        updateNotifBadge();
      }
    });

    notifList.insertBefore(el, notifList.firstChild);

    // Keep DOM lean
    const items = notifList.querySelectorAll('.notif-item');
    if (items.length > 25) items[items.length - 1].remove();
  }

  function updateNotifBadge() {
    notifBadge.textContent = unreadCount;
    notifBadge.classList.toggle('hidden', unreadCount === 0);
  }

  markAllRead.addEventListener('click', () => {
    notifList.querySelectorAll('.notif-item:not(.read)').forEach(el => el.classList.add('read'));
    unreadCount = 0;
    updateNotifBadge();
  });


  // ──────────────────────────
  // FILTER TABS
  // ──────────────────────────
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      rebuildFeed();
    });
  });

  function rebuildFeed() {
    feed.innerHTML = '';
    const filtered = currentFilter === 'all'
      ? allEvents
      : allEvents.filter(e => e.type === currentFilter);

    if (filtered.length === 0) {
      feed.appendChild(feedEmpty);
      return;
    }

    // Show last 60
    filtered.slice(-60).forEach(e => renderEventToFeed(e));
    if (autoScroll) feed.scrollTop = feed.scrollHeight;
  }

  function updateTabCounts() {
    Object.keys(eventCounts).forEach(type => {
      const el = document.getElementById(`count-${type}`);
      if (el) el.textContent = eventCounts[type];
    });
  }


  // ──────────────────────────
  // PAUSE / RESUME
  // ──────────────────────────
  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
    pauseBtn.classList.toggle('paused', isPaused);
    logConsole('sys', isPaused ? 'Feed paused.' : 'Feed resumed.');
  });


  // ──────────────────────────
  // CLEAR ALL
  // ──────────────────────────
  clearBtn.addEventListener('click', () => {
    allEvents   = [];
    eventCounts = { alert: 0, success: 0, info: 0, warning: 0 };
    totalReceived = 0;
    feed.innerHTML = '';
    feed.appendChild(feedEmpty);
    updateCounters();
    updateTabCounts();
    logConsole('sys', 'Feed cleared.');
  });


  // ──────────────────────────
  // AUTO-SCROLL TOGGLE
  // ──────────────────────────
  autoScrollTgl.addEventListener('change', () => {
    autoScroll = autoScrollTgl.checked;
  });


  // ──────────────────────────
  // CONSOLE SEND
  // ──────────────────────────
  consoleSend.addEventListener('click', sendConsoleMsg);
  consoleInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendConsoleMsg(); });

  function sendConsoleMsg() {
    const msg = consoleInput.value.trim();
    if (!msg) return;
    logConsole('sent', msg);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    } else {
      // Simulate echo response
      setTimeout(() => logConsole('recv', `[echo] ${msg}`), 120);
    }
    consoleInput.value = '';
  }

  clearConsole.addEventListener('click', () => { consoleLog.innerHTML = ''; });


  // ──────────────────────────
  // UPTIME COUNTER
  // ──────────────────────────
  setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('uptimeVal').textContent = `${m}:${s}`;
  }, 1000);


  // ── Events/min counter ──
  setInterval(() => {
    document.getElementById('eventsPerMin').textContent = eventsThisMin;
    eventsThisMin = 0;
  }, 60000);


  // ──────────────────────────
  // COUNTERS
  // ──────────────────────────
  function updateCounters() {
    document.getElementById('totalReceived').textContent = totalReceived;
  }

  function updateLastPing() {
    document.getElementById('lastPing').textContent = timestamp();
  }

  function flashStat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 600);
  }


  // ──────────────────────────
  // HELPERS
  // ──────────────────────────
  function timestamp() {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function typeColor(type) {
    return { alert: '#ff4d6d', success: '#00e5a0', info: '#4d9fff', warning: '#ffbe0b' }[type] || '#4d9fff';
  }


  // ──────────────────────────
  // KICK OFF
  // ──────────────────────────
  connectWS();

});
