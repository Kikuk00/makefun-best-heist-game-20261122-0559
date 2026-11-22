// Velvet Vault — browser wiring: input, the animation loop, and the screens.
// The simulation itself lives in sim.js; this file only connects it to the
// keyboard, the mouse and the canvas.
import { TILE, HUD_H, CANVAS_W, CANVAS_H } from './config.js';
import { LEVELS } from './levels.js';
import { createState, stepGame, ratingFor } from './sim.js';
import { render, renderTitle } from './render.js';
import { ensureAudio, playSound, toggleMute } from './audio.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || '1') || 1;

const keys = {};
let mouse = { x: CANVAS_W / 2, y: HUD_H + 200 };
let click = null;

function readInput() {
  return {
    up: !!(keys.KeyW || keys.ArrowUp),
    down: !!(keys.KeyS || keys.ArrowDown),
    left: !!(keys.KeyA || keys.ArrowLeft),
    right: !!(keys.KeyD || keys.ArrowRight),
    sneak: !!(keys.ShiftLeft || keys.ShiftRight),
    interact: !!keys.KeyE,
    toolKey: keys.Digit1 ? '1' : keys.Digit2 ? '2' : keys.Digit3 ? '3' : null,
    click,
    mouse,
  };
}

function startLevel(state, levelIndex) {
  const fresh = createState(levelIndex, state ? state.seed : seed);
  if (state) fresh.take = state.takeAtLevelStart;
  fresh.takeAtLevelStart = fresh.take;
  fresh.screen = 'play';
  return fresh;
}

let state = createState(0, seed);

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function onKeyDown(event) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  ensureAudio();
  keys[event.code] = true;
  if (event.code === 'KeyM') {
    const muted = toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
    return;
  }
  if (state.screen === 'title' && (event.code === 'Enter' || event.code === 'Space')) {
    state.screen = 'play';
    announce(`${state.level.name}. ${state.level.subtitle}`);
    playSound('click');
    return;
  }
  if (state.screen === 'play' && event.code === 'KeyP') {
    state.screen = 'paused';
    return;
  }
  if (state.screen === 'paused' && event.code === 'KeyP') {
    state.screen = 'play';
    return;
  }
  if (state.screen === 'caught' && event.code === 'KeyR') {
    state = startLevel(state, state.levelIndex);
    announce('Trying the room again.');
    return;
  }
  if (state.screen === 'leveldone' && event.code === 'Enter') {
    if (state.levelIndex + 1 < LEVELS.length) {
      state = startLevel(state, state.levelIndex + 1);
      announce(`${state.level.name}. ${state.level.subtitle}`);
    }
    return;
  }
  if (state.screen === 'win' && event.code === 'KeyR') {
    state = createState(0, seed);
    state.screen = 'title';
  }
}

function onKeyUp(event) {
  keys[event.code] = false;
}

function canvasPos(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (CANVAS_W / rect.width),
    y: (event.clientY - rect.top) * (CANVAS_H / rect.height),
  };
}

function onMouseMove(event) {
  mouse = canvasPos(event);
}

function onClick(event) {
  ensureAudio();
  const pos = canvasPos(event);
  if (state.screen === 'title') {
    state.screen = 'play';
    announce(`${state.level.name}. ${state.level.subtitle}`);
    return;
  }
  if (state.screen !== 'play') return;
  // The click aims the noisemaker at a floor spot (world pixels).
  click = { x: pos.x, y: pos.y - HUD_H };
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
canvas.addEventListener('mousemove', onMouseMove);
canvas.addEventListener('click', onClick);

let last = performance.now();
let time = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (state.screen === 'play') {
    const events = [];
    const input = readInput();
    click = null; // one tick per click
    const result = stepGame(state, input, dt, events);
    if (result === 'caught') {
      state.screen = 'caught';
      announce('Busted! The guards found you. Press R to run it back.');
    } else if (result === 'escaped') {
      state.rating = ratingFor(state.maxAlarm);
      if (state.levelIndex + 1 >= LEVELS.length) {
        state.screen = 'win';
        announce(`Clean getaway! Total take $${state.take.toLocaleString('en-US')}. ${state.rating}.`);
      } else {
        state.screen = 'leveldone';
        announce(`Room cleared. Take $${state.take.toLocaleString('en-US')}. Press Enter for the next room.`);
      }
    }
  }
  if (state.screen === 'title') renderTitle(ctx, state, time);
  else render(ctx, state, time);
  requestAnimationFrame(frame);
}

// Screenshot scenes run the real simulation with scripted input, render one
// frame, and stop — no animation loop, so the frame is deterministic.
if (shotName) {
  const shotState = runShot(shotName, seed);
  if (shotState) {
    state = shotState;
    if (shotName === 'title') renderTitle(ctx, state, 1.5);
    else render(ctx, state, 1.5);
    document.title = `shot:${shotName}`;
  }
} else {
  requestAnimationFrame(frame);
}
