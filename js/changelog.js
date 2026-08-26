export const CHANGELOG = [
  {
    at: "2026-08-26T09:44:00+01:00",
    title: "In front of the scrap again",
    items: [
      "You stand in front of the rusted frame’s rocks and crates — the sky and midground are the files as-is, with no fade",
    ],
  },
  {
    at: "2026-08-26T09:36:00+01:00",
    title: "Climb without a ghost ladder",
    items: [
      "The scavenger’s climb poses no longer have a second ladder drawn on him — he just holds the rusted pipes",
    ],
  },
  {
    at: "2026-08-26T09:32:00+01:00",
    title: "A clear window",
    items: [
      "The rusted frame is the Photoshop file as-is — no extra fade or keying on top",
    ],
  },
  {
    at: "2026-08-26T09:28:00+01:00",
    title: "The right jump",
    items: [
      "Jump now uses the actual leap poses from the sheet, not a slice from the gap between figures",
    ],
  },
  {
    at: "2026-08-26T09:22:00+01:00",
    title: "Solid in the air",
    items: [
      "Jumping no longer washes the scavenger out — he keeps his colour in the air",
    ],
  },
  {
    at: "2026-08-26T09:20:00+01:00",
    title: "Ladders you can see",
    items: [
      "Rusted pipe ladders now run the full height between floors, with a handle at the top and feet at the base",
      "Yard 1, 4, and 6 have ladders punching through the walkways so every cell is reachable",
      "The wasteland backdrop is dimmer, and the scavenger reads brighter against the scrap",
    ],
  },
  {
    at: "2026-08-26T09:08:00+01:00",
    title: "In front of the scrap",
    items: [
      "You stand in front of the rusted frame now — the crates and rocks no longer hide the scavenger",
    ],
  },
  {
    at: "2026-08-25T20:30:00+01:00",
    title: "First scramble",
    items: [
      "Scrap Runner is playable — collect the Energy Cells, then race the hatch before the bots catch you",
      "Twenty single-screen yards. New kit shows up as you go: moving platforms, collapsing floors, drones, switches, belts, live floors, then a guardian",
      "Same Arcade Engage account, live online list, and a scoreboard with avatars under the yard",
    ],
  },
];

function formatWhen(at) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function renderNewsList(target) {
  if (!target) return;
  target.innerHTML = CHANGELOG.slice(0, 3).map((entry) => (
    `<li><strong>${entry.title}</strong> — ${entry.items[0]}</li>`
  )).join("");
}

export function renderChangelog(target) {
  if (!target) return;
  target.innerHTML = CHANGELOG.map((entry) => `
    <article class="log-entry">
      <p class="log-when">${formatWhen(entry.at)}</p>
      <h3>${entry.title}</h3>
      <ul>${entry.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
}
