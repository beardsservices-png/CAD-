// examples.js — prebuilt drawings that ship with the app, used as worked
// tutorials. Each entry names the features it demonstrates so the Examples
// dialog can teach as well as load.
export const EXAMPLES = [
  {
    id: "covered-patio-plan",
    file: "examples/covered-patio-plan.json",
    name: "Covered Patio — 24 ft, 2/12 shed roof",
    blurb:
      "A complete real job: existing rock wall and house, four 4×4 posts, a doubled 2×6 beam " +
      "with staggered joints, 2×6 double joists, T&G pine ceiling, underlayment, skip boards, " +
      "snap-lock metal, trim and flashing, gutter, and an 18\" soffit.",
    teaches: [
      "Build steps — press ‹ › at the bottom right to assemble it one stage at a time",
      "Existing (reference only) — the house and rock wall are ghosted and never counted",
      "Materials — the button up top itemises everything, with hardware suggestions",
      "Layers — turn Ceiling, Roofing or Trim off to see what's underneath",
      "Labels — every piece is named, which is what makes the takeoff readable",
    ],
  },
  {
    id: "l-shaped-porch-windows",
    file: "examples/l-shaped-porch-windows.json",
    name: "Giles Porch — plan (overhead)",
    blurb:
      "Jesse & Doree Giles, Phase 3 porch enclosure. Overhead view of the stone-wall porch: a 58\" × 91\" open walkway (no door) at the wall corner, two windows split by a cedar mullion in the 65\" " +
      "front opening, and two more the same way on the 90\" long side.",
    teaches: [
      "Existing (reference only) — house, stone wall, posts and beam are ghosted and never counted",
      "Build steps — ‹ › shows the walkway trim, the mullion, then the windows",
      "3D Preview — windows sit on the cap at 37\" and stop at the beam",
    ],
  },
  {
    id: "l-shaped-porch-long-side",
    file: "examples/l-shaped-porch-long-side.json",
    name: "Giles Porch — long side (elevation)",
    blurb:
      "Jesse & Doree Giles, Phase 3 porch enclosure. The 90\" side seen from outside: two windows on the stone cap, and the triangle between the beam " +
      "and the roof framed in 2×4, wrapped in cedar and glazed with two layers of plexiglass.",
    teaches: [
      "Elevation view — canvas up is height, so this is how the wall will actually look",
      "Build steps — mullion, triangle framing, windows, then the triangle plexiglass",
      "Materials — itemises the framing, windows and plexiglass for this side",
    ],
  },
  {
    id: "collins-picket-fence-plan",
    file: "examples/collins-picket-fence-plan.json",
    name: "Collins Picket Fence — plan (overhead)",
    blurb:
      "Charlotte Collins, back-yard picket fence replacement, 3 ft tall, 92 ft with the gate. Four 6 ft bays down each " +
      "24 ft side; the back widened from 38 ft to 44 ft to match the deck — three 6 ft bays each side of " +
      "one 8 ft tractor gate. Bays built on site from 2×4 rails and cut pickets. Old fence line ghosted.",
    teaches: [
      "Existing (reference only) — the deck and the old 38 ft fence line are ghosted and never counted",
      "Build steps — posts, then the sections, then the gate leaves",
      "Materials — counts the posts, bays and gate leaves for the homeowner's shopping list",
    ],
  },
  {
    id: "collins-picket-fence-back",
    file: "examples/collins-picket-fence-back.json",
    name: "Collins Picket Fence — back run (elevation)",
    blurb:
      "Charlotte Collins. The 44 ft back run seen from the yard: 3 ft pickets on two 2×4 rails, " +
      "posts every 6 ft, and the 8 ft tractor gate in the middle.",
    teaches: [
      "Elevation view — canvas up is height, so this is how the fence will actually look",
      "Build steps — posts, sections, then the gate",
    ],
  },
];
