let ctx = null;
let muted = false;

try {
  muted = localStorage.getItem("scraprunner-mute") === "1";
} catch {
  muted = false;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  try {
    localStorage.setItem("scraprunner-mute", muted ? "1" : "0");
  } catch {
    // Private mode can block storage.
  }
  return muted;
}

export function toggleMute() {
  return setMuted(!muted);
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
  }
  if (ctx?.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, duration, type, gain, slide = 0) {
  if (muted) return;
  const audio = ensure();
  if (!audio) return;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), audio.currentTime + duration);
  }
  g.gain.setValueAtTime(gain, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(g).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

export const sfx = {
  jump: () => tone(420, 0.12, "square", 0.04, -180),
  collect: () => {
    tone(660, 0.08, "square", 0.05);
    setTimeout(() => tone(880, 0.1, "square", 0.04), 50);
  },
  hatch: () => {
    tone(220, 0.18, "sawtooth", 0.05, 140);
    setTimeout(() => tone(330, 0.22, "square", 0.04, 80), 80);
  },
  die: () => tone(180, 0.28, "sawtooth", 0.06, -120),
  clear: () => {
    tone(520, 0.1, "square", 0.05);
    setTimeout(() => tone(690, 0.12, "square", 0.05), 80);
    setTimeout(() => tone(880, 0.16, "square", 0.05), 160);
  },
  extra: () => {
    tone(740, 0.08, "triangle", 0.05);
    setTimeout(() => tone(990, 0.14, "triangle", 0.05), 70);
  },
};
