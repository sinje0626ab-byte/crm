// 사운드 엔진. 언데드러쉬(YJ GAMES)의 Web Audio 신시사이저를 그대로 가져와
// 이 게임에 맞는 효과음과 배경음(겨울 앰비언트)을 더했다. 외부 음원 파일이 없다.
const MUTE_KEY = 'whiteout-hunter-muted';

export const Audio = (() => {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch { /* 저장소가 막혀 있으면 기본값 */ }

  // 프레임당 동시 발생 사운드 상한: 오실레이터 폭증 방지
  let voices = 0;
  const MAX_VOICES = 12;

  const rand = (a, b) => a + Math.random() * (b - a);

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.45;
      master.connect(ctx.destination);

      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);

      musicBus = ctx.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(master);
    } catch {
      ctx = null;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type = 'square', vol = 1, slideTo = null) {
    if (!ctx || muted || voices >= MAX_VOICES) return;
    voices++;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol = 1, freq = 900, q = 1) {
    if (!ctx || muted || voices >= MAX_VOICES) return;
    voices++;
    const len = (ctx.sampleRate * dur) | 0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(bp);
    bp.connect(g);
    g.connect(sfxBus);
    src.start();
  }

  // 너무 자주 울리는 소리를 솎아낸다
  const lastAt = {};
  function throttled(key, ms, fn) {
    const now = performance.now();
    if (lastAt[key] && now - lastAt[key] < ms) return;
    lastAt[key] = now;
    fn();
  }

  const S = {
    // 전투 / 채집
    swing() { noise(0.13, 0.22, 1500, 0.8); tone(340, 0.12, 'sawtooth', 0.07, 150); },
    chop() { tone(190, 0.09, 'square', 0.28, 95); noise(0.08, 0.32, 520); },
    treeFall() {
      tone(120, 0.5, 'sawtooth', 0.22, 48);
      noise(0.55, 0.4, 300, 0.7);
      setTimeout(() => noise(0.2, 0.25, 900), 260);
    },
    bearHit() { tone(rand(300, 360), 0.05, 'triangle', 0.2, 180); noise(0.05, 0.18, 700); },
    bearDie() { tone(rand(150, 200), 0.34, 'sawtooth', 0.32, 58); noise(0.3, 0.26, 420); },
    arrow() { noise(0.07, 0.16, 2200); tone(700, 0.06, 'triangle', 0.1, 1200); },
    skill() {
      // 크게 휘두르는 바람 + 낮은 충격음 + 금속성 잔향
      noise(0.45, 0.4, 900, 0.6);
      tone(140, 0.4, 'sawtooth', 0.3, 50);
      [880, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, 0.24, 'triangle', 0.2, f * 1.2), i * 55));
    },
    skillReady() { tone(784, 0.1, 'sine', 0.16, 1046); },
    levelup() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.26, 'triangle', 0.3), i * 85)); },
    hurt() {
      tone(165, 0.16, 'sawtooth', 0.4, 58);
      tone(90, 0.22, 'triangle', 0.3, 42);
      noise(0.16, 0.36, 300);
    },
    down() { [400, 330, 262, 180].forEach((f, i) => setTimeout(() => tone(f, 0.32, 'sawtooth', 0.3, f * 0.6), i * 150)); },

    // 자원 / 경제
    pickWood() { throttled('pw', 70, () => tone(430, 0.05, 'triangle', 0.16, 620)); },
    pickMeat() { throttled('pm', 70, () => tone(700, 0.05, 'sine', 0.16, 900)); },
    deposit() { throttled('dp', 110, () => tone(520, 0.06, 'sine', 0.14, 300)); },
    cook() { throttled('ck', 260, () => noise(0.18, 0.1, 2600, 0.6)); },
    coin() { throttled('ci', 45, () => tone(1046, 0.05, 'sine', 0.2, 1568)); },
    sell() { [784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.26), i * 70)); },
    buy() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.3), i * 70)); },
    full() { tone(330, 0.1, 'square', 0.18); setTimeout(() => tone(247, 0.14, 'square', 0.18), 110); },
    buyerCome() { tone(587, 0.09, 'sine', 0.14, 784); },

    // UI
    ui() { tone(880, 0.04, 'sine', 0.16, 1200); },
    start() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.26), i * 90)); },
  };

  /* --------------------------------------------------- 배경음(겨울 앰비언트) */
  // 느린 단조 패드 + 드문드문 울리는 종소리 + 바람. 루프 파일 없이 스케줄링한다.
  const CHORDS = [
    [220.00, 261.63, 329.63],  // Am
    [174.61, 220.00, 261.63],  // F
    [261.63, 329.63, 392.00],  // C
    [196.00, 246.94, 293.66],  // G
  ];
  const BELLS = [440, 523.25, 587.33, 659.25, 783.99, 880];
  let musicOn = false;
  let chordTimer = null;
  let bellTimer = null;
  let windNodes = null;
  let chordIdx = 0;

  function playChord() {
    if (!ctx || !musicOn) return;
    const chord = CHORDS[chordIdx % CHORDS.length];
    chordIdx++;
    const t0 = ctx.currentTime;
    const dur = 8;
    for (const f of chord) {
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        o.type = 'triangle';
        o.frequency.value = f;
        o.detune.value = detune;
        lp.type = 'lowpass';
        lp.frequency.value = 760;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.055, t0 + 2.2);
        g.gain.setValueAtTime(0.055, t0 + dur - 2.6);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        o.connect(lp); lp.connect(g); g.connect(musicBus);
        o.start(t0);
        o.stop(t0 + dur + 0.1);
      }
    }
    chordTimer = setTimeout(playChord, (dur - 1.4) * 1000);
  }

  function playBell() {
    if (!ctx || !musicOn) return;
    if (Math.random() < 0.62) {
      const f = BELLS[(Math.random() * BELLS.length) | 0];
      const t0 = ctx.currentTime;
      for (const [delay, vol] of [[0, 0.085], [0.34, 0.04], [0.68, 0.018]]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + delay);
        g.gain.exponentialRampToValueAtTime(vol, t0 + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 1.5);
        o.connect(g); g.connect(musicBus);
        o.start(t0 + delay);
        o.stop(t0 + delay + 1.6);
      }
    }
    bellTimer = setTimeout(playBell, rand(2600, 5200));
  }

  function startWind() {
    if (!ctx || windNodes) return;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    // 바람이 몰아치듯 아주 느리게 세기를 바꾼다
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(lp); lp.connect(g); g.connect(musicBus);
    src.start();
    lfo.start();
    windNodes = { src, lfo };
  }

  function musicStart() {
    ensure();
    if (!ctx || musicOn) return;
    musicOn = true;
    startWind();
    playChord();
    bellTimer = setTimeout(playBell, 3000);
  }

  function musicStop() {
    musicOn = false;
    clearTimeout(chordTimer);
    clearTimeout(bellTimer);
    if (windNodes) {
      try { windNodes.src.stop(); windNodes.lfo.stop(); } catch { /* 이미 정지 */ }
      windNodes = null;
    }
  }

  function applyMute() {
    if (master) master.gain.value = muted ? 0 : 0.45;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* 무시 */ }
  }

  return {
    ensure,
    resume,
    S,
    // 디버그/테스트용: 실제로 소리가 나가는지 파형을 들여다볼 수 있게 한다
    _debug: { get ctx() { return ctx; }, get master() { return master; } },
    frameReset() { voices = 0; },
    musicStart,
    musicStop,
    setMusicVolume(v) { if (musicBus) musicBus.gain.value = v; },
    isMuted() { return muted; },
    setMuted(v) { muted = v; applyMute(); },
    toggle() { muted = !muted; applyMute(); return muted; },
  };
})();
