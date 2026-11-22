// Velvet Vault — the thief: movement, sneaking, tools and interactions.
// The player module owns the thief's state and turns raw input into actions;
// the world decides what those actions hit.
import {
  TILE, PLAYER_SPEED, PLAYER_SNEAK_SPEED, PLAYER_RADIUS,
  TOOLS, DISGUISE_SECONDS, NOISEMAKER_RANGE,
  DOOR_HOLD_SECONDS, HACK_HOLD_SECONDS, LOOT_HOLD_SECONDS,
} from './config.js';
import {
  moveCircle, solidForPlayer, doorNear, panelNear, findPath,
} from './world.js';
import { lureGuards } from './guards.js';

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    angle: Math.PI / 2, // facing down the room
    sneaking: false,
    disguiseLeft: 0,
    tool: 'lockpick',
    moving: false,
    // Hold-to-use progress, one interaction at a time.
    hold: null, // {kind: 'door'|'hack'|'loot', target, seconds}
    lootFlash: 0, // seconds left showing the "+$250" popup
    lootFlashText: '',
    toolFlash: '',
    toolFlashLeft: 0,
  };
}

/** What the thief is standing next to that E could work on, if anything. */
export function nearbyInteraction(world, player) {
  const door = doorNear(world, player.x, player.y);
  if (door) return { kind: 'door', target: door, label: 'Hold E — pick the lock' };
  const panel = panelNear(world, player.x, player.y);
  if (panel) {
    const cam = world.cameras.find((c) => !c.disabled && Math.hypot(c.x - panel.x, c.y - panel.y) < TILE * 5);
    if (cam) return { kind: 'hack', target: { panel, camera: cam }, label: 'Hold E — kill the camera' };
  }
  for (const item of world.loot) {
    if (!item.taken && item.main && Math.hypot(item.x - player.x, item.y - player.y) < TILE * 1.1) {
      return { kind: 'loot', target: item, label: `Hold E — crack the ${item.name}` };
    }
  }
  return null;
}

/**
 * One tick of the thief. `input` is {up,down,left,right,sneak,interact,
 * toolKey, click:{x,y}|null, mouse:{x,y}} in world pixels. `events` collects
 * sounds and messages for main.js (pickup, tool, caught...). Returns the
 * interaction prompt for the HUD, or null.
 */
export function updatePlayer(world, player, guards, input, dt, state, events) {
  player.moving = false;
  if (player.disguiseLeft > 0) player.disguiseLeft = Math.max(0, player.disguiseLeft - dt);
  if (player.lootFlash > 0) player.lootFlash -= dt;
  if (player.toolFlashLeft > 0) player.toolFlashLeft -= dt;

  // Tool selection.
  if (input.toolKey === TOOLS.lockpick.key) player.tool = 'lockpick';
  if (input.toolKey === TOOLS.noisemaker.key) player.tool = 'noisemaker';
  if (input.toolKey === TOOLS.disguise.key) player.tool = 'disguise';

  // Mouse: a click throws the noisemaker when that tool is selected.
  if (input.click && player.tool === 'noisemaker') {
    const dx = input.click.x - player.x;
    const dy = input.click.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= NOISEMAKER_RANGE && state.take >= TOOLS.noisemaker.cost) {
      const tx = player.x + (dx / dist) * Math.min(dist, NOISEMAKER_RANGE);
      const ty = player.y + (dy / dist) * Math.min(dist, NOISEMAKER_RANGE);
      const lured = lureGuards(guards, tx, ty, 230);
      state.take -= TOOLS.noisemaker.cost;
      state.noise = { x: tx, y: ty, left: 0.9 };
      events.push({ type: 'noise', lured });
      flashTool(player, `Noisemaker −$${TOOLS.noisemaker.cost}`);
    } else if (dist > NOISEMAKER_RANGE) {
      flashTool(player, 'Too far to throw');
    } else {
      flashTool(player, 'Not enough take for that');
    }
  }

  // Disguise is instant on keypress.
  if (input.toolKey === TOOLS.disguise.key && player.disguiseLeft <= 0) {
    if (state.take >= TOOLS.disguise.cost) {
      state.take -= TOOLS.disguise.cost;
      player.disguiseLeft = DISGUISE_SECONDS;
      events.push({ type: 'disguise' });
      flashTool(player, `Disguise −$${TOOLS.disguise.cost}`);
    } else {
      flashTool(player, 'Not enough take for that');
    }
  }

  // Movement: WASD or arrows, Shift to sneak (slower, harder to spot).
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.sneaking = !!input.sneak;
    const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_SPEED;
    const moved = moveCircle(world, player, PLAYER_RADIUS, mx * speed * dt, my * speed * dt, solidForPlayer);
    player.x = moved.x;
    player.y = moved.y;
    player.angle = Math.atan2(my, mx);
    player.moving = true;
  } else {
    player.sneaking = false;
  }

  // Small loot is picked up by walking over it.
  for (const item of world.loot) {
    if (item.taken || item.main) continue;
    if (Math.hypot(item.x - player.x, item.y - player.y) < TILE * 0.7) {
      item.taken = true;
      state.take += item.value;
      state.smallTaken += 1;
      player.lootFlash = 1.2;
      player.lootFlashText = `+$${item.value}`;
      events.push({ type: 'pickup', value: item.value });
    }
  }

  // Hold-to-use: door, hack panel, or the main loot. A selected lockpick
  // opens a locked door at once instead of the slow hold.
  const near = nearbyInteraction(world, player);
  if (input.interact && near) {
    if (near.kind === 'door' && player.tool === 'lockpick') {
      useLockpick(world, player, state, events);
      player.hold = null;
      return near;
    }
    if (!player.hold || player.hold.kind !== near.kind) {
      player.hold = { kind: near.kind, target: near.target, seconds: 0 };
    }
    const need = near.kind === 'door' ? DOOR_HOLD_SECONDS
      : near.kind === 'hack' ? HACK_HOLD_SECONDS : LOOT_HOLD_SECONDS;
    player.hold.seconds += dt;
    if (player.hold.seconds >= need) {
      finishHold(world, player, near, state, events);
      player.hold = null;
    }
    return near;
  }
  player.hold = null;
  return near;
}

/** Lockpick on a locked door: instant, from anywhere near it. */
export function useLockpick(world, player, state, events) {
  const door = doorNear(world, player.x, player.y);
  if (!door) {
    flashTool(player, 'No locked door nearby');
    return false;
  }
  if (state.take < TOOLS.lockpick.cost) {
    flashTool(player, 'Not enough take for that');
    return false;
  }
  state.take -= TOOLS.lockpick.cost;
  door.open = true;
  events.push({ type: 'unlock' });
  flashTool(player, `Lockpick −$${TOOLS.lockpick.cost}`);
  return true;
}

function finishHold(world, player, near, state, events) {
  if (near.kind === 'door') {
    near.target.open = true;
    events.push({ type: 'unlock' });
  } else if (near.kind === 'hack') {
    near.target.camera.disabled = true;
    events.push({ type: 'hack' });
    flashTool(player, 'Camera down');
  } else if (near.kind === 'loot') {
    const item = near.target;
    item.taken = true;
    state.take += item.value;
    state.mainTaken = true;
    world.exit.open = true;
    player.lootFlash = 1.6;
    player.lootFlashText = `+$${item.value} — ${item.name}!`;
    events.push({ type: 'mainloot', value: item.value, name: item.name });
  }
}

function flashTool(player, text) {
  player.toolFlash = text;
  player.toolFlashLeft = 1.6;
}

/** Autoplay helper for the screenshot scenes: follow a grid path. */
export function pathInput(world, player, path, dt) {
  if (!path || path.length === 0) return { up: false, down: false, left: false, right: false, sneak: true, interact: false, toolKey: null, click: null, mouse: null };
  const target = path[0];
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  // Close enough to this waypoint: take the next one. The shift radius must
  // exceed the steering dead zone below, or the thief stalls between the two.
  if (Math.hypot(dx, dy) < 8) path.shift();
  if (path.length === 0) return { up: false, down: false, left: false, right: false, sneak: true, interact: false, toolKey: null, click: null, mouse: null };
  const next = path[0];
  const nx = next.x - player.x;
  const ny = next.y - player.y;
  return {
    up: ny < -2, down: ny > 2, left: nx < -2, right: nx > 2,
    sneak: false, interact: false, toolKey: null, click: null, mouse: null,
  };
}

/** Build a grid path (tile centres) for the thief to follow. */
export function pathTo(world, player, tx, ty) {
  const ax = Math.floor(player.x / TILE);
  const ay = Math.floor(player.y / TILE);
  return findPath(world, ax, ay, tx, ty, solidForPlayer);
}
