const API = '/api';
const POLL_MS = 10000;
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const PERIODS = ['Morning','Day','Evening','Night'];
const MODES = {0:'Off',1:'Heat',2:'Cool',3:'Auto'};
const STATES = {0:'Idle',1:'Heating',2:'Cooling'};
const FSTATES = {0:'Off',1:'Running'};
const FMODES = {0:'Auto',1:'On',2:'Circulate'};

let data = null, schedCool = null, schedHeat = null, datalog = null, sysInfo = null;
let schedMode = 'cool';
let busy = false; // lock to serialize all thermostat communication

// --- Helpers ---
const $ = id => document.getElementById(id);
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
async function api(path, method='GET', body=null) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
function minsToTime(m) {
  const h = Math.floor(m/60), mm = m%60;
  const ap = h >= 12 ? 'PM' : 'AM';
  return ((h%12)||12) + ':' + String(mm).padStart(2,'0') + ' ' + ap;
}
function minsToInput(m) {
  const h = Math.floor(m/60), mm = m%60;
  return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}
function inputToMins(v) {
  const [h,m] = v.split(':').map(Number);
  return h*60+m;
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.panel).classList.add('active');
    if (tab.dataset.panel === 'panelSchedule') renderSchedule();
    if (tab.dataset.panel === 'panelRuntime') fetchDatalog();
    if (tab.dataset.panel === 'panelSystem') fetchSysInfo();
  });
});

// --- Temperature Ring ---
function setRing(temp) {
  const pct = Math.min(1, Math.max(0, (temp-50)/50));
  const circ = 2*Math.PI*90;
  $('ring').style.strokeDashoffset = circ*(1-pct);
}

// --- Main Poll ---
async function poll() {
  if (busy) return;
  busy = true;
  try {
    data = await api('/tstat');
    $('currentTemp').textContent = data.temp.toFixed(1);
    $('currentTemp').parentElement.classList.remove('loading');
    setRing(data.temp);

    // Setpoint
    const spKey = data.tmode===1?'t_heat':data.tmode===2?'t_cool':null;
    const sp = spKey ? data[spKey] : null;
    $('setpoint').textContent = sp!=null ? sp.toFixed(0)+'°' : '--';

    // Mode buttons
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => {
      const m = parseInt(b.dataset.mode);
      b.classList.toggle('active', m===data.tmode);
      b.classList.toggle('cool-active', m===2 && m===data.tmode);
      b.classList.toggle('heat-active', m===1 && m===data.tmode);
    });

    // Fan buttons
    document.querySelectorAll('.mode-btn[data-fan]').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.fan)===data.fmode);
    });

    // State & Fan state
    $('stateVal').textContent = STATES[data.tstate]||'Idle';
    $('stateVal').className = 'val ' + (data.tstate===1?'c-heat':data.tstate===2?'c-cool':'c-off');
    $('fanStateVal').textContent = FSTATES[data.fstate]||'Off';
    $('fanStateVal').className = 'val ' + (data.fstate===1?'c-fan':'c-off');

    // Hold banner
    const banner = $('holdBanner');
    if (data.hold===1) { banner.classList.add('visible'); }
    else { banner.classList.remove('visible'); }

    // Status
    $('status').className = 'status-bar';
    $('status').innerHTML = '<span class="dot"></span>Live — ' + new Date().toLocaleTimeString();
  } catch(e) {
    $('status').className = 'status-bar error';
    $('status').innerHTML = '<span class="dot"></span>Error: ' + e.message;
  } finally { busy = false; }
}

// --- Setpoint Change ---
async function changeSetpoint(delta) {
  busy = true;
  if (!data) return;
  const key = data.tmode===1?'t_heat':data.tmode===2?'t_cool':null;
  if (!key) return;
  const newSp = data[key]+delta;
  if (newSp<50||newSp>90) return;
  $('spUp').classList.add('busy'); $('spDown').classList.add('busy');
  try {
    const body = {}; body[key]=newSp; body.hold=1;
    await api('/tstat','POST',body);
    data[key]=newSp;
    $('setpoint').textContent = newSp+'°';
    toast('Set to '+newSp+'° — Hold ON');
    setTimeout(poll,1500);
  } catch(e) { toast('Failed: '+e.message); }
  finally { $('spUp').classList.remove('busy'); $('spDown').classList.remove('busy'); busy = false; }
}
$('spUp').addEventListener('click', ()=>changeSetpoint(1));
$('spDown').addEventListener('click', ()=>changeSetpoint(-1));

// --- Mode Change ---
document.querySelectorAll('.mode-btn[data-mode]').forEach(b => {
  b.addEventListener('click', async () => {
    const m = parseInt(b.dataset.mode);
    try {
      await api('/tstat','POST',{tmode:m});
      toast('Mode → '+MODES[m]);
      setTimeout(poll,1000);
    } catch(e) { toast('Failed: '+e.message); }
  });
});

// --- Fan Change ---
document.querySelectorAll('.mode-btn[data-fan]').forEach(b => {
  b.addEventListener('click', async () => {
    const f = parseInt(b.dataset.fan);
    try {
      await api('/tstat','POST',{fmode:f});
      toast('Fan → '+FMODES[f]);
      setTimeout(poll,1000);
    } catch(e) { toast('Failed: '+e.message); }
  });
});

// --- Hold ---
$('releaseHold').addEventListener('click', async () => {
  try {
    await api('/tstat','POST',{hold:0});
    toast('Hold released');
    setTimeout(poll,1000);
  } catch(e) { toast('Failed: '+e.message); }
});

// --- Schedule ---
async function fetchSchedules() {
  busy = true;
  try {
    schedCool = await api('/tstat/program/cool');
    schedHeat = await api('/tstat/program/heat');
  } catch(e) { toast('Failed to load schedules: ' + e.message); }
  finally { busy = false; }
}

document.querySelectorAll('.sched-type-btn').forEach(b => {
  b.addEventListener('click', () => {
    schedMode = b.dataset.stype;
    document.querySelectorAll('.sched-type-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    renderSchedule();
  });
});

function renderSchedule() {
  const sched = schedMode==='cool'?schedCool:schedHeat;
  if (!sched) { fetchSchedules().then(renderSchedule); return; }
  const container = $('schedGrid');
  const today = (new Date().getDay()+6)%7; // API: 0=Mon
  container.innerHTML = '';
  for (let d=0;d<7;d++) {
    const arr = sched[String(d)];
    const isToday = d===today;
    let html = `<div class="sched-day"><div class="sched-day-name">${DAYS[d]}${isToday?'<span class="today-badge">TODAY</span>':''}</div><div class="periods">`;
    for (let p=0;p<4;p++) {
      const mins = arr[p*2], temp = arr[p*2+1];
      html += `<div class="period">
        <div class="p-label">${PERIODS[p]}</div>
        <input type="time" value="${minsToInput(mins)}" data-day="${d}" data-idx="${p*2}" class="sched-time">
        <input type="number" value="${temp}" min="50" max="90" data-day="${d}" data-idx="${p*2+1}" class="sched-temp">
      </div>`;
    }
    html += '</div></div>';
    container.innerHTML += html;
  }
}

$('schedSave').addEventListener('click', async () => {
  const sched = schedMode==='cool'?{...schedCool}:{...schedHeat};
  // Read all inputs
  document.querySelectorAll('.sched-time').forEach(inp => {
    const d=inp.dataset.day, i=parseInt(inp.dataset.idx);
    sched[d][i] = inputToMins(inp.value);
  });
  document.querySelectorAll('.sched-temp').forEach(inp => {
    const d=inp.dataset.day, i=parseInt(inp.dataset.idx);
    sched[d][i] = parseFloat(inp.value);
  });
  $('schedSave').classList.add('busy');
  try {
    await api('/tstat/program/'+schedMode, 'POST', sched);
    if (schedMode==='cool') schedCool=sched; else schedHeat=sched;
    toast('Schedule saved!');
  } catch(e) { toast('Failed: '+e.message); }
  finally { $('schedSave').classList.remove('busy'); }
});

$('schedCopyAll').addEventListener('click', () => {
  const sched = schedMode==='cool'?schedCool:schedHeat;
  if (!sched) return;
  // Copy Monday to all days
  const mon = [...sched['0']];
  for (let d=1;d<7;d++) sched[String(d)] = [...mon];
  renderSchedule();
  toast('Monday copied to all days');
});

// --- Runtime / Datalog ---
async function fetchDatalog() {
  busy = true;
  try {
    datalog = await api('/tstat/datalog');
    renderDatalog();
  } catch(e) { toast('Failed to load runtime data'); }
  finally { busy = false; }
}

function renderDatalog() {
  if (!datalog) return;
  const render = (prefix, d) => {
    const coolMin = d.cool_runtime.hour*60+d.cool_runtime.minute;
    const heatMin = d.heat_runtime.hour*60+d.heat_runtime.minute;
    const maxMin = Math.max(coolMin,heatMin,1);
    $(prefix+'CoolBar').style.width = (coolMin/Math.max(maxMin,120)*100)+'%';
    $(prefix+'HeatBar').style.width = (heatMin/Math.max(maxMin,120)*100)+'%';
    $(prefix+'CoolVal').textContent = d.cool_runtime.hour+'h '+d.cool_runtime.minute+'m';
    $(prefix+'HeatVal').textContent = d.heat_runtime.hour+'h '+d.heat_runtime.minute+'m';
  };
  render('today', datalog.today);
  render('yest', datalog.yesterday);
}

// --- System Info ---
async function fetchSysInfo() {
  busy = true;
  try {
    const sys = await api('/sys');
    const model = await api('/tstat/model');
    const name = await api('/sys/name');
    sysInfo = {...sys, ...model, ...name};
    $('sysName').textContent = sysInfo.name||'--';
    $('sysModel').textContent = sysInfo.model||'--';
    $('sysFw').textContent = sysInfo.fw_version||'--';
    $('sysApi').textContent = 'v'+sysInfo.api_version||'--';
    $('sysUuid').textContent = sysInfo.uuid||'--';
    $('sysWlan').textContent = sysInfo.wlan_fw_version||'--';
    $('headerModel').textContent = sysInfo.model + ' \u2014 ' + sysInfo.name;
  } catch(e) {}
  finally { busy = false; }
}

// --- Init ---
(async function init() {
  await poll();
  await fetchSchedules();
  await fetchSysInfo();
  setInterval(poll, POLL_MS);
})();
