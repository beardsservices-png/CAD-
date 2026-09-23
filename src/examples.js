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
      "Jesse & Doree Giles, Phase 3 porch enclosure. Overhead view of the stone-wall porch: a 58\" × 91\" open doorway at the wall corner, one 65\" " +
      "window on the front, and two windows split by a cedar mullion on the 90\" long side.",
    teaches: [
      "Existing (reference only) — house, stone wall, posts and beam are ghosted and never counted",
      "Build steps — ‹ › shows the doorway trim, the mullion, then the windows",
      "3D Preview — windows sit on the cap at 37\" and stop at the beam",
    ],
  },
  {
    id: "l-shaped-porch-long-side",
    file: "examples/l-shaped-porch-long-side.json",
    name: "Giles Porch — long side (elevation)",
    blurb:
      "Jesse & Doree Giles, Phase 3 porch enclosure. The 90\" side seen from outside: two windows on the stone cap, and the triangle between the beam " +
      "and the roof framed in 2×4, wrapped in cedar and glazed with fixed glass.",
    teaches: [
      "Elevation view — canvas up is height, so this is how the wall will actually look",
      "Build steps — mullion, triangle framing, windows, then the triangle glass",
      "Materials — itemises the framing and glass for this side",
    ],
  },
];
