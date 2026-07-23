/* SynthLab Studio v1 — Player + Creative Space */
const SR = 44100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtHz = (hz) => Number(hz).toLocaleString('pt-PT', { maximumFractionDigits: 2 });
const parseDecimal = (value, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? '').trim().replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
};
const secondsFromTime = (h, m, s = 0) => Math.max(0, Math.round((parseDecimal(h) * 3600) + (parseDecimal(m) * 60) + parseDecimal(s)));
const secondsToClock = (total) => {
  total = Math.max(0, Math.floor(total));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s` : `${m}m ${String(s).padStart(2,'0')}s`;
};

const PRESETS = window.SYNTHLAB_PRESETS;

const MOD_LABELS = {
  continuous_plus_pulse: 'Tom contínuo + pulso acrescentado',
  tremolo: 'Tremolo contínuo',
  vibrato: 'Vibrato leve',
  filter_sweep: 'Filtro oscilante',
  pan_motion: 'Panorama automático',
  static: 'Estático',
};

const MOD_EXPLAIN = {
  continuous_plus_pulse: 'A amplitude mantém uma base contínua e recebe acentos regulares. O som não corta totalmente entre pulsos.',
  tremolo: 'O volume oscila de forma sinusoidal, criando movimento musical contínuo.',
  vibrato: 'A frequência oscila levemente em torno da frequência base, criando instabilidade tonal controlada.',
  filter_sweep: 'A frequência do filtro abre e fecha, mudando a cor/timbre do som sem mudar necessariamente a nota base.',
  pan_motion: 'O som move-se entre esquerda e direita, criando movimento espacial.',
  static: 'Sem modulação dinâmica. A frequência e amplitude ficam estáveis.',
};

const state = {
  ctx: null,
  master: null,
  analyser: null,
  isPlaying: false,
  sequenceMode: false,
  sequenceIndex: 0,
  sequenceStartedAt: 0,
  timerStartedAt: 0,
  timerDuration: 0,
  raf: null,
  nodes: [],
  layers: [
    { name: 'Canal 1', active: true, freq: 528, waveform: 'sine', level: 0.45, pan: 0, pulseHz: 6, pulseDepth: 0.45, modType: 'continuous_plus_pulse', filterCutoff: 1800 },
    { name: 'Canal 2', active: false, freq: 432, waveform: 'sine', level: 0.25, pan: 0.2, pulseHz: 0.5, pulseDepth: 0.35, modType: 'filter_sweep', filterCutoff: 1200 },
    { name: 'Canal 3', active: false, freq: 852, waveform: 'sine', level: 0.18, pan: -0.2, pulseHz: 0.1, pulseDepth: 0.3, modType: 'pan_motion', filterCutoff: 2200 },
  ],
  sequenceRows: [],
};

function getBaseMeaning(hz) {
  const base = PRESETS.bases.find(b => Math.abs(b.hz - hz) < 0.001);
  return base ? base.meaning : 'frequência personalizada fora do catálogo base';
}
function getPulseMeaning(hz) {
  const p = PRESETS.pulses.find(x => Math.abs(x.hz - hz) < 0.001);
  return p ? p.meaning : 'pulso personalizado';
}

function fillSelects() {
  const baseSelect = qs('#playerBase');
  PRESETS.bases.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.hz;
    opt.textContent = b.label;
    if (b.hz === 528) opt.selected = true;
    baseSelect.appendChild(opt);
  });

  const pulseSelect = qs('#playerPulse');
  PRESETS.pulses.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.hz;
    opt.textContent = p.label;
    if (p.hz === 6) opt.selected = true;
    pulseSelect.appendChild(opt);
  });

  const seqSelect = qs('#sequencePresetSelect');
  PRESETS.sequencePresets.forEach(sp => {
    const opt = document.createElement('option');
    opt.value = sp.id;
    opt.textContent = sp.name;
    seqSelect.appendChild(opt);
  });
}

function createSequenceRow(data = {}) {
  return {
    label: data.label ?? 'Etapa',
    freq: Number(data.freq ?? 528),
    pulseHz: Number(data.pulseHz ?? 2),
    hours: Number(data.hours ?? 0),
    minutes: Number(data.minutes ?? 20),
    level: Number(data.level ?? 40),
    mode: data.mode ?? 'continuous_plus_pulse',
  };
}

function defaultSequence() {
  state.sequenceRows = [
    createSequenceRow({ label: 'Etapa 1', freq: 285, pulseHz: 2, hours: 0, minutes: 20, level: 55 }),
    createSequenceRow({ label: 'Etapa 2', freq: 582, pulseHz: 2, hours: 8, minutes: 0, level: 45 }),
  ];
}

function renderSequenceRows() {
  const wrap = qs('#sequenceRows');
  wrap.innerHTML = '';
  state.sequenceRows.forEach((row, i) => {
    const el = document.createElement('div');
    el.className = 'sequence-row';
    el.innerHTML = `
      <label>Nome <input data-seq="label" data-i="${i}" type="text" value="${row.label}"></label>
      <label>Hz <input data-seq="freq" data-i="${i}" type="text" inputmode="decimal" value="${row.freq}"></label>
      <label>Pulso <input data-seq="pulseHz" data-i="${i}" type="text" inputmode="decimal" value="${row.pulseHz}"></label>
      <label>Horas <input data-seq="hours" data-i="${i}" type="number" min="0" max="24" step="1" value="${row.hours}"></label>
      <label>Min <input data-seq="minutes" data-i="${i}" type="number" min="0" max="59" step="1" value="${row.minutes}"></label>
      <label>Nível % <input data-seq="level" data-i="${i}" type="number" min="0" max="80" step="1" value="${row.level}"></label>
      <button class="remove-row" data-remove-seq="${i}">Remover</button>
    `;
    wrap.appendChild(el);
  });
  qsa('[data-seq]').forEach(input => input.addEventListener('change', onSequenceChange));
  qsa('[data-remove-seq]').forEach(btn => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.removeSeq);
    state.sequenceRows.splice(idx, 1);
    if (state.sequenceRows.length === 0) defaultSequence();
    renderSequenceRows();
    updateUI();
  }));
}

function onSequenceChange(e) {
  const i = Number(e.target.dataset.i);
  const key = e.target.dataset.seq;
  if (!state.sequenceRows[i]) return;
  if (key === 'label') state.sequenceRows[i][key] = e.target.value;
  else state.sequenceRows[i][key] = parseDecimal(e.target.value, state.sequenceRows[i][key]);
  updateUI();
}

function renderLayers() {
  const wrap = qs('#layersEditor');
  wrap.innerHTML = '';
  state.layers.forEach((layer, i) => {
    const el = document.createElement('div');
    el.className = 'layer-card';
    el.innerHTML = `
      <div class="layer-top">
        <h3>${layer.name}</h3>
        <label class="inline-check"><input data-layer="active" data-i="${i}" type="checkbox" ${layer.active ? 'checked' : ''}> ativo</label>
      </div>
      <div class="layer-grid">
        <label>Frequência Hz <input data-layer="freq" data-i="${i}" type="text" inputmode="decimal" value="${layer.freq}"></label>
        <label>Onda
          <select data-layer="waveform" data-i="${i}">
            ${['sine','triangle','sawtooth','square'].map(w => `<option value="${w}" ${layer.waveform===w?'selected':''}>${w}</option>`).join('')}
          </select>
        </label>
        <label>Modulação
          <select data-layer="modType" data-i="${i}">
            ${Object.entries(MOD_LABELS).filter(([k]) => k !== 'static').map(([k,v]) => `<option value="${k}" ${layer.modType===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </label>
        <label>Nível <input data-layer="level" data-i="${i}" type="range" min="0" max="0.8" step="0.01" value="${layer.level}"></label>
        <label>Pulso Hz <input data-layer="pulseHz" data-i="${i}" type="text" inputmode="decimal" value="${layer.pulseHz}"></label>
        <label>Intensidade <input data-layer="pulseDepth" data-i="${i}" type="range" min="0" max="0.95" step="0.01" value="${layer.pulseDepth}"></label>
        <label>Pan <input data-layer="pan" data-i="${i}" type="range" min="-1" max="1" step="0.01" value="${layer.pan}"></label>
        <label>Filtro Hz <input data-layer="filterCutoff" data-i="${i}" type="number" min="120" max="12000" step="10" value="${layer.filterCutoff}"></label>
      </div>
      <p class="hint">${MOD_EXPLAIN[layer.modType]}</p>
    `;
    wrap.appendChild(el);
  });
  qsa('[data-layer]').forEach(input => input.addEventListener('input', onLayerChange));
  qsa('select[data-layer], input[type="checkbox"][data-layer], input[type="text"][data-layer], input[type="number"][data-layer]').forEach(input => input.addEventListener('change', onLayerChange));
}

function onLayerChange(e) {
  const i = Number(e.target.dataset.i);
  const key = e.target.dataset.layer;
  const layer = state.layers[i];
  if (!layer) return;
  if (key === 'active') layer.active = e.target.checked;
  else if (key === 'waveform' || key === 'modType') layer[key] = e.target.value;
  else layer[key] = parseDecimal(e.target.value, layer[key]);
  if (key === 'freq') layer.freq = clamp(layer.freq, 20, 18000);
  if (key === 'pulseHz') layer.pulseHz = clamp(layer.pulseHz, 0.01, 80);
  if (key === 'filterCutoff') layer.filterCutoff = clamp(layer.filterCutoff, 120, 12000);
  syncNodesFromState();
  updateUI();
}

async function ensureAudio() {
  if (!state.ctx) {
    state.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    state.master = state.ctx.createGain();
    state.master.gain.value = parseDecimal(qs('#masterGain').value, 0.35);
    state.master.connect(state.ctx.destination);
  }
  if (state.ctx.state === 'suspended') await state.ctx.resume();
}

function buildNodes() {
  stopNodesOnly();
  state.nodes = state.layers.map(layer => {
    const osc = state.ctx.createOscillator();
    const gain = state.ctx.createGain();
    const filter = state.ctx.createBiquadFilter();
    const pan = state.ctx.createStereoPanner ? state.ctx.createStereoPanner() : null;
    osc.type = layer.waveform;
    osc.frequency.value = layer.freq;
    gain.gain.value = 0;
    filter.type = 'lowpass';
    filter.frequency.value = layer.filterCutoff;
    filter.Q.value = 0.8;
    osc.connect(gain);
    gain.connect(filter);
    if (pan) {
      filter.connect(pan);
      pan.connect(state.master);
      pan.pan.value = layer.pan;
    } else {
      filter.connect(state.master);
    }
    osc.start();
    return { osc, gain, filter, pan, startTime: state.ctx.currentTime };
  });
}

function stopNodesOnly() {
  state.nodes.forEach(n => {
    try { n.osc.stop(); } catch {}
    try { n.osc.disconnect(); } catch {}
    try { n.gain.disconnect(); } catch {}
    try { n.filter.disconnect(); } catch {}
    try { n.pan && n.pan.disconnect(); } catch {}
  });
  state.nodes = [];
}

function syncNodesFromState() {
  if (!state.isPlaying) return;
  state.layers.forEach((layer, i) => {
    const n = state.nodes[i];
    if (!n) return;
    const t = state.ctx.currentTime;
    if (n.osc.type !== layer.waveform) n.osc.type = layer.waveform;
    n.osc.frequency.setTargetAtTime(layer.freq, t, 0.02);
    n.filter.frequency.setTargetAtTime(layer.filterCutoff, t, 0.05);
    if (n.pan) n.pan.pan.setTargetAtTime(layer.pan, t, 0.05);
  });
}

async function startPlayback({ sequence = false } = {}) {
  await ensureAudio();
  state.sequenceMode = sequence;
  state.sequenceIndex = 0;
  state.sequenceStartedAt = state.ctx.currentTime;
  state.timerStartedAt = state.ctx.currentTime;
  state.timerDuration = getTimerDuration();
  if (sequence) applySequenceStage(0);
  buildNodes();
  state.isPlaying = true;
  loopAudio();
  updateUI();
}

function stopPlayback() {
  state.isPlaying = false;
  state.sequenceMode = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  if (state.ctx && state.nodes.length) {
    const now = state.ctx.currentTime;
    state.nodes.forEach((n) => {
      try {
        n.gain.gain.cancelScheduledValues(now);
        n.gain.gain.setTargetAtTime(0, now, 0.05);
        n.osc.stop(now + 0.25);
      } catch {}
    });
    setTimeout(stopNodesOnly, 320);
  }
  updateUI();
}

function panic() {
  if (state.master && state.ctx) {
    state.master.gain.cancelScheduledValues(state.ctx.currentTime);
    state.master.gain.setValueAtTime(0, state.ctx.currentTime);
  }
  stopPlayback();
  qs('#masterGain').value = 0.15;
  onMasterChange();
}

function getTimerDuration() {
  if (!qs('#timerEnabled').checked) return 0;
  return secondsFromTime(qs('#timerHours').value, qs('#timerMinutes').value, qs('#timerSeconds').value);
}

function applySequenceStage(index) {
  const row = state.sequenceRows[index];
  if (!row) return;
  state.layers.forEach((l, i) => { l.active = i === 0; });
  const l = state.layers[0];
  l.freq = row.freq;
  l.pulseHz = row.pulseHz;
  l.level = clamp(row.level / 100, 0, 0.8);
  l.modType = row.mode || 'continuous_plus_pulse';
  l.pulseDepth = 0.45;
  renderLayers();
  syncNodesFromState();
}

function loopAudio() {
  if (!state.isPlaying || !state.ctx) return;
  const now = state.ctx.currentTime;
  if (state.sequenceMode) updateSequence(now);
  else updateTimer(now);

  state.layers.forEach((layer, i) => {
    const n = state.nodes[i];
    if (!n) return;
    const t = now - n.startTime;
    const pulse = layer.pulseHz > 0 ? (Math.sin(2 * Math.PI * layer.pulseHz * t - Math.PI / 2) + 1) / 2 : 1;
    const depth = clamp(layer.pulseDepth, 0, 0.95);
    let gain = layer.active ? layer.level : 0;
    let freq = layer.freq;
    let cutoff = layer.filterCutoff;
    let pan = layer.pan;

    if (layer.modType === 'continuous_plus_pulse') {
      gain *= (1 - depth) + depth * pulse;
    } else if (layer.modType === 'tremolo') {
      gain *= (1 - depth * 0.85) + (depth * 0.85) * pulse;
    } else if (layer.modType === 'vibrato') {
      const cents = 20 * depth;
      freq = layer.freq * Math.pow(2, ((Math.sin(2 * Math.PI * Math.max(layer.pulseHz, 0.1) * t) * cents) / 1200));
    } else if (layer.modType === 'filter_sweep') {
      cutoff = clamp(layer.filterCutoff * (0.55 + pulse * (1.6 + depth)), 120, 12000);
      gain *= 0.9;
    } else if (layer.modType === 'pan_motion') {
      pan = clamp(layer.pan + Math.sin(2 * Math.PI * Math.max(layer.pulseHz, 0.05) * t) * depth, -1, 1);
      gain *= 0.92;
    }

    const audioTime = state.ctx.currentTime;
    n.gain.gain.setTargetAtTime(gain, audioTime, 0.015);
    n.osc.frequency.setTargetAtTime(freq, audioTime, 0.02);
    n.filter.frequency.setTargetAtTime(cutoff, audioTime, 0.03);
    if (n.pan) n.pan.pan.setTargetAtTime(pan, audioTime, 0.03);
  });

  state.raf = requestAnimationFrame(loopAudio);
  updateUI(false);
}

function updateTimer(now) {
  if (!state.timerDuration) return;
  const elapsed = now - state.timerStartedAt;
  if (elapsed >= state.timerDuration) stopPlayback();
}

function updateSequence(now) {
  const row = state.sequenceRows[state.sequenceIndex];
  if (!row) { stopPlayback(); return; }
  const dur = secondsFromTime(row.hours, row.minutes, 0);
  if (dur <= 0) return;
  const elapsed = now - state.sequenceStartedAt;
  if (elapsed >= dur) {
    state.sequenceIndex += 1;
    if (state.sequenceIndex >= state.sequenceRows.length) {
      if (qs('#sequenceLoop').checked) state.sequenceIndex = 0;
      else { stopPlayback(); return; }
    }
    state.sequenceStartedAt = now;
    applySequenceStage(state.sequenceIndex);
    stopNodesOnly();
    buildNodes();
  }
}

function onMasterChange() {
  const value = parseDecimal(qs('#masterGain').value, 0.35);
  qs('#masterValue').textContent = `${Math.round(value * 100)}%`;
  if (state.master && state.ctx) state.master.gain.setTargetAtTime(value, state.ctx.currentTime, 0.03);
}

function applyPlayerPreset() {
  const base = parseDecimal(qs('#playerBase').value, 528);
  const pulse = parseDecimal(qs('#playerPulse').value, 6);
  const mode = qs('#playerModType').value;
  state.layers[0].active = true;
  state.layers[0].freq = base;
  state.layers[0].pulseHz = pulse;
  state.layers[0].modType = mode;
  state.layers[0].level = parseDecimal(qs('#playerLevel').value, 0.45);
  renderLayers();
  syncNodesFromState();
  updateUI();
}

function loadSequencePreset() {
  const id = qs('#sequencePresetSelect').value;
  const preset = PRESETS.sequencePresets.find(p => p.id === id);
  if (!preset) return;
  state.sequenceRows = preset.stages.map(createSequenceRow);
  renderSequenceRows();
  updateUI();
}

function setMode(mode) {
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  qsa('.mode-panel').forEach(p => p.classList.remove('active'));
  qs(`#mode${mode[0].toUpperCase()}${mode.slice(1)}`).classList.add('active');
}

function updateUI(renderLayerText = true) {
  qs('#statusDot').classList.toggle('on', state.isPlaying);
  qs('#transportState').textContent = state.isPlaying ? (state.sequenceMode ? 'Sequência ativa' : 'A tocar') : 'Parado';
  qs('#playStopBtn').textContent = state.isPlaying ? 'Parar' : 'Iniciar';
  qs('#timerHint').textContent = qs('#timerEnabled').checked ? `Ativo: para após ${secondsToClock(getTimerDuration())}.` : 'Desligado: a reprodução fica indefinida.';

  let activeLayers = state.layers.filter(l => l.active);
  if (state.sequenceMode) {
    const row = state.sequenceRows[state.sequenceIndex];
    const elapsed = state.ctx ? state.ctx.currentTime - state.sequenceStartedAt : 0;
    const remain = row ? secondsFromTime(row.hours, row.minutes) - elapsed : 0;
    qs('#nowSummary').innerHTML = row ? `<strong>${row.label}</strong><br>${fmtHz(row.freq)} Hz + ${fmtHz(row.pulseHz)} Hz · etapa ${state.sequenceIndex + 1}/${state.sequenceRows.length} · restante ${secondsToClock(remain)}` : 'Sequência terminada.';
  } else if (activeLayers.length) {
    qs('#nowSummary').innerHTML = activeLayers.map(l => `<strong>${l.name}</strong>: ${fmtHz(l.freq)} Hz · ${fmtHz(l.pulseHz)} Hz · ${MOD_LABELS[l.modType]} · nível ${Math.round(l.level*100)}%`).join('<br>');
  } else {
    qs('#nowSummary').textContent = 'Nenhum canal ativo.';
  }

  const l = state.layers[0];
  const cycle = l.pulseHz > 0 ? (1 / l.pulseHz) : 0;
  qs('#technicalSummary').innerHTML = `Canal 1: ${fmtHz(l.freq)} Hz (${getBaseMeaning(l.freq)}). Pulso: ${fmtHz(l.pulseHz)} Hz ${cycle ? `= ciclo de ${cycle.toFixed(cycle >= 1 ? 1 : 2)} s` : ''}. Modulação: ${MOD_LABELS[l.modType]}.`;
  qs('#gestureExplain').innerHTML = `<strong>Canal 1</strong><br>Frequência: ${fmtHz(l.freq)} Hz<br>Intensidade da modulação: ${Math.round(l.pulseDepth*100)}%<br>Resultado: ${MOD_EXPLAIN[l.modType]}<br><span class="hint">Base experiencial: ${getBaseMeaning(l.freq)}. Pulso: ${getPulseMeaning(l.pulseHz)}.</span>`;

  updateXYVisual();
}

function updateXYVisual() {
  const l = state.layers[0];
  const x = (Math.log(l.freq) - Math.log(80)) / (Math.log(1200) - Math.log(80));
  const y = l.pulseDepth;
  qs('#xyCrosshair').style.left = `${clamp(x,0,1)*100}%`;
  qs('#xyCrosshair').style.top = `${(1-clamp(y,0,1))*100}%`;
  qs('#xyReadout').textContent = `X: ${fmtHz(l.freq)} Hz · Y: ${Math.round(l.pulseDepth*100)}%`;
}

function onXY(e) {
  const rect = qs('#xyPad').getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  const x = clamp((p.clientX - rect.left) / rect.width, 0, 1);
  const y = clamp((p.clientY - rect.top) / rect.height, 0, 1);
  const min = Math.log(80);
  const max = Math.log(1200);
  state.layers[0].freq = Math.round(Math.exp(min + x * (max - min)) * 10) / 10;
  state.layers[0].pulseDepth = Math.round((1 - y) * 100) / 100;
  renderLayers();
  syncNodesFromState();
  updateUI();
}

function setupXY() {
  const pad = qs('#xyPad');
  let down = false;
  pad.addEventListener('pointerdown', (e) => { down = true; pad.setPointerCapture(e.pointerId); onXY(e); });
  pad.addEventListener('pointermove', (e) => { if (down) onXY(e); });
  pad.addEventListener('pointerup', () => { down = false; });
  pad.addEventListener('pointercancel', () => { down = false; });
}

function setupStudioChips() {
  qsa('[data-studio-set]').forEach(btn => btn.addEventListener('click', () => {
    const type = btn.dataset.studioSet;
    const l = state.layers[0];
    if (type === 'calm') { l.freq = 528; l.pulseHz = 0.1; l.modType = 'continuous_plus_pulse'; l.pulseDepth = 0.28; l.level = 0.32; }
    if (type === 'focus') { l.freq = 741; l.pulseHz = 15; l.modType = 'continuous_plus_pulse'; l.pulseDepth = 0.35; l.level = 0.36; }
    if (type === 'space') { l.freq = 963; l.pulseHz = 0.5; l.modType = 'pan_motion'; l.pulseDepth = 0.55; l.level = 0.28; }
    if (type === 'texture') { l.freq = 417; l.pulseHz = 6; l.modType = 'filter_sweep'; l.pulseDepth = 0.55; l.level = 0.35; }
    renderLayers();
    syncNodesFromState();
    updateUI();
  }));
}

function initEvents() {
  qs('#playStopBtn').addEventListener('click', () => state.isPlaying ? stopPlayback() : startPlayback());
  qs('#panicBtn').addEventListener('click', panic);
  qs('#masterGain').addEventListener('input', onMasterChange);
  qsa('.tab').forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  qs('#applyPlayerPreset').addEventListener('click', applyPlayerPreset);
  qs('#timerEnabled').addEventListener('change', updateUI);
  ['#timerHours','#timerMinutes','#timerSeconds'].forEach(sel => qs(sel).addEventListener('input', updateUI));
  qs('#loadSequencePreset').addEventListener('click', loadSequencePreset);
  qs('#startSequenceBtn').addEventListener('click', () => startPlayback({ sequence: true }));
  qs('#addSequenceRow').addEventListener('click', () => { state.sequenceRows.push(createSequenceRow({ label: `Etapa ${state.sequenceRows.length + 1}` })); renderSequenceRows(); updateUI(); });
  setupXY();
  setupStudioChips();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js?v=studio1').catch(() => {});
  }
}

function init() {
  fillSelects();
  defaultSequence();
  renderSequenceRows();
  renderLayers();
  initEvents();
  onMasterChange();
  updateUI();
  registerSW();
}

document.addEventListener('DOMContentLoaded', init);
