// Velvet Vault — everything the player sees: the room, the cones, the
// watchers, the thief, and the HUD with its alarm meter. All drawing is
// canvas 2D, all art is code — no image files.
import {
  TILE, COLS, ROWS, WORLD_W, WORLD_H, HUD_H, CANVAS_W, CANVAS_H,
  GUARD_RANGE, GUARD_HALF_ANGLE, CAMERA_RANGE, CAMERA_HALF_ANGLE,
  TOOLS, COLORS, PLAYER_RADIUS, GUARD_RADIUS,
} from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS, GUARD_INVESTIGATE } from './guards.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle - halfAngle) * range, y + Math.sin(angle - halfAngle) * range);
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle + halfAngle) * range, y + Math.sin(angle + halfAngle) * range);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawFloor(ctx, world) {
  const tint = world.level.tint;
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const ch = world.grid[ty][tx];
      if (ch === '#') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const odd = (tx + ty) % 2 === 0;
      ctx.fillStyle = tint || (odd ? COLORS.floorA : COLORS.floorB);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = COLORS.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawWalls(ctx, world) {
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      if (world.grid[ty][tx] !== '#') continue;
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(x, y, TILE, 6);
      ctx.strokeStyle = COLORS.wallEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

function drawDoorsAndVents(ctx, world) {
  for (const door of world.doors) {
    const x = door.tx * TILE;
    const y = door.ty * TILE;
    if (door.open) {
      ctx.fillStyle = '#10131a';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = COLORS.goldDark;
      ctx.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 5);
      continue;
    }
    ctx.fillStyle = '#6b4a1f';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#8a6132';
    ctx.fillRect(x + 3, y + 3, TILE - 6, 5);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2b1d0c';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', x + TILE / 2, y + TILE - 7);
  }
  for (const vent of world.vents) {
    const x = vent.tx * TILE;
    const y = vent.ty * TILE;
    ctx.fillStyle = '#39404f';
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.strokeStyle = '#7d8698';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 11 + i * 9);
      ctx.lineTo(x + TILE - 8, y + 11 + i * 9);
      ctx.stroke();
    }
  }
}

function drawLootAndExit(ctx, world, time) {
  for (const item of world.loot) {
    if (item.taken) continue;
    const bob = Math.sin(time * 3 + item.tx) * 2;
    if (item.main) {
      // The big prize: a glowing case on a pedestal.
      ctx.fillStyle = '#3a2f14';
      ctx.beginPath();
      ctx.arc(item.x, item.y + 8, 15, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(item.x, item.y + bob);
      ctx.fillStyle = COLORS.gold;
      rr(ctx, -13, -11, 26, 20, 4);
      ctx.fill();
      ctx.fillStyle = COLORS.goldDark;
      ctx.fillRect(-13, -2, 26, 3);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(0, -4, 4, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.name.toUpperCase(), item.x, item.y - 22);
    } else {
      ctx.save();
      ctx.translate(item.x, item.y + bob);
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  // The exit: a green door that only opens once the main loot is taken.
  const ex = world.exit;
  const open = ex.open;
  ctx.fillStyle = open ? COLORS.exit : '#274d33';
  rr(ctx, ex.x - 17, ex.y - 17, 34, 34, 5);
  ctx.fill();
  ctx.strokeStyle = open ? '#a9f5c6' : '#5b7a65';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = open ? '#0d2b16' : '#9fb8a8';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', ex.x, ex.y - 22);
  ctx.fillStyle = open ? '#0d2b16' : '#c9d6cd';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(open ? '➜' : '✕', ex.x, ex.y + 6);
  if (open) {
    ctx.strokeStyle = `rgba(88, 214, 141, ${0.5 + 0.3 * Math.sin(time * 4)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(ex.x - 21, ex.y - 21, 42, 42);
  }
}

function drawHackPanels(ctx, world) {
  for (const panel of world.hackPanels) {
    const cam = world.cameras.find((c) => !c.disabled && Math.hypot(c.x - panel.x, c.y - panel.y) < TILE * 5);
    ctx.fillStyle = cam ? '#1d3a5f' : '#2c3e2c';
    rr(ctx, panel.x - 11, panel.y - 11, 22, 22, 4);
    ctx.fill();
    ctx.strokeStyle = cam ? '#6ea8ff' : '#7bc47f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = cam ? '#bcd6ff' : '#b8e6bb';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cam ? 'CAM' : 'OFF', panel.x, panel.y + 4);
  }
}

function drawCameras(ctx, world) {
  for (const cam of world.cameras) {
    if (!cam.disabled) {
      const fill = cam.suspicion > 0.5 ? COLORS.coneAlert : COLORS.coneCamera;
      drawCone(ctx, cam.x, cam.y, cam.angle, CAMERA_RANGE, CAMERA_HALF_ANGLE, fill, COLORS.coneCameraEdge);
    }
    // Pole-mounted camera body.
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(cam.x, cam.y, 9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = cam.disabled ? '#5a6b52' : COLORS.red;
    ctx.lineWidth = 2;
    ctx.stroke();
    const lx = cam.x + Math.cos(cam.angle) * 12;
    const ly = cam.y + Math.sin(cam.angle) * 12;
    ctx.fillStyle = cam.disabled ? '#4a5546' : COLORS.red;
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, TAU);
    ctx.fill();
    if (cam.disabled) {
      ctx.strokeStyle = '#7bc47f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cam.x - 5, cam.y);
      ctx.lineTo(cam.x - 1, cam.y + 5);
      ctx.lineTo(cam.x + 6, cam.y - 5);
      ctx.stroke();
    }
  }
}

function drawGuards(ctx, guards, time) {
  for (const guard of guards) {
    const alert = guard.state === GUARD_ALERT;
    const fill = alert ? COLORS.coneAlert : COLORS.coneGuard;
    drawCone(ctx, guard.x, guard.y, guard.angle, GUARD_RANGE, GUARD_HALF_ANGLE, fill, alert ? 'rgba(231,76,60,0.6)' : COLORS.coneGuardEdge);
    // Body: navy uniform, cap, facing tick.
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD_RADIUS, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#0e1a2e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.guardCap;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 3, 8, Math.PI, 0);
    ctx.fill();
    const fx = guard.x + Math.cos(guard.angle) * (GUARD_RADIUS + 4);
    const fy = guard.y + Math.sin(guard.angle) * (GUARD_RADIUS + 4);
    ctx.strokeStyle = '#dfe6f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // Suspicion: "?" while curious, "!" while chasing or investigating.
    let mark = null;
    if (alert) mark = '!';
    else if (guard.state === GUARD_SUSPICIOUS) mark = '?';
    else if (guard.state === GUARD_INVESTIGATE) mark = '…';
    if (mark) {
      const pulse = alert ? 1 + 0.12 * Math.sin(time * 10) : 1;
      ctx.font = `bold ${Math.round(20 * pulse)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = alert ? COLORS.red : COLORS.amber;
      ctx.fillText(mark, guard.x, guard.y - GUARD_RADIUS - 8);
    }
    // Suspicion ring while it builds.
    if (guard.suspicion > 0.05 && guard.suspicion < ALERT_AT_GUARD) {
      ctx.strokeStyle = `rgba(243, 156, 18, ${0.4 + guard.suspicion * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, GUARD_RADIUS + 5, -Math.PI / 2, -Math.PI / 2 + TAU * guard.suspicion);
      ctx.stroke();
    }
  }
}

// Suspicion value at which the ring stops (the guard is already chasing).
const ALERT_AT_GUARD = 0.72;

function drawPlayer(ctx, player, time) {
  const disguised = player.disguiseLeft > 0;
  // Sneak shadow: a soft circle showing the thief is moving quietly.
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(88, 214, 141, 0.10)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 22, 0, TAU);
    ctx.fill();
  }
  if (disguised) {
    ctx.fillStyle = 'rgba(88, 214, 141, 0.18)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = disguised ? '#274d33' : COLORS.thief;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
  // The hat: brim and crown, turned toward the facing angle.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = COLORS.thiefHat;
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 11, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = disguised ? COLORS.green : COLORS.gold;
  ctx.fillRect(6, -2, 5, 4);
  ctx.restore();
  // Loot flash popup.
  if (player.lootFlash > 0) {
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(player.lootFlashText, player.x, player.y - 24);
  }
  // Hold progress ring while picking, hacking or cracking.
  if (player.hold) {
    const need = player.hold.kind === 'door' ? 2.5 : player.hold.kind === 'hack' ? 2.0 : 1.2;
    const frac = Math.min(1, player.hold.seconds / need);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_RADIUS + 8, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
    ctx.stroke();
  }
}

function drawNoise(ctx, state, time) {
  if (!state.noise || state.noise.left <= 0) return;
  const n = state.noise;
  ctx.strokeStyle = `rgba(242, 193, 78, ${Math.min(1, n.left * 2)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(n.x, n.y, 10 + (0.9 - n.left) * 26, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CLATTER!', n.x, n.y - 16);
}

function drawHud(ctx, state, player, world) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H - 0.5);
  ctx.lineTo(CANVAS_W, HUD_H - 0.5);
  ctx.stroke();

  // Left: level and timer.
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${state.levelIndex + 1}. ${world.level.name}`, 14, 24);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '12px sans-serif';
  const t = Math.floor(state.elapsed);
  ctx.fillText(`⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}  ·  par ${world.level.parSeconds}s`, 14, 44);

  // Centre: the alarm meter.
  const ax = 330;
  const aw = 300;
  const alarm = state.alarm;
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax, 20);
  ctx.fillStyle = '#20242e';
  rr(ctx, ax, 26, aw, 16, 8);
  ctx.fill();
  const frac = Math.min(1, alarm);
  const grad = ctx.createLinearGradient(ax, 0, ax + aw, 0);
  grad.addColorStop(0, COLORS.green);
  grad.addColorStop(0.55, COLORS.amber);
  grad.addColorStop(1, COLORS.red);
  ctx.fillStyle = grad;
  if (frac > 0.01) {
    rr(ctx, ax, 26, Math.max(10, aw * frac), 16, 8);
    ctx.fill();
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  rr(ctx, ax, 26, aw, 16, 8);
  ctx.stroke();
  ctx.fillStyle = alarm > 0.72 ? COLORS.red : COLORS.muted;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(alarm > 0.72 ? 'SPOTTED!' : alarm > 0.25 ? 'suspicious…' : 'unseen', ax, 58);

  // Right: the take and the tools.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`$${state.take.toLocaleString('en-US')}`, CANVAS_W - 14, 26);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '12px sans-serif';
  const tools = Object.entries(TOOLS).map(([id, tool]) => {
    const sel = player.tool === id;
    return `${sel ? '▶' : ''}${tool.key} ${tool.name} −$${tool.cost}`;
  }).join('   ');
  ctx.fillText(tools, CANVAS_W - 14, 46);
  if (player.disguiseLeft > 0) {
    ctx.fillStyle = COLORS.green;
    ctx.fillText(`Disguise ${Math.ceil(player.disguiseLeft)}s`, CANVAS_W - 14, 60);
  }
}

function drawPrompt(ctx, prompt, player) {
  if (!prompt) return;
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px sans-serif';
  const text = prompt.label;
  const w = ctx.measureText(text).width + 24;
  const x = Math.max(8, Math.min(CANVAS_W - w - 8, player.x - w / 2));
  const y = HUD_H + WORLD_H - 34;
  ctx.fillStyle = 'rgba(10, 12, 16, 0.88)';
  rr(ctx, x, y, w, 26, 6);
  ctx.fill();
  ctx.strokeStyle = COLORS.goldDark;
  ctx.stroke();
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, x + w / 2, y + 18);
}

function drawBanner(ctx, text, sub, color) {
  ctx.fillStyle = 'rgba(8, 9, 13, 0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(text, CANVAS_W / 2, CANVAS_H / 2 - 10);
  if (sub) {
    ctx.fillStyle = COLORS.text;
    ctx.font = '16px sans-serif';
    ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 24);
  }
}

/** Draw one frame of the live game. */
export function render(ctx, state, time) {
  const { world, player, guards, cameras } = state;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();
  ctx.translate(0, HUD_H);
  drawFloor(ctx, world);
  drawDoorsAndVents(ctx, world);
  drawLootAndExit(ctx, world, time);
  drawHackPanels(ctx, world);
  drawCameras(ctx, world);
  drawGuards(ctx, guards, time);
  drawNoise(ctx, state, time);
  drawPlayer(ctx, player, time);
  ctx.restore();
  drawHud(ctx, state, player, world);
  if (state.screen === 'play') drawPrompt(ctx, state.prompt, player);
  if (state.toolFlashLeft > 0 && player.toolFlash) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = COLORS.amber;
    ctx.fillText(player.toolFlash, CANVAS_W / 2, HUD_H + 26);
  }
  if (state.screen === 'caught') {
    drawBanner(ctx, 'BUSTED!', 'The guards found you. Press R to run it back.', COLORS.red);
  } else if (state.screen === 'leveldone') {
    const bonus = Math.max(0, world.level.parSeconds - Math.floor(state.elapsed)) * 10;
    drawBanner(ctx, 'ROOM CLEARED', `${world.level.name} · take $${state.take.toLocaleString('en-US')} · speed bonus $${bonus} — press Enter for the next room`, COLORS.green);
  } else if (state.screen === 'win') {
    drawBanner(ctx, 'CLEAN GETAWAY', `Total take $${state.take.toLocaleString('en-US')} · ${state.rating} — press R to heist again`, COLORS.gold);
  } else if (state.screen === 'paused') {
    drawBanner(ctx, 'PAUSED', 'Press P to keep sneaking.', COLORS.text);
  }
}

/** The title screen, drawn over a dimmed live room. */
export function renderTitle(ctx, state, time) {
  render(ctx, state, time);
  ctx.fillStyle = 'rgba(8, 9, 13, 0.82)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('VELVET VAULT', CANVAS_W / 2, 150);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.fillText('The Midnight Heist', CANVAS_W / 2, 184);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '15px sans-serif';
  const lines = [
    'Three rooms. Three scores. One crew: you.',
    'Grab the main loot, then reach the exit before the alarm does.',
    '',
    'WASD / arrows — move      Shift — sneak      E — hold to pick, hack, crack',
    '1 lockpick · 2 noisemaker (click to throw) · 3 disguise — every tool costs $100 of the take',
    'Guards patrol with vision cones. Cameras sweep. Break line of sight to cool the alarm.',
    'Vents are thief-only shortcuts. Locked doors can be held open — or picked, fast.',
    '',
    'Click or press Enter to start the heist.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, CANVAS_W / 2, 240 + i * 26));
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 16px sans-serif';
  const blink = 0.6 + 0.4 * Math.sin(time * 3);
  ctx.globalAlpha = blink;
  ctx.fillText('— press Enter —', CANVAS_W / 2, 240 + lines.length * 26 + 18);
  ctx.globalAlpha = 1;
}
