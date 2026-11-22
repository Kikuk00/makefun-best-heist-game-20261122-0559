// Velvet Vault — the screenshot scenes. Each one plays the real simulation
// forward from a fresh room with a scripted thief (walk here, pick that,
// crack the loot), then freezes on the frame. Same seed, same frame, and
// every pixel is the game's own code running — never a mock-up.
import { TILE } from './config.js';
import { createState, stepGame } from './sim.js';
import { pathTo, pathInput } from './player.js';

const DT = 1 / 60;

function idleInput() {
  return {
    up: false, down: false, left: false, right: false,
    sneak: false, interact: false, toolKey: null, click: null, mouse: null,
  };
}

/**
 * Run a script of steps against a state. A step is one of:
 *   { goto: [tx, ty], sneak?: bool }  walk the thief to a tile
 *   { wait: seconds }                  stand still
 *   { hold: seconds }                  hold E (pick / hack / crack)
 *   { tool: '1'|'2'|'3' }              press a tool key once
 *   { click: [tx, ty] }                throw the noisemaker at a tile
 * Stops early if the run ends (caught / escaped) and returns the result.
 */
export function runSteps(state, steps) {
  let result = null;
  for (const step of steps) {
    if (result) break;
    if (step.goto) {
      const path = pathTo(state.world, state.player, step.goto[0], step.goto[1]);
      let guard = 0;
      while (path && path.length > 0 && guard < 2400) {
        const input = pathInput(state.world, state.player, path, DT);
        input.sneak = !!step.sneak;
        const events = [];
        result = stepGame(state, input, DT, events);
        if (result) break;
        guard += 1;
      }
    } else if (step.wait) {
      const n = Math.round(step.wait / DT);
      for (let i = 0; i < n && !result; i += 1) {
        const events = [];
        result = stepGame(state, idleInput(), DT, events);
      }
    } else if (step.hold) {
      const n = Math.round(step.hold / DT);
      for (let i = 0; i < n && !result; i += 1) {
        const input = idleInput();
        input.interact = true;
        input.sneak = !!step.sneak;
        const events = [];
        result = stepGame(state, input, DT, events);
      }
    } else if (step.tool) {
      const input = idleInput();
      input.toolKey = step.tool;
      const events = [];
      result = stepGame(state, input, DT, events);
    } else if (step.click) {
      state.player.tool = 'noisemaker';
      const input = idleInput();
      input.toolKey = '2';
      input.click = { x: (step.click[0] + 0.5) * TILE, y: (step.click[1] + 0.5) * TILE };
      const events = [];
      result = stepGame(state, input, DT, events);
    }
  }
  return result;
}

const SCRIPTS = {
  // The cover: a full heist in miniature. The thief pockets a painting,
  // picks the gallery door, creeps to the loot, lures the loot guard to
  // the far corner with a noisemaker, then cracks the Starlight Mask
  // while the guard investigates — alarm half up, cones everywhere.
  cover: {
    level: 0,
    steps: [
      { goto: [3, 3] },
      { goto: [6, 3] },
      { hold: 0.3 },
      { goto: [9, 2], sneak: true },
      { click: [15, 4] },
      { goto: [10, 2], sneak: true },
      { hold: 1.4, sneak: true },
      { goto: [12, 8], sneak: true },
      // Linger: the corridor guard turns and walks back toward the thief,
      // so the frame freezes with the alarm meter at ~60% and a "?" over
      // the guard — the heist mid-escape, not already won.
      { wait: 6.5 },
    ],
  },
  // The vault: the thief pockets the start-room painting, picks the door,
  // pockets another painting, drops through the vent to the corridor,
  // picks the vault-room door, then creeps up under the vault guard's
  // patrol to the gold — alarm climbing, camera sweeping overhead.
  vault: {
    level: 1,
    steps: [
      { goto: [5, 1] },
      { goto: [6, 3] },
      { hold: 0.3 },
      { goto: [10, 2] },
      { goto: [8, 8], sneak: true },
      { goto: [6, 13] },
      { hold: 0.3 },
      { goto: [11, 13], sneak: true },
      { wait: 0.6 },
    ],
  },
  // The getaway: the thief hugs the far edge down to a painting, buys a
  // disguise, cracks the briefcase under the rooftop guard's nose, refreshes
  // the disguise, then walks straight past the patrol to the helipad.
  escape: {
    level: 2,
    steps: [
      { goto: [1, 12] },
      { goto: [11, 12] },
      { tool: '3' },
      { goto: [11, 5], sneak: true },
      { hold: 1.4 },
      { tool: '3' },
      { goto: [20, 1] },
      { wait: 0.4 },
    ],
  },
  // The title screen, over the gallery at rest.
  title: { level: 0, steps: [] },
};

/** Build a frozen state for one screenshot scene. */
export function runShot(name, seed = 1) {
  const script = SCRIPTS[name];
  if (!script) return null;
  const state = createState(script.level, seed);
  state.screen = 'play';
  if (name === 'title') {
    state.screen = 'title';
    return state;
  }
  const result = runSteps(state, script.steps);
  // If the scripted thief got caught or escaped mid-scene, keep the frame
  // as a live play frame rather than the end banner.
  if (result) state.screen = 'play';
  return state;
}
