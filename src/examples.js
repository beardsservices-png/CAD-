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
    id: "snap-lock-trim-details",
    file: "examples/snap-lock-trim-details.json",
    name: "Snap-Lock Trim — Interlock Details",
    blurb:
      "Six true-scale section cuts through a snap-lock standing seam roof: the eave hem over the " +
      "drip edge, the endwall Z and turn-up at the house, the rake cleat, the seam-and-clip itself, " +
      "a trim end lap, and the eave/rake corner. Drawn for the 24 ft covered patio, in inches.",
    teaches: [
      "Section details — polylines traced along the real bend lines of each piece of metal",
      "True scale — a 1\" seam is one inch, so you can measure the drawing and believe it",
      "Layers — turn Trim, Panels or Fasteners off to see one system at a time",
      "Elevation view mode — cut sections, not a plan",
    ],
  },
];
