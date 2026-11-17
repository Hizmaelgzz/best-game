// Synthesised sound: no audio files, everything is an oscillator or a burst of
// filtered noise through the Web Audio API. Created on the first user gesture
// (browsers block audio before one) and silent until then.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A minor-key bass pulse that keeps time under the game, one note per beat.
  const BASS_LINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, cutoff) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    shoot() {
      tone(720, 0.09, 'square', 0.08, 240);
    },
    hit() {
      noise(0.12, 0.2, 900);
      tone(180, 0.1, 'sawtooth', 0.1, 70);
    },
    explode() {
      noise(0.45, 0.35, 700);
      tone(90, 0.4, 'sine', 0.25, 30);
    },
    pickup() {
      tone(880, 0.08, 'sine', 0.14, 1320);
    },
    repair() {
      tone(520, 0.12, 'sine', 0.14, 780);
      tone(780, 0.14, 'sine', 0.1, 1040);
    },
    dash() {
      noise(0.16, 0.12, 2400);
    },
    wave() {
      tone(220, 0.25, 'triangle', 0.18, 440);
      tone(330, 0.25, 'triangle', 0.12, 660);
    },
    gameOver() {
      tone(392, 0.3, 'triangle', 0.18, 370);
      tone(311, 0.3, 'triangle', 0.18, 294);
      tone(233, 0.6, 'triangle', 0.18, 175);
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const f = BASS_LINE[musicStep % BASS_LINE.length];
        musicStep += 1;
        if (f) tone(f, 0.22, 'triangle', 0.1);
      }, 240);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
