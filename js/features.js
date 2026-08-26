export const FEATURES = [
  {
    title: "Yards",
    items: [
      "Each level is one screen of rusted platforms, pipe ladders, and walkways",
      "Ladders punch through floors — climb the full column from handle to feet. Every ladder is the same width",
      "Every yard has a ladder from the floor up to the first ledge — Yard 1 has one on both sides",
      "Collect every Energy Cell. The extraction hatch then lights up — reach it to clear the yard",
      "Twenty yards. The layout gets meaner; a new mechanic lands every few screens",
    ],
  },
  {
    title: "Modes",
    items: [
      "Easy, Medium, Hard",
      "Easy: 5 lives, slower bots. Medium: 4 lives. Hard: 3 lives and faster machines",
      "Speed x1 / x2",
      "Mute (button or M), Pause, Reset",
    ],
  },
  {
    title: "Moving around",
    items: [
      "Walk with A / D, arrows, or O / P. Let go and he stands still — no running on the spot",
      "Climb ladders with up / down. Space or up jumps off a floor. On a ladder, Space plus left or right leaps off; Space alone slides down",
      "Climb poses are just the scavenger — the rusted pipe ladder is in the yard, not on the sprite",
      "Touch a scrap bot, drone, crawler, hunter, orb, crusher, or a live floor and you lose a life",
    ],
  },
  {
    title: "Enemies",
    items: [
      "Scrap Bot — walks platforms and uses ladders",
      "Crawler — patrols one platform and turns at the edge",
      "Drone — flies a horizontal beat across gaps (from yard 8)",
      "Hunter Bot — sometimes picks a route toward you",
      "Magnetic Orb — rides a rail around the yard",
      "Crusher — a piston, not a thinker",
      "Yard 20 has a larger guardian in the middle of the scramble",
    ],
  },
  {
    title: "Kit that shows up later",
    items: [
      "Yards 1–3: run, climb, collect",
      "Yard 4: moving platforms",
      "Yard 6: collapsing platforms",
      "Yard 8: drones",
      "Yard 10: switches open gates",
      "Yard 12: conveyor belts",
      "Yard 15: electrical floors",
      "Yard 20: guardian",
    ],
  },
  {
    title: "Scoring",
    items: [
      "Energy Cells score more on later yards. Clearing a yard adds a time bonus",
      "Extra life every 10,000",
      "Post a name to the live board. Rows show the Arcade Engage avatar if you picked one",
      "Easy, Medium, and Hard boards stay separate",
    ],
  },
  {
    title: "Social / account",
    items: [
      "Same Arcade Engage magic-link account as Field Rush and No Brakes",
      "Online list is who is in this yard, by browser",
      "Scoreboard sits under the playfield with avatars",
    ],
  },
  {
    title: "UI",
    items: [
      "Sky, midground, and rusted frame are the Photoshop files as-is. You, the bots, and the cells draw in front of the scrap",
      "Jump uses the leap poses from the sheet. The scavenger stays solid in the air",
      "Header: lives, score, level, cells, mode, online, plus mute / speed / pause / reset",
      "Left rail: Online and Account. Right rail: Back to Games, Game Features, Keys, News",
    ],
  },
];

export function renderFeatures(target) {
  if (!target) return;
  target.innerHTML = FEATURES.map((section) => `
    <article class="log-entry">
      <h3>${section.title}</h3>
      <ul>${section.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    </article>
  `).join("");
}
