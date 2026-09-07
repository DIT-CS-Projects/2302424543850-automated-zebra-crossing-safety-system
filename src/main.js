// ============================================================
// CONFIGURATION – change these to match your setup
// ============================================================
const FLASK_BASE_URL = '';  // empty or just remove
await fetch('/api/status');  // relative path
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '123456789';

// ============================================================
// STATE
// ============================================================
const state = {
  trafficLight: 'red',         // 'red' | 'yellow' | 'green' | 'off'
  vehicleDetected: false,
  vehicleStopped: false,
  bumpStatus: 'lowered',       // 'raised' | 'lowered'
  pedestrianCrossing: 'not_allowed',
  systemOnline: true,
  systemHealth: 'operational',
  events: [],
  eventId: 0,
  distance: 0,
  speed: 0,
  mode: 'AUTO',
};

// ============================================================
// DOM REFS
// ============================================================
const $ = (id) => document.getElementById(id);

const el = {
  // Auth
  authOverlay: $('authOverlay'),
  loginForm: $('loginForm'),
  registerForm: $('registerForm'),
  loginUsername: $('loginUsername'),
  loginPassword: $('loginPassword'),
  registerUsername: $('registerUsername'),
  registerEmail: $('registerEmail'),
  registerPassword: $('registerPassword'),
  loginBtn: $('loginBtn'),
  registerBtn: $('registerBtn'),
  showRegisterLink: $('showRegisterLink'),
  showLoginLink: $('showLoginLink'),
  loginError: $('loginError'),
  registerError: $('registerError'),
  logoutBtn: $('logoutBtn'),
  dashboardPage: $('app'),

  // Dashboard
  clockDisplay: $('clockDisplay'),
  systemDot: $('systemDot'),
  systemStatusLabel: $('systemStatusLabel'),
  lastUpdateLabel: $('lastUpdateLabel'),
  vehicleDetectedValue: $('vehicleDetectedValue'),
  vehicleDetectedBadge: $('vehicleDetectedBadge'),
  cardVehicleDetected: $('cardVehicleDetected'),
  vehicleStoppedValue: $('vehicleStoppedValue'),
  vehicleStoppedBadge: $('vehicleStoppedBadge'),
  cardVehicleStopped: $('cardVehicleStopped'),
  bumpStatusValue: $('bumpStatusValue'),
  bumpStatusBadge: $('bumpStatusBadge'),
  cardBump: $('cardBump'),
  systemHealthValue: $('systemHealthValue'),
  systemHealthBadge: $('systemHealthBadge'),
  cardSystem: $('cardSystem'),
  tlRed: $('tlRed'),
  tlYellow: $('tlYellow'),
  tlGreen: $('tlGreen'),
  tlStatusText: $('tlStatusText'),
  pedIcon: $('pedIcon'),
  pedText: $('pedText'),
  pedBadge: $('pedBadge'),
  distanceValue: $('distanceValue'),
  speedValue: $('speedValue'),
  modeValue: $('modeValue'),

  // Admin buttons
  btnSetManual: $('btnSetManual'),
  btnSetAuto: $('btnSetAuto'),
  btnToggleLight: $('btnToggleLight'),
  btnToggleBump: $('btnToggleBump'),
  btnStopBump: $('btnStopBump'),
  btnResetSystem: $('btnResetSystem'),
  toggleLightLabel: $('toggleLightLabel'),
  toggleBumpLabel: $('toggleBumpLabel'),

  eventLog: $('eventLog'),
  eventCount: $('eventCount'),
  eventLogContainer: $('eventLogContainer'),
};

// ============================================================
// AUTH LOGIC (simulated with localStorage)
// ============================================================
const AUTH_KEY = 'gutawire_user';

function getUsers() {
  return JSON.parse(localStorage.getItem('gutawire_users') || '{}');
}
function saveUsers(users) {
  localStorage.setItem('gutawire_users', JSON.stringify(users));
}
function getLoggedInUser() {
  return localStorage.getItem(AUTH_KEY);
}
function setLoggedInUser(username) {
  localStorage.setItem(AUTH_KEY, username);
}
function clearLoggedInUser() {
  localStorage.removeItem(AUTH_KEY);
}

function showAuthError(formId, msg) {
  const errEl = formId === 'login' ? el.loginError : el.registerError;
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
  setTimeout(() => errEl.classList.add('hidden'), 4000);
}

function toggleForm(showLogin) {
  el.loginForm.classList.toggle('active', showLogin);
  el.registerForm.classList.toggle('active', !showLogin);
  el.loginError.classList.add('hidden');
  el.registerError.classList.add('hidden');
}

// --- Login ---
el.loginBtn.addEventListener('click', () => {
  const username = el.loginUsername.value.trim();
  const password = el.loginPassword.value.trim();
  if (!username || !password) {
    showAuthError('login', 'Please fill in all fields.');
    return;
  }
  const users = getUsers();
  if (users[username] && users[username].password === password) {
    setLoggedInUser(username);
    enterDashboard();
  } else {
    showAuthError('login', 'Invalid username or password.');
  }
});

// --- Register ---
el.registerBtn.addEventListener('click', () => {
  const username = el.registerUsername.value.trim();
  const email = el.registerEmail.value.trim();
  const password = el.registerPassword.value.trim();
  if (!username || password.length < 6) {
    showAuthError('register', 'Username required, password min 6 chars.');
    return;
  }
  const users = getUsers();
  if (users[username]) {
    showAuthError('register', 'Username already exists.');
    return;
  }
  users[username] = { password, email };
  saveUsers(users);
  setLoggedInUser(username);
  enterDashboard();
});

// --- Switch forms ---
el.showRegisterLink.addEventListener('click', () => toggleForm(false));
el.showLoginLink.addEventListener('click', () => toggleForm(true));

// --- Logout ---
el.logoutBtn.addEventListener('click', () => {
  clearLoggedInUser();
  el.dashboardPage.style.display = 'none';
  el.authOverlay.style.display = 'flex';
  toggleForm(true);
  el.loginUsername.value = '';
  el.loginPassword.value = '';
});

// --- Enter Dashboard ---
function enterDashboard() {
  el.authOverlay.style.display = 'none';
  el.dashboardPage.style.display = 'block';
  if (!window._pollingStarted) {
    window._pollingStarted = true;
    startPolling();
  }
  // Add startup event
  addEvent('⏳ System initializing. Waiting for heartbeat from ESP32...', 'info');
  addEvent(`👤 User "${getLoggedInUser()}" logged in`, 'success');
}

// ============================================================
// CHECK SESSION ON LOAD
// ============================================================
if (getLoggedInUser()) {
  enterDashboard();
} else {
  el.authOverlay.style.display = 'flex';
  toggleForm(true);
}

// ============================================================
// HELPERS
// ============================================================
function formatTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}
function now() { return Date.now(); }
function getTimestamp() { return formatTime(now()); }

// ============================================================
// EVENT LOG
// ============================================================
function addEvent(message, type = 'info') {
  const id = ++state.eventId;
  const ts = now();
  const entry = { id, ts, message, type };
  state.events.push(entry);
  renderEventLog();
  setTimeout(() => {
    if (el.eventLogContainer) {
      el.eventLogContainer.scrollTop = el.eventLogContainer.scrollHeight;
    }
  }, 50);
  return entry;
}

function renderEventLog() {
  const container = el.eventLog;
  const count = state.events.length;
  el.eventCount.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  if (count === 0) {
    container.innerHTML = `<div class="event-empty"><i class="fas fa-inbox" style="font-size:20px;display:block;margin-bottom:8px;opacity:0.4;"></i>No events yet.</div>`;
    return;
  }
  const items = state.events.slice(-50).reverse();
  let html = '';
  for (const e of items) {
    const time = formatTime(e.ts);
    let icon = 'fa-circle-info';
    if (e.type === 'warning') icon = 'fa-triangle-exclamation';
    else if (e.type === 'danger') icon = 'fa-circle-exclamation';
    else if (e.type === 'success') icon = 'fa-circle-check';
    html += `
      <div class="event-entry type-${e.type} fade-in">
        <span class="event-time">${time}</span>
        <span class="event-icon"><i class="fas ${icon}"></i></span>
        <span class="event-msg">${e.message}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

// ============================================================
// UI UPDATE FUNCTIONS
// ============================================================
function updateClock() {
  el.clockDisplay.textContent = new Date().toTimeString().slice(0, 8);
}
function updateLastUpdate() {
  el.lastUpdateLabel.textContent = `Last update: ${getTimestamp()}`;
}

function updateTrafficLight() {
  const status = state.trafficLight;
  el.tlRed.classList.remove('active-red', 'active-yellow', 'active-green');
  el.tlYellow.classList.remove('active-red', 'active-yellow', 'active-green');
  el.tlGreen.classList.remove('active-red', 'active-yellow', 'active-green');
  el.tlStatusText.classList.remove('red', 'yellow', 'green');
  if (status === 'off') {
    el.tlStatusText.textContent = 'OFF';
    el.tlStatusText.style.color = 'var(--text-muted)';
    return;
  }
  if (status === 'red') {
    el.tlRed.classList.add('active-red');
    el.tlStatusText.textContent = 'RED';
    el.tlStatusText.classList.add('red');
  } else if (status === 'yellow') {
    el.tlYellow.classList.add('active-yellow');
    el.tlStatusText.textContent = 'YELLOW';
    el.tlStatusText.classList.add('yellow');
  } else if (status === 'green') {
    el.tlGreen.classList.add('active-green');
    el.tlStatusText.textContent = 'GREEN';
    el.tlStatusText.classList.add('green');
  }
  el.tlStatusText.style.color = '';
}

function updateVehicleDetected() {
  const val = state.vehicleDetected;
  el.vehicleDetectedValue.textContent = val ? 'Yes' : 'No';
  el.vehicleDetectedBadge.textContent = val ? '✓' : '✗';
  el.vehicleDetectedBadge.className = 'badge ' + (val ? 'badge-green' : 'badge-gray');
  el.cardVehicleDetected.style.borderColor = val ? 'rgba(34,197,94,0.3)' : 'var(--border-color)';
}

function updateVehicleStopped() {
  const val = state.vehicleStopped;
  el.vehicleStoppedValue.textContent = val ? 'Yes' : 'No';
  el.vehicleStoppedBadge.textContent = val ? '✓' : '✗';
  el.vehicleStoppedBadge.className = 'badge ' + (val ? 'badge-green' : 'badge-gray');
  el.cardVehicleStopped.style.borderColor = val ? 'rgba(34,197,94,0.3)' : 'var(--border-color)';
}

function updateBump() {
  const val = state.bumpStatus;
  const isRaised = val === 'raised';
  el.bumpStatusValue.textContent = isRaised ? 'Raised ↑' : 'Lowered ↓';
  el.bumpStatusBadge.textContent = isRaised ? '⬆' : '⬇';
  el.bumpStatusBadge.className = 'badge ' + (isRaised ? 'badge-warning' : 'badge-blue');
  el.cardBump.style.borderColor = isRaised ? 'rgba(245,158,11,0.3)' : 'rgba(74,124,247,0.3)';

  // Update toggle button label
  if (el.toggleBumpLabel) {
    el.toggleBumpLabel.textContent = isRaised ? 'Lower Bump' : 'Raise Bump';
  }
}

function updatePedestrian() {
  const val = state.pedestrianCrossing;
  const allowed = val === 'allowed';
  el.pedText.textContent = allowed ? 'Allowed' : 'Not Allowed';
  el.pedText.className = 'ped-text ' + (allowed ? 'allowed' : 'not-allowed');
  el.pedIcon.className = 'ped-icon ' + (allowed ? 'allowed' : 'not-allowed');
  el.pedIcon.innerHTML = allowed ?
    '<i class="fas fa-person-walking"></i>' :
    '<i class="fas fa-person-walking" style="opacity:0.4;"></i>';
  el.pedBadge.textContent = allowed ? '✓' : '✗';
  el.pedBadge.className = 'badge ' + (allowed ? 'badge-green' : 'badge-red');
}

function updateSystemHealth() {
  const health = state.systemHealth;
  const online = state.systemOnline;
  el.systemDot.className = 'status-dot ' + (online ? 'online' : 'offline');
  el.systemStatusLabel.textContent = online ? 'Online' : 'Offline';
  el.systemStatusLabel.style.color = online ? 'var(--accent-green)' : 'var(--accent-red)';
  if (health === 'operational') {
    el.systemHealthValue.textContent = 'Operational';
    el.systemHealthBadge.textContent = '✓';
    el.systemHealthBadge.className = 'badge badge-green';
    el.cardSystem.style.borderColor = 'rgba(34,197,94,0.3)';
  } else if (health === 'degraded') {
    el.systemHealthValue.textContent = 'Degraded';
    el.systemHealthBadge.textContent = '⚠';
    el.systemHealthBadge.className = 'badge badge-yellow';
    el.cardSystem.style.borderColor = 'rgba(245,158,11,0.3)';
  } else {
    el.systemHealthValue.textContent = 'Offline';
    el.systemHealthBadge.textContent = '✗';
    el.systemHealthBadge.className = 'badge badge-red';
    el.cardSystem.style.borderColor = 'rgba(239,68,68,0.3)';
  }

  // Update traffic light toggle label
  if (el.toggleLightLabel) {
    el.toggleLightLabel.textContent = state.trafficLight === 'off' ? 'Turn On Light' : 'Turn Off Light';
  }
}

function updateTelemetry() {
  el.distanceValue.textContent = state.distance.toFixed(1);
  el.speedValue.textContent = state.speed.toFixed(1);
  el.modeValue.textContent = state.mode;
  el.modeValue.style.color = state.mode === 'MANUAL' ? 'var(--accent-amber)' : 'var(--accent-cyan)';
}

function fullUpdate() {
  updateClock();
  updateLastUpdate();
  updateTrafficLight();
  updateVehicleDetected();
  updateVehicleStopped();
  updateBump();
  updatePedestrian();
  updateSystemHealth();
  updateTelemetry();
}

// ============================================================
// APPLY DATA FROM ESP32
// ============================================================
function applyData(data) {
  const changes = [];

  // 1. Traffic Light
  let newLight = 'off';
  if (data.phase === 'GREEN') newLight = 'green';
  else if (data.phase === 'YELLOW') newLight = 'yellow';
  else if (data.phase === 'RED') newLight = 'red';
  if (newLight !== state.trafficLight) {
    changes.push(`Traffic light → ${newLight.toUpperCase()}`);
    state.trafficLight = newLight;
  }

  // 2. Vehicle Detected
  const detected = data.vehicleMetalConfirmed === true || data.metalDetectedNow === true;
  if (detected !== state.vehicleDetected) {
    changes.push(`Vehicle ${detected ? 'detected' : 'not detected'}`);
    state.vehicleDetected = detected;
  }

  // 3. Vehicle Stopped (speed < 0.5 km/h)
  const stopped = detected && (data.speedKmh || 0) < 0.5;
  if (stopped !== state.vehicleStopped) {
    changes.push(`Vehicle ${stopped ? 'stopped' : 'moving'}`);
    state.vehicleStopped = stopped;
  }

  // 4. Bump Status
  let bump = 'lowered';
  if (data.bumper === 'UP' || data.bumper === 'RAISING') bump = 'raised';
  else if (data.bumper === 'DOWN' || data.bumper === 'LOWERING') bump = 'lowered';
  if (bump !== state.bumpStatus) {
    changes.push(`Bump ${bump === 'raised' ? '↑ Raised' : '↓ Lowered'}`);
    state.bumpStatus = bump;
  }

  // 5. Pedestrian Crossing
  let ped = 'not_allowed';
  if (data.pedestrianLight === 'GREEN') ped = 'allowed';
  if (ped !== state.pedestrianCrossing) {
    changes.push(`Pedestrian ${ped === 'allowed' ? 'ALLOWED' : 'BLOCKED'}`);
    state.pedestrianCrossing = ped;
  }

  // 6. Telemetry
  state.distance = data.distance || 0;
  state.speed = data.speedKmh || 0;
  state.mode = data.mode || 'AUTO';

  // 7. System Health
  if (data.success === false && data.message) {
    // This happens when Flask says "No ESP32 IP learned"
    if (state.systemOnline) {
      state.systemOnline = false;
      state.systemHealth = 'degraded';
      changes.push(`⚠️ System degraded: ${data.message}`);
    }
  } else if (data.mode !== undefined) {
    // Valid data received – ensure we are online
    if (!state.systemOnline) {
      state.systemOnline = true;
      state.systemHealth = 'operational';
      changes.push('✅ System reconnected and online');
    }
  }

  // Log changes
  for (const msg of changes) {
    let type = 'info';
    if (msg.includes('BLOCKED') || msg.includes('offline') || msg.includes('degraded')) type = 'danger';
    else if (msg.includes('ALLOWED') || msg.includes('online') || msg.includes('↑') || msg.includes('✅')) type = 'success';
    else if (msg.includes('⚠️')) type = 'warning';
    addEvent(msg, type);
  }
  fullUpdate();
  // Quick test: force‑update the "Vehicle Detected" text
  document.getElementById('vehicleDetectedValue').textContent = state.vehicleDetected ? 'Yes' : 'No';
}

// ============================================================
// FETCH FROM FLASK PROXY (with spam prevention)
// ============================================================
let fetchCounter = 0;
let requestBusy = false;
let wasOffline = false; // Prevents logging "Lost connection" every 2 seconds

async function fetchStatus() {
  if (requestBusy) return;
  requestBusy = true;
  try {
    const response = await fetch(`${FLASK_BASE_URL}/api/status`, {
      headers: { 'X-API-Key': API_TOKEN, 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    // Success: reset offline flag
    if (wasOffline) {
      wasOffline = false;
    }
    applyData(data);

    fetchCounter++;
    if (fetchCounter % 10 === 0) {
      addEvent(`Heartbeat — ${state.mode} | ${state.trafficLight.toUpperCase()}`, 'info');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    // Only log the offline event once
    if (!wasOffline && state.systemOnline) {
      wasOffline = true;
      state.systemOnline = false;
      state.systemHealth = 'offline';
      addEvent('⚠️ Lost connection to system (Flask or ESP32 unreachable)', 'danger');
      fullUpdate();
    } else if (!wasOffline && !state.systemOnline) {
      // If already offline, just update UI without spamming log
      fullUpdate();
    }
  } finally {
    requestBusy = false;
  }
}

// ============================================================
// SEND COMMAND
// ============================================================
async function sendCommand(command, customSuccessMsg = null) {
  try {
    const response = await fetch(`${FLASK_BASE_URL}/api/control`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_TOKEN,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ command })
    });
    const data = await response.json();
    if (data.success) {
      addEvent(customSuccessMsg || `✅ "${command}" executed`, 'success');
      await fetchStatus();
    } else {
      addEvent(`⚠️ "${command}" failed: ${data.message || 'unknown'}`, 'warning');
    }
  } catch (error) {
    addEvent(`❌ "${command}" network error`, 'danger');
  }
}

// ============================================================
// ADMIN BUTTONS (with toggles)
// ============================================================

// 1. Toggle Traffic Light
el.btnToggleLight.addEventListener('click', () => {
  if (state.trafficLight === 'off') {
    sendCommand('traffic_red', '🔴 Traffic light turned ON (Red)');
  } else {
    sendCommand('traffic_off', '💡 Traffic light turned OFF');
  }
});

// 2. Toggle Bump (Raise / Lower)
el.btnToggleBump.addEventListener('click', () => {
  if (state.bumpStatus === 'raised' || state.bumpStatus === 'RAISING') {
    sendCommand('bumper_down', '⬇ Bump lowered');
  } else {
    sendCommand('bumper_up', '⬆ Bump raised');
  }
});

// 3. Stop Bump Motor (Emergency)
el.btnStopBump.addEventListener('click', () => {
  sendCommand('bumper_stop', '🛑 Bump motor stopped (emergency)');
});

// 4. Reset Cycle
el.btnResetSystem.addEventListener('click', () => {
  sendCommand('restart_cycle', '🔄 Traffic cycle restarted');
});

// 5. Manual Mode
el.btnSetManual.addEventListener('click', () => sendCommand('manual', '🖐️ Switched to MANUAL mode'));

// 6. Auto Mode
el.btnSetAuto.addEventListener('click', () => sendCommand('auto', '🤖 Switched to AUTO mode'));

// ============================================================
// POLLING (starts after login)
// ============================================================
function startPolling() {
  updateClock();
  setInterval(updateClock, 1000);

  // Initial fetch
  fetchStatus().then(() => {
    // If still offline after first fetch, the event log already shows the waiting message
    if (!state.systemOnline) {
      addEvent('⏳ Still waiting for ESP32 heartbeat... Ensure Flask is running and ESP32 is configured.', 'info');
    }
  });

  // Poll every 2 seconds
  setInterval(fetchStatus, 2000);
}