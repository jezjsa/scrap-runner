import { COLS, LEVELS, ROWS, TOTAL_LEVELS } from "./levels.js";
import { drawSprite, loadArt } from "./sprites.js";
import { sfx } from "./audio.js";

export const TILE = 32;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

const SWING_PIVOT_X = WIDTH / 2;
const SWING_PIVOT_Y = 2;
const SWING_LEN = 240;
const SWING_AMP = 0.28;
const SWING_HZ = 0.45;

const DIFFICULTIES = {
  easy: { lives: 5, enemy: 0.82, label: "Easy" },
  medium: { lives: 4, enemy: 1, label: "Medium" },
  hard: { lives: 3, enemy: 1.22, label: "Hard" },
};

const keys = new Set();
let art = null;
let canvas = null;
let ctx = null;
let hooks = {};
let running = false;
let last = 0;
let tipUntil = 0;
let tipText = "";

const state = {
  phase: "menu",
  difficulty: "easy",
  speed: 1,
  level: 0,
  lives: 5,
  score: 0,
  extraAt: 10000,
  cellsGot: 0,
  cellsMax: 0,
  hatchOpen: false,
  gateOpen: false,
  startedAt: 0,
  levelAt: 0,
  runId: null,
  grid: [],
  player: null,
  enemies: [],
  cells: [],
  movers: [],
  collapses: [],
  crushers: [],
  orbs: [],
  rails: [],
  hatch: null,
  switchPos: null,
  spawn: { x: 40, y: 400 },
};

function now() {
  return performance.now();
}

function showTip(text, ms = 2200) {
  tipText = text;
  tipUntil = now() + ms;
  hooks.onTip?.(text, ms);
}

function hud() {
  hooks.onHud?.({
    lives: state.lives,
    score: state.score,
    level: state.level + 1,
    total: TOTAL_LEVELS,
    cells: state.cellsGot,
    cellsMax: state.cellsMax,
    hatchOpen: state.hatchOpen,
    difficulty: state.difficulty,
    speed: state.speed,
    paused: state.phase === "paused",
    playing: state.phase === "play",
  });
}

function tileAt(tx, ty) {
  if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return "=";
  return state.grid[ty][tx];
}

function setTile(tx, ty, ch) {
  if (ty < 0 || tx < 0 || tx >= COLS || ty >= ROWS) return;
  const row = state.grid[ty];
  state.grid[ty] = row.slice(0, tx) + ch + row.slice(tx + 1);
}

function isLadder(ch) {
  return ch === "L" || ch === "+";
}

function isFloorChar(ch) {
  return ch === "=" || ch === "+" || ch === ">" || ch === "<" || ch === "E";
}

function isGateAt(px, py) {
  return tileAt(Math.floor(px / TILE), Math.floor(py / TILE)) === "G" && !state.gateOpen;
}

function beamTop(ty) {
  return ty * TILE + 18;
}

function floorY(px, prevY, nextY, throughHoles = false) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(nextY / TILE);
  const ch = tileAt(tx, ty);
  const dropThrough =
    throughHoles && (ch === "+" || (nextY > prevY && isLadder(tileAt(tx, ty + 1))));
  if (isFloorChar(ch) && !dropThrough) {
    const top = beamTop(ty);
    if (prevY <= top + 1 && nextY >= top) return top;
  }
  for (const plat of state.movers) {
    if (px >= plat.x && px < plat.x + plat.w && prevY <= plat.y + 1 && nextY >= plat.y) return plat.y;
  }
  for (const plate of state.collapses) {
    if (plate.gone) continue;
    const top = plate.y + 18;
    if (px >= plate.x && px < plate.x + plate.w && prevY <= top + 1 && nextY >= top) return top;
  }
  return null;
}

function supportedAt(px, py) {
  return floorY(px, py - 4, py + 2) != null;
}

function ladderSamples(body) {
  return {
    xs: [body.x + 2, body.x + body.w / 2, body.x + body.w - 2],
    ys: [body.y + 4, body.y + body.h / 2, body.y + body.h - 2, body.y + body.h + 6],
  };
}

function onLadder(body) {
  const { xs, ys } = ladderSamples(body);
  for (const x of xs) {
    for (const y of ys) {
      if (isLadder(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)))) return true;
    }
  }
  return false;
}

function ladderBeneath(body) {
  const feetTy = Math.floor((body.y + body.h + 1) / TILE);
  const xs = [body.x - 12, body.x + 2, body.x + body.w / 2, body.x + body.w - 2, body.x + body.w + 12];
  for (const x of xs) {
    const tx = Math.floor(x / TILE);
    if (isLadder(tileAt(tx, feetTy)) || isLadder(tileAt(tx, feetTy + 1))) return true;
  }
  return false;
}

function ladderCol(body) {
  const midX = body.x + body.w / 2;
  const { ys } = ladderSamples(body);
  const searchY = [...ys, body.y + body.h + TILE / 2];
  let best = Math.floor(midX / TILE);
  let bestDist = Infinity;
  const tx0 = Math.floor(body.x / TILE) - 1;
  const tx1 = Math.floor((body.x + body.w) / TILE) + 1;
  for (let tx = tx0; tx <= tx1; tx += 1) {
    for (const y of searchY) {
      if (!isLadder(tileAt(tx, Math.floor(y / TILE)))) continue;
      const dist = Math.abs(midX - (tx * TILE + TILE / 2));
      if (dist < bestDist) {
        bestDist = dist;
        best = tx;
      }
    }
  }
  return best;
}

function snapToLadder(p) {
  p.x = ladderCol(p) * TILE + (TILE - p.w) / 2;
}

function eachLadderRun(fn) {
  for (let x = 0; x < COLS; x += 1) {
    let y = 0;
    while (y < ROWS) {
      if (!isLadder(tileAt(x, y))) {
        y += 1;
        continue;
      }
      const y0 = y;
      while (y < ROWS && isLadder(tileAt(x, y))) y += 1;
      fn(x, y0, y);
    }
  }
}

function drawLadderRun(col, y0, y1) {
  const destW = 24;
  const x = col * TILE + (TILE - destW) / 2;
  const topY = y0 * TILE;
  const botY = y1 * TILE;
  const kit = art?.ladder;
  ctx.imageSmoothingEnabled = false;
  if (kit?.mid && kit?.top && kit?.base) {
    const scale = destW / kit.mid.width;
    const topH = Math.max(8, Math.round(kit.top.height * scale));
    const midH = Math.max(8, Math.round(kit.mid.height * scale));
    const baseH = Math.max(8, Math.round(kit.base.height * scale));
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 2, topY, destW + 4, botY - topY);
    ctx.clip();
    ctx.drawImage(kit.top, x, topY, destW, topH);
    for (let y = topY + topH - 2; y < botY - baseH; y += midH - 2) {
      ctx.drawImage(kit.mid, x, y, destW, midH);
    }
    ctx.drawImage(kit.base, x, botY - baseH, destW, baseH);
    ctx.restore();
    return;
  }
  if (kit?.full) {
    ctx.drawImage(kit.full, x, topY, destW, botY - topY);
    return;
  }
  ctx.strokeStyle = "#c47840";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, topY);
  ctx.lineTo(x + 4, botY);
  ctx.moveTo(x + destW - 4, topY);
  ctx.lineTo(x + destW - 4, botY);
  ctx.stroke();
  ctx.strokeStyle = "#e08a4a";
  ctx.lineWidth = 2;
  for (let y = topY + 10; y < botY; y += 14) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + destW - 4, y);
    ctx.stroke();
  }
}

function conveyorAt(body) {
  const feet = tileAt(Math.floor((body.x + body.w / 2) / TILE), Math.floor((body.y + body.h + 1) / TILE));
  if (feet === ">") return 70;
  if (feet === "<") return -70;
  return 0;
}

function electricAt(body) {
  const tx = Math.floor((body.x + body.w / 2) / TILE);
  const ty = Math.floor((body.y + body.h + 1) / TILE);
  return tileAt(tx, ty) === "E" && body.onGround;
}

function addScore(n) {
  state.score += n;
  if (state.score >= state.extraAt) {
    state.lives += 1;
    state.extraAt += 10000;
    sfx.extra();
    showTip("Extra life");
  }
}

function parseLevel(index) {
  const def = LEVELS[index];
  state.grid = def.grid.slice();
  state.enemies = [];
  state.cells = [];
  state.movers = [];
  state.collapses = [];
  state.crushers = [];
  state.orbs = [];
  state.rails = [];
  state.hatch = null;
  state.switchPos = null;
  state.hatchOpen = false;
  state.gateOpen = false;
  state.cellsGot = 0;
  state.levelAt = now();

  const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  const eatRun = (x, y, ch) => {
    let x1 = x;
    while (x1 < COLS && state.grid[y][x1] === ch && !used[y][x1]) {
      used[y][x1] = true;
      x1 += 1;
    }
    return x1 - x;
  };

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = state.grid[y][x];
      if (used[y][x]) continue;
      if (ch === "S") {
        state.spawn = { x: x * TILE + 8, y: y * TILE + 4 };
        setTile(x, y, ".");
      } else if (ch === "H") {
        state.hatch = { x: x * TILE, y: y * TILE, w: TILE * 2, h: TILE };
        setTile(x, y, ".");
      } else if (ch === "C") {
        state.cells.push({ x: x * TILE + 6, y: y * TILE + 6, w: 20, h: 20, got: false, frame: (x + y) % 12 });
        setTile(x, y, ".");
      } else if (ch === "W") {
        state.switchPos = { x: x * TILE, y: y * TILE };
        setTile(x, y, ".");
      } else if (ch === "B" || ch === "R" || ch === "D" || ch === "X" || ch === "U") {
        const kind = ch === "B" ? "bot" : ch === "R" ? "crawler" : ch === "D" ? "drone" : ch === "U" ? "guardian" : "hunter";
        const big = kind === "guardian";
        state.enemies.push({
          kind,
          x: x * TILE + (big ? 2 : 6),
          y: y * TILE + (big ? -10 : 6),
          w: big ? 28 : 18,
          h: big ? 36 : 22,
          vx: kind === "drone" ? 50 : 36,
          vy: 0,
          dir: x < COLS / 2 ? 1 : -1,
          climbing: false,
          frame: 0,
          think: 0,
        });
        setTile(x, y, ".");
      } else if (ch === "M") {
        const len = eatRun(x, y, "M");
        state.movers.push({
          x: x * TILE,
          y: y * TILE,
          w: len * TILE,
          h: 10,
          dir: 1,
          speed: 36,
        });
        for (let i = 0; i < len; i += 1) setTile(x + i, y, ".");
      } else if (ch === "K") {
        const len = eatRun(x, y, "K");
        state.collapses.push({
          x: x * TILE,
          y: y * TILE,
          w: len * TILE,
          h: TILE,
          timer: 0,
          falling: false,
          gone: false,
          vy: 0,
        });
        for (let i = 0; i < len; i += 1) setTile(x + i, y, ".");
      } else if (ch === "P") {
        state.crushers.push({
          x: x * TILE,
          y: y * TILE,
          w: TILE,
          h: TILE * 2,
          baseY: y * TILE,
          t: x * 0.4,
        });
        setTile(x, y, ".");
      } else if (ch === "o") {
        state.rails.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
        setTile(x, y, ".");
      }
    }
  }

  if (state.rails.length) {
    const path = orderRail(state.rails);
    state.orbs.push({ path, u: 0, speed: 55, r: 8 });
  }

  state.cellsMax = state.cells.length;
  state.player = makePlayer(state.spawn.x, state.spawn.y);
}

function orderRail(points) {
  if (points.length < 2) return points;
  const left = points.slice();
  const path = [left.shift()];
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    const last = path[path.length - 1];
    for (let i = 0; i < left.length; i += 1) {
      const d = Math.hypot(left[i].x - last.x, left[i].y - last.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    path.push(left.splice(best, 1)[0]);
  }
  return path;
}

function makePlayer(x, y) {
  return {
    x,
    y,
    w: 16,
    h: 30,
    vx: 0,
    vy: 0,
    dir: 1,
    onGround: false,
    climbing: false,
    sliding: false,
    walking: false,
    invuln: 1.1,
    frame: 0,
    anim: 0,
    riding: null,
  };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveAxis(body, dx, dy) {
  if (dx) {
    body.x += dx;
    const dir = Math.sign(dx);
    const edge = dir > 0 ? body.x + body.w : body.x;
    if (isGateAt(edge, body.y + 4) || isGateAt(edge, body.y + body.h - 4)) {
      if (dir > 0) body.x = Math.floor((body.x + body.w) / TILE) * TILE - body.w - 0.01;
      else body.x = Math.floor(body.x / TILE) * TILE + TILE + 0.01;
      body.vx = 0;
    }
    body.x = Math.max(2, Math.min(WIDTH - body.w - 2, body.x));
  }
  if (dy) {
    const prevFeet = body.y + body.h;
    body.y += dy;
    if (dy > 0) {
      const feet = body.y + body.h;
      const through = Boolean(body.climbing);
      const left = floorY(body.x + 3, prevFeet, feet, through);
      const right = floorY(body.x + body.w - 3, prevFeet, feet, through);
      const top = left ?? right;
      if (top != null) {
        body.y = top - body.h - 0.01;
        body.vy = 0;
        body.onGround = true;
      }
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;
  const left = keys.has("ArrowLeft") || keys.has("a") || keys.has("o");
  const right = keys.has("ArrowRight") || keys.has("d") || keys.has("p");
  const up = keys.has("ArrowUp") || keys.has("w");
  const down = keys.has("ArrowDown") || keys.has("s");
  const hop = keys.has(" ");
  const jump = hop || up;

  p.riding = null;
  p.onGround = supportedAt(p.x + 2, p.y + p.h + 1) || supportedAt(p.x + p.w - 2, p.y + p.h + 1);
  for (const plat of state.movers) {
    if (p.x + p.w > plat.x && p.x < plat.x + plat.w && Math.abs(p.y + p.h - plat.y) < 6 && p.vy >= 0) {
      p.onGround = true;
      p.y = plat.y - p.h - 0.01;
      p.riding = plat;
    }
  }
  for (const plate of state.collapses) {
    if (plate.gone) continue;
    if (p.x + p.w > plate.x && p.x < plate.x + plate.w && Math.abs(p.y + p.h - plate.y) < 6 && p.vy >= 0) {
      p.onGround = true;
      p.y = plate.y - p.h - 0.01;
      plate.timer += dt;
      if (plate.timer > 0.45) plate.falling = true;
    }
  }

  const feetCh = tileAt(
    Math.floor((p.x + p.w / 2) / TILE),
    Math.floor((p.y + p.h + 1) / TILE),
  );
  const onSolidFloor = p.onGround && feetCh !== "+" && feetCh !== "L";

  const canClimb = onLadder(p) || ((down || p.climbing || p.sliding) && ladderBeneath(p));
  if (canClimb && (up || down || p.climbing || p.sliding)) {
    if (hop && (left || right)) {
      p.climbing = false;
      p.sliding = false;
      p.walking = false;
      p.dir = left ? -1 : 1;
      p.vx = p.dir * 200;
      p.vy = -280;
      p.onGround = false;
      p.x += p.dir * 10;
      sfx.jump();
    } else if (up) {
      p.sliding = false;
      p.climbing = true;
      p.vy = -110;
      p.vx = 0;
      snapToLadder(p);
      p.walking = false;
    } else if ((hop || p.sliding) && !onSolidFloor) {
      p.climbing = true;
      p.sliding = true;
      p.walking = false;
      p.vx = 0;
      p.vy = 280;
      snapToLadder(p);
      if (left) p.dir = -1;
      if (right) p.dir = 1;
    } else {
      p.sliding = false;
      p.climbing = true;
      p.vy = 0;
      p.vx = 0;
      snapToLadder(p);
      if (down) p.vy = 110;
      if (left) p.dir = -1;
      if (right) p.dir = 1;
      if ((left || right) && p.onGround && !down) p.climbing = false;
      p.walking = false;
    }
  } else {
    p.climbing = false;
    p.sliding = false;
  }

  if (!p.climbing) {
    const walk = 140;
    p.vx = 0;
    p.walking = left || right;
    if (left) {
      p.vx = -walk;
      p.dir = -1;
    }
    if (right) {
      p.vx = walk;
      p.dir = 1;
    }
    p.vx += conveyorAt(p);
    if (p.riding) p.vx += p.riding.dir * p.riding.speed;
    if (jump && p.onGround && !down) {
      p.vy = -330;
      p.onGround = false;
      sfx.jump();
    }
    p.vy += 980 * dt;
    if (p.vy > 520) p.vy = 520;
  }

  moveAxis(p, p.vx * dt, 0);
  moveAxis(p, 0, p.vy * dt);
  if (p.y > HEIGHT + 40) hurt();

  if (p.sliding) p.anim += dt * 14;
  else if (p.climbing && Math.abs(p.vy) > 20) p.anim += dt * 8;
  else if (p.walking) p.anim += dt * 10;
  else if (p.onGround) p.anim += dt * 2;
  p.invuln = Math.max(0, p.invuln - dt);

  for (const cell of state.cells) {
    if (cell.got) continue;
    if (overlap(p, cell)) {
      cell.got = true;
      state.cellsGot += 1;
      addScore(120 + state.level * 40);
      sfx.collect();
      if (state.cellsGot >= state.cellsMax) {
        state.hatchOpen = true;
        sfx.hatch();
        showTip("Hatch is live — get out");
      }
    }
  }

  if (state.switchPos && !state.gateOpen) {
    const sw = { x: state.switchPos.x + 6, y: state.switchPos.y + 6, w: 20, h: 20 };
    if (overlap(p, sw)) {
      state.gateOpen = true;
      showTip("Gate open");
      sfx.collect();
    }
  }

  if (state.hatchOpen && state.hatch && overlap(p, state.hatch)) {
    clearLevel();
    return;
  }

  if (p.invuln > 0) return;
  if (electricAt(p)) {
    hurt();
    return;
  }
  for (const e of state.enemies) {
    if (overlap(p, e)) {
      hurt();
      return;
    }
  }
  for (const orb of state.orbs) {
    const hit = { x: orb.x - orb.r, y: orb.y - orb.r, w: orb.r * 2, h: orb.r * 2 };
    if (overlap(p, hit)) {
      hurt();
      return;
    }
  }
  for (const crush of state.crushers) {
    if (overlap(p, crush)) {
      hurt();
      return;
    }
  }
}

function edgeAhead(body, dir) {
  const lookX = dir > 0 ? body.x + body.w + 2 : body.x - 2;
  const ground = supportedAt(lookX, body.y + body.h + 4);
  const wall = isGateAt(lookX, body.y + body.h / 2);
  return !ground || wall;
}

function nearestLadderX(fromX, rowY) {
  let best = null;
  let bestD = Infinity;
  const ty = Math.floor(rowY / TILE);
  for (let tx = 0; tx < COLS; tx += 1) {
    if (!isLadder(tileAt(tx, ty))) continue;
    const x = tx * TILE + 10;
    const d = Math.abs(x - fromX);
    if (d < bestD) {
      bestD = d;
      best = x;
    }
  }
  return best;
}

function updateEnemy(e, dt) {
  const speed = (e.kind === "drone" ? 70 : e.kind === "guardian" ? 52 : e.kind === "hunter" ? 48 : 38)
    * DIFFICULTIES[state.difficulty].enemy;
  e.frame += dt * 8;

  if (e.kind === "drone") {
    e.x += e.dir * speed * dt;
    if (e.x < 8 || e.x + e.w > WIDTH - 8 || isGateAt(e.dir > 0 ? e.x + e.w : e.x, e.y + 8)) e.dir *= -1;
    return;
  }

  e.onGround = supportedAt(e.x + 2, e.y + e.h + 1) || supportedAt(e.x + e.w - 2, e.y + e.h + 1);
  const climbKinds = e.kind === "bot" || e.kind === "hunter" || e.kind === "guardian";
  if (climbKinds && onLadder(e)) {
    e.think -= dt;
    if (e.think <= 0) {
      e.think = 0.8 + Math.random();
      if (e.kind === "hunter" || e.kind === "guardian") {
        e.climbing = state.player.y + 8 < e.y ? -1 : state.player.y > e.y + 20 ? 1 : 0;
      } else {
        e.climbing = Math.random() < 0.45 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      }
    }
    if (e.climbing) {
      e.vy = e.climbing * speed * 0.85;
      e.vx = 0;
      moveAxis(e, 0, e.vy * dt);
      if (!onLadder(e)) e.climbing = 0;
      return;
    }
  }

  if ((e.kind === "hunter" || e.kind === "guardian") && e.onGround) {
    e.think -= dt;
    if (e.think <= 0) {
      e.think = 0.7;
      if (Math.abs(state.player.y - e.y) > 28) {
        const lx = nearestLadderX(e.x, e.y + e.h / 2);
        if (lx != null) e.dir = lx < e.x ? -1 : 1;
      } else {
        e.dir = state.player.x < e.x ? -1 : 1;
      }
    }
  }

  if (e.kind === "crawler" || !climbKinds) {
    if (edgeAhead(e, e.dir)) e.dir *= -1;
  } else if (e.onGround && edgeAhead(e, e.dir) && !onLadder(e)) {
    e.dir *= -1;
  }

  e.vx = e.dir * speed;
  e.vy += 980 * dt;
  if (e.vy > 480) e.vy = 480;
  moveAxis(e, e.vx * dt, 0);
  moveAxis(e, 0, e.vy * dt);
}

function updateMovers(dt) {
  for (const plat of state.movers) {
    plat.x += plat.dir * plat.speed * dt;
    const left = plat.x + 2;
    const right = plat.x + plat.w - 2;
    if (isGateAt(left, plat.y + 4) || isGateAt(right, plat.y + 4) || plat.x < 8 || plat.x + plat.w > WIDTH - 8) {
      plat.dir *= -1;
      plat.x += plat.dir * plat.speed * dt * 2;
    }
  }
  for (const plate of state.collapses) {
    if (!plate.falling || plate.gone) continue;
    plate.vy += 700 * dt;
    plate.y += plate.vy * dt;
    if (plate.y > HEIGHT + 40) plate.gone = true;
  }
  for (const crush of state.crushers) {
    crush.t += dt;
    const cycle = (Math.sin(crush.t * 1.6) + 1) / 2;
    crush.y = crush.baseY + cycle * TILE * 3;
  }
  for (const orb of state.orbs) {
    if (orb.path.length < 2) continue;
    orb.u += (orb.speed * dt) / 40;
    const span = orb.path.length;
    const u = ((orb.u % span) + span) % span;
    const i = Math.floor(u);
    const t = u - i;
    const a = orb.path[i];
    const b = orb.path[(i + 1) % span];
    orb.x = a.x + (b.x - a.x) * t;
    orb.y = a.y + (b.y - a.y) * t;
  }
}

function hurt() {
  if (state.phase !== "play") return;
  if (state.player.invuln > 0) return;
  sfx.die();
  state.lives -= 1;
  if (state.lives <= 0) {
    endRun(false);
    return;
  }
  state.player = makePlayer(state.spawn.x, state.spawn.y);
  showTip("Hit — try again");
  hud();
}

function clearLevel() {
  const elapsed = (now() - state.levelAt) / 1000;
  const bonus = Math.max(0, Math.round((90 - elapsed) * (6 + state.level)));
  addScore(400 + state.level * 80 + bonus);
  sfx.clear();
  if (state.level >= TOTAL_LEVELS - 1) {
    endRun(true);
    return;
  }
  state.level += 1;
  parseLevel(state.level);
  showTip(LEVELS[state.level].blurb, 2600);
  hud();
}

function endRun(won) {
  state.phase = won ? "won" : "over";
  running = false;
  hud();
  hooks.onEnd?.({
    won,
    score: state.score,
    waves: state.level + 1,
    durationMs: Math.round(now() - state.startedAt),
    difficulty: state.difficulty,
  });
}

function swingAngle(t) {
  return SWING_AMP * Math.sin(t * SWING_HZ * Math.PI * 2);
}

function drawSwing(t) {
  if (state.level !== 0) return;
  const img = art?.swing;
  if (!img) return;
  const destH = SWING_LEN;
  const destW = Math.max(16, Math.round(img.width * (destH / img.height)));
  const angle = swingAngle(t);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.translate(SWING_PIVOT_X, SWING_PIVOT_Y);
  ctx.rotate(angle);
  ctx.drawImage(img, -destW / 2, 0, destW, destH);
  ctx.restore();
}

function drawPlatform(x, y, w, h, color = "#6a3a22") {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#8a5a32";
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = "#2a1810";
  for (let i = x + 6; i < x + w; i += 14) ctx.fillRect(i, y + 4, 2, 2);
}

function drawWorld(t) {
  if (art?.sky) ctx.drawImage(art.sky, 0, 0, WIDTH, HEIGHT);
  else {
    ctx.fillStyle = "#141210";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (art?.midground) ctx.drawImage(art.midground, 0, 0, WIDTH, HEIGHT);
  if (art?.frame) ctx.drawImage(art.frame, 0, 0, WIDTH, HEIGHT);

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const ch = tileAt(x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (ch === "=" || ch === "+") drawPlatform(px, py + 18, TILE, 12);
      if (ch === ">" || ch === "<") {
        drawPlatform(px, py + 18, TILE, 12, "#5a3220");
        ctx.fillStyle = "#e08a4a";
        ctx.fillText(ch === ">" ? "›" : "‹", px + 10, py + 16);
      }
      if (ch === "E") {
        drawPlatform(px, py + 18, TILE, 12, "#2a3a18");
        ctx.fillStyle = `rgba(140, 220, 70, ${0.35 + Math.sin(t * 8 + x) * 0.2})`;
        ctx.fillRect(px, py + 16, TILE, 14);
      }
      if (ch === "G" && !state.gateOpen) {
        ctx.fillStyle = "#3a2a22";
        ctx.fillRect(px + 10, py, 12, TILE);
        ctx.fillStyle = "#8a5a32";
        ctx.fillRect(px + 8, py, 16, 4);
      }
    }
  }

  eachLadderRun(drawLadderRun);
  drawSwing(t);

  for (const plat of state.movers) drawPlatform(plat.x, plat.y, plat.w, plat.h, "#8a4a28");
  for (const plate of state.collapses) {
    if (plate.gone) continue;
    drawPlatform(plate.x, plate.y + 18, plate.w, 12, plate.falling ? "#4a2218" : "#6a3a22");
  }
  for (const crush of state.crushers) {
    ctx.fillStyle = "#4a2a1c";
    ctx.fillRect(crush.x + 4, crush.baseY, 24, crush.y - crush.baseY + crush.h);
    ctx.fillStyle = "#8a3a22";
    ctx.fillRect(crush.x, crush.y + crush.h - 10, crush.w, 12);
  }

  if (state.switchPos) {
    ctx.fillStyle = state.gateOpen ? "#6a8a3a" : "#c44b3a";
    ctx.fillRect(state.switchPos.x + 10, state.switchPos.y + 10, 12, 14);
  }

  if (state.hatch) {
    const glow = state.hatchOpen;
    ctx.fillStyle = glow ? "#3a5a22" : "#2a221c";
    ctx.fillRect(state.hatch.x, state.hatch.y + 8, state.hatch.w, 20);
    if (glow) {
      ctx.fillStyle = `rgba(140, 220, 80, ${0.45 + Math.sin(t * 6) * 0.2})`;
      ctx.fillRect(state.hatch.x + 6, state.hatch.y - 10, state.hatch.w - 12, 18);
      ctx.fillStyle = "#c8f0a4";
      ctx.font = "700 10px Trebuchet MS";
      ctx.fillText("HATCH", state.hatch.x + 6, state.hatch.y + 4);
    }
  }

  for (const cell of state.cells) {
    if (cell.got) continue;
    const frame = art?.cells?.[cell.frame % (art.cells.length || 1)];
    if (frame) drawSprite(ctx, frame, cell.x - 2, cell.y - 4, 24, 24);
    else {
      ctx.fillStyle = "#7ae05a";
      ctx.beginPath();
      ctx.arc(cell.x + 10, cell.y + 10, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const orb of state.orbs) {
    ctx.fillStyle = "#7ae05a";
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c8f0a4";
    ctx.stroke();
  }

  for (const e of state.enemies) {
    const sheet = e.kind === "drone" ? art?.enemies?.drone
      : e.kind === "crawler" ? art?.enemies?.crawler
        : e.kind === "guardian" ? art?.enemies?.bot
          : e.kind === "hunter" ? art?.enemies?.rat
            : art?.enemies?.bot;
    const frame = sheet?.[Math.floor(e.frame) % (sheet?.length || 1)];
    const dw = e.kind === "guardian" ? 40 : 28;
    const dh = e.kind === "guardian" ? 44 : 30;
    if (frame) drawSprite(ctx, frame, e.x - 6, e.y - 8, dw, dh, e.dir < 0);
    else {
      ctx.fillStyle = e.kind === "drone" ? "#6a8a3a" : "#8a4a28";
      ctx.fillRect(e.x, e.y, e.w, e.h);
    }
  }

  const hero = state.player;
  if (hero) {
    const blink = hero.invuln > 0 && Math.floor(hero.invuln * 12) % 2 === 0;
    if (!blink) {
      let frames = art?.hero?.run;
      let frameIndex = Math.floor(hero.anim);
      if (hero.climbing) {
        frames = art?.hero?.climb?.length ? art.hero.climb : frames;
        if (!hero.sliding && Math.abs(hero.vy) <= 20) frameIndex = 0;
      } else if (!hero.onGround && art?.hero?.jump?.length) {
        frames = art.hero.jump;
        frameIndex = hero.vy < 0 ? Math.min(1, frames.length - 1) : 0;
      } else if (!hero.walking) {
        frames = art?.hero?.idle?.length ? art.hero.idle : frames;
        if (!art?.hero?.idle?.length) frameIndex = 0;
      }
      const frame = frames?.[frameIndex % (frames?.length || 1)];
      if (frame) {
        drawSprite(ctx, frame, hero.x - 14, hero.y - 16, 48, 52, hero.dir < 0);
      }
      else {
        ctx.fillStyle = "#6a7a3a";
        ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
      }
    }
  }

  const def = LEVELS[state.level];
  ctx.fillStyle = "rgba(12, 8, 6, 0.55)";
  ctx.fillRect(10, 8, 280, 28);
  ctx.fillStyle = "#e8c8a0";
  ctx.font = "700 13px Trebuchet MS";
  ctx.fillText(`${def.name}  ·  ${def.blurb}`, 18, 27);

  if (state.phase === "paused") {
    ctx.fillStyle = "rgba(8, 6, 4, 0.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#e08a4a";
    ctx.font = "800 28px Trebuchet MS";
    ctx.fillText("Paused", WIDTH / 2 - 56, HEIGHT / 2);
  }
}

function tick(ts) {
  if (!running && state.phase !== "paused") return;
  const raw = Math.min(0.033, (ts - last) / 1000 || 0.016);
  last = ts;
  const dt = raw * state.speed;
  if (state.phase === "play") {
    updateMovers(dt);
    updatePlayer(dt);
    for (const e of state.enemies) updateEnemy(e, dt);
    hud();
  }
  drawWorld(ts / 1000);
  if (now() < tipUntil && tipText) {
    hooks.onTip?.(tipText, tipUntil - now());
  } else if (tipText) {
    tipText = "";
    hooks.onTip?.("", 0);
  }
  requestAnimationFrame(tick);
}

function bindKeys() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) {
      event.preventDefault();
    }
    keys.add(key);
    if (key === "m") hooks.onMute?.();
  });
  window.addEventListener("keyup", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    keys.delete(key);
  });
}

export async function bootGame(target, nextHooks) {
  canvas = target;
  ctx = canvas.getContext("2d");
  hooks = nextHooks || {};
  art = await loadArt();
  bindKeys();
  parseLevel(0);
  drawWorld(0);
  hud();
}

export function setDifficulty(value) {
  if (DIFFICULTIES[value]) state.difficulty = value;
  hud();
}

export function getDifficulty() {
  return state.difficulty;
}

export function startRun() {
  const spec = DIFFICULTIES[state.difficulty];
  state.phase = "play";
  state.level = 0;
  state.lives = spec.lives;
  state.score = 0;
  state.extraAt = 10000;
  state.startedAt = now();
  parseLevel(0);
  running = true;
  last = now();
  showTip(LEVELS[0].blurb, 2600);
  hud();
  requestAnimationFrame(tick);
}

export function togglePause() {
  if (state.phase === "play") {
    state.phase = "paused";
    hud();
    return true;
  }
  if (state.phase === "paused") {
    state.phase = "play";
    running = true;
    last = now();
    requestAnimationFrame(tick);
    hud();
    return false;
  }
  return false;
}

export function cycleSpeed() {
  state.speed = state.speed === 1 ? 2 : 1;
  hud();
  return state.speed;
}

export function resetRun() {
  running = false;
  state.phase = "menu";
  parseLevel(0);
  drawWorld(0);
  hud();
}

export function getScorePayload() {
  return {
    score: state.score,
    waves: state.level + 1,
    won: state.phase === "won",
    durationMs: Math.round(now() - state.startedAt),
    difficulty: state.difficulty,
  };
}
