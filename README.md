# Velvet Vault — The Midnight Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Kikuk00/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Kikuk00/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down 2D heist game for the [make.fun](https://make.fun) bounty
**best-heist-game-20261122-0559** ("Make the best heist game"). One thief,
three rooms, one very nervous alarm meter.

## The game

You are the thief. Three rooms stand between you and a clean getaway:

1. **The Gallery** — lift the Starlight Mask, then slip out the back.
2. **The Vault Floor** — the vault gold is yours, if the floor lets you leave.
3. **The Rooftop Getaway** — grab the briefcase. The helicopter is waiting.

Each room is a stealth puzzle with several routes: the main halls, locked
doors, and thief-only vents. Guards patrol with vision cones, cameras sweep
the rooms, and the alarm meter climbs whenever anyone sees you — break line
of sight to cool it down. Get spotted too long and the guards give chase;
get caught and the room starts over.

## Tools — every one costs $100 of the take

- **1 · Lockpick** — opens a locked door instantly (or hold **E** for 2.5 s, free but slow).
- **2 · Noisemaker** — click a floor spot to throw it; nearby guards go investigate the clatter.
- **3 · Disguise** — 8 seconds of blending in; cones ignore you unless you get very close.

Small loot is pocketed by walking over it; the main loot takes a 1.2 s hold
to crack, and only then does the exit open. Finish under par time for a
speed bonus. Your rating — **Ghost**, **Smooth** or **Loud** — depends on how
high the alarm ever climbed.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Shift | Sneak (slower, half as easy to spot) |
| E (hold) | Pick a lock, hack a camera panel, crack the main loot |
| 1 / 2 / 3 | Select lockpick / noisemaker / disguise |
| Mouse click | Throw the noisemaker at a floor spot |
| P | Pause · M mute · R retry after being busted |

## Play it

Open `game/index.html` in a desktop browser — no build step, no network
requests, everything is static files. Sound is synthesized live with
WebAudio; there are no audio files.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` via the vendored
`vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `game/` — the playable game (`index.html` + `src/*.js`, one job per file)
- `game/src/levels.js` — the three rooms, patrols and camera sweeps
- `game/src/guards.js` — patrols, vision cones, suspicion and chases
- `game/src/player.js` — the thief, tools and interactions
- `game/src/render.js` — all drawing, HUD and screens
- `game/src/shots.js` — the deterministic screenshot scenes
- `screenshots/` — real renders of the game running (the first is the cover)
- `vendor/makefun-game.ts` — the make.fun dossier library, copied from the kit unchanged

MIT licensed. Original art, sounds and names — no commercial game was copied.
