// Velvet Vault — the watchers: guard patrols, suspicion and chases, and
// the sweeping security cameras. All vision checks live here.
import {
  TILE, GUARD_SPEED, GUARD_CHASE_SPEED, GUARD_INVESTIGATE_SPEED,
  GUARD_RANGE, GUARD_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE,
  GUARD_SPOT_RATE, CAMERA_SPOT_RATE, CLOSE_SPOT_BONUS,
  SUSPICION_DECAY, ALERT_AT, DISGUISE_CLOSE_RANGE, INVESTIGATE_SECONDS,
  GUARD_RADIUS,
} from './config.js';
import { hasLineOfSight, moveCircle, solidForGuard, angleDiff } from './world.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';
export const GUARD_INVESTIGATE = 'investigate';

/** Fresh guard runtime state from a level's patrol definition. */
export function makeGuard(def, index) {
  const start = def.waypoints[0];
  return {
    index,
    x: start.x,
    y: start.y,
    angle: 0,
    waypointIndex: 1 % def.waypoints.length,
    waypoints: def.waypoints,
    wait: 0,
    state: GUARD_PATROL,
    suspicion: 0,
    lastSeen: null,
    loseSight: 0,
    investigate: null,
    investigateLeft: 0,
    moving: false,
  };
}

/** Fresh camera runtime state. */
export function makeCamera(def, index) {
  return {
    index,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    phase: index * 1.7, // cameras start out of phase with each other
    angle: def.baseAngle,
    suspicion: 0,
    disabled: false,
  };
}

/** Can this watcher see the thief right now? Disguise only helps at range. */
export function canSeeWatcher(world, watcher, range, halfAngle, player, disguised) {
  const dx = player.x - watcher.x;
  const dy = player.y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return { sees: false, dist };
  if (disguised && dist > DISGUISE_CLOSE_RANGE) return { sees: false, dist };
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(watcher.angle, toPlayer)) > halfAngle) return { sees: false, dist };
  if (!hasLineOfSight(world, watcher.x, watcher.y, player.x, player.y)) return { sees: false, dist };
  return { sees: true, dist };
}

function stepGuardToward(world, guard, tx, ty, dt, speed) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) return true;
  const step = Math.min(dist, speed * dt);
  const nx = guard.x + (dx / dist) * step;
  const ny = guard.y + (dy / dist) * step;
  const moved = moveCircle(world, guard, GUARD_RADIUS, nx - guard.x, ny - guard.y, solidForGuard);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  guard.moving = true;
  return dist - step < 3;
}

/** One tick of a guard. Returns nothing; mutates guard and the shared alarm. */
export function updateGuard(world, guard, player, dt, alarm) {
  const disguised = player.disguiseLeft > 0;
  const seen = canSeeWatcher(world, guard, GUARD_RANGE, GUARD_HALF_ANGLE, player, disguised);
  guard.moving = false;

  if (seen.sees) {
    // Sneaking halves how fast a guard clocks the thief.
    const rate = (GUARD_SPOT_RATE + (seen.dist < 70 ? CLOSE_SPOT_BONUS : 0)) * (player.sneaking ? 0.5 : 1);
    guard.suspicion = Math.min(1, guard.suspicion + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSight = 0;
    if (guard.suspicion >= ALERT_AT) guard.state = GUARD_ALERT;
    else if (guard.suspicion > 0.25) guard.state = GUARD_SUSPICIOUS;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
    if (guard.state === GUARD_ALERT || guard.state === GUARD_SUSPICIOUS) {
      guard.loseSight += dt;
      if (guard.loseSight > 3) {
        guard.state = guard.investigate ? GUARD_INVESTIGATE : GUARD_PATROL;
        guard.loseSight = 0;
      }
    }
  }

  // The alarm meter follows the most suspicious watcher in the room.
  alarm.value = Math.max(alarm.value, guard.suspicion);

  if (guard.state === GUARD_ALERT && guard.lastSeen) {
    const arrived = stepGuardToward(world, guard, guard.lastSeen.x, guard.lastSeen.y, dt, GUARD_CHASE_SPEED);
    if (arrived) {
      // Reached where the thief was last seen: look around, then give up.
      guard.state = GUARD_SUSPICIOUS;
      guard.wait = 1.2;
      guard.loseSight = 0;
    }
  } else if (guard.state === GUARD_INVESTIGATE && guard.investigate) {
    const arrived = stepGuardToward(world, guard, guard.investigate.x, guard.investigate.y, dt, GUARD_INVESTIGATE_SPEED);
    guard.investigateLeft -= dt;
    if (arrived || guard.investigateLeft <= 0) {
      guard.investigate = null;
      guard.state = GUARD_PATROL;
      guard.wait = 1.0;
    }
  } else if (guard.state === GUARD_SUSPICIOUS && guard.lastSeen) {
    // Creep toward the last glimpse, cautiously.
    stepGuardToward(world, guard, guard.lastSeen.x, guard.lastSeen.y, dt, GUARD_SPEED * 0.6);
    if (guard.wait > 0) {
      guard.wait -= dt;
      if (guard.wait <= 0) guard.state = GUARD_PATROL;
    }
  } else {
    // Patrol: walk the waypoints, pausing a beat at each one.
    if (guard.wait > 0) {
      guard.wait -= dt;
      const next = guard.waypoints[guard.waypointIndex];
      guard.angle = Math.atan2(next.y - guard.y, next.x - guard.x);
    } else {
      const target = guard.waypoints[guard.waypointIndex];
      const arrived = stepGuardToward(world, guard, target.x, target.y, dt, GUARD_SPEED);
      if (arrived) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.wait = 1.0;
      }
    }
  }
  return alarm;
}

/** One tick of a camera. Cameras never move, but their cone sweeps. */
export function updateCamera(world, camera, player, dt, alarm) {
  if (camera.disabled) {
    camera.suspicion = 0;
    return alarm;
  }
  camera.phase += dt * 0.55;
  camera.angle = camera.baseAngle + Math.sin(camera.phase) * camera.sweep;
  const disguised = player.disguiseLeft > 0;
  const seen = canSeeWatcher(world, camera, CAMERA_RANGE, CAMERA_HALF_ANGLE, player, disguised);
  if (seen.sees) {
    // Sneaking halves how fast a camera clocks the thief.
    const rate = (CAMERA_SPOT_RATE + (seen.dist < 70 ? CLOSE_SPOT_BONUS : 0)) * (player.sneaking ? 0.5 : 1);
    camera.suspicion = Math.min(1, camera.suspicion + rate * dt);
  } else {
    camera.suspicion = Math.max(0, camera.suspicion - SUSPICION_DECAY * dt);
  }
  alarm.value = Math.max(alarm.value, camera.suspicion);
  return alarm;
}

/** Send every guard close to a point to go and look at it. */
export function lureGuards(guards, x, y, radius) {
  let lured = 0;
  for (const guard of guards) {
    if (Math.hypot(guard.x - x, guard.y - y) < radius) {
      guard.investigate = { x, y };
      guard.investigateLeft = INVESTIGATE_SECONDS;
      if (guard.state !== GUARD_ALERT) guard.state = GUARD_INVESTIGATE;
      guard.suspicion = Math.max(0, guard.suspicion - 0.3);
      lured += 1;
    }
  }
  return lured;
}

/** Is any guard close enough to the thief to grab them? */
export function guardTouchingPlayer(guards, player) {
  for (const guard of guards) {
    if (guard.state !== GUARD_ALERT) continue;
    if (Math.hypot(guard.x - player.x, guard.y - player.y) < GUARD_RADIUS + 14) return guard;
  }
  return null;
}
