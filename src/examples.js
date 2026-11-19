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
      "front opening, and three on the 90\" long side.",
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
      "Jesse & Doree Giles, Phase 3 porch enclosure. The 90\" side seen from outside: three windows on the stone cap, and the triangle between the beam " +
      "and the roof framed in 2×4, wrapped in cedar and glazed with one layer of plexiglass.",
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
      "Charlotte Collins, back-yard picket fence replacement, 3 ft tall, same footprint as the old fence: 38 ft across the back, " +
      "24 ft down each side, one 4 ft gate in the middle of the back run. 86 ft of run, 82 ft of fence plus the gate. " +
      "Hand framed on site from 2×4 rails and 6 ft pickets cut in half, 3½–4 in between pickets. Old fence line ghosted.",
    teaches: [
      "Existing (reference only) — the deck and the old fence line are ghosted and never counted",
      "Build steps — posts, then the sections, then the gate",
      "Materials — counts the posts, bays and gate for the materials list",
    ],
  },
  {
    id: "collins-picket-fence-back",
    file: "examples/collins-picket-fence-back.json",
    name: "Collins Picket Fence — back run (elevation)",
    blurb:
      "Charlotte Collins. The 38 ft back run seen from the yard: 3 ft pickets on two 2×4 rails, " +
      "posts every 67 in, and the 4 ft gate in the middle (three bays each side).",
    teaches: [
      "Elevation view — canvas up is height, so this is how the fence will actually look",
      "Build steps — posts, sections, then the gate",
    ],
  },
  {
    id: "backstop-plan",
    file: "examples/backstop-plan.json",
    name: "Range Backstop — plan (overhead)",
    blurb:
      "Shooting range backstop: four 8 ft railroad-tie sections, 8 courses (56 in) high, with dirt banked in front. " +
      "End sections angle forward 28°, the two middle sections kink back 6 in at the center joint (the M), " +
      "rebar through every course into the ground, kickers on the back at each joint and end.",
    teaches: [
      "Build steps — ‹ › shows the tie wall, then rebar and kickers, then the dirt",
      "Materials — counts the ties, rebar and kicker pieces",
      "3D Preview — the courses stack and the angled sections show",
    ],
  },
  {
    id: "backstop-rear",
    file: "examples/backstop-rear.json",
    name: "Range Backstop — rear view (elevation)",
    blurb:
      "The backstop seen from behind: eight courses of 7×9 ties per section, two rebar per section " +
      "(dashed where they are in the ground) and a kicker at each joint and end.",
    teaches: [
      "Elevation view — canvas up is height",
      "Materials — the tie count here is the shopping list",
    ],
  },
  {
    id: "backstop-section",
    file: "examples/backstop-section.json",
    name: "Range Backstop — side section",
    blurb:
      "Cut through the wall: dirt face sloping out from near the top of the ties, rebar through every course " +
      "into the ground, and a 45° kicker braced against the back.",
    teaches: [
      "Elevation view — shooter on the left, kicker on the right",
    ],
  },
  {
    id: "seger-steps-a-plan",
    file: "examples/seger-steps-a-plan.json",
    name: "Seger Front Steps A (as formed) — plan (overhead)",
    blurb: "John Seger front steps as formed (19 Nov): three 8 in step-downs. 72 x 36 upper landing 1 in below the door, 12 in middle step, lower landing 8 in up running 12 in past the old slab at the front and on the window side. Old slab, little landing and brick steps stay under the pour (ghosted).",
    teaches: ["Existing (reference only) is ghosted", "3D Preview shows the four 6 in levels"],
  },
  {
    id: "seger-steps-a-front",
    file: "examples/seger-steps-a-front.json",
    name: "Seger Front Steps A (as formed) — front view (elevation)",
    blurb: "John Seger front steps as formed (19 Nov): three 8 in step-downs. 72 x 36 upper landing 1 in below the door, 12 in middle step, lower landing 8 in up running 12 in past the old slab at the front and on the window side. Old slab, little landing and brick steps stay under the pour (ghosted).",
    teaches: ["Existing (reference only) is ghosted", "3D Preview shows the three 8 in levels"],
  },
  {
    id: "seger-steps-b-plan",
    file: "examples/seger-steps-b-plan.json",
    name: "Seger Front Steps B (angled) — plan (overhead)",
    blurb: "John Seger front steps (17 Nov): 72 x 36 upper landing at the door, 12 in step out to the garage corner, 44 in lower landing, one step down to the driveway; four 6 in steps; handrail on the window side and front. Version B: from the storm-door latch, the landing edge kicks out 22.5 deg and step 3 out 45 deg.",
    teaches: ["Existing (reference only) is ghosted", "3D Preview shows the four 6 in levels"],
  },
  {
    id: "seger-steps-b-front",
    file: "examples/seger-steps-b-front.json",
    name: "Seger Front Steps B (angled) — front view (elevation)",
    blurb: "John Seger front steps (17 Nov): 72 x 36 upper landing at the door, 12 in step out to the garage corner, 44 in lower landing, one step down to the driveway; four 6 in steps; handrail on the window side and front. Version B (angled).",
    teaches: ["Existing (reference only) is ghosted", "3D Preview shows the four 6 in levels"],
  },
  {
    id: "giles-transom-windows-elevation",
    file: "examples/giles-transom-windows-elevation.json",
    name: "Giles Porch — transom windows (elevation)",
    blurb:
      "Jesse & Doree Giles, Phase 3 porch enclosure. Three hinged transom windows above the beam, over the walkway and the two front windows: " +
      "cedar picture frames with 1/4\" plexiglass clamped between, bottom hinges, gas struts and a pole-operated quarter-turn latch. " +
      "Bay widths are estimated from a photo.",
    teaches: [
      "Existing (reference only) — beam, posts, rafters and the windows below are ghosted",
      "Build steps — cedar frames, plexiglass, then hinges, struts and latch",
      "Materials — counts the trim pieces, glazing and hardware for the three units",
    ],
  },
];
