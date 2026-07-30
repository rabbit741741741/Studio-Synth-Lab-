/* SynthLab Studio v1.7 — temporizador rápido + exportação social vertical */
const APP_VERSION = '1.7';
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


const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PC_KEY_TO_SEMITONE = { a:0, w:1, s:2, e:3, d:4, f:5, t:6, g:7, y:8, h:9, u:10, j:11, k:12 };
const PC_CHORD_SHORTCUTS = {
  '1': 'single', '2': 'major', '3': 'minor', '4': 'sus2', '5': 'sus4',
  '6': 'power', '7': 'maj7', '8': 'dom7', '9': 'min7', '0': 'add9'
};
const PC_EFFECT_SHORTCUTS = {
  p: 'continuous_plus_pulse', v: 'vibrato', b: 'tremolo', n: 'filter_sweep', m: 'pan_motion', o: 'static'
};
const PC_EFFECT_LABELS = {
  continuous_plus_pulse: 'Pulso/acento', vibrato: 'Vibrato', tremolo: 'Tremolo',
  filter_sweep: 'Filtro oscilante', pan_motion: 'Panorama automático', static: 'Seco'
};
const CHORDS = {
  single: [0],
  major: [0,4,7],
  minor: [0,3,7],
  dim: [0,3,6],
  aug: [0,4,8],
  sus2: [0,2,7],
  sus4: [0,5,7],
  power: [0,7,12],
  maj7: [0,4,7,11],
  dom7: [0,4,7,10],
  min7: [0,3,7,10],
  min9: [0,3,7,10,14],
  add9: [0,4,7,14],
  octave: [0,12,24],
};
const SCALES = {
  chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  pentatonic: [0,2,4,7,9],
  dorian: [0,2,3,5,7,9,10],
};
const ROOTS = NOTE_NAMES.map((name, semi) => ({ name, semi }));
const CTRL_ASSIGNMENTS = [
  ['freq','Frequência canal 1'], ['pulseDepth','Intensidade modulação'], ['pulseHz','Pulso Hz'], ['filterCutoff','Filtro Hz'], ['pan','Panorama'], ['kbdFilter','Filtro teclado'], ['kbdDepth','Intensidade teclado'], ['kbdRate','Velocidade efeito teclado'], ['kbdVibrato','Vibrato cents']
];
const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const midiName = (midi) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const ccToUnit = (v) => clamp(v / 127, 0, 1);
const unitToLogRange = (u, min, max) => Math.exp(Math.log(min) + clamp(u,0,1) * (Math.log(max) - Math.log(min)));

const state = {
  ctx: null,
  master: null,
  analyser: null,
  recDest: null,
  recorder: null,
  recordChunks: [],
  recordUrl: null,
  recordTextUrl: null,
  recordBaseName: '',
  recordSession: null,
  recordStartedAt: 0,
  isRecording: false,
  recordMimeType: '',
  lastSessionLog: {},
  videoRecorder: null,
  videoChunks: [],
  videoUrl: null,
  videoMimeType: '',
  videoStream: null,
  videoRaf: null,
  videoStartedAt: 0,
  isVideoRecording: false,
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
  voices: [],
  voiceRaf: null,
  midiAccess: null,
  pitchBend: 0,
  keyboard: {
    rootSemi: 0,
    scale: 'chromatic',
    octave: 3,
    waveform: 'sine',
    chord: 'single',
    chordVoicing: 'closed',
    chordInversion: 0,
    level: 0.28,
    filterCutoff: 2600,
    pulseHz: 0.1,
    pulseDepth: 0.25,
    vibratoCents: 18,
    envelope: 'soft',
    strumMs: 0,
    modType: 'continuous_plus_pulse',
    pan: 0,
    arpEnabled: false,
    arpLatch: false,
    arpRate: 2,
    arpPattern: 'up',
    arp: null,
    heldGroups: new Map(),
    pcCapture: true,
    downPcGroups: new Set(),
    controller: { xAssign: 'freq', yAssign: 'pulseDepth', x: 0.5, y: 0.5 },
    motionActive: false,
  },
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

  const rootSelect = qs('#kbdRoot');
  if (rootSelect) ROOTS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.semi;
    opt.textContent = r.name;
    if (r.semi === 0) opt.selected = true;
    rootSelect.appendChild(opt);
  });

  const xSel = qs('#ctrlXAssign');
  const ySel = qs('#ctrlYAssign');
  if (xSel && ySel) CTRL_ASSIGNMENTS.forEach(([id, label]) => {
    const xo = document.createElement('option'); xo.value = id; xo.textContent = label; xSel.appendChild(xo);
    const yo = document.createElement('option'); yo.value = id; yo.textContent = label; ySel.appendChild(yo);
  });
  if (xSel) xSel.value = 'freq';
  if (ySel) ySel.value = 'pulseDepth';
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
    const removed = state.sequenceRows[idx] ? safeClone(state.sequenceRows[idx]) : null;
    state.sequenceRows.splice(idx, 1);
    logSessionEvent('sequence_row_removed', { index: idx, removed });
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
  logSessionEvent('sequence_parameter_change', { rowIndex: i, parameter: key, value: state.sequenceRows[i][key], row: safeClone(state.sequenceRows[i]) });
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
  logSessionEvent('layer_parameter_change', { layerIndex: i, layerName: layer.name, parameter: key, value: layer[key], layer: safeClone(layer) });
  syncNodesFromState();
  updateUI();
}

async function ensureAudio() {
  if (!state.ctx) {
    state.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
    state.master = state.ctx.createGain();
    state.master.gain.value = parseDecimal(qs('#masterGain').value, 0.35);
    state.recDest = state.ctx.createMediaStreamDestination();
    state.analyser = state.ctx.createAnalyser();
    state.analyser.fftSize = 2048;
    state.analyser.smoothingTimeConstant = 0.82;
    state.master.connect(state.ctx.destination);
    state.master.connect(state.recDest);
    state.master.connect(state.analyser);
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
  logSessionEvent('playback_start', { sequence, state: captureSessionState() });
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

function stopPlayback({ reason = 'user_stop', finalizeTimedExports = false } = {}) {
  logSessionEvent('playback_stop', { reason, sequenceMode: state.sequenceMode, sequenceIndex: state.sequenceIndex });
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
  if (finalizeTimedExports) {
    if (state.isRecording) stopRecording();
    if (state.isVideoRecording && qs('#socialStopWithTimer')?.checked) stopSocialVideo('timer_finished');
  }
  updateUI();
}

function panic() {
  logSessionEvent('panic_silence', { reason: 'panic_button' });
  if (state.master && state.ctx) {
    state.master.gain.cancelScheduledValues(state.ctx.currentTime);
    state.master.gain.setValueAtTime(0, state.ctx.currentTime);
  }
  stopAllKeyboardVoices(true);
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
  logSessionEvent('sequence_stage_applied', { index, row: safeClone(row), layer: safeClone(l) });
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
  if (elapsed >= state.timerDuration) {
    logSessionEvent('timer_finished', { duration_s: state.timerDuration });
    qs('#timerEnabled').checked = false;
    state.timerDuration = 0;
    stopPlayback({ reason: 'timer_finished', finalizeTimedExports: true });
  }
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


function activeModeName() {
  return qs('.tab.active')?.dataset?.mode || 'desconhecido';
}

function safeClone(value) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch { return value; }
}

function currentRelTime() {
  if (!state.ctx || !state.recordStartedAt) return 0;
  return Math.max(0, Math.round((state.ctx.currentTime - state.recordStartedAt) * 1000) / 1000);
}

function captureKeyboardState() {
  const k = state.keyboard;
  return {
    rootSemi: k.rootSemi,
    scale: k.scale,
    octave: k.octave,
    waveform: k.waveform,
    chord: k.chord,
    chordVoicing: k.chordVoicing,
    chordInversion: k.chordInversion,
    level: k.level,
    filterCutoff: k.filterCutoff,
    pulseHz: k.pulseHz,
    pulseDepth: k.pulseDepth,
    vibratoCents: k.vibratoCents,
    envelope: k.envelope,
    strumMs: k.strumMs,
    modType: k.modType,
    pan: k.pan,
    arpEnabled: k.arpEnabled,
    arpLatch: k.arpLatch,
    arpRate: k.arpRate,
    arpPattern: k.arpPattern,
    pcCapture: k.pcCapture,
    controller: safeClone(k.controller),
    motionActive: k.motionActive
  };
}

function captureSessionState() {
  return {
    app: 'SynthLab Studio',
    version: APP_VERSION,
    mode: activeModeName(),
    transport: {
      isPlaying: state.isPlaying,
      sequenceMode: state.sequenceMode,
      sequenceIndex: state.sequenceIndex,
      timerEnabled: !!qs('#timerEnabled')?.checked,
      timerHours: qs('#timerHours')?.value ?? '0',
      timerMinutes: qs('#timerMinutes')?.value ?? '0',
      timerSeconds: qs('#timerSeconds')?.value ?? '0',
      sequenceLoop: !!qs('#sequenceLoop')?.checked
    },
    masterGain: parseDecimal(qs('#masterGain')?.value, 0.35),
    layers: safeClone(state.layers),
    sequenceRows: safeClone(state.sequenceRows),
    keyboard: captureKeyboardState(),
    controllerAssignments: {
      x: qs('#ctrlXAssign')?.value || null,
      y: qs('#ctrlYAssign')?.value || null
    },
    player: {
      base: qs('#playerBase')?.value || null,
      pulse: qs('#playerPulse')?.value || null,
      modType: qs('#playerModType')?.value || null,
      level: qs('#playerLevel')?.value || null
    }
  };
}

function createRecordSession() {
  state.recordSession = {
    schema: 'synthlab-session-v1',
    app: 'SynthLab Studio',
    version: APP_VERSION,
    purpose: 'Recriar e auditar uma gravação gerada pelo SynthLab Studio.',
    startedAtISO: new Date().toISOString(),
    sampleRate: state.ctx?.sampleRate || SR,
    audioMimeType: state.recordMimeType || 'formato automático',
    audioFileName: '',
    initialState: captureSessionState(),
    events: [],
    notes: [
      'Este TXT descreve a sessão gravada.',
      'A parte humana é para leitura; o bloco JSON entre SYNTHLAB_SESSION_JSON_BEGIN/END é para recriação futura.',
      'A recriação exata depende da mesma versão ou de um importador compatível no SynthLab Studio.'
    ]
  };
  state.lastSessionLog = {};
}

function logSessionEvent(type, details = {}) {
  if (!state.isRecording || !state.recordSession) return;
  const ev = {
    t_s: currentRelTime(),
    wallClockISO: new Date().toISOString(),
    type,
    details: safeClone(details)
  };
  state.recordSession.events.push(ev);
  if (state.recordSession.events.length > 10000) state.recordSession.events.shift();
}

function logSessionContinuous(type, key, details = {}, minInterval = 0.35) {
  if (!state.isRecording || !state.recordSession) return;
  const now = currentRelTime();
  const k = `${type}:${key}`;
  if (state.lastSessionLog[k] !== undefined && (now - state.lastSessionLog[k]) < minInterval) return;
  state.lastSessionLog[k] = now;
  logSessionEvent(type, details);
}

function simpleObjectLines(obj, indent = '') {
  if (obj === null || obj === undefined) return [`${indent}-`];
  if (typeof obj !== 'object') return [`${indent}${String(obj)}`];
  if (Array.isArray(obj)) {
    if (!obj.length) return [`${indent}[]`];
    return obj.flatMap((item, i) => {
      const lines = simpleObjectLines(item, indent + '  ');
      lines[0] = `${indent}${i + 1}. ${lines[0].trimStart()}`;
      return lines;
    });
  }
  return Object.entries(obj).flatMap(([k, v]) => {
    if (v && typeof v === 'object') return [`${indent}${k}:`].concat(simpleObjectLines(v, indent + '  '));
    return [`${indent}${k}: ${v}`];
  });
}

function describeLayer(layer, i) {
  return `Canal ${i + 1}: ${layer.active ? 'ativo' : 'inativo'} | ${layer.freq} Hz | onda ${layer.waveform} | nível ${Math.round(layer.level*100)}% | ${MOD_LABELS[layer.modType] || layer.modType} | pulso ${layer.pulseHz} Hz | profundidade ${Math.round(layer.pulseDepth*100)}% | pan ${layer.pan} | filtro ${layer.filterCutoff} Hz`;
}

function createSessionText(session) {
  const lines = [];
  const final = session.finalState || captureSessionState();
  lines.push('SYNTHLAB STUDIO - FICHEIRO DE PARÂMETROS E SCRIPT DE RECRIAÇÃO');
  lines.push(`Versão: ${APP_VERSION}`);
  lines.push('');
  lines.push('1. IDENTIFICAÇÃO');
  lines.push(`Início: ${session.startedAtISO}`);
  lines.push(`Fim: ${session.endedAtISO || '-'}`);
  lines.push(`Duração gravada: ${session.duration_s ?? '-'} s`);
  lines.push(`Ficheiro de áudio associado: ${session.audioFileName || '-'}`);
  lines.push(`Formato áudio: ${session.audioMimeType || '-'}`);
  lines.push(`Sample rate: ${session.sampleRate || '-'} Hz`);
  lines.push('');
  lines.push('2. COMO USAR ESTE FICHEIRO');
  lines.push('- Ler as secções 3 a 6 para perceber a sessão de forma humana.');
  lines.push('- Guardar este TXT junto ao ficheiro de áudio.');
  lines.push('- Para recriação futura, usar o JSON entre SYNTHLAB_SESSION_JSON_BEGIN e SYNTHLAB_SESSION_JSON_END.');
  lines.push('- A recriação totalmente automática requer uma versão/importador do SynthLab Studio compatível com schema synthlab-session-v1.');
  lines.push('');
  lines.push('3. ESTADO INICIAL');
  lines.push(`Modo inicial: ${session.initialState.mode}`);
  lines.push(`Master inicial: ${Math.round((session.initialState.masterGain || 0)*100)}%`);
  (session.initialState.layers || []).forEach((l, i) => lines.push(describeLayer(l, i)));
  lines.push('');
  lines.push('4. ESTADO FINAL');
  lines.push(`Modo final: ${final.mode}`);
  lines.push(`Master final: ${Math.round((final.masterGain || 0)*100)}%`);
  (final.layers || []).forEach((l, i) => lines.push(describeLayer(l, i)));
  lines.push('');
  lines.push('5. TECLADO / ACORDES / EFEITOS NO FINAL');
  lines.push(...simpleObjectLines(final.keyboard, ''));
  lines.push('');
  lines.push('6. LINHA TEMPORAL DE ALTERAÇÕES');
  if (!session.events.length) lines.push('Sem eventos registados para além da configuração inicial/final.');
  session.events.forEach((ev, idx) => {
    lines.push(`${String(idx + 1).padStart(4, '0')} | t=${Number(ev.t_s).toFixed(3)}s | ${ev.type} | ${JSON.stringify(ev.details)}`);
  });
  lines.push('');
  lines.push('7. SCRIPT JSON PARA RECRIAÇÃO FUTURA');
  lines.push('SYNTHLAB_SESSION_JSON_BEGIN');
  lines.push(JSON.stringify(session, null, 2));
  lines.push('SYNTHLAB_SESSION_JSON_END');
  lines.push('');
  lines.push('FIM DO FICHEIRO');
  return lines.join('\n');
}

function finalizeRecordSession(audioFileName) {
  if (!state.recordSession) return null;
  state.recordSession.endedAtISO = new Date().toISOString();
  state.recordSession.duration_s = currentRelTime();
  state.recordSession.audioFileName = audioFileName || '';
  state.recordSession.finalState = captureSessionState();
  state.recordSession.eventCount = state.recordSession.events.length;
  return state.recordSession;
}

function revokeRecordTextUrl() {
  if (state.recordTextUrl) {
    try { URL.revokeObjectURL(state.recordTextUrl); } catch {}
    state.recordTextUrl = null;
  }
}

function buildRecordTextDownload(baseName) {
  revokeRecordTextUrl();
  const session = finalizeRecordSession(`${baseName}.${state.recordMimeType?.includes('mp4') ? 'm4a' : 'webm'}`);
  if (!session) return;
  const text = createSessionText(session);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  state.recordTextUrl = URL.createObjectURL(blob);
  const link = qs('#recordSaveTxtLink');
  if (link) {
    link.href = state.recordTextUrl;
    link.download = `${baseName}-parametros-script.txt`;
  }
}

function triggerSaveBoth() {
  const audio = qs('#recordSaveLink');
  const txt = qs('#recordSaveTxtLink');
  if (audio?.href) audio.click();
  if (txt?.href) setTimeout(() => txt.click(), 450);
}


function getRecordingMimeType() {
  if (!window.MediaRecorder) return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4'
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function updateRecorderUI() {
  const startBtn = qs('#recordStartBtn');
  const stopBtn = qs('#recordStopBtn');
  const status = qs('#recordStatus');
  const audioLink = qs('#recordSaveLink');
  const txtLink = qs('#recordSaveTxtLink');
  const bothBtn = qs('#recordSaveBothBtn');
  if (!startBtn || !stopBtn || !status || !audioLink) return;
  startBtn.disabled = state.isRecording;
  stopBtn.disabled = !state.isRecording;
  if (state.isRecording) {
    const elapsed = state.ctx ? Math.max(0, Math.floor(state.ctx.currentTime - state.recordStartedAt)) : 0;
    status.textContent = `Gravação: ativa · ${secondsToClock(elapsed)} · ${state.recordMimeType || 'formato automático'} · parâmetros a registar`;
  } else {
    status.textContent = state.recordUrl ? 'Gravação pronta: guardar áudio e parâmetros TXT.' : 'Gravação: parada';
  }
  audioLink.classList.toggle('hidden', !state.recordUrl);
  txtLink?.classList.toggle('hidden', !state.recordTextUrl);
  bothBtn?.classList.toggle('hidden', !(state.recordUrl && state.recordTextUrl));
}

async function startRecording() {
  const status = qs('#recordStatus');
  if (!window.MediaRecorder) {
    if (status) status.textContent = 'Gravação não suportada neste browser.';
    return;
  }
  await ensureAudio();
  if (!state.recDest) {
    if (status) status.textContent = 'Destino de gravação indisponível.';
    return;
  }
  if (state.isRecording) return;
  if (state.recordUrl) {
    URL.revokeObjectURL(state.recordUrl);
    state.recordUrl = null;
  }
  revokeRecordTextUrl();
  state.recordBaseName = '';
  state.recordChunks = [];
  state.recordMimeType = getRecordingMimeType();
  createRecordSession();
  try {
    const opts = state.recordMimeType ? { mimeType: state.recordMimeType } : undefined;
    state.recorder = new MediaRecorder(state.recDest.stream, opts);
    state.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) state.recordChunks.push(ev.data);
    };
    state.recorder.onerror = () => {
      if (status) status.textContent = 'Erro durante a gravação.';
      state.isRecording = false;
      updateRecorderUI();
    };
    state.recorder.onstop = () => {
      const type = state.recordMimeType || 'audio/webm';
      const blob = new Blob(state.recordChunks, { type });
      state.recordUrl = URL.createObjectURL(blob);
      const link = qs('#recordSaveLink');
      const ext = type.includes('mp4') ? 'm4a' : 'webm';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `synthlab-studio-${stamp}`;
      state.recordBaseName = baseName;
      if (link) {
        link.href = state.recordUrl;
        link.download = `${baseName}.${ext}`;
      }
      logSessionEvent('recording_stop', { reason: 'user_stop', audioExtension: ext });
      state.isRecording = false;
      buildRecordTextDownload(baseName);
      updateRecorderUI();
    };
    state.recorder.start(250);
    state.recordStartedAt = state.ctx.currentTime;
    state.isRecording = true;
    logSessionEvent('recording_start', { mimeType: state.recordMimeType || 'auto', initialState: captureSessionState() });
    updateRecorderUI();
  } catch (err) {
    if (status) status.textContent = 'Gravação bloqueada ou indisponível neste browser.';
    state.isRecording = false;
    updateRecorderUI();
  }
}

function stopRecording() {
  if (!state.recorder || !state.isRecording) return;
  try { state.recorder.stop(); }
  catch {
    state.isRecording = false;
    updateRecorderUI();
  }
}

function onMasterChange() {
  const value = parseDecimal(qs('#masterGain').value, 0.35);
  qs('#masterValue').textContent = `${Math.round(value * 100)}%`;
  if (state.master && state.ctx) state.master.gain.setTargetAtTime(value, state.ctx.currentTime, 0.03);
  logSessionContinuous('master_change', 'master', { value }, 0.2);
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
  logSessionEvent('player_preset_applied', { base, pulse, mode, level: state.layers[0].level, layer: safeClone(state.layers[0]) });
  updateUI();
}

function loadSequencePreset() {
  const id = qs('#sequencePresetSelect').value;
  const preset = PRESETS.sequencePresets.find(p => p.id === id);
  if (!preset) return;
  state.sequenceRows = preset.stages.map(createSequenceRow);
  logSessionEvent('sequence_preset_loaded', { id: preset.id, name: preset.name, stages: safeClone(state.sequenceRows) });
  renderSequenceRows();
  updateUI();
}

function setMode(mode) {
  logSessionEvent('mode_change', { mode });
  qsa('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  qsa('.mode-panel').forEach(p => p.classList.remove('active'));
  qs(`#mode${mode[0].toUpperCase()}${mode.slice(1)}`).classList.add('active');
}

function getTimerRemaining(now = state.ctx?.currentTime || 0) {
  if (!state.timerDuration || !state.isPlaying || state.sequenceMode) return 0;
  return Math.max(0, state.timerDuration - (now - state.timerStartedAt));
}

function updateQuickTimerUI() {
  const enabled = !!qs('#timerEnabled')?.checked;
  const duration = getTimerDuration();
  const summary = qs('#quickTimerSummary');
  const status = qs('#quickTimerStatus');
  if (!summary || !status) return;
  if (state.isPlaying && state.sequenceMode) {
    summary.textContent = '⏱ Sequência';
    status.textContent = enabled ? `Temporizador de ${secondsToClock(duration)} guardado para a próxima reprodução normal.` : 'A sequência usa a duração de cada etapa.';
    return;
  }
  if (!enabled || duration <= 0) {
    summary.textContent = '⏱ Sem limite';
    status.textContent = 'Sem limite: a reprodução não para automaticamente.';
    return;
  }
  const remain = getTimerRemaining();
  summary.textContent = state.isPlaying ? `⏱ ${secondsToClock(remain)}` : `⏱ ${secondsToClock(duration)}`;
  status.textContent = state.isPlaying ? `Ativo agora: faltam ${secondsToClock(remain)}.` : `Preparado: para após ${secondsToClock(duration)}.`;
}

function updateUI(renderLayerText = true) {
  qs('#statusDot').classList.toggle('on', state.isPlaying);
  qs('#transportState').textContent = state.isPlaying ? (state.sequenceMode ? 'Sequência ativa' : 'A tocar') : 'Parado';
  qs('#playStopBtn').textContent = state.isPlaying ? 'Parar' : 'Iniciar';
  const timerDuration = getTimerDuration();
  qs('#timerHint').textContent = qs('#timerEnabled').checked && timerDuration > 0 ? `Ativo: para após ${secondsToClock(timerDuration)}. Alterações aplicam-se imediatamente à reprodução normal.` : 'Desligado: a reprodução fica indefinida.';

  let activeLayers = state.layers.filter(l => l.active);
  if (state.sequenceMode) {
    const row = state.sequenceRows[state.sequenceIndex];
    const elapsed = state.ctx ? state.ctx.currentTime - state.sequenceStartedAt : 0;
    const remain = row ? secondsFromTime(row.hours, row.minutes) - elapsed : 0;
    qs('#nowSummary').innerHTML = row ? `<strong>${row.label}</strong><br>${fmtHz(row.freq)} Hz + ${fmtHz(row.pulseHz)} Hz · etapa ${state.sequenceIndex + 1}/${state.sequenceRows.length} · restante ${secondsToClock(remain)}` : 'Sequência terminada.';
  } else if (activeLayers.length) {
    const timerLine = state.isPlaying && state.timerDuration ? `<br><span class="timer-live">Tempo restante: ${secondsToClock(getTimerRemaining())}</span>` : '';
    qs('#nowSummary').innerHTML = activeLayers.map(l => `<strong>${l.name}</strong>: ${fmtHz(l.freq)} Hz · ${fmtHz(l.pulseHz)} Hz · ${MOD_LABELS[l.modType]} · nível ${Math.round(l.level*100)}%`).join('<br>') + timerLine;
  } else if (state.voices.length) {
    const names = [...new Set(state.voices.slice(-5).map(v => midiName(v.midi)))].join(' · ');
    qs('#nowSummary').innerHTML = `<strong>Teclado ativo</strong>: ${names}<br>${MOD_LABELS[state.keyboard.modType]} · nível ${Math.round(state.keyboard.level*100)}%`;
  } else {
    qs('#nowSummary').textContent = 'Nenhum canal ativo.';
  }

  const l = state.layers[0];
  const cycle = l.pulseHz > 0 ? (1 / l.pulseHz) : 0;
  qs('#technicalSummary').innerHTML = `Canal 1: ${fmtHz(l.freq)} Hz (${getBaseMeaning(l.freq)}). Pulso: ${fmtHz(l.pulseHz)} Hz ${cycle ? `= ciclo de ${cycle.toFixed(cycle >= 1 ? 1 : 2)} s` : ''}. Modulação: ${MOD_LABELS[l.modType]}.`;
  qs('#gestureExplain').innerHTML = `<strong>Canal 1</strong><br>Frequência: ${fmtHz(l.freq)} Hz<br>Intensidade da modulação: ${Math.round(l.pulseDepth*100)}%<br>Resultado: ${MOD_EXPLAIN[l.modType]}<br><span class="hint">Base experiencial: ${getBaseMeaning(l.freq)}. Pulso: ${getPulseMeaning(l.pulseHz)}.</span>`;

  updateQuickTimerUI();
  updateRecorderUI();
  updateSocialVideoUI();
  if (!state.isVideoRecording) drawSocialFrame();
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
  logSessionContinuous('xy_pad_change', 'studio_xy', { x, y, freq: state.layers[0].freq, pulseDepth: state.layers[0].pulseDepth }, 0.25);
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
    logSessionEvent('studio_quick_set', { preset: btn.dataset.studioSet, layers: safeClone(state.layers) });
    updateUI();
  }));
}


function renderKeyboard() {
  const wrap = qs('#musicalKeyboard');
  if (!wrap) return;
  wrap.innerHTML = '';
  const baseMidi = (state.keyboard.octave + 1) * 12;
  const allowed = SCALES[state.keyboard.scale] || SCALES.chromatic;
  for (let i = 0; i < 24; i++) {
    const midi = baseMidi + i;
    const semi = midi % 12;
    const rel = (semi - state.keyboard.rootSemi + 12) % 12;
    const btn = document.createElement('button');
    btn.className = `key-btn ${[1,3,6,8,10].includes(semi) ? 'black' : 'white'} ${allowed.includes(rel) ? 'in-scale' : ''}`;
    btn.textContent = midiName(midi);
    btn.dataset.midi = midi;
    btn.type = 'button';
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); btn.classList.add('active'); keyboardDown(midi, `pad-${midi}`); });
    btn.addEventListener('pointerup', () => { btn.classList.remove('active'); keyboardUp(`pad-${midi}`); });
    btn.addEventListener('pointercancel', () => { btn.classList.remove('active'); keyboardUp(`pad-${midi}`); });
    wrap.appendChild(btn);
  }
  updateKeyboardExplain();
}

function updateKeyboardStateFromUI() {
  state.keyboard.rootSemi = parseDecimal(qs('#kbdRoot')?.value, 0);
  state.keyboard.scale = qs('#kbdScale')?.value || 'chromatic';
  state.keyboard.octave = parseDecimal(qs('#kbdOctave')?.value, 3);
  state.keyboard.waveform = qs('#kbdWaveform')?.value || 'sine';
  state.keyboard.chord = qs('#kbdChord')?.value || 'single';
  state.keyboard.chordVoicing = qs('#kbdVoicing')?.value || 'closed';
  state.keyboard.chordInversion = parseDecimal(qs('#kbdInversion')?.value, 0);
  state.keyboard.level = parseDecimal(qs('#kbdLevel')?.value, 0.28);
  state.keyboard.filterCutoff = parseDecimal(qs('#kbdFilter')?.value, 2600);
  state.keyboard.modType = qs('#kbdEffectType')?.value || state.keyboard.modType || 'continuous_plus_pulse';
  state.keyboard.pulseHz = parseDecimal(qs('#kbdEffectRate')?.value, state.keyboard.pulseHz || 0.1);
  state.keyboard.pulseDepth = parseDecimal(qs('#kbdEffectDepth')?.value, state.keyboard.pulseDepth || 0.25);
  state.keyboard.vibratoCents = parseDecimal(qs('#kbdVibratoCents')?.value, state.keyboard.vibratoCents || 18);
  state.keyboard.envelope = qs('#kbdEnvelope')?.value || 'soft';
  state.keyboard.strumMs = parseDecimal(qs('#kbdStrumMs')?.value, 0);
  state.keyboard.arpEnabled = !!qs('#arpEnabled')?.checked;
  state.keyboard.arpLatch = !!qs('#arpLatch')?.checked;
  state.keyboard.arpRate = parseDecimal(qs('#arpRate')?.value, 2);
  state.keyboard.arpPattern = qs('#arpPattern')?.value || 'up';
}

function setKeyboardUIFromState() {
  const k = state.keyboard;
  const values = {
    '#kbdEffectType': k.modType,
    '#kbdEffectRate': k.pulseHz,
    '#kbdEffectDepth': k.pulseDepth,
    '#kbdVibratoCents': k.vibratoCents,
    '#kbdFilter': k.filterCutoff,
    '#kbdLevel': k.level,
    '#kbdEnvelope': k.envelope,
    '#kbdStrumMs': k.strumMs,
    '#kbdVoicing': k.chordVoicing,
    '#kbdInversion': k.chordInversion,
  };
  Object.entries(values).forEach(([sel, val]) => { const el = qs(sel); if (el) el.value = String(val); });
  const capture = qs('#kbdPcCapture');
  if (capture) capture.checked = !!k.pcCapture;
}

function applyKeyboardModPreset() {
  const val = qs('#kbdModPreset')?.value || 'soft528';
  const k = state.keyboard;
  if (val === 'soft528') { k.pulseHz = 0.1; k.pulseDepth = 0.25; k.modType = 'continuous_plus_pulse'; k.vibratoCents = 8; k.filterCutoff = 2400; k.envelope = 'soft'; k.strumMs = 0; k.pan = 0; }
  if (val === 'theta852') { k.pulseHz = 6; k.pulseDepth = 0.38; k.modType = 'continuous_plus_pulse'; k.vibratoCents = 10; k.filterCutoff = 3000; k.envelope = 'soft'; k.strumMs = 15; k.pan = 0; }
  if (val === 'focus741') { k.pulseHz = 15; k.pulseDepth = 0.32; k.modType = 'continuous_plus_pulse'; k.vibratoCents = 6; k.filterCutoff = 3600; k.envelope = 'fast'; k.strumMs = 0; k.pan = 0; }
  if (val === 'witness963') { k.pulseHz = 0.5; k.pulseDepth = 0.42; k.modType = 'pan_motion'; k.vibratoCents = 12; k.filterCutoff = 4200; k.envelope = 'pad'; k.strumMs = 45; k.pan = 0; }
  if (val === 'texture417') { k.pulseHz = 6; k.pulseDepth = 0.55; k.modType = 'filter_sweep'; k.vibratoCents = 8; k.filterCutoff = 1800; k.envelope = 'soft'; k.strumMs = 25; k.pan = 0; }
  if (val === 'vibratoLead') { k.pulseHz = 5.5; k.pulseDepth = 0.55; k.modType = 'vibrato'; k.vibratoCents = 35; k.filterCutoff = 3800; k.envelope = 'fast'; k.strumMs = 0; k.pan = 0; }
  if (val === 'tremoloPulse') { k.pulseHz = 8; k.pulseDepth = 0.5; k.modType = 'tremolo'; k.vibratoCents = 6; k.filterCutoff = 3200; k.envelope = 'soft'; k.strumMs = 0; k.pan = 0; }
  if (val === 'spacePan') { k.pulseHz = 0.35; k.pulseDepth = 0.65; k.modType = 'pan_motion'; k.vibratoCents = 10; k.filterCutoff = 4000; k.envelope = 'pad'; k.strumMs = 30; k.pan = 0; }
  if (val === 'dry') { k.pulseHz = 1; k.pulseDepth = 0.04; k.modType = 'static'; k.vibratoCents = 0; k.filterCutoff = 5000; k.envelope = 'fast'; k.strumMs = 0; k.pan = 0; }
  setKeyboardUIFromState();
  logSessionEvent('keyboard_mod_preset_applied', { preset: val, keyboard: captureKeyboardState() });
  updateKeyboardExplain();
}

function chordMidis(rootMidi) {
  let ints = [...(CHORDS[state.keyboard.chord] || CHORDS.single)].sort((a,b)=>a-b);
  const inv = Math.max(0, Math.min(parseInt(state.keyboard.chordInversion || 0, 10), Math.max(0, ints.length - 1)));
  for (let i = 0; i < inv; i++) {
    const first = ints.shift();
    ints.push(first + 12);
  }
  if (state.keyboard.chordVoicing === 'open' && ints.length >= 3) {
    ints[1] += 12;
    ints.sort((a,b)=>a-b);
  }
  if (state.keyboard.chordVoicing === 'wide' && ints.length >= 3) {
    ints = ints.map((x, i) => x + (i > 0 ? 12 * i : 0)).sort((a,b)=>a-b);
  }
  return ints.map(x => rootMidi + x).filter(m => m >= 24 && m <= 108);
}

function envelopeTimes(name) {
  if (name === 'fast') return { attack: 0.012, release: 0.12 };
  if (name === 'pad') return { attack: 0.22, release: 0.85 };
  return { attack: 0.045, release: 0.28 };
}

function orderArpNotes(notes) {
  const pat = state.keyboard.arpPattern;
  if (pat === 'down') return [...notes].sort((a,b)=>b-a);
  if (pat === 'updown') {
    const up = [...notes].sort((a,b)=>a-b);
    return up.concat(up.slice(1,-1).reverse());
  }
  if (pat === 'random') return [...notes].sort(() => Math.random() - 0.5);
  return [...notes].sort((a,b)=>a-b);
}

async function keyboardDown(midi, group = `kbd-${midi}`) {
  await ensureAudio();
  updateKeyboardStateFromUI();
  updateKeyboardExplain();
  const notes = chordMidis(midi);
  logSessionEvent('keyboard_note_on', { rootMidi: midi, rootName: midiName(midi), group, chord: state.keyboard.chord, voicing: state.keyboard.chordVoicing, inversion: state.keyboard.chordInversion, notes: notes.map(n => ({ midi: n, name: midiName(n), freq: Math.round(midiToFreq(n)*100)/100 })), effect: state.keyboard.modType, arpEnabled: state.keyboard.arpEnabled });
  if (state.keyboard.arpEnabled) {
    startArp(notes, group);
  } else {
    const spacing = Math.max(0, state.keyboard.strumMs || 0) / 1000;
    const voiceIds = notes.map((n, i) => triggerKeyboardVoice(n, { group, delay: spacing * i }));
    state.keyboard.heldGroups.set(group, voiceIds.filter(Boolean));
  }
  startVoiceLoop();
  updateUI();
}

function keyboardUp(group) {
  logSessionEvent('keyboard_note_off', { group });
  if (state.keyboard.arpEnabled && state.keyboard.arpLatch) return;
  if (state.keyboard.arp && state.keyboard.arp.group === group) state.keyboard.arp = null;
  const ids = state.keyboard.heldGroups.get(group) || [];
  ids.forEach(id => releaseVoice(id));
  state.keyboard.heldGroups.delete(group);
}

function triggerKeyboardVoice(midi, opts = {}) {
  if (!state.ctx || !state.master) return null;
  const k = state.keyboard;
  const osc = state.ctx.createOscillator();
  const gain = state.ctx.createGain();
  const filter = state.ctx.createBiquadFilter();
  const pan = state.ctx.createStereoPanner ? state.ctx.createStereoPanner() : null;
  const id = `${Date.now()}-${Math.random()}`;
  const bendCents = state.pitchBend || 0;
  const freq = midiToFreq(midi) * Math.pow(2, bendCents / 1200);
  osc.type = k.waveform;
  osc.frequency.value = freq;
  gain.gain.value = 0;
  filter.type = 'lowpass';
  filter.frequency.value = k.filterCutoff;
  filter.Q.value = 0.9;
  osc.connect(gain); gain.connect(filter);
  if (pan) { filter.connect(pan); pan.connect(state.master); pan.pan.value = k.pan; }
  else filter.connect(state.master);
  const now = state.ctx.currentTime;
  const startAt = now + Math.max(0, opts.delay || 0);
  const env = envelopeTimes(k.envelope);
  osc.start(startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(k.level, startAt + env.attack);
  const voice = { id, midi, freq, osc, gain, filter, pan, started: startAt, released: false, stopAt: null, group: opts.group || null, baseGain: k.level, pulseHz: k.pulseHz, depth: k.pulseDepth, vibratoCents: k.vibratoCents, releaseTime: env.release, modType: k.modType, filterCutoff: k.filterCutoff, panBase: k.pan };
  state.voices.push(voice);
  if (opts.duration) setTimeout(() => releaseVoice(id), opts.duration * 1000);
  return id;
}

function releaseVoice(id) {
  const v = state.voices.find(x => x.id === id);
  if (!v || v.released || !state.ctx) return;
  const now = state.ctx.currentTime;
  v.released = true;
  const rel = Math.max(0.04, v.releaseTime || 0.25);
  v.stopAt = now + rel;
  try { v.gain.gain.cancelScheduledValues(now); v.gain.gain.setTargetAtTime(0, now, rel / 4); v.osc.stop(now + rel + 0.05); } catch {}
}

function stopAllKeyboardVoices(immediate = false) {
  state.keyboard.arp = null;
  state.keyboard.heldGroups.clear();
  const now = state.ctx?.currentTime || 0;
  state.voices.forEach(v => {
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setTargetAtTime(0, now, immediate ? 0.005 : 0.04);
      v.osc.stop(now + (immediate ? 0.03 : 0.25));
    } catch {}
  });
  setTimeout(() => { state.voices.forEach(disconnectVoice); state.voices = []; }, immediate ? 60 : 320);
}

function disconnectVoice(v) {
  try { v.osc.disconnect(); } catch {}
  try { v.gain.disconnect(); } catch {}
  try { v.filter.disconnect(); } catch {}
  try { v.pan && v.pan.disconnect(); } catch {}
}

function startArp(notes, group) {
  state.keyboard.arp = { notes: orderArpNotes(notes), index: 0, group, nextAt: 0 };
  state.keyboard.heldGroups.set(group, []);
}

function updateArp(now) {
  const arp = state.keyboard.arp;
  if (!arp || !arp.notes.length) return;
  const rate = clamp(state.keyboard.arpRate, 0.5, 16);
  if (now >= arp.nextAt) {
    const note = arp.notes[arp.index % arp.notes.length];
    const dur = Math.min(0.85 / rate, 0.55);
    const id = triggerKeyboardVoice(note, { group: arp.group, duration: dur });
    const ids = state.keyboard.heldGroups.get(arp.group) || [];
    if (id) ids.push(id);
    state.keyboard.heldGroups.set(arp.group, ids.slice(-32));
    arp.index += 1;
    arp.nextAt = now + 1 / rate;
  }
}

function updateVoices(now) {
  updateArp(now);
  state.voices = state.voices.filter(v => {
    if (v.stopAt && now > v.stopAt + 0.15) { disconnectVoice(v); return false; }
    if (now < v.started) return true;
    const t = now - v.started;
    const pulse = v.pulseHz > 0 ? (Math.sin(2 * Math.PI * v.pulseHz * t - Math.PI / 2) + 1) / 2 : 1;
    const depth = clamp(v.depth, 0, 0.95);
    let gain = v.released ? 0 : v.baseGain;
    let freq = v.freq;
    let cutoff = v.filterCutoff;
    let pan = v.panBase;
    if (v.modType === 'continuous_plus_pulse') gain *= (1 - depth) + depth * pulse;
    else if (v.modType === 'tremolo') gain *= (1 - depth * 0.85) + (depth * 0.85) * pulse;
    else if (v.modType === 'vibrato') freq = v.freq * Math.pow(2, (Math.sin(2*Math.PI*Math.max(v.pulseHz,0.1)*t) * (v.vibratoCents || 18) * depth) / 1200);
    else if (v.modType === 'filter_sweep') cutoff = clamp(v.filterCutoff * (0.6 + pulse * (1.4 + depth)), 160, 12000);
    else if (v.modType === 'pan_motion') pan = clamp(v.panBase + Math.sin(2*Math.PI*Math.max(v.pulseHz,0.05)*t)*depth, -1, 1);
    try {
      v.gain.gain.setTargetAtTime(gain, now, 0.018);
      v.osc.frequency.setTargetAtTime(freq, now, 0.02);
      v.filter.frequency.setTargetAtTime(cutoff, now, 0.04);
      if (v.pan) v.pan.pan.setTargetAtTime(pan, now, 0.04);
    } catch {}
    return true;
  });
}

function startVoiceLoop() {
  if (state.voiceRaf) return;
  const tick = () => {
    if (!state.ctx) { state.voiceRaf = null; return; }
    updateVoices(state.ctx.currentTime);
    updateUI(false);
    if (state.voices.length || state.keyboard.arp) state.voiceRaf = requestAnimationFrame(tick);
    else state.voiceRaf = null;
  };
  state.voiceRaf = requestAnimationFrame(tick);
}

function updateKeyboardExplain() {
  const box = qs('#kbdExplain');
  if (!box) return;
  const k = state.keyboard;
  const chordName = qs('#kbdChord')?.selectedOptions?.[0]?.textContent || 'Nota única';
  const voicingName = qs('#kbdVoicing')?.selectedOptions?.[0]?.textContent || 'Fechado';
  const envName = qs('#kbdEnvelope')?.selectedOptions?.[0]?.textContent || 'Suave';
  box.innerHTML = `<strong>Teclado</strong><br>Acorde: ${chordName} · voz: ${voicingName} · inversão ${k.chordInversion || 0} · arpejo: ${k.arpEnabled ? `${k.arpRate} nota/s` : 'desligado'}<br>Efeito: ${MOD_LABELS[k.modType]} · velocidade ${fmtHz(k.pulseHz)} Hz · profundidade ${Math.round(k.pulseDepth*100)}% · vibrato ${Math.round(k.vibratoCents || 0)} cents · filtro ${Math.round(k.filterCutoff)} Hz · envelope ${envName}.<br><span class="hint">Cada escolha altera variáveis concretas: notas em Hz, amplitude, envelope, filtro, panorama, vibrato e tempo.</span>`;
}


function setKeyboardStatus(text, kind = 'info') {
  const el = qs('#kbdPcStatus');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function setSelectValue(sel, value) {
  const el = qs(sel);
  if (!el) return false;
  el.value = String(value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setCheckboxValue(sel, value) {
  const el = qs(sel);
  if (!el) return false;
  el.checked = !!value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setVirtualKeyActive(midi, active) {
  qsa(`.key-btn[data-midi="${midi}"]`).forEach(btn => btn.classList.toggle('active', !!active));
}

function syncEffectChips() {
  qsa('[data-kbd-effect]').forEach(b => b.classList.toggle('active', b.dataset.kbdEffect === state.keyboard.modType));
}

function updateKeyboardCaptureUI() {
  const on = !!state.keyboard.pcCapture;
  const capture = qs('#kbdPcCapture');
  if (capture) capture.checked = on;
  const focusBtn = qs('#kbdFocusBtn');
  if (focusBtn) focusBtn.classList.toggle('active', on);
  setKeyboardStatus(on ? 'Captura do teclado do PC ativa. As teclas musicais e atalhos ficam prioritários.' : 'Captura desligada. Clica no painel do teclado ou ativa a captura para tocar com o laptop.', on ? 'ok' : 'warn');
}

function releasePcKeyboardNotes() {
  const groups = Array.from(state.keyboard.downPcGroups || []);
  groups.forEach(group => keyboardUp(group));
  groups.forEach(group => {
    const midi = Number(group.split('-')[1]);
    if (Number.isFinite(midi)) setVirtualKeyActive(midi, false);
  });
  state.keyboard.downPcGroups?.clear();
}

function cycleSelect(sel, direction = 1) {
  const el = qs(sel);
  if (!el || !el.options.length) return;
  let idx = el.selectedIndex + direction;
  if (idx < 0) idx = el.options.length - 1;
  if (idx >= el.options.length) idx = 0;
  el.selectedIndex = idx;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function adjustRange(sel, delta) {
  const el = qs(sel);
  if (!el) return;
  const step = parseDecimal(el.step, 1) || 1;
  const min = parseDecimal(el.min, -Infinity);
  const max = parseDecimal(el.max, Infinity);
  const current = parseDecimal(el.value, 0);
  el.value = String(clamp(current + delta * step, min, max));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function handlePcKeyboardShortcut(key, e) {
  if (PC_CHORD_SHORTCUTS[key] !== undefined) {
    setSelectValue('#kbdChord', PC_CHORD_SHORTCUTS[key]);
    setKeyboardStatus(`Acorde por atalho: ${qs('#kbdChord')?.selectedOptions?.[0]?.textContent || PC_CHORD_SHORTCUTS[key]}.`, 'ok');
    return true;
  }
  if (PC_EFFECT_SHORTCUTS[key] !== undefined) {
    const effect = PC_EFFECT_SHORTCUTS[key];
    setSelectValue('#kbdEffectType', effect);
    state.keyboard.modType = effect;
    syncEffectChips();
    updateKeyboardExplain();
    setKeyboardStatus(`Efeito por atalho: ${PC_EFFECT_LABELS[effect] || effect}.`, 'ok');
    return true;
  }
  if (key === 'z') { cycleSelect('#kbdOctave', -1); renderKeyboard(); setKeyboardStatus('Oitava desceu.', 'ok'); return true; }
  if (key === 'x') { cycleSelect('#kbdOctave', 1); renderKeyboard(); setKeyboardStatus('Oitava subiu.', 'ok'); return true; }
  if (key === 'c') { cycleSelect('#kbdChord', 1); setKeyboardStatus(`Acorde: ${qs('#kbdChord')?.selectedOptions?.[0]?.textContent || ''}.`, 'ok'); return true; }
  if (key === 'i') { cycleSelect('#kbdInversion', e.shiftKey ? -1 : 1); setKeyboardStatus(`Inversão: ${qs('#kbdInversion')?.selectedOptions?.[0]?.textContent || ''}.`, 'ok'); return true; }
  if (key === 'r') { setCheckboxValue('#arpEnabled', !qs('#arpEnabled')?.checked); setKeyboardStatus(qs('#arpEnabled')?.checked ? 'Arpegiador ligado.' : 'Arpegiador desligado.', 'ok'); return true; }
  if (key === 'l') { setCheckboxValue('#arpLatch', !qs('#arpLatch')?.checked); setKeyboardStatus(qs('#arpLatch')?.checked ? 'Manter arpejo ligado.' : 'Manter arpejo desligado.', 'ok'); return true; }
  if (key === ',') { adjustRange('#kbdEffectDepth', -4); setKeyboardStatus('Profundidade do efeito reduzida.', 'ok'); return true; }
  if (key === '.') { adjustRange('#kbdEffectDepth', 4); setKeyboardStatus('Profundidade do efeito aumentada.', 'ok'); return true; }
  if (key === '-') { adjustRange('#kbdVibratoCents', -4); setKeyboardStatus('Vibrato reduzido.', 'ok'); return true; }
  if (key === '+' || key === '=') { adjustRange('#kbdVibratoCents', 4); setKeyboardStatus('Vibrato aumentado.', 'ok'); return true; }
  if (key === 'escape') { releasePcKeyboardNotes(); stopAllKeyboardVoices(false); setKeyboardStatus('Notas/arpejo libertados.', 'warn'); return true; }
  if (key === ' ') {
    const root = (state.keyboard.octave + 1) * 12 + state.keyboard.rootSemi;
    keyboardDown(root, 'pc-space-test');
    setTimeout(() => keyboardUp('pc-space-test'), state.keyboard.arpEnabled ? 1400 : 900);
    setKeyboardStatus('Teste de acorde disparado pela barra de espaço.', 'ok');
    return true;
  }
  return false;
}

function shouldCapturePcKeyboard(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const keyboardVisible = !!qs('#modeKeyboard')?.classList.contains('active');
  if (!keyboardVisible) return false;
  const target = e.target;
  const editable = target && target.matches && target.matches('input, textarea, select, [contenteditable="true"]');
  if (state.keyboard.pcCapture) return true;
  if (editable) return false;
  return true;
}

function logKeyboardParameterChange(source) {
  updateKeyboardStateFromUI();
  logSessionEvent('keyboard_parameter_change', { source, keyboard: captureKeyboardState() });
}

function setupKeyboardEvents() {
  ['#kbdRoot','#kbdScale','#kbdOctave'].forEach(sel => qs(sel)?.addEventListener('change', () => { logKeyboardParameterChange(sel); renderKeyboard(); }));
  ['#kbdWaveform','#kbdChord','#kbdVoicing','#kbdInversion','#kbdEffectType','#kbdEnvelope','#arpRate','#arpPattern'].forEach(sel => qs(sel)?.addEventListener('change', () => { logKeyboardParameterChange(sel); syncEffectChips(); updateKeyboardExplain(); }));
  ['#kbdLevel','#kbdFilter','#kbdEffectRate','#kbdEffectDepth','#kbdVibratoCents','#kbdStrumMs'].forEach(sel => qs(sel)?.addEventListener('input', () => { updateKeyboardStateFromUI(); logSessionContinuous('keyboard_parameter_change', sel, { source: sel, keyboard: captureKeyboardState() }, 0.25); updateKeyboardExplain(); }));
  ['#arpEnabled','#arpLatch'].forEach(sel => qs(sel)?.addEventListener('change', () => { logKeyboardParameterChange(sel); updateKeyboardExplain(); }));
  qs('#kbdModPreset')?.addEventListener('change', () => { applyKeyboardModPreset(); syncEffectChips(); });
  qs('#kbdPcCapture')?.addEventListener('change', (e) => {
    state.keyboard.pcCapture = !!e.target.checked;
    logSessionEvent('keyboard_pc_capture_change', { pcCapture: state.keyboard.pcCapture });
    updateKeyboardCaptureUI();
  });
  qs('#kbdFocusBtn')?.addEventListener('click', () => {
    state.keyboard.pcCapture = true;
    document.activeElement?.blur?.();
    qs('#modeKeyboard')?.focus?.();
    updateKeyboardCaptureUI();
  });
  qs('#kbdReleaseBtn')?.addEventListener('click', () => {
    releasePcKeyboardNotes();
    stopAllKeyboardVoices(false);
    setKeyboardStatus('Notas/arpejo libertados manualmente.', 'warn');
  });
  qsa('[data-kbd-effect]').forEach(btn => btn.addEventListener('click', () => {
    const el = qs('#kbdEffectType');
    if (el) el.value = btn.dataset.kbdEffect;
    updateKeyboardStateFromUI();
    syncEffectChips();
    updateKeyboardExplain();
  }));
  qs('#testChordBtn')?.addEventListener('click', async () => {
    const root = (state.keyboard.octave + 1) * 12 + state.keyboard.rootSemi;
    await keyboardDown(root, 'test-chord');
    setTimeout(() => keyboardUp('test-chord'), state.keyboard.arpEnabled ? 1400 : 900);
  });
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (!shouldCapturePcKeyboard(e)) return;
    if (e.target?.matches?.('input, textarea, select, [contenteditable="true"]') && state.keyboard.pcCapture) e.target.blur();

    const semi = PC_KEY_TO_SEMITONE[key];
    if (semi !== undefined) {
      if (e.repeat) return;
      e.preventDefault();
      const octave = state.keyboard.octave + (e.shiftKey ? 1 : 0);
      const midi = (octave + 1) * 12 + semi;
      const group = `pc-${midi}`;
      if (state.keyboard.downPcGroups.has(group)) return;
      state.keyboard.downPcGroups.add(group);
      setVirtualKeyActive(midi, true);
      keyboardDown(midi, group);
      setKeyboardStatus(`Nota ${midiName(midi)} pelo teclado do laptop.`, 'ok');
      return;
    }

    if (handlePcKeyboardShortcut(key, e)) {
      e.preventDefault();
      logSessionEvent('pc_keyboard_shortcut', { key, keyboard: captureKeyboardState() });
      updateKeyboardStateFromUI();
      syncEffectChips();
      updateKeyboardExplain();
    }
  });
  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const semi = PC_KEY_TO_SEMITONE[key];
    if (semi === undefined) return;
    const octave = state.keyboard.octave + (e.shiftKey ? 1 : 0);
    const midi = (octave + 1) * 12 + semi;
    const group = `pc-${midi}`;
    state.keyboard.downPcGroups.delete(group);
    setVirtualKeyActive(midi, false);
    keyboardUp(group);
  });
  window.addEventListener('blur', () => { releasePcKeyboardNotes(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releasePcKeyboardNotes(); });
  updateKeyboardCaptureUI();
  syncEffectChips();
}

function applyControllerValue(assign, unit) {
  const l = state.layers[0];
  const k = state.keyboard;
  if (assign === 'freq') l.freq = Math.round(unitToLogRange(unit, 80, 1200) * 10) / 10;
  if (assign === 'pulseDepth') l.pulseDepth = Math.round(unit * 100) / 100;
  if (assign === 'pulseHz') l.pulseHz = Math.round(unitToLogRange(unit, 0.1, 40) * 100) / 100;
  if (assign === 'filterCutoff') l.filterCutoff = Math.round(unitToLogRange(unit, 180, 10000));
  if (assign === 'pan') l.pan = Math.round((unit * 2 - 1) * 100) / 100;
  if (assign === 'kbdFilter') { k.filterCutoff = Math.round(unitToLogRange(unit, 250, 10000)); const el = qs('#kbdFilter'); if (el) el.value = k.filterCutoff; }
  if (assign === 'kbdDepth') { k.pulseDepth = Math.round(unit * 95) / 100; const el = qs('#kbdEffectDepth'); if (el) el.value = k.pulseDepth; }
  if (assign === 'kbdRate') { k.pulseHz = Math.round(unitToLogRange(unit, 0.1, 40) * 100) / 100; const el = qs('#kbdEffectRate'); if (el) el.value = k.pulseHz; }
  if (assign === 'kbdVibrato') { k.vibratoCents = Math.round(unit * 80); const el = qs('#kbdVibratoCents'); if (el) el.value = k.vibratoCents; }
  logSessionContinuous('controller_parameter_change', assign, { assign, unit, layers: safeClone(state.layers), keyboard: captureKeyboardState() }, 0.25);
  syncNodesFromState();
  renderLayers();
  updateKeyboardExplain();
  updateUI();
}

function setupControllerPad() {
  const pad = qs('#controllerPad');
  if (!pad) return;
  let down = false;
  const move = (e) => {
    const rect = pad.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    state.keyboard.controller.x = x; state.keyboard.controller.y = y;
    qs('#controllerCrosshair').style.left = `${x*100}%`;
    qs('#controllerCrosshair').style.top = `${y*100}%`;
    const xa = qs('#ctrlXAssign').value; const ya = qs('#ctrlYAssign').value;
    applyControllerValue(xa, x);
    applyControllerValue(ya, 1-y);
    qs('#controllerReadout').textContent = `X → ${qs('#ctrlXAssign').selectedOptions[0].textContent}; Y → ${qs('#ctrlYAssign').selectedOptions[0].textContent}`;
  };
  pad.addEventListener('pointerdown', (e)=>{ down=true; pad.setPointerCapture(e.pointerId); move(e); });
  pad.addEventListener('pointermove', (e)=>{ if(down) move(e); });
  pad.addEventListener('pointerup', ()=>{ down=false; });
  pad.addEventListener('pointercancel', ()=>{ down=false; });
}

async function enableMIDI() {
  const status = qs('#midiStatus');
  if (!navigator.requestMIDIAccess) { status.textContent = 'Este browser não disponibilizou MIDI nesta sessão.'; return; }
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    state.midiAccess = access;
    const bind = () => {
      let count = 0;
      access.inputs.forEach(input => { input.onmidimessage = onMIDIMessage; count += 1; });
      status.textContent = count ? `MIDI ativo: ${count} entrada(s) ligada(s).` : 'MIDI ativo, mas sem entradas detetadas.';
    };
    access.onstatechange = bind;
    bind();
  } catch (err) {
    status.textContent = 'MIDI não autorizado ou indisponível.';
  }
}

function onMIDIMessage(ev) {
  const [status, d1, d2] = ev.data;
  const cmd = status & 0xf0;
  if (cmd === 0x90 && d2 > 0) { logSessionEvent('midi_note_on', { midi: d1, velocity: d2, name: midiName(d1) }); keyboardDown(d1, `midi-${d1}`); }
  else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) { logSessionEvent('midi_note_off', { midi: d1, name: midiName(d1) }); keyboardUp(`midi-${d1}`); }
  else if (cmd === 0xb0) {
    const u = ccToUnit(d2);
    if (d1 === 1) { state.keyboard.pulseDepth = u; const el = qs('#kbdEffectDepth'); if (el) el.value = u.toFixed(2); updateKeyboardExplain(); }
    if (d1 === 7) { qs('#masterGain').value = (u * 0.9).toFixed(2); onMasterChange(); }
    if (d1 === 74) { state.keyboard.filterCutoff = Math.round(unitToLogRange(u, 250, 10000)); qs('#kbdFilter').value = state.keyboard.filterCutoff; updateKeyboardExplain(); }
    if (d1 === 10) { state.layers[0].pan = Math.round((u*2-1)*100)/100; renderLayers(); syncNodesFromState(); updateUI(); }
  } else if (cmd === 0xe0) {
    const value14 = (d2 << 7) + d1;
    state.pitchBend = ((value14 - 8192) / 8192) * 120;
    logSessionContinuous('midi_pitch_bend', 'pitchbend', { value14, cents: state.pitchBend }, 0.2);
  }
}

async function enableMotion() {
  const status = qs('#motionStatus');
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { status.textContent = 'Movimento não autorizado.'; return; }
    }
    state.keyboard.motionActive = true;
    logSessionEvent('device_motion_enabled', { status: 'enabled' });
    status.textContent = 'Movimento ativo: inclinação esquerda/direita → panorama; frente/trás → filtro.';
    window.addEventListener('deviceorientation', onDeviceMotionControl, { passive: true });
  } catch {
    status.textContent = 'Movimento indisponível neste dispositivo/browser.';
  }
}

function onDeviceMotionControl(e) {
  if (!state.keyboard.motionActive) return;
  const gamma = clamp((e.gamma || 0) / 45, -1, 1);
  const beta = clamp((e.beta || 0) / 60, -1, 1);
  state.layers[0].pan = Math.round(gamma * 100) / 100;
  state.layers[0].filterCutoff = Math.round(unitToLogRange((1 - beta) / 2, 300, 8000));
  logSessionContinuous('device_motion_change', 'orientation', { gamma: e.gamma, beta: e.beta, pan: state.layers[0].pan, filterCutoff: state.layers[0].filterCutoff }, 0.4);
  syncNodesFromState();
  updateUI();
}

function setupControllerEvents() {
  qs('#enableMidiBtn')?.addEventListener('click', enableMIDI);
  qs('#enableMotionBtn')?.addEventListener('click', enableMotion);
  ['#ctrlXAssign','#ctrlYAssign'].forEach(sel => qs(sel)?.addEventListener('change', () => qs('#controllerReadout').textContent = 'Mapeamento atualizado.'));
  setupControllerPad();
}


function setQuickTimerSeconds(totalSeconds, source = 'quick_timer') {
  const total = clamp(Math.round(parseDecimal(totalSeconds, 0)), 0, 24 * 3600);
  const enabled = total > 0;
  qs('#timerEnabled').checked = enabled;
  qs('#timerHours').value = Math.floor(total / 3600);
  qs('#timerMinutes').value = Math.floor((total % 3600) / 60);
  qs('#timerSeconds').value = total % 60;
  if (state.isPlaying && !state.sequenceMode && state.ctx) {
    state.timerStartedAt = state.ctx.currentTime;
    state.timerDuration = total;
  }
  logSessionEvent('quick_timer_change', { source, enabled, duration_s: total, appliesNow: state.isPlaying && !state.sequenceMode });
  updateUI();
}

function applyTimerInputsToPlayback(source = 'detailed_timer') {
  const total = getTimerDuration();
  const effective = qs('#timerEnabled').checked ? total : 0;
  if (state.isPlaying && !state.sequenceMode && state.ctx) {
    state.timerStartedAt = state.ctx.currentTime;
    state.timerDuration = effective;
  }
  logSessionEvent('timer_change', { source, enabled: effective > 0, duration_s: effective, appliesNow: state.isPlaying && !state.sequenceMode });
  updateUI();
}

function setupQuickTimer() {
  qsa('[data-quick-min]').forEach(btn => btn.addEventListener('click', () => {
    setQuickTimerSeconds(parseDecimal(btn.dataset.quickMin, 0) * 60, 'quick_preset');
    qs('#quickTimerDetails').open = false;
  }));
  qs('#quickTimerApplyCustom')?.addEventListener('click', () => {
    const minutes = clamp(parseDecimal(qs('#quickTimerCustomMinutes').value, 20), 1, 1440);
    setQuickTimerSeconds(minutes * 60, 'quick_custom');
    qs('#quickTimerDetails').open = false;
  });
}

function getVideoMimeType() {
  if (!window.MediaRecorder) return '';
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidates.find(type => MediaRecorder.isTypeSupported?.(type)) || '';
}

function setSocialCanvasSize() {
  const canvas = qs('#socialCanvas');
  if (!canvas) return;
  const quality = qs('#socialQuality')?.value || '720';
  canvas.width = quality === '1080' ? 1080 : 720;
  canvas.height = quality === '1080' ? 1920 : 1280;
}

function socialText(ctx, text, x, y, size, weight = 500, align = 'center', alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#e0e0e0';
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSocialFrame() {
  const canvas = qs('#socialCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const now = state.ctx?.currentTime || performance.now() / 1000;
  const l = state.layers[0];
  const pulseHz = Math.max(0.01, parseDecimal(l?.pulseHz, 0.1));
  const phase = (Math.sin(2 * Math.PI * pulseHz * now - Math.PI / 2) + 1) / 2;
  const visual = qs('#socialVisual')?.value || 'pulse';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * .5, h * .42, 0, w * .5, h * .42, w * .72);
  glow.addColorStop(0, 'rgba(46,139,87,0.16)');
  glow.addColorStop(.5, 'rgba(197,160,89,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  socialText(ctx, 'SYNTHLAB', w / 2, h * .10, Math.round(w * .055), 700, 'center', .92);
  socialText(ctx, 'exploração sonora experimental', w / 2, h * .145, Math.round(w * .026), 400, 'center', .64);

  if (visual === 'wave') {
    const data = new Uint8Array(state.analyser?.fftSize || 2048);
    if (state.analyser) state.analyser.getByteTimeDomainData(data);
    else data.fill(128);
    ctx.save();
    ctx.lineWidth = Math.max(3, w * .006);
    ctx.strokeStyle = '#c5a059';
    ctx.shadowColor = 'rgba(197,160,89,.55)';
    ctx.shadowBlur = w * .035;
    ctx.beginPath();
    const yMid = h * .45;
    const amp = h * .12;
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / (data.length - 1)) * w;
      const y = yMid + ((data[i] - 128) / 128) * amp;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  } else if (visual === 'minimal') {
    ctx.save();
    ctx.strokeStyle = 'rgba(197,160,89,.45)';
    ctx.lineWidth = Math.max(2, w * .003);
    ctx.strokeRect(w * .16, h * .29, w * .68, h * .32);
    ctx.restore();
    socialText(ctx, `${fmtHz(l?.freq || 0)} Hz`, w / 2, h * .405, Math.round(w * .11), 700);
    socialText(ctx, `pulso ${fmtHz(l?.pulseHz || 0)} Hz`, w / 2, h * .49, Math.round(w * .045), 500, 'center', .78);
  } else {
    const radius = w * (.13 + phase * .095);
    ctx.save();
    ctx.beginPath();
    ctx.arc(w / 2, h * .43, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(46,139,87,${.18 + phase * .28})`;
    ctx.fill();
    ctx.lineWidth = Math.max(4, w * .008);
    ctx.strokeStyle = '#c5a059';
    ctx.shadowColor = 'rgba(197,160,89,.65)';
    ctx.shadowBlur = w * (.04 + phase * .025);
    ctx.stroke();
    ctx.restore();
  }

  socialText(ctx, `${fmtHz(l?.freq || 0)} Hz`, w / 2, h * .69, Math.round(w * .083), 700);
  socialText(ctx, `Pulso ${fmtHz(l?.pulseHz || 0)} Hz`, w / 2, h * .755, Math.round(w * .038), 500, 'center', .76);
  socialText(ctx, MOD_LABELS[l?.modType] || 'Som SynthLab', w / 2, h * .81, Math.round(w * .028), 400, 'center', .58);

  let footer = 'sem limite';
  if (state.timerDuration && state.isPlaying && !state.sequenceMode) footer = `restante ${secondsToClock(getTimerRemaining(now))}`;
  else if (state.isVideoRecording && state.ctx) footer = `vídeo ${secondsToClock(state.ctx.currentTime - state.videoStartedAt)}`;
  socialText(ctx, footer, w / 2, h * .91, Math.round(w * .027), 500, 'center', .68);
}

function socialAnimationLoop() {
  if (!state.isVideoRecording) return;
  drawSocialFrame();
  updateSocialVideoUI();
  state.videoRaf = requestAnimationFrame(socialAnimationLoop);
}

function revokeVideoUrl() {
  if (state.videoUrl) {
    try { URL.revokeObjectURL(state.videoUrl); } catch {}
    state.videoUrl = null;
  }
}

function updateSocialVideoUI() {
  const start = qs('#socialStartBtn');
  const stop = qs('#socialStopBtn');
  const status = qs('#socialStatus');
  const save = qs('#socialSaveLink');
  if (!start || !stop || !status || !save) return;
  start.disabled = state.isVideoRecording;
  stop.disabled = !state.isVideoRecording;
  save.classList.toggle('hidden', !state.videoUrl);
  if (state.isVideoRecording) {
    const elapsed = state.ctx ? Math.max(0, state.ctx.currentTime - state.videoStartedAt) : 0;
    status.textContent = `Vídeo: a gravar · ${secondsToClock(elapsed)} · ${state.videoMimeType || 'formato automático'}`;
  } else if (state.videoUrl) {
    status.textContent = `Vídeo pronto para guardar · ${state.videoMimeType.includes('mp4') ? 'MP4' : 'WebM'}.`;
  } else {
    status.textContent = 'Vídeo: parado. Inicia primeiro o som que queres exportar.';
  }
}

async function startSocialVideo() {
  const status = qs('#socialStatus');
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    if (status) status.textContent = 'Vídeo não suportado neste browser.';
    return;
  }
  if (!state.isPlaying && state.voices.length === 0) {
    if (status) status.textContent = 'Inicia primeiro a reprodução ou toca notas antes de gravar o vídeo.';
    return;
  }
  await ensureAudio();
  if (!state.recDest?.stream?.getAudioTracks().length) {
    if (status) status.textContent = 'Fluxo de áudio interno indisponível.';
    return;
  }
  if (state.isVideoRecording) return;
  revokeVideoUrl();
  setSocialCanvasSize();
  drawSocialFrame();
  const canvas = qs('#socialCanvas');
  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...state.recDest.stream.getAudioTracks()
  ]);
  state.videoStream = stream;
  state.videoChunks = [];
  state.videoMimeType = getVideoMimeType();
  const quality = qs('#socialQuality')?.value || '720';
  const opts = {
    videoBitsPerSecond: quality === '1080' ? 8000000 : 4200000,
    audioBitsPerSecond: 192000
  };
  if (state.videoMimeType) opts.mimeType = state.videoMimeType;
  try {
    state.videoRecorder = new MediaRecorder(stream, opts);
    state.videoRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) state.videoChunks.push(ev.data);
    };
    state.videoRecorder.onerror = () => {
      state.isVideoRecording = false;
      if (status) status.textContent = 'Erro durante a gravação de vídeo.';
      updateSocialVideoUI();
    };
    state.videoRecorder.onstop = () => {
      const type = state.videoMimeType || 'video/webm';
      const blob = new Blob(state.videoChunks, { type });
      state.videoUrl = URL.createObjectURL(blob);
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const link = qs('#socialSaveLink');
      if (link) {
        link.href = state.videoUrl;
        link.download = `synthlab-studio-reels-${stamp}.${ext}`;
      }
      state.isVideoRecording = false;
      if (state.videoRaf) cancelAnimationFrame(state.videoRaf);
      state.videoStream?.getVideoTracks().forEach(track => track.stop());
      state.videoStream = null;
      logSessionEvent('social_video_stop', { format: type, extension: ext });
      updateSocialVideoUI();
    };
    state.videoRecorder.start(250);
    state.videoStartedAt = state.ctx.currentTime;
    state.isVideoRecording = true;
    logSessionEvent('social_video_start', { mimeType: state.videoMimeType || 'auto', quality, visual: qs('#socialVisual')?.value || 'pulse' });
    socialAnimationLoop();
    updateSocialVideoUI();
  } catch (err) {
    state.videoStream?.getVideoTracks().forEach(track => track.stop());
    state.videoStream = null;
    state.isVideoRecording = false;
    if (status) status.textContent = 'O browser bloqueou este formato de vídeo. Experimenta outro browser/dispositivo.';
    updateSocialVideoUI();
  }
}

function stopSocialVideo(reason = 'user_stop') {
  if (!state.videoRecorder || !state.isVideoRecording) return;
  logSessionEvent('social_video_stop_requested', { reason });
  try { state.videoRecorder.stop(); }
  catch {
    state.isVideoRecording = false;
    updateSocialVideoUI();
  }
}

function setupSocialVideo() {
  qs('#socialStartBtn')?.addEventListener('click', startSocialVideo);
  qs('#socialStopBtn')?.addEventListener('click', () => stopSocialVideo('user_stop'));
  qs('#socialVisual')?.addEventListener('change', drawSocialFrame);
  qs('#socialQuality')?.addEventListener('change', () => { setSocialCanvasSize(); drawSocialFrame(); });
  setSocialCanvasSize();
  drawSocialFrame();
}

function initEvents() {
  setupQuickTimer();
  setupSocialVideo();
  qs('#playStopBtn').addEventListener('click', () => state.isPlaying ? stopPlayback() : startPlayback());
  qs('#panicBtn').addEventListener('click', panic);
  qs('#recordStartBtn')?.addEventListener('click', startRecording);
  qs('#recordStopBtn')?.addEventListener('click', stopRecording);
  qs('#recordSaveBothBtn')?.addEventListener('click', triggerSaveBoth);
  qs('#masterGain').addEventListener('input', onMasterChange);
  qsa('.tab').forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
  qs('#applyPlayerPreset').addEventListener('click', applyPlayerPreset);
  qs('#timerEnabled').addEventListener('change', () => applyTimerInputsToPlayback('detailed_toggle'));
  ['#timerHours','#timerMinutes','#timerSeconds'].forEach(sel => qs(sel).addEventListener('input', () => applyTimerInputsToPlayback('detailed_value')));
  qs('#loadSequencePreset').addEventListener('click', loadSequencePreset);
  qs('#startSequenceBtn').addEventListener('click', () => startPlayback({ sequence: true }));
  qs('#addSequenceRow').addEventListener('click', () => { const row = createSequenceRow({ label: `Etapa ${state.sequenceRows.length + 1}` }); state.sequenceRows.push(row); logSessionEvent('sequence_row_added', { row: safeClone(row) }); renderSequenceRows(); updateUI(); });
  setupXY();
  setupStudioChips();
  setupKeyboardEvents();
  setupControllerEvents();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js?v=studio1_7').catch(() => {});
  }
}

function init() {
  fillSelects();
  defaultSequence();
  renderSequenceRows();
  renderLayers();
  renderKeyboard();
  applyKeyboardModPreset();
  initEvents();
  onMasterChange();
  updateUI();
  registerSW();
}

document.addEventListener('DOMContentLoaded', init);
