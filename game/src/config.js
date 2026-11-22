// Velvet Vault — shared tuning constants. One place for every number the
// other modules read, so balancing the game means editing this file only.
export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const WORLD_W = COLS * TILE; // 960
export const WORLD_H = ROWS * TILE; // 600
export const HUD_H = 64;
export const CANVAS_W = WORLD_W; // 960
export const CANVAS_H = HUD_H + WORLD_H; // 664

// Movement speeds, pixels per second.
export const PLAYER_SPEED = 150;
export const PLAYER_SNEAK_SPEED = 82;
export const GUARD_SPEED = 58;
export const GUARD_CHASE_SPEED = 118;
export const GUARD_INVESTIGATE_SPEED = 88;

// Vision: guards see a wedge, cameras a sweeping wedge. Walls block both.
export const GUARD_RANGE = 185;
export const GUARD_HALF_ANGLE = Math.PI / 5.2; // ~35 degrees each side
export const CAMERA_RANGE = 205;
export const CAMERA_HALF_ANGLE = Math.PI / 6; // 30 degrees each side
// How fast suspicion (0..1) grows while the thief is inside a cone.
export const GUARD_SPOT_RATE = 0.55; // ~1.8 s of exposure to max out
export const CAMERA_SPOT_RATE = 0.8; // cameras are quicker than guards
export const CLOSE_SPOT_BONUS = 0.6; // extra rate inside 70 px
export const SUSPICION_DECAY = 0.35; // per second, out of sight
export const ALARM_DECAY = 0.05; // the alarm meter drains very slowly
export const ALERT_AT = 0.72; // suspicion above this: guard gives chase
export const DISGUISE_CLOSE_RANGE = 46; // disguised: only spotted this close

// The thief.
export const PLAYER_RADIUS = 12;
export const GUARD_RADIUS = 13;

// Tools. Every use costs a cut of the take — nothing in this crew is free.
export const TOOLS = {
  lockpick: { key: '1', name: 'Lockpick', cost: 100, desc: 'Opens a locked door instantly' },
  noisemaker: { key: '2', name: 'Noisemaker', cost: 100, desc: 'Click a floor spot: guards go look' },
  disguise: { key: '3', name: 'Disguise', cost: 100, desc: '8 s: cones ignore you unless close' },
};
export const DISGUISE_SECONDS = 8;
export const NOISEMAKER_RANGE = 280; // how far the thief can throw
export const NOISEMAKER_LURE_RADIUS = 230; // guards inside this go investigate
export const INVESTIGATE_SECONDS = 5;

// Interactions.
export const DOOR_HOLD_SECONDS = 2.5; // hold E beside a locked door
export const HACK_HOLD_SECONDS = 2.0; // hold E beside a camera panel
export const LOOT_HOLD_SECONDS = 1.2; // hold E to crack the main loot

// Money.
export const SMALL_LOOT_VALUE = 250;
export const MAIN_LOOT_VALUE = 1500;

// Colours.
export const COLORS = {
  bg: '#0d0f14',
  floorA: '#232733',
  floorB: '#1e222c',
  floorLine: '#2c3140',
  wall: '#3a4152',
  wallTop: '#4d566e',
  wallEdge: '#171a21',
  carpet: '#5a2e35',
  gold: '#f2c14e',
  goldDark: '#b98a1e',
  green: '#58d68d',
  red: '#e74c3c',
  amber: '#f39c12',
  coneGuard: 'rgba(242, 193, 78, 0.20)',
  coneGuardEdge: 'rgba(242, 193, 78, 0.45)',
  coneCamera: 'rgba(231, 76, 60, 0.20)',
  coneCameraEdge: 'rgba(231, 76, 60, 0.5)',
  coneAlert: 'rgba(231, 76, 60, 0.34)',
  hudBg: '#12141b',
  hudLine: '#2a2f3d',
  text: '#e8e6df',
  muted: '#9aa0b0',
  thief: '#1b1e26',
  thiefHat: '#0f1116',
  guard: '#2e4a7a',
  guardCap: '#1d3257',
  exit: '#2ecc71',
};
