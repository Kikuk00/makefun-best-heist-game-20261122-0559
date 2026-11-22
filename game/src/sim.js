// Velvet Vault — the simulation core: fresh state for a room and one fixed
// tick of it. No DOM here, so the game, the tests and the screenshot scenes
// all drive the same code.
import { TILE, ALARM_DECAY } from './config.js';
import { LEVELS } from './levels.js';
import { buildWorld } from './world.js';
import {
  makeGuard, makeCamera, updateGuard, updateCamera, guardTouchingPlayer,
} from './guards.js';
import { makePlayer, updatePlayer } from './player.js';
import { mulberry32 } from './rng.js';
import { playSound, startAlarmLoop, stopAlarmLoop } from './audio.js';

/** Fresh state for one room. `seed` fixes every random choice in it. */
export function createState(levelIndex, seed = 1) {
  const level = LEVELS[levelIndex];
  const rng = mulberry32(seed * 7919 + levelIndex * 104729);
  const world = buildWorld(level);
  const guards = world.guards.map((def, i) => makeGuard(def, i));
  const cameras = world.cameras.map((def, i) => makeCamera(def, i));
  const player = makePlayer(world.playerStart);
  return {
    levelIndex,
    level,
    world,
    guards,
    cameras,
    player,
    rng,
    alarm: 0,
    maxAlarm: 0,
    take: 0,
    takeAtLevelStart: 0,
    smallTaken: 0,
    mainTaken: false,
    elapsed: 0,
    screen: 'title',
    prompt: null,
    noise: null,
    rating: 'Ghost',
    spotted: false, // have we played the spotted sting for this alarm rise?
    seed,
  };
}

/**
 * One fixed tick of the live game. `input` is the player module's input
 * shape. `events` collects {type} entries for sounds and messages.
 * Returns 'caught' | 'escaped' | null.
 */
export function stepGame(state, input, dt, events) {
  const { world, player, guards, cameras } = state;
  state.elapsed += dt;
  if (state.noise) {
    state.noise.left -= dt;
    if (state.noise.left <= 0) state.noise = null;
  }

  // The alarm drains slowly, then the watchers push it back up.
  const alarmBox = { value: Math.max(0, state.alarm - ALARM_DECAY * dt) };
  state.prompt = updatePlayer(world, player, guards, input, dt, state, events);
  for (const guard of guards) updateGuard(world, guard, player, dt, alarmBox);
  for (const camera of cameras) updateCamera(world, camera, player, dt, alarmBox);
  state.alarm = alarmBox.value;
  state.maxAlarm = Math.max(state.maxAlarm, state.alarm);

  // Sounds for what just happened.
  for (const event of events) {
    if (event.type === 'pickup') playSound('pickup');
    else if (event.type === 'mainloot') playSound('mainloot');
    else if (event.type === 'unlock') playSound('unlock');
    else if (event.type === 'hack') playSound('hack');
    else if (event.type === 'noise') playSound('noise');
    else if (event.type === 'disguise') playSound('disguise');
  }
  if (state.alarm >= 0.72 && !state.spotted) {
    state.spotted = true;
    playSound('spotted');
    startAlarmLoop();
  } else if (state.alarm < 0.5 && state.spotted) {
    state.spotted = false;
    stopAlarmLoop();
  }

  // Caught: the meter filled, or a chasing guard laid hands on the thief.
  if (state.alarm >= 1 || guardTouchingPlayer(guards, player)) {
    playSound('caught');
    stopAlarmLoop();
    return 'caught';
  }

  // Escaped: main loot taken and the thief reaches the open exit.
  if (world.exit.open && Math.hypot(player.x - world.exit.x, player.y - world.exit.y) < TILE * 0.6) {
    const bonus = Math.max(0, state.level.parSeconds - Math.floor(state.elapsed)) * 10;
    state.take += bonus;
    state.escapeBonus = bonus;
    playSound('escape');
    stopAlarmLoop();
    return 'escaped';
  }
  return null;
}

export function ratingFor(maxAlarm) {
  if (maxAlarm < 0.25) return 'Ghost';
  if (maxAlarm < 0.7) return 'Smooth';
  return 'Loud';
}
