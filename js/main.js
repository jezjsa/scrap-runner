import { renderChangelog, renderNewsList } from "./changelog.js";
import { renderFeatures } from "./features.js";
import {
  bootGame,
  cycleSpeed,
  getDifficulty,
  getScorePayload,
  resetRun,
  setDifficulty,
  startRun,
  togglePause,
} from "./game.js";
import { AVATARS, avatarUrl } from "./avatars.js";
import { isMuted, toggleMute } from "./audio.js";
import {
  adoptFieldRushIdentity,
  currentUser,
  leavePresence,
  playerName,
  refreshUser,
  requestLink,
  sendHeartbeat,
  setAvatar,
  signOut,
  startRun as startScoreRun,
  submitScore,
  verifyLink,
  watchLiveCount,
  watchLivePlayers,
  watchScores,
} from "./social.js";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&#39;";
  });
}

function formatWhen(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function difficultyLabel(value) {
  if (value === "medium") return "Medium";
  if (value === "hard") return "Hard";
  return "Easy";
}

function nameHue(name) {
  let n = 0;
  for (let i = 0; i < name.length; i += 1) n = (n * 33 + name.charCodeAt(i)) >>> 0;
  return n % 360;
}

function boardFace(row) {
  if (row.avatar) {
    return `<img class="board-face" src="${avatarUrl(row.avatar)}" alt="" width="22" height="22" />`;
  }
  return `<span class="board-face" style="background:hsl(${nameHue(row.name || "p")} 46% 42%)"></span>`;
}

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayCopy = document.getElementById("overlay-copy");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayScore = document.getElementById("overlay-score");
const scoreForm = document.getElementById("score-form");
const startActions = document.getElementById("start-actions");
const difficultyPick = document.getElementById("difficulty-pick");
const tipBanner = document.getElementById("tip-banner");
const START_TITLE = overlayTitle?.textContent || "Scavenge the yard";
const START_COPY = overlayCopy?.textContent || "";

let boardDifficulty = "easy";
let stopBoard = null;
let ended = false;

function paintMute() {
  const btn = document.getElementById("btn-mute");
  if (!btn) return;
  btn.textContent = isMuted() ? "Unmute" : "Mute";
  btn.setAttribute("aria-pressed", isMuted() ? "true" : "false");
}

function paintAccount() {
  const guest = document.getElementById("account-guest");
  const signed = document.getElementById("account-user");
  const nameEl = document.getElementById("account-name");
  const levelEl = document.getElementById("account-level");
  const img = document.getElementById("account-avatar-img");
  const user = currentUser();
  if (!user) {
    guest?.classList.remove("hidden");
    signed?.classList.add("hidden");
    return;
  }
  guest?.classList.add("hidden");
  signed?.classList.remove("hidden");
  if (nameEl) nameEl.textContent = user.name || user.email;
  if (levelEl) levelEl.textContent = user.level ? `Level ${user.level}` : user.email;
  if (img) img.src = avatarUrl(user.avatar);
}

function paintAvatars() {
  const box = document.getElementById("avatar-picker");
  if (!box) return;
  const user = currentUser();
  box.innerHTML = AVATARS.map((row) => `
    <button type="button" class="avatar-pick ${user?.avatar === row.id ? "selected" : ""}" data-id="${row.id}" title="${row.label}">
      <img src="${avatarUrl(row.id)}" alt="${row.label}" />
    </button>
  `).join("");
}

function isLocalHost() {
  return /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
}

function paintOnline(rows) {
  const list = document.getElementById("online-list");
  const empty = document.getElementById("online-empty");
  if (!list) return;
  const you = playerName() || "You";
  const others = isLocalHost() ? [] : rows.filter((row) => !row.self);
  const mine = rows.find((row) => row.self);
  const shown = [{ name: you, self: true, version: mine?.version, avatar: currentUser()?.avatar }, ...others];
  if (empty) empty.classList.add("hidden");
  list.innerHTML = shown.map((row) => `
    <li class="${row.self ? "online-you" : ""}">
      <div class="online-row">
        ${boardFace(row)}
        <span class="online-copy">
          <span class="online-name">${escapeHtml(row.name)}</span>
          ${row.version ? `<span class="online-meta">${escapeHtml(row.version)}</span>` : ""}
        </span>
      </div>
    </li>
  `).join("");
}

function paintBoard(rows) {
  const body = document.getElementById("scoreboard-body");
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="7">No scores yet. Drop in.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><span class="board-name">${boardFace(row)}${escapeHtml(row.name)}</span></td>
      <td>${difficultyLabel(row.difficulty)}</td>
      <td class="board-score">${Number(row.score).toLocaleString()}</td>
      <td>${row.waves}${row.won ? " ✓" : ""}</td>
      <td>${row.version ? escapeHtml(row.version) : "—"}</td>
      <td>${formatWhen(row.createdAt)}</td>
    </tr>
  `).join("");
}

function showMenu() {
  overlay?.classList.remove("hidden");
  overlayTitle.textContent = START_TITLE;
  overlayCopy.textContent = START_COPY;
  overlayKicker.textContent = "Wasteland · Yard 1";
  overlayScore?.classList.add("hidden");
  scoreForm?.classList.add("hidden");
  startActions?.classList.remove("hidden");
  difficultyPick?.classList.remove("hidden");
  ended = false;
}

function showEnd(result) {
  ended = true;
  overlay?.classList.remove("hidden");
  overlayTitle.textContent = result.won ? "Extracted" : "Caught in the yard";
  overlayCopy.textContent = result.won
    ? "Twenty yards. The vault door took you. Post the score."
    : `You made it to yard ${result.waves}. The bots got the last word.`;
  overlayKicker.textContent = result.won ? "Door sealed" : "Run over";
  if (overlayScore) {
    overlayScore.textContent = result.score.toLocaleString();
    overlayScore.classList.remove("hidden");
  }
  scoreForm?.classList.remove("hidden");
  startActions?.classList.remove("hidden");
  difficultyPick?.classList.remove("hidden");
  const name = document.getElementById("player-name");
  if (name instanceof HTMLInputElement) name.value = playerName();
}

function bindOverlay(openId, overlayId, closeId) {
  const layer = document.getElementById(overlayId);
  document.getElementById(openId)?.addEventListener("click", () => layer?.classList.remove("hidden"));
  document.getElementById(closeId)?.addEventListener("click", () => layer?.classList.add("hidden"));
  layer?.addEventListener("click", (event) => {
    if (event.target === layer) layer.classList.add("hidden");
  });
}

async function consumeAuth() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("auth");
  const note = document.getElementById("signup-status");
  if (token) {
    url.searchParams.delete("auth");
    history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    try {
      await verifyLink(token);
      if (note) note.textContent = "Signed in.";
    } catch (err) {
      if (note) {
        note.textContent = err instanceof Error ? err.message : "That sign-in link did not work.";
      }
    }
    paintAccount();
    paintAvatars();
    return;
  }
  const shared = await adoptFieldRushIdentity();
  if (shared === undefined) return;
  if (!shared) await refreshUser();
  paintAccount();
  paintAvatars();
}

document.getElementById("signup-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("signup-email");
  const note = document.getElementById("signup-status");
  const button = document.getElementById("btn-signup");
  if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
  button.disabled = true;
  if (note) note.textContent = "Sending link…";
  try {
    await requestLink(input.value.trim());
    if (note) note.textContent = "Check your email. Same Arcade Engage account as Field Rush.";
  } catch (err) {
    if (note) note.textContent = err instanceof Error ? err.message : "Could not send the link.";
  }
  button.disabled = false;
});

document.getElementById("btn-signout")?.addEventListener("click", async () => {
  await signOut();
  paintAccount();
  const note = document.getElementById("signup-status");
  if (note) note.textContent = "Signed out.";
});

document.getElementById("btn-avatar")?.addEventListener("click", () => {
  document.getElementById("avatar-picker")?.classList.toggle("hidden");
});

document.getElementById("avatar-picker")?.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-id]");
  if (!btn) return;
  try {
    await setAvatar(btn.dataset.id);
    paintAccount();
    paintAvatars();
  } catch (err) {
    console.error(err);
  }
});

document.querySelectorAll(".difficulty-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".difficulty-btn").forEach((other) => other.classList.remove("selected"));
    btn.classList.add("selected");
    setDifficulty(btn.dataset.difficulty);
    document.getElementById("stat-difficulty").textContent = difficultyLabel(btn.dataset.difficulty);
  });
});

document.getElementById("btn-start")?.addEventListener("click", async () => {
  overlay?.classList.add("hidden");
  ended = false;
  await startScoreRun();
  startRun();
  void sendHeartbeat({ name: playerName(), difficulty: getDifficulty() });
});

document.getElementById("btn-mute")?.addEventListener("click", () => {
  toggleMute();
  paintMute();
});

document.getElementById("btn-speed")?.addEventListener("click", () => {
  const speed = cycleSpeed();
  document.getElementById("btn-speed").textContent = `Speed x${speed}`;
});

document.getElementById("btn-pause")?.addEventListener("click", () => {
  const paused = togglePause();
  document.getElementById("btn-pause").textContent = paused ? "Resume" : "Pause";
});

document.getElementById("btn-reset")?.addEventListener("click", () => {
  resetRun();
  showMenu();
  document.getElementById("btn-pause").textContent = "Pause";
});

document.getElementById("score-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("player-name");
  const note = document.getElementById("score-status");
  const button = document.getElementById("btn-post-score");
  if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) return;
  button.disabled = true;
  if (note) note.textContent = "Posting…";
  try {
    const payload = getScorePayload();
    await submitScore({ ...payload, name: input.value.trim() });
    if (note) note.textContent = "On the board.";
  } catch (err) {
    if (note) note.textContent = err instanceof Error ? err.message : "Could not post.";
  }
  button.disabled = false;
});

document.getElementById("btn-skip-score")?.addEventListener("click", () => {
  scoreForm?.classList.add("hidden");
});

document.getElementById("board-tabs")?.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-difficulty]");
  if (!btn) return;
  document.querySelectorAll("#board-tabs .board-tab").forEach((other) => other.classList.remove("selected"));
  btn.classList.add("selected");
  boardDifficulty = btn.dataset.difficulty;
  void stopBoard?.();
  void watchScores(boardDifficulty, paintBoard).then((stop) => {
    stopBoard = stop;
  });
});

bindOverlay("btn-changelog", "changelog-overlay", "btn-close-changelog");
bindOverlay("btn-features", "features-overlay", "btn-close-features");
renderChangelog(document.getElementById("changelog-body"));
renderFeatures(document.getElementById("features-body"));
renderNewsList(document.getElementById("news-list"));
paintMute();
paintAccount();
paintAvatars();
paintOnline([]);
paintBoard([]);

void consumeAuth().then(() => {
  paintAccount();
  paintAvatars();
  void sendHeartbeat({ name: playerName() });
});

void watchLiveCount((count) => {
  const el = document.getElementById("stat-online");
  if (el) el.textContent = String(isLocalHost() ? 1 : Math.max(Number(count) || 0, 1));
});
void watchLivePlayers(paintOnline);
void watchScores(boardDifficulty, paintBoard).then((stop) => {
  stopBoard = stop;
});

const heartbeat = setInterval(() => {
  if (document.visibilityState === "visible") {
    void sendHeartbeat({ name: playerName(), difficulty: getDifficulty() });
  }
}, 8000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void sendHeartbeat({ name: playerName() });
});
window.addEventListener("pagehide", () => {
  clearInterval(heartbeat);
  void leavePresence();
});

const canvas = document.getElementById("game");
if (canvas instanceof HTMLCanvasElement) {
  void bootGame(canvas, {
    onHud: (hud) => {
      document.getElementById("stat-lives").textContent = String(hud.lives);
      document.getElementById("stat-score").textContent = hud.score.toLocaleString();
      document.getElementById("stat-level").textContent = `${hud.level} / ${hud.total}`;
      document.getElementById("stat-cells").textContent = `${hud.cells} / ${hud.cellsMax}`;
      document.getElementById("stat-difficulty").textContent = difficultyLabel(hud.difficulty);
      document.getElementById("btn-speed").textContent = `Speed x${hud.speed}`;
      document.getElementById("btn-pause").textContent = hud.paused ? "Resume" : "Pause";
    },
    onTip: (text, ms) => {
      if (!tipBanner) return;
      if (!text || ms <= 0) {
        tipBanner.classList.add("hidden");
        tipBanner.textContent = "";
        return;
      }
      tipBanner.textContent = text;
      tipBanner.classList.remove("hidden");
    },
    onMute: () => {
      toggleMute();
      paintMute();
    },
    onEnd: (result) => {
      if (!ended) showEnd(result);
    },
  }).catch((err) => {
    console.error(err);
  });
}
