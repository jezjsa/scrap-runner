import heroUrl from "../assets/hero.png";
import enemiesUrl from "../assets/enemies.png";
import cellsUrl from "../assets/cells.png";
import laddersUrl from "../assets/ladders.png";
import skyUrl from "../assets/sky.png";
import midUrl from "../assets/midground.png";
import frameUrl from "../assets/frame.png";

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

function keyFull(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  keyBackdrop(ctx, canvas.width, canvas.height);
  return canvas;
}

function extractBlobs(img, minArea = 180) {
  const sheet = keyFull(img);
  const ctx = sheet.getContext("2d");
  const { width, height } = sheet;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const seen = new Uint8Array(width * height);
  const blobs = [];

  const solid = (p) => data[p * 4 + 3] > 12;

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

function classifyHero(blobs) {
  const people = blobs.filter((row) => row.area >= 4000);
  const byY = [...people].sort((a, b) => a.y - b.y);
  const topY = byY[0]?.y ?? 0;
  const run = people
    .filter((row) => row.y < topY + 80)
    .sort((a, b) => a.x - b.x)
    .map((row) => row.canvas);
  const rest = people.filter((row) => row.y >= topY + 80);
  const jump = rest
    .filter((row) => row.h < 190)
    .sort((a, b) => a.x - b.x)
    .map((row) => row.canvas);
  const climb = rest
    .filter((row) => row.h >= 190)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((row) => row.canvas);
  return { run, jump, climb };
}

export async function loadArt() {
  const [heroImg, enemyImg, cellImg, ladderImg, sky, midgroundImg, frameImg] = await Promise.all([
    loadImage(heroUrl),
    loadImage(enemiesUrl),
    loadImage(cellsUrl),
    loadImage(laddersUrl),
    loadImage(skyUrl),
    loadImage(midUrl),
    loadImage(frameUrl),
  ]);

  const hero = classifyHero(extractBlobs(heroImg, 4000));
  const enemyFrames = sliceGrid(enemyImg, 4, 4);
  const cellFrames = sliceGrid(cellImg, 4, 3);
  const blobs = extractBlobs(ladderImg);
  const byH = [...blobs].sort((a, b) => a.h - b.h);
  const tallest = byH[byH.length - 1];
  const pieces = byH.filter((row) => !tallest || row.h < tallest.h * 0.42);
  const top = [...pieces].sort((a, b) => b.w / b.h - a.w / a.h)[0] || pieces[0];
  const leftover = pieces.filter((row) => row !== top);
  leftover.sort((a, b) => b.h - a.h);
  const mid = leftover[0] || top;
  const base = leftover.find((row) => row !== mid) || leftover[1] || mid;
  const full = tallest;

  return {
    sky,
    midground: midgroundImg,
    frame: frameImg,
    hero,
    enemies: {
      bot: enemyFrames.slice(0, 4),
      drone: enemyFrames.slice(4, 8),
      crawler: enemyFrames.slice(8, 12),
      rat: enemyFrames.slice(12, 16),
    },
    cells: cellFrames,
    ladder: {
      top: top?.canvas || null,
      mid: mid?.canvas || null,
      base: base?.canvas || null,
      full: full?.canvas || null,
    },
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
