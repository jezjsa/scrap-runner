import heroUrl from "../assets/hero-new.png";
import enemiesUrl from "../assets/enemies.png";
import ratsUrl from "../assets/rats.png";
import cellsUrl from "../assets/cells.png";
import laddersUrl from "../assets/ladders.png";
import skyUrl from "../assets/sky.png";
import midUrl from "../assets/midground.png";
import frameUrl from "../assets/frame.png";
import swingUrl from "../assets/swing.png";
import exitUrl from "../assets/exit.png";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function isBackdrop(data, i) {
  return data[i] < 8 && data[i + 1] < 8 && data[i + 2] < 8;
}

function keyBackdrop(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const seen = new Uint8Array(width * height);
  const stack = [];

  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    seen[p] = 1;
    if (isBackdrop(data, p * 4)) stack.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (stack.length) {
    const p = stack.pop();
    data[p * 4 + 3] = 0;
    const x = p % width;
    const y = (p - x) / width;
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  ctx.putImageData(image, 0, 0);
  return image;
}

function trimFrame(source) {
  const ctx = source.getContext("2d");
  const { width, height } = source;
  const image = keyBackdrop(ctx, width, height);
  const data = image.data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return source;
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(source, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

function sliceGrid(img, cols, rows) {
  const cellW = Math.floor(img.width / cols);
  const cellH = Math.floor(img.height / rows);
  const frames = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = document.createElement("canvas");
      cell.width = cellW;
      cell.height = cellH;
      cell.getContext("2d").drawImage(
        img,
        c * cellW,
        r * cellH,
        cellW,
        cellH,
        0,
        0,
        cellW,
        cellH,
      );
      frames.push(trimFrame(cell));
    }
  }
  return frames;
}

function sliceExit(img) {
  const width = img.width;
  const height = img.height;
  const sheet = document.createElement("canvas");
  sheet.width = width;
  sheet.height = height;
  const sheetCtx = sheet.getContext("2d");
  sheetCtx.drawImage(img, 0, 0);
  const data = sheetCtx.getImageData(0, 0, width, height).data;
  const occ = new Array(width).fill(0);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (data[(y * width + x) * 4 + 3] > 20) occ[x] += 1;
    }
  }
  const runs = [];
  let start = -1;
  for (let x = 0; x <= width; x += 1) {
    const solid = x < width && occ[x] >= 8;
    if (solid && start < 0) start = x;
    if (!solid && start >= 0) {
      runs.push({ x0: start, x1: x - 1 });
      start = -1;
    }
  }
  const doors = runs.filter((run) => run.x1 - run.x0 > 40).slice(0, 3);
  if (doors.length < 3) return [];

  let minY = height;
  let maxY = 0;
  for (const run of doors) {
    for (let y = 0; y < height; y += 1) {
      for (let x = run.x0; x <= run.x1; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 20) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  const pad = 2;
  minY = Math.max(0, minY - pad);
  maxY = Math.min(height - 1, maxY + pad);
  const frameH = maxY - minY + 1;
  const frameW = Math.max(...doors.map((run) => run.x1 - run.x0 + 1));

  return doors.map((run) => {
    const frame = document.createElement("canvas");
    frame.width = frameW;
    frame.height = frameH;
    frame.getContext("2d").drawImage(
      sheet,
      run.x0,
      minY,
      run.x1 - run.x0 + 1,
      frameH,
      0,
      0,
      run.x1 - run.x0 + 1,
      frameH,
    );
    return frame;
  });
}

function asCanvas(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d").drawImage(img, 0, 0);
  return canvas;
}

function keyFull(img) {
  const canvas = asCanvas(img);
  keyBackdrop(canvas.getContext("2d"), canvas.width, canvas.height);
  return canvas;
}

function extractBlobs(img, minArea = 180, opts = {}) {
  const minAlpha = opts.minAlpha ?? 12;
  const maxW = opts.maxW ?? Infinity;
  const sheet = opts.key === false ? asCanvas(img) : keyFull(img);
  const ctx = sheet.getContext("2d");
  const { width, height } = sheet;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const seen = new Uint8Array(width * height);
  const blobs = [];

  const solid = (p) => data[p * 4 + 3] >= minAlpha;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (seen[start] || !solid(start)) continue;
      const stack = [start];
      seen[start] = 1;
      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let area = 0;
      while (stack.length) {
        const p = stack.pop();
        area += 1;
        const px = p % width;
        const py = (p - px) / width;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
        const next = [p + 1, p - 1, p + width, p - width];
        for (const n of next) {
          if (n < 0 || n >= width * height) continue;
          const nx = n % width;
          if (Math.abs(nx - px) > 1) continue;
          if (seen[n] || !solid(n)) continue;
          seen[n] = 1;
          stack.push(n);
        }
      }
      if (area < minArea) continue;
      if (maxX - minX + 1 > maxW) continue;
      const pad = 2;
      const sx = Math.max(0, minX - pad);
      const sy = Math.max(0, minY - pad);
      const sw = Math.min(width - 1, maxX + pad) - sx + 1;
      const sh = Math.min(height - 1, maxY + pad) - sy + 1;
      const piece = document.createElement("canvas");
      piece.width = sw;
      piece.height = sh;
      piece.getContext("2d").drawImage(sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      blobs.push({
        canvas: piece,
        w: sw,
        h: sh,
        area,
        x: sx,
        y: sy,
      });
    }
  }
  return blobs.sort((a, b) => a.h - b.h || a.w - b.w);
}

function mergeBlobs(left, right) {
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const w = Math.max(left.x + left.w, right.x + right.w) - x;
  const h = Math.max(left.y + left.h, right.y + right.h) - y;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(left.canvas, left.x - x, left.y - y);
  ctx.drawImage(right.canvas, right.x - x, right.y - y);
  return { canvas, w, h, x, y, area: left.area + right.area };
}

function classifyLadder(blobs) {
  const kit = blobs.filter((row) => row.x < 250 && row.h < 180 && row.area >= 1500);
  const top = [...kit].sort((a, b) => b.w - a.w)[0] || blobs[0];
  const rest = kit.filter((row) => row !== top);
  const mid = [...rest].sort((a, b) => b.area - a.area)[0] || top;
  const feet = rest
    .filter((row) => row !== mid && row.w < 60 && row.h > 80)
    .sort((a, b) => a.x - b.x);
  const base = feet.length >= 2 ? mergeBlobs(feet[0], feet[1]) : feet[0] || mid;
  const full = [...blobs].sort((a, b) => b.h - a.h)[0];
  return {
    top: top?.canvas || null,
    mid: mid?.canvas || null,
    base: base?.canvas || null,
    full: full?.canvas || null,
  };
}

function classifyHero(blobs) {
  const people = blobs.filter((row) => row.area >= 4000 && row.w < 400);
  const byY = [...people].sort((a, b) => a.y - b.y);
  const rows = [];
  for (const blob of byY) {
    const last = rows[rows.length - 1];
    if (!last || blob.y > last[0].y + 140) rows.push([blob]);
    else last.push(blob);
  }
  const top = (rows[0] || []).sort((a, b) => a.x - b.x).map((row) => row.canvas);
  const idle = top.slice(0, 2);
  const run = top.slice(2);
  const mid = (rows[1] || []).sort((a, b) => a.x - b.x);
  const jump = mid.slice(0, 2).map((row) => row.canvas);
  // Bottom row is jump / hang / sit — do not cycle those on a ladder.
  const climb = mid.slice(2).map((row) => row.canvas);
  return { idle, run, jump, climb };
}

export async function loadArt() {
  const [heroImg, enemyImg, ratImg, cellImg, ladderImg, sky, midgroundImg, frameImg, swingImg, exitImg] = await Promise.all([
    loadImage(heroUrl),
    loadImage(enemiesUrl),
    loadImage(ratsUrl),
    loadImage(cellsUrl),
    loadImage(laddersUrl),
    loadImage(skyUrl),
    loadImage(midUrl),
    loadImage(frameUrl),
    loadImage(swingUrl),
    loadImage(exitUrl),
  ]);

  const hero = classifyHero(extractBlobs(heroImg, 4000, { key: false, minAlpha: 40, maxW: 400 }));
  const enemyFrames = sliceGrid(enemyImg, 4, 4);
  const cellFrames = sliceGrid(cellImg, 4, 3);
  const ladder = classifyLadder(extractBlobs(ladderImg));

  return {
    sky,
    midground: midgroundImg,
    frame: frameImg,
    hero,
    enemies: {
      bot: enemyFrames.slice(0, 4),
      drone: enemyFrames.slice(4, 8),
      crawler: enemyFrames.slice(8, 12),
      hunter: enemyFrames.slice(12, 16),
      rat: sliceGrid(ratImg, 4, 1),
    },
    cells: cellFrames,
    ladder,
    swing: swingImg,
    exit: sliceExit(exitImg),
  };
}

export function drawSprite(ctx, frame, x, y, w, h, flip = false) {
  if (!frame) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(frame, 0, 0, w, h);
  } else {
    ctx.drawImage(frame, x, y, w, h);
  }
  ctx.restore();
}

export function drawSpriteAtHeight(ctx, frame, cx, feetY, destH, flip = false, sink = 4) {
  if (!frame) return;
  const destW = Math.max(1, Math.round(destH * (frame.width / frame.height)));
  drawSprite(ctx, frame, cx - destW / 2, feetY - destH + sink, destW, destH, flip);
}

export function drawSpriteFit(ctx, frame, cx, cy, maxW, maxH, flip = false) {
  if (!frame) return;
  const scale = Math.min(maxW / frame.width, maxH / frame.height);
  const destW = Math.max(1, Math.round(frame.width * scale));
  const destH = Math.max(1, Math.round(frame.height * scale));
  drawSprite(ctx, frame, cx - destW / 2, cy - destH / 2, destW, destH, flip);
}
