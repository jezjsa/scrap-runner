export const FEATURES = [
  {
    title: "Yards",
    items: [
      "Each level is one screen of rusted platforms, pipe ladders, and walkways",
      "Ladders punch through floors and stick a little above each ledge. Hold up to the last rung and you hop onto the walkway — then walk left or right. Every ladder is the same width",
      "Every yard has a ladder from the floor up to the first ledge — Yard 1 has one on both sides",
      "Collect every Energy Cell — each one sits on a faint pulsing green glow and draws at the sheet’s shape, not a stretched square. Grab one and green coin bubbles pop over his head, then fade. The vault door then opens — walk in to clear the yard",
      "Twenty yards. The layout gets meaner; a new mechanic lands every few screens",
    ],
  },
  {
    title: "Modes",
    items: [
      "Easy, Medium, Hard",
      "3 lives on every mode. Easy: slower bots. Medium: normal. Hard: faster machines",
      "Speed x1 / x2",
      "Mute (button or M), Pause, Reset",
    ],
  },
  {
    title: "Moving around",
    items: [
      "Walk with A / D, arrows, or O / P. Let go and he stands still — no running on the spot",
      "Climb ladders with up / down. At the top you hop onto the ledge — no extra jump. Standing on a ledge with a ladder under your feet, press down to climb down. Jumping onto a ladder pulls you onto the pipes. Space or up jumps off a floor. On a ladder, Space plus left or right leaps off; Space alone drops you until you grab with up / W. Yard 1’s crane hook: jump on, swing, then Space plus a direction to leap off",
      "Climb poses are the reach-and-step frames from the sheet — the rusted pipe ladder is in the yard, not on the sprite. Hang still when you are not moving",
      "Touch a scrap bot, scrap rat, drone, crawler, hunter, orb, crusher, or a live floor and you lose a life",
    ],
  },
  {
    title: "Enemies",
    items: [
      "Scrap Bot — walks platforms and uses ladders. Drawn a bit larger so you can see them coming",
      "Scrap Rat — scurries one walkway and turns at the edge. Yard 3 has a few on the mid ledges",
      "Crawler — four-legged scrap spider. Patrols one platform and turns at the edge. Yard 4 has them on the top walkways",
      "Drone — flies a horizontal beat across gaps (from yard 8)",
      "Hunter Bot — sometimes picks a route toward you. First shows up on Yard 4",
      "Magnetic Orb — rides a rail around the yard",
      "Crusher — a piston, not a thinker",
      "Yard 20 has a larger guardian in the middle of the scramble",
    ],
  },
  {
    title: "Kit that shows up later",
    items: [
      "Yards 1–3: run, climb, collect. A rusted vault door sits flush with the right edge of every yard. Yard 1 has a crane hook between the mid walkways. Yard 2 has a ladder up to the centre ledge — the bots start on their own walkways, not on top of you. Yard 3’s top walkways sit low enough that you stay on screen, and scrap rats patrol the mid ledges",
      "Yard 4: moving platforms, plus a walker, a hunter, and spider crawlers from the enemy sheet",
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
      "Sky, midground, and rusted frame are the Photoshop files as-is. You, the bots, the cells, and the vault door draw in front of the scrap",
      "Jump uses the leap poses from the sheet. The scavenger stays solid in the air, and draws at the sheet’s proportions instead of a stretched box",
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
