// Synthesized sound effects: every sound is built from oscillators and
// filtered noise at run time, so the game ships no audio files at all.
// The AudioContext starts on the player's first gesture (browsers require
// it), and M toggles mute. Every call is safe before the context exists.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._noise = null;
  }

  // Call from a click or keypress: creates/resumes the context.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this._noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noiseBurst(dur, vol, filterFreq, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot(weaponId) {
    if (weaponId === 'scattergun') {
      this._noiseBurst(0.16, 0.5, 900);
      this._tone(120, 0.14, 'sine', 0.5, 45);
    } else if (weaponId === 'rifle') {
      this._tone(340, 0.07, 'square', 0.16, 130);
      this._noiseBurst(0.05, 0.18, 3200);
    } else {
      this._tone(240, 0.08, 'square', 0.22, 95);
      this._noiseBurst(0.05, 0.2, 2600);
    }
  }

  dryFire() {
    this._tone(900, 0.04, 'square', 0.12, 700);
  }

  reload() {
    this._tone(700, 0.05, 'square', 0.14, 500);
    this._tone(500, 0.05, 'square', 0.14, 350, 0.14);
  }

  hit() {
    this._noiseBurst(0.05, 0.22, 1800);
  }

  kill() {
    this._tone(110, 0.18, 'sine', 0.5, 40);
    this._noiseBurst(0.1, 0.2, 700);
  }

  boardBreak() {
    this._noiseBurst(0.14, 0.4, 500);
    this._tone(90, 0.12, 'triangle', 0.3, 55);
  }

  repair() {
    this._tone(190, 0.07, 'triangle', 0.35, 140);
    this._tone(240, 0.06, 'triangle', 0.3, 180, 0.09);
  }

  buy() {
    this._tone(660, 0.12, 'sine', 0.3);
    this._tone(990, 0.18, 'sine', 0.3, null, 0.1);
  }

  denied() {
    this._tone(130, 0.14, 'sawtooth', 0.2, 90);
  }

  powerOn() {
    this._tone(100, 0.9, 'sine', 0.35, 620);
    this._tone(220, 0.9, 'triangle', 0.2, 880, 0.1);
  }

  waveStart() {
    this._tone(440, 0.12, 'square', 0.18);
    this._tone(660, 0.16, 'square', 0.18, null, 0.16);
  }

  hurt() {
    this._tone(80, 0.2, 'sine', 0.55, 45);
    this._noiseBurst(0.12, 0.25, 500);
  }

  spit() {
    this._tone(300, 0.12, 'sawtooth', 0.12, 140);
  }

  gameOver() {
    this._tone(392, 0.3, 'triangle', 0.3);
    this._tone(311, 0.3, 'triangle', 0.3, null, 0.28);
    this._tone(233, 0.55, 'triangle', 0.3, null, 0.56);
  }

  rankUp() {
    this._tone(523, 0.1, 'sine', 0.25);
    this._tone(659, 0.1, 'sine', 0.25, null, 0.09);
    this._tone(784, 0.16, 'sine', 0.25, null, 0.18);
  }

  click() {
    this._tone(800, 0.04, 'square', 0.1, 600);
  }
}
