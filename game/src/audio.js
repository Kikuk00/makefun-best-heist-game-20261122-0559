// Velvet Vault — all sound is synthesized with WebAudio: no audio files,
// no network, just oscillators. Created on the first user gesture.
let ctx = null;
let muted = false;
let alarmNodes = null;

export function ensureAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch (e) {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function toggleMute() {
  muted = !muted;
  if (muted) stopAlarmLoop();
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Play one named game sound. */
export function playSound(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'pickup': // a bright little coin arpeggio
      tone(880, 0.09, 'sine', 0.12);
      tone(1318, 0.12, 'sine', 0.1, 0.07);
      break;
    case 'mainloot': // the big score
      tone(523, 0.12, 'triangle', 0.16);
      tone(659, 0.12, 'triangle', 0.16, 0.1);
      tone(784, 0.12, 'triangle', 0.16, 0.2);
      tone(1046, 0.28, 'triangle', 0.18, 0.3);
      break;
    case 'unlock': // tumblers falling
      tone(300, 0.06, 'square', 0.06);
      tone(420, 0.06, 'square', 0.06, 0.06);
      tone(560, 0.1, 'square', 0.07, 0.12);
      break;
    case 'hack': // camera dying
      tone(900, 0.25, 'sawtooth', 0.07, 0, 120);
      break;
    case 'noise': // the thrown noisemaker clatters
      tone(1400, 0.05, 'square', 0.08);
      tone(900, 0.05, 'square', 0.08, 0.08);
      tone(1600, 0.07, 'square', 0.08, 0.16);
      break;
    case 'disguise': // a smooth change of coat
      tone(400, 0.3, 'sine', 0.08, 0, 700);
      break;
    case 'spotted': // the guard's sharp shout
      tone(700, 0.12, 'square', 0.12);
      tone(950, 0.16, 'square', 0.12, 0.1);
      break;
    case 'caught': // busted
      tone(220, 0.5, 'sawtooth', 0.14, 0, 90);
      tone(110, 0.6, 'sawtooth', 0.12, 0.15, 55);
      break;
    case 'escape': // clean getaway jingle
      tone(392, 0.12, 'triangle', 0.15);
      tone(523, 0.12, 'triangle', 0.15, 0.11);
      tone(659, 0.12, 'triangle', 0.15, 0.22);
      tone(784, 0.35, 'triangle', 0.17, 0.33);
      break;
    case 'click':
      tone(600, 0.05, 'sine', 0.08);
      break;
    default:
      break;
  }
}

/** A quiet two-tone alarm loop while the meter is high. */
export function startAlarmLoop() {
  if (!ctx || muted || alarmNodes) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(620, ctx.currentTime);
  g.gain.setValueAtTime(0.035, ctx.currentTime);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 1.4;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  lfo.start();
  alarmNodes = { osc, lfo, g };
}

export function stopAlarmLoop() {
  if (!alarmNodes) return;
  try {
    alarmNodes.osc.stop();
    alarmNodes.lfo.stop();
  } catch (e) { /* already stopped */ }
  alarmNodes = null;
}
