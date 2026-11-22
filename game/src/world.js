// Velvet Vault — the room itself: parsing a level map into walls, doors,
// vents and pickups, plus the geometry every other module leans on
// (collision, line of sight, grid pathfinding).
import {
  COLS, ROWS, TILE, WORLD_W, WORLD_H,
  SMALL_LOOT_VALUE, MAIN_LOOT_VALUE,
} from './config.js';

export const T_WALL = '#';
export const T_FLOOR = '.';
export const T_DOORWAY = 'd';
export const T_LOCKED = 'D';
export const T_VENT = 'v';

/** Parse a level definition into a live room object. */
export function buildWorld(level) {
  const grid = level.map.map((row) => row.split(''));
  const world = {
    level,
    grid,
    doors: [], // {tx, ty, locked, open, progress}
    vents: [],
    loot: [], // {tx, ty, x, y, value, main, taken, name}
    hackPanels: [], // {tx, ty, x, y}
    playerStart: { x: TILE * 1.5, y: TILE * 1.5 },
    exit: { tx: 0, ty: 0, x: 0, y: 0, open: false },
    guards: level.guards.map((g) => ({
      spawn: g.spawn,
      waypoints: g.waypoints.map(([tx, ty]) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE })),
    })),
    cameras: level.cameras.map((c) => ({
      x: (c.tx + 0.5) * TILE,
      y: (c.ty + 0.5) * TILE,
      baseAngle: c.angle,
      sweep: c.sweep,
      phase: 0,
      disabled: false,
    })),
  };
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const ch = grid[ty][tx];
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      if (ch === 'P') world.playerStart = { x: cx, y: cy };
      else if (ch === 'D') world.doors.push({ tx, ty, locked: true, open: false, progress: 0 });
      else if (ch === 'v') world.vents.push({ tx, ty });
      else if (ch === 'L') world.loot.push({ tx, ty, x: cx, y: cy, value: SMALL_LOOT_VALUE, main: false, taken: false, name: 'painting' });
      else if (ch === 'V') world.loot.push({ tx, ty, x: cx, y: cy, value: MAIN_LOOT_VALUE, main: true, taken: false, name: level.mainLootName });
      else if (ch === 'X') world.exit = { tx, ty, x: cx, y: cy, open: false };
      else if (ch === 'H') world.hackPanels.push({ tx, ty, x: cx, y: cy });
    }
  }
  return world;
}

/** The tile character at a pixel position; walls outside the map. */
export function tileAt(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return T_WALL;
  return world.grid[ty][tx];
}

/** A tile blocks movement for the thief (walls and shut locked doors). */
export function solidForPlayer(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const ch = world.grid[ty][tx];
  if (ch === T_WALL) return true;
  if (ch === T_LOCKED) {
    const door = world.doors.find((d) => d.tx === tx && d.ty === ty);
    return !(door && door.open);
  }
  return false;
}

/** A tile blocks a guard: walls, shut doors and vents (guards never crawl). */
export function solidForGuard(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const ch = world.grid[ty][tx];
  if (ch === T_WALL || ch === T_VENT) return true;
  if (ch === T_LOCKED) {
    const door = world.doors.find((d) => d.tx === tx && d.ty === ty);
    return !(door && door.open);
  }
  return false;
}

/** A tile blocks sight: walls and shut doors only. */
export function blocksSight(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
  const ch = world.grid[ty][tx];
  if (ch === T_WALL) return true;
  if (ch === T_LOCKED) {
    const door = world.doors.find((d) => d.tx === tx && d.ty === ty);
    return !(door && door.open);
  }
  return false;
}

/** Move a circle (x, y, radius) by (dx, dy), sliding along walls. */
export function moveCircle(world, pos, radius, dx, dy, solid) {
  let { x, y } = pos;
  const nx = x + dx;
  if (!hitsSolid(world, nx, y, radius, solid)) x = nx;
  else {
    // Slide: try the move in small steps to hug the wall instead of sticking.
    const step = dx === 0 ? 0 : Math.sign(dx) * 2;
    let px = x;
    while (step !== 0 && !hitsSolid(world, px + step, y, radius, solid)) px += step;
    x = px;
  }
  const ny = y + dy;
  if (!hitsSolid(world, x, ny, radius, solid)) y = ny;
  else {
    const step = dy === 0 ? 0 : Math.sign(dy) * 2;
    let py = y;
    while (step !== 0 && !hitsSolid(world, x, py + step, radius, solid)) py += step;
    y = py;
  }
  return { x: Math.max(radius, Math.min(WORLD_W - radius, x)), y: Math.max(radius, Math.min(WORLD_H - radius, y)) };
}

function hitsSolid(world, x, y, radius, solid) {
  const x0 = Math.floor((x - radius) / TILE);
  const x1 = Math.floor((x + radius) / TILE);
  const y0 = Math.floor((y - radius) / TILE);
  const y1 = Math.floor((y + radius) / TILE);
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      if (!solid(world, tx, ty)) continue;
      // Circle vs tile rectangle overlap.
      const rx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const ry = Math.max(ty * TILE, Math.min(y, (ty + 1) * TILE));
      const ddx = x - rx;
      const ddy = y - ry;
      if (ddx * ddx + ddy * ddy < radius * radius) return true;
    }
  }
  return false;
}

/** True when no wall or shut door stands between two points. */
export function hasLineOfSight(world, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (blocksSight(world, Math.floor((x0 + dx * t) / TILE), Math.floor((y0 + dy * t) / TILE))) return false;
  }
  return true;
}

/** Shortest walkable path on the grid, as tile centres, from tile a to b. */
export function findPath(world, ax, ay, bx, by, solid) {
  if (ax === bx && ay === by) return [{ x: (ax + 0.5) * TILE, y: (ay + 0.5) * TILE }];
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const seen = new Set([key(ax, ay)]);
  const queue = [[ax, ay]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (solid(world, nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [cx, cy]);
      if (nx === bx && ny === by) {
        const path = [];
        let cur = [bx, by];
        while (cur) {
          path.unshift({ x: (cur[0] + 0.5) * TILE, y: (cur[1] + 0.5) * TILE });
          cur = prev.get(key(cur[0], cur[1]));
        }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}

/** Smallest signed angle difference, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** The locked door (if any) whose tile the point is on or next to. */
export function doorNear(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (const door of world.doors) {
    if (door.open) continue;
    if (Math.abs(door.tx - tx) + Math.abs(door.ty - ty) <= 1) return door;
  }
  return null;
}

/** The hack panel (if any) whose tile the point is on or next to. */
export function panelNear(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  for (const panel of world.hackPanels) {
    if (Math.abs(panel.tx - tx) + Math.abs(panel.ty - ty) <= 1) return panel;
  }
  return null;
}
