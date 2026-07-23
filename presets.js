/* SynthLab Studio v1 — presets e sequências */
window.SYNTHLAB_PRESETS = (() => {
  const bases = [
    { hz: 174, label: '174 Hz — segurança corporal', meaning: 'relaxamento corporal e sensação de base física' },
    { hz: 285, label: '285 Hz — vitalidade e integridade', meaning: 'vitalidade simbólica e integridade corporal' },
    { hz: 396, label: '396 Hz — ancoragem emocional', meaning: 'ancoragem, estabilidade e redução subjetiva de medo' },
    { hz: 417, label: '417 Hz — mudança de padrões', meaning: 'transição, renovação e quebra simbólica de padrões' },
    { hz: 528, label: '528 Hz — repouso e vitalidade', meaning: 'repouso, vitalidade e sensação de recuperação' },
    { hz: 639, label: '639 Hz — empatia e relação', meaning: 'empatia, comunicação e harmonia relacional' },
    { hz: 741, label: '741 Hz — expressão e clareza', meaning: 'clareza, expressão, escrita e organização mental' },
    { hz: 852, label: '852 Hz — intuição e discernimento', meaning: 'escuta interior, discernimento e presença antes do pensamento' },
    { hz: 963, label: '963 Hz — contemplação e silêncio', meaning: 'silêncio, contemplação e estado testemunha' },
  ];

  const pulses = [
    { hz: 0.1, label: '0.1 Hz — coerência / ciclo 10 s', meaning: 'ciclo lento, respiração guiada e estabilidade' },
    { hz: 0.5, label: '0.5 Hz — Turiya / transe lento', meaning: 'transe muito lento, observação e silêncio interior' },
    { hz: 2, label: '2 Hz — Delta', meaning: 'descanso profundo e uso noturno/repouso' },
    { hz: 6, label: '6 Hz — Theta', meaning: 'meditação, imaginação e trabalho simbólico' },
    { hz: 10, label: '10 Hz — Alpha', meaning: 'relaxamento consciente e presença desperta' },
    { hz: 15, label: '15 Hz — Beta', meaning: 'foco ativo e trabalho estruturado' },
    { hz: 40, label: '40 Hz — Gamma experimental', meaning: 'clareza intensa/hiper-foco experimental' },
  ];

  const sequencePresets = [
    {
      id: 'night_528_extended',
      name: 'Sequência Noturna Alargada — foco 528 Hz',
      goal: 'Indução ao sono, transe inicial e regeneração prolongada na madrugada utilizando a base de 528 Hz.',
      stages: [
        { label: 'Etapa 1 — alívio físico inicial', freq: 174, pulseHz: 2, hours: 0, minutes: 30, level: 45, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 2 — silêncio e transe', freq: 285, pulseHz: 0.5, hours: 3, minutes: 0, level: 38, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 3 — regeneração longa', freq: 528, pulseHz: 2, hours: 5, minutes: 0, level: 35, mode: 'continuous_plus_pulse' },
      ],
    },
    {
      id: 'anxiety_reset_grounding',
      name: 'Reset de Ansiedade e Ancoragem',
      goal: 'Trazer o utilizador de hiperalerta ou pânico para presença corporal segura.',
      stages: [
        { label: 'Etapa 1 — suavizar ritmo mental', freq: 396, pulseHz: 10, hours: 0, minutes: 5, level: 38, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 2 — respiração lenta', freq: 174, pulseHz: 0.1, hours: 0, minutes: 10, level: 35, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 3 — presença sem pensamento', freq: 852, pulseHz: 6, hours: 0, minutes: 10, level: 32, mode: 'continuous_plus_pulse' },
      ],
    },
    {
      id: 'deep_focus_writing',
      name: 'Foco Profundo e Escrita Crítica',
      goal: 'Blocos de trabalho estruturado, organização mental e clareza cognitiva.',
      stages: [
        { label: 'Etapa 1 — clareza inicial', freq: 741, pulseHz: 10, hours: 0, minutes: 10, level: 35, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 2 — escrita constante', freq: 741, pulseHz: 15, hours: 0, minutes: 40, level: 40, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 3 — pico experimental', freq: 963, pulseHz: 40, hours: 0, minutes: 10, level: 25, mode: 'continuous_plus_pulse' },
      ],
    },
    {
      id: 'cosmic_transition_meditation',
      name: 'Meditação de Transição Cósmica',
      goal: 'Sessão curta para quebra de padrões antigos e expansão contemplativa.',
      stages: [
        { label: 'Etapa 1 — padrões e subconsciente', freq: 417, pulseHz: 6, hours: 0, minutes: 15, level: 36, mode: 'continuous_plus_pulse' },
        { label: 'Etapa 2 — silêncio testemunha', freq: 963, pulseHz: 0.5, hours: 0, minutes: 15, level: 34, mode: 'continuous_plus_pulse' },
      ],
    },
  ];

  return { bases, pulses, sequencePresets };
})();
