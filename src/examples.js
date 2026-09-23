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
    name: "L-Shaped Porch — windows between posts",
    blurb:
      "Overhead view of an L-shaped porch on a 37\" stone wall: a 58\" × 91\" open doorway against the " +
      "wall corner, then 65\" and 90\" window openings (57\" tall) between 3½\" cedar posts.",
    teaches: [
      "Existing (reference only) — house, stone wall, posts and beam are ghosted and never counted",
      "Build steps — ‹ › shows the doorway trim first, then the windows",
      "3D Preview — windows sit on the cap at 37\" and stop at the beam",
    ],
  },
];
