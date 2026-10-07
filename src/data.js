/* ===========================================================================
 * CaliForge — Skill & exercise knowledge base
 * ---------------------------------------------------------------------------
 * This module is the "domain knowledge" of the planner. Each skill defines:
 *   - category: PUSH / PULL / CORE / LEGS  (used by the scheduler to balance days)
 *   - difficulty: rough weeks-to-goal baseline for a dedicated athlete
 *   - progressions: ordered list of lead-up exercises (easy -> hard), each with
 *       a prescription template (sets x reps/seconds) that the planner emits.
 * Everything is exposed on window.CF so the other <script type=text/babel>
 * modules can share it without a bundler.
 * ========================================================================= */

window.CF = window.CF || {};

const CATEGORY = {
  PUSH: "PUSH",
  PULL: "PULL",
  CORE: "CORE",
  LEGS: "LEGS",
};

/**
 * A progression step.
 * @typedef {Object} Step
 * @property {string} name
 * @property {"reps"|"hold"} type
 * @property {number} sets
 * @property {number} value   reps count OR seconds for a hold
 * @property {string} [note]
 */

const SKILLS = [
  {
    id: "front-lever",
    label: "Front Lever",
    emoji: "🛩️",
    category: CATEGORY.PULL,
    accent: "blue",
    baselineWeeks: 24,
    description:
      "Vízszintes, arccal felfelé húzás-alapú statikus elem. Erős lapocka- és törzsstabilitást igényel.",
    progressions: [
      { name: "Tuck Front Lever hold", type: "hold", sets: 4, value: 8, note: "Térd a mellkashoz húzva." },
      { name: "Advanced Tuck Front Lever hold", type: "hold", sets: 4, value: 10, note: "Hát párhuzamos a talajjal." },
      { name: "One-leg Front Lever hold", type: "hold", sets: 4, value: 8 },
      { name: "Straddle Front Lever hold", type: "hold", sets: 5, value: 8 },
      { name: "Full Front Lever hold", type: "hold", sets: 5, value: 6 },
    ],
    accessories: [
      { name: "Front Lever raise (tuck)", type: "reps", sets: 4, value: 6 },
      { name: "Weighted pull-up", type: "reps", sets: 4, value: 5 },
    ],
  },
  {
    id: "straddle-planche",
    label: "Straddle Planche",
    emoji: "🤸",
    category: CATEGORY.PUSH,
    accent: "violet",
    baselineWeeks: 32,
    description:
      "Terpeszben tartott planche. Hatalmas váll- és csuklóerőt, valamint protrakciót követel.",
    progressions: [
      { name: "Planche lean", type: "hold", sets: 5, value: 15, note: "Váll jól a kéz elé tolva." },
      { name: "Tuck Planche hold", type: "hold", sets: 4, value: 8 },
      { name: "Advanced Tuck Planche hold", type: "hold", sets: 4, value: 8 },
      { name: "Straddle Planche negatives", type: "reps", sets: 4, value: 4 },
      { name: "Straddle Planche hold", type: "hold", sets: 5, value: 5 },
    ],
    accessories: [
      { name: "Pseudo Planche push-up", type: "reps", sets: 4, value: 8 },
      { name: "Protraction push-up", type: "reps", sets: 3, value: 12 },
    ],
  },
  {
    id: "full-planche",
    label: "Full Planche",
    emoji: "🦅",
    category: CATEGORY.PUSH,
    accent: "violet",
    baselineWeeks: 44,
    description:
      "A planche teljes, zárt lábú változata — a felsőtest húzóerejének egyik csúcseleme.",
    progressions: [
      { name: "Planche lean", type: "hold", sets: 5, value: 20 },
      { name: "Advanced Tuck Planche hold", type: "hold", sets: 4, value: 10 },
      { name: "Straddle Planche hold", type: "hold", sets: 5, value: 8 },
      { name: "Full Planche negatives", type: "reps", sets: 4, value: 3 },
      { name: "Full Planche hold", type: "hold", sets: 5, value: 4 },
    ],
    accessories: [
      { name: "Pseudo Planche push-up (deep)", type: "reps", sets: 4, value: 6 },
      { name: "Maltese lean", type: "hold", sets: 3, value: 8 },
    ],
  },
  {
    id: "muscle-up",
    label: "Muscle-up",
    emoji: "💪",
    category: CATEGORY.PULL,
    accent: "green",
    baselineWeeks: 12,
    description:
      "Robbanékony húzás átmenettel tolásba a rúd felett. Explozív húzóerő és átfordulási technika.",
    progressions: [
      { name: "Explosive pull-up (chest to bar)", type: "reps", sets: 4, value: 6 },
      { name: "Straight bar dip", type: "reps", sets: 4, value: 8 },
      { name: "Negative muscle-up", type: "reps", sets: 4, value: 3 },
      { name: "Band-assisted muscle-up", type: "reps", sets: 4, value: 4 },
      { name: "Strict muscle-up", type: "reps", sets: 5, value: 3 },
    ],
    accessories: [
      { name: "Weighted pull-up", type: "reps", sets: 4, value: 5 },
      { name: "Russian dip", type: "reps", sets: 3, value: 8 },
    ],
  },
  {
    id: "handstand",
    label: "Freestanding Handstand",
    emoji: "🧘",
    category: CATEGORY.PUSH,
    accent: "blue",
    baselineWeeks: 20,
    description:
      "Szabadon álló kézállás. Egyensúly, csuklókontroll és vállstabilitás.",
    progressions: [
      { name: "Wall handstand hold (chest to wall)", type: "hold", sets: 4, value: 30 },
      { name: "Wall handstand shoulder taps", type: "reps", sets: 4, value: 8 },
      { name: "Freestanding kick-up practice", type: "reps", sets: 5, value: 5 },
      { name: "Freestanding handstand hold", type: "hold", sets: 6, value: 10 },
    ],
    accessories: [
      { name: "Handstand push-up negative", type: "reps", sets: 3, value: 4 },
      { name: "Wrist prep circuit", type: "reps", sets: 2, value: 10 },
    ],
  },
  {
    id: "human-flag",
    label: "Human Flag",
    emoji: "🚩",
    category: CATEGORY.CORE,
    accent: "green",
    baselineWeeks: 28,
    description:
      "Oldalirányú zászlótartás függőleges rúdon. Egyedülálló oldalsó törzs- és vállerő.",
    progressions: [
      { name: "Support hold (vertical bar)", type: "hold", sets: 4, value: 12 },
      { name: "Tuck Human Flag hold", type: "hold", sets: 4, value: 8 },
      { name: "Straddle Human Flag negatives", type: "reps", sets: 4, value: 3 },
      { name: "Straddle Human Flag hold", type: "hold", sets: 5, value: 6 },
      { name: "Full Human Flag hold", type: "hold", sets: 5, value: 5 },
    ],
    accessories: [
      { name: "Side plank raise", type: "reps", sets: 3, value: 10 },
      { name: "Clutch flag hold", type: "hold", sets: 3, value: 10 },
    ],
  },
  {
    id: "l-sit",
    label: "L-Sit → V-Sit",
    emoji: "🪑",
    category: CATEGORY.CORE,
    accent: "blue",
    baselineWeeks: 10,
    description: "Alapvető törzs- és csípőhajlító elem, kiváló rávezető a nehezebb elemekhez.",
    progressions: [
      { name: "Tuck L-sit hold", type: "hold", sets: 4, value: 15 },
      { name: "L-sit hold", type: "hold", sets: 5, value: 12 },
      { name: "L-sit to tuck raise", type: "reps", sets: 4, value: 8 },
      { name: "V-sit hold", type: "hold", sets: 5, value: 8 },
    ],
    accessories: [
      { name: "Compression leg raise", type: "reps", sets: 3, value: 10 },
      { name: "Hollow body hold", type: "hold", sets: 3, value: 25 },
    ],
  },
  {
    id: "pistol-squat",
    label: "Pistol Squat",
    emoji: "🦵",
    category: CATEGORY.LEGS,
    accent: "green",
    baselineWeeks: 10,
    description: "Egylábas mélyguggolás — alsótest erő, mobilitás és egyensúly.",
    progressions: [
      { name: "Box pistol squat", type: "reps", sets: 4, value: 6 },
      { name: "Assisted pistol squat", type: "reps", sets: 4, value: 6 },
      { name: "Negative pistol squat", type: "reps", sets: 4, value: 5 },
      { name: "Full pistol squat", type: "reps", sets: 4, value: 6 },
    ],
    accessories: [
      { name: "Bulgarian split squat", type: "reps", sets: 3, value: 10 },
      { name: "Calf raise", type: "reps", sets: 3, value: 15 },
    ],
  },
];

/* Shared warm-up block appended to every training day */
const WARMUP = [
  { name: "Csukló- és vállkörzés mobilizáció", type: "hold", sets: 1, value: 120 },
  { name: "Scapula pull-up + push-up", type: "reps", sets: 2, value: 10 },
];

const SKILL_BY_ID = SKILLS.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {});

window.CF.CATEGORY = CATEGORY;
window.CF.SKILLS = SKILLS;
window.CF.SKILL_BY_ID = SKILL_BY_ID;
window.CF.WARMUP = WARMUP;
