// Fig: "Progression bench" — how double progression works in Orléans Fitness.
// Three set columns (reps 8–12 on a ruler), a flag that pops at 12 reps, a gate bar that lifts only
// when all three flags are up (AND), and a weight stack whose selector pin drops one 2.5 kg plate.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const SKILL = "/root/.claude/skills/anatomy";
const k = await import(`${SKILL}/kit/iso-kit.mjs`);
const { kitScript } = await import(`${SKILL}/scripts/inline-kit.mjs`);

const OUT_DIR = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? process.cwd();
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---------- Truth: the model ----------
const REP_MIN = 10, REP_MAX = 12, SETS = 3, STEP_KG = 2.5;
const SLED_KG = 40, START_PLATES = 8, MAX_PLATES = 12;   // 40 kg sled + 8 × 2.5 = 60 kg
// A realistic run of workouts: reps per set. When all three hit 12, weight goes up and reps restart at 10.
const WORKOUTS = [[10, 10, 10], [11, 10, 10], [12, 11, 10], [12, 12, 11], [12, 12, 12], [11, 10, 10], [12, 11, 11], [12, 12, 12]];

// ---------- World ----------
const WIDTH = 640, HEIGHT = 430;
const PLATE = { x: -152, y: -40, w: 302, d: 84, r: 8 };
const PLATE_H = 12, FOOT_H = 5;
const COLS = [-112, -66, -20];
const FOOT_Z = 6;
const COL_TOP = 86;                    // underside of the top cap
const CAP_H = 4;
const REP_Z = (rep) => 16 + (rep - 8) * 13; // rep 8 → z 16, rep 12 → z 68
const SLIDER_H = 8;
const FLAG_UP = 7;
const BAR_Z = COL_TOP + CAP_H + 9;      // gate bar rest height
const BAR_UP = 8;
const BAR = { x: -134, y: -27, w: 166, d: 6, r: 1.5 };
const STACK = { x: 48, y: -13, w: 38, d: 24, r: 1.4 };
const PITCH = 4.8, PLATE_T = 4.2, STACK_Z = 6;
const STACK_TOP = STACK_Z + MAX_PLATES * PITCH;   // 63.6
const ROD_X = [43, 91];
const ROD_TOP = 104;
const pinZ = (plates) => STACK_TOP - (plates - 0.5) * PITCH - 1.2; // pin sits in plate `plates` from the top

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), [BAR.x, BAR.y, BAR_Z + BAR_UP + 6], [ROD_X[1], 0, ROD_TOP + 4], [BAR.x + BAR.w, BAR.y, BAR_Z + BAR_UP + 6]],
  WIDTH, HEIGHT, { pad: 28, azimuth: 40 },
);

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const screwDots = (plan, z, inset, size = 0.45) => D(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size });

// ---------- Base ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 20))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  const seam = k.sideSeam(PLATE, -5, P, 8);
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid", inner: L(seam, { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // Ruler strip along the front edge
  const strip = { x: -130, y: PLATE.y + PLATE.d - 13, w: 150, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.4 }));
  // Label plate with three rule lines (they stand for printed text)
  const label = { x: 40, y: PLATE.y + PLATE.d - 18, w: 46, d: 11, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 4), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P, 4), { tone: "faint" }));
  [[4, 30], [4, 22], [4, 26]].forEach(([x0, len], i) => out.push(L(k.lineOnTop([label.x + x0 + 2, label.y + 3.2 + i * 2.4], [label.x + x0 + 2 + len, label.y + 3.2 + i * 2.4], 0.8, P), { tone: "lo", free: true })));
  out.push(D([at([label.x + 2.2, label.y + 5.5, 0.8]), at([label.x + label.w - 2.2, label.y + 5.5, 0.8])], { size: 0.4 }));
  return out.join("");
}

// ---------- Gate bar (behind the columns) ----------
const BAR_POSTS = [BAR.x - 6, BAR.x + BAR.w - 22];
function barPosts() {
  const out = [];
  for (const x of BAR_POSTS) {
    const foot = { x: x - 6, y: -36, w: 12, d: 10, r: 1.6 };
    out.push(S(k.slabOf(foot, 0, 4, P, 3, 0.5), { tone: "mid" }), screwDots(foot, 4, 2.2));
    out.push(S(k.cylinder(x, -31, 2.4, 4, BAR_Z + BAR_UP + 8 - 4, P, 24), { tone: "mid", crease: "none" }));
    out.push(L([30, 60].map((z) => k.sideArc(x, -31, 2.4, z, P, 14)).join(""), { tone: "faint" }));
    out.push(S(k.cylinder(x, -31, 3, BAR_Z + BAR_UP + 8, 1.6, P, 24), { tone: "mid" }));
  }
  return out.join("");
}

function gateBar() {
  const out = [];
  // bushings riding the two posts
  for (const x of BAR_POSTS) {
    const bush = { x: x - 4, y: -28.6, w: 8, d: 3, r: 0.8 };
    out.push(S(k.slabOf(bush, BAR_Z - 2, 9, P, 3, 0.4), { tone: "mid" }));
    out.push(D([at([x - 2.2, -27.1, BAR_Z + 7]), at([x + 2.2, -27.1, BAR_Z + 7])], { size: 0.4 }));
  }
  // catch blocks hanging under the bar, one over each column's flag
  for (const cx of COLS) {
    const catchBlock = { x: cx + 2, y: -25, w: 7, d: 5, r: 0.8 };
    out.push(S(k.slabOf(catchBlock, BAR_Z - 4, 4, P, 3, 0.3), { tone: "lo" }));
  }
  out.push(S(k.slabOf(BAR, BAR_Z, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(BAR, 1.6), BAR_Z + 5, P, 4), { tone: "faint" }));
  out.push(D(COLS.map((cx) => at([cx + 5.5, BAR.y + 3, BAR_Z + 5])), { size: 0.45 }));
  // pawl arm reaching over to the weight stack
  const arm = { x: BAR.x + BAR.w - 2, y: -26, w: ROD_X[0] - (BAR.x + BAR.w) + 8, d: 4, r: 1 };
  out.push(S(k.slabOf(arm, BAR_Z + 0.5, 4, P, 3, 0.4), { tone: "mid" }));
  const pawl = { x: ROD_X[0] - 2, y: -26.5, w: 9, d: 5, r: 1 };
  out.push(S(k.slabOf(pawl, BAR_Z - 3, 8, P, 3, 0.4), { tone: "lo" }));
  out.push(D([at([pawl.x + 4.5, pawl.y + 2.5, BAR_Z + 5])], { size: 0.5, tone: "hi" }));
  return out.join("");
}

// ---------- A set column ----------
function columnBack(cx, n) {
  const out = [];
  const foot = { x: cx - 15, y: -15, w: 30, d: 26, r: 2 };
  out.push(S(k.slabOf(foot, 0, FOOT_Z, P, 4, 0.6), { tone: "mid" }), screwDots(foot, 3, 0.5));
  const board = { x: cx - 13, y: -13, w: 26, d: 4, r: 0.8 };
  out.push(S(k.slabOf(board, FOOT_Z, COL_TOP - FOOT_Z, P, 3, 0.4), { tone: "mid" }));
  // ruler strip on the board's front face, ticks hang off its right edge at each rep
  const sx = cx - 12, sw = 3.4, face = board.y + board.d; // face at y = -9
  const strip = { x: sx, y: face, w: sw, d: 0.7, r: 0.3 };
  out.push(S(k.slabOf(strip, REP_Z(8) - 4, REP_Z(12) - REP_Z(8) + 8, P, 2), { tone: "lo", crease: "none" }));
  const minor = [], major = [];
  for (let rep = 8; rep <= 12; rep++) {
    const big = rep >= REP_MIN;
    const z = REP_Z(rep);
    (big ? major : minor).push(k.segment([sx + sw, face + 0.7, z], [sx + sw + (big ? 4.2 : 2.4), face + 0.7, z], P));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  // the 10–12 band: a lo inlay between the major ticks on the strip
  out.push(S(k.slabOf({ x: sx + 0.6, y: face + 0.7, w: sw - 1.2, d: 0.2, r: 0.2 }, REP_Z(REP_MIN), REP_Z(REP_MAX) - REP_Z(REP_MIN), P, 2), { tone: "hi", crease: "none" }));
  // central rail the slider runs on
  const rail = { x: cx - 2.5, y: face, w: 5, d: 2.4, r: 0.6 };
  out.push(S(k.slabOf(rail, FOOT_Z, COL_TOP - FOOT_Z, P, 3, 0.3), { tone: "mid" }));
  out.push(D([at([cx, face + 2.4, FOOT_Z + 3]), at([cx, face + 2.4, COL_TOP - 3])], { size: 0.4 }));
  // engraved set number on the board, low on the right
  out.push(k.faceTextSvg(k.sideMatrix([cx + 6, face, 0], FOOT_Z + 9, P, "right"), String(n), { size: 3.4, tone: "lo", anchor: "middle" }));
  return out.join("");
}

function slider(cx) {
  // built at rep 10, moved along z
  const z = REP_Z(REP_MIN) - SLIDER_H / 2;
  const plan = { x: cx - 9, y: -6.6, w: 18, d: 8, r: 1.2 };
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(plan, 2), z - 1, 0.1, P)}" style="filter:blur(3px);opacity:.5"/>`];
  out.push(S(k.slabOf(plan, z, SLIDER_H, P, 4, 0.6), { tone: "hi", crease: "lo", inner: L(k.sideSeam(plan, z + SLIDER_H / 2, P, 4), { tone: "faint" }) }));
  out.push(D([at([plan.x + 2.4, plan.y + 2.4, z + SLIDER_H]), at([plan.x + plan.w - 2.4, plan.y + 2.4, z + SLIDER_H])], { size: 0.4, tone: "lo" }));
  // index pointer reaching left to the ruler
  const tip = { x: cx - 12.4 + 3.6, y: -8.9, w: 4.4, d: 2.4, r: 0.4 };
  out.push(S(k.slabOf(tip, REP_Z(REP_MIN) - 0.6, 1.2, P, 2), { tone: "hi", crease: "none" }));
  // knurled thumb knob on the front
  const neck = { x: cx - 1.6, y: plan.y + plan.d - 0.2, w: 3.2, d: 2.4, r: 0.6 };
  out.push(S(k.slabOf(neck, z + 2.4, 3.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(k.cylinder(cx, neck.y + neck.d + 2.2, 2.6, z + 1.6, 4.8, P, 22), { tone: "mid" }));
  out.push(L(k.knurl(cx, neck.y + neck.d + 2.2, 2.6, z + 1.6, z + 6.4, 18, P), { tone: "lo" }));
  return out.join("");
}

function flag(cx) {
  // pops up through the cap when the slider reaches 12 reps; drawn before the cap
  const plan = { x: cx + 3.6, y: -12.2, w: 3.8, d: 3.4, r: 0.6 };
  return S(k.slabOf(plan, COL_TOP + CAP_H - FLAG_UP + 1, FLAG_UP + 2, P, 2, 0.3), { tone: "hi", lit: true });
}

function cap(cx) {
  const out = [];
  const plan = { x: cx - 14, y: -14, w: 28, d: 11, r: 1.6 };
  out.push(S(k.slabOf(plan, COL_TOP, CAP_H, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.planOutline({ x: cx + 3.1, y: -12.7, w: 4.8, d: 4.4, r: 0.8 }, COL_TOP + CAP_H, P, 3), { tone: "lo" }));
  out.push(D([at([plan.x + 2.4, plan.y + 5.5, COL_TOP + CAP_H]), at([cx - 3, plan.y + 5.5, COL_TOP + CAP_H])], { size: 0.45 }));
  // compression spring under the slider's stop, seen as a stub stop block on the rail top
  return out.join("");
}

// ---------- Weight stack ----------
function stackBack() {
  const out = [];
  const foot = { x: STACK.x - 10, y: STACK.y - 5, w: STACK.w + 20, d: STACK.d + 10, r: 2 };
  out.push(S(k.slabOf(foot, 0, STACK_Z, P, 4, 0.6), { tone: "mid" }), screwDots(foot, 3, 0.5));
  // back guide rod (left) first; the right rod is nearer and drawn after the plates
  out.push(S(k.cylinder(ROD_X[0], 0, 1.8, STACK_Z, ROD_TOP - STACK_Z, P, 22), { tone: "mid", crease: "none" }));
  return out.join("");
}

function plates() {
  const out = [];
  for (let i = 0; i < MAX_PLATES; i++) {
    const z = STACK_Z + i * PITCH;
    const top = i === MAX_PLATES - 1;
    out.push(S(k.slabOf(STACK, z, PLATE_T, P, 4, 0.4), { tone: top ? "hi" : "mid", crease: "lo" }));
    // pin hole on the front face of every plate
    out.push(L(k.sideRing([STACK.x + STACK.w / 2, STACK.y + STACK.d, z + PLATE_T / 2], 1.1, "y", P), { tone: "lo" }));
  }
  // head plate with the lifting eye
  const head = k.insetPlan(STACK, -1);
  out.push(S(k.slabOf(head, STACK_TOP, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(k.faceTextSvg(k.topMatrix([STACK.x + STACK.w / 2, STACK.y + 6], STACK_TOP + 5, P, "x"), "2.5 kg", { size: 3, tone: "lo", anchor: "middle" }));
  out.push(S(k.cylinder(STACK.x + STACK.w / 2, 0, 3.4, STACK_TOP + 5, 3, P, 24), { tone: "mid" }));
  out.push(S(k.cylinder(STACK.x + STACK.w / 2, 0, 1.4, STACK_TOP + 8, ROD_TOP - STACK_TOP - 8, P, 16), { tone: "mid", crease: "none" }));
  return out.join("");
}

function stackFront() {
  const out = [];
  out.push(S(k.cylinder(ROD_X[1], 0, 1.8, STACK_Z, ROD_TOP - STACK_Z, P, 22), { tone: "mid", crease: "none" }));
  const cross = { x: ROD_X[0] - 5, y: -5, w: ROD_X[1] - ROD_X[0] + 10, d: 10, r: 2 };
  out.push(S(k.slabOf(cross, ROD_TOP, 5, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.ring(ROD_X[0], 0, 2.6, ROD_TOP + 5, P, 16) + k.ring(ROD_X[1], 0, 2.6, ROD_TOP + 5, P, 16), { tone: "lo" }));
  out.push(D([at([ROD_X[0], 0, ROD_TOP + 5]), at([ROD_X[1], 0, ROD_TOP + 5])], { size: 0.5 }));
  out.push(S(k.cylinder(STACK.x + STACK.w / 2, 0, 4.2, ROD_TOP + 5, 2.4, P, 28), { tone: "mid" }));
  return out.join("");
}

function pin() {
  // the selector pin, built at START_PLATES and moved along z
  const z = pinZ(START_PLATES);
  const cx = STACK.x + STACK.w / 2;
  const shaft = { x: cx - 1.1, y: STACK.y + STACK.d, w: 2.2, d: 7, r: 0.6 };
  const out = [S(k.slabOf(shaft, z + 0.1, 2.2, P, 2), { tone: "hi", crease: "none", lit: true })];
  const grip = { x: cx - 4.5, y: shaft.y + shaft.d, w: 9, d: 3, r: 1.2 };
  out.push(S(k.slabOf(grip, z - 2, 6.4, P, 3, 0.4), { tone: "hi", lit: true }));
  out.push(D([at([cx, grip.y + grip.d, z + 1.2])], { size: 0.5 }));
  return out.join("");
}

// ---------- Assemble ----------
const restLift = (rep) => REP_Z(rep) - REP_Z(REP_MIN);
const first = WORKOUTS[0];
const body = [base(), barPosts(), `<g data-part="bar">${gateBar()}</g>`];
COLS.forEach((cx, i) => {
  body.push(columnBack(cx, i + 1));
  body.push(`<g data-part="slider" transform="${k.translateAlong(P, [0, 0, restLift(first[i])])}">${slider(cx)}</g>`);
  body.push(`<g data-part="flag" transform="${k.translateAlong(P, [0, 0, 0])}">${flag(cx)}</g>`);
  body.push(cap(cx));
});
body.push(stackBack(), plates(), `<g data-part="pin">${pin()}</g>`, stackFront());

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Стенд прогрессии веса. Три стойки — три подхода; ползунок на каждой поднимается по линейке повторов от 8 до 12. На 12 повторах из крышки стойки выскакивает флажок. Планка-замок сзади поднимается, только когда подняты все три флажка, и тогда штырь на весовой колонне опускается на одну пластину: плюс 2,5 кг. Затем повторы начинаются снова с 10.",
  body,
});

const live = `
const P = ${JSON.stringify(P)};
const WORKOUTS = ${JSON.stringify(WORKOUTS)};
const REP_MIN = ${REP_MIN}, REP_MAX = ${REP_MAX}, STEP_KG = ${STEP_KG}, SLED_KG = ${SLED_KG};
const START_PLATES = ${START_PLATES}, MAX_PLATES = ${MAX_PLATES}, PITCH = ${PITCH};
const REP_STEP = ${REP_Z(9) - REP_Z(8)}, FLAG_UP = ${FLAG_UP}, BAR_UP = ${BAR_UP};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const sliders = [...svg.querySelectorAll('[data-part="slider"]')];
const flags = [...svg.querySelectorAll('[data-part="flag"]')];
const bar = svg.querySelector('[data-part="bar"]');
const pinEl = svg.querySelector('[data-part="pin"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

const fmt = (kg) => kg.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let workout = 0, reps = [...WORKOUTS[0]], plates = START_PLATES;
const lift = reps.map((r) => (r - REP_MIN) * REP_STEP);
const flagAt = [0, 0, 0], flagRate = [0, 0, 0];
let barAt = 0, barRate = 0, pinAt = 0, paid = false, resetAt = 0, note = "";
let frame = 0, last = 0, clock = 0, nextTour = 2.8, touring = true, visible = false, idle = 0;

function say() {
  const kg = SLED_KG + plates * STEP_KG;
  const all = reps.every((r) => r >= REP_MAX);
  const text = "Тр. " + (workout + 1) + " · " + fmt(kg) + " кг · " + reps.join("/") + " → " + (note || (all ? "+2,5 кг" : "вес тот же"));
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuetext", text);
}

function nextWorkout() {
  workout = (workout + 1) % WORKOUTS.length;
  if (workout === 0) { plates = START_PLATES; }
  reps = [...WORKOUTS[workout]];
  note = "";
  paid = false;
  say();
}

function draw() {
  sliders.forEach((el, i) => el.setAttribute("transform", translateAlong(P, [0, 0, lift[i]])));
  flags.forEach((el, i) => el.setAttribute("transform", translateAlong(P, [0, 0, flagAt[i]])));
  bar.setAttribute("transform", translateAlong(P, [0, 0, barAt]));
  pinEl.setAttribute("transform", translateAlong(P, [0, 0, -pinAt]));
}

function spring(at, rate, want, dt, k, d) {
  for (let i = 0; i < 4; i++) { rate += ((want - at) * k - rate * d) * dt / 4; at += rate * dt / 4; }
  return [at, rate];
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  const ease = (x, want, s) => calm ? want : x + (want - x) * (1 - Math.exp(-dt / s));

  if (touring && clock >= nextTour) { nextWorkout(); nextTour = clock + 3.4; }

  reps.forEach((r, i) => { lift[i] = ease(lift[i], (r - REP_MIN) * REP_STEP, 0.32); });
  // a flag pops when its slider is (nearly) at 12 reps
  const up = lift.map((l) => l >= (REP_MAX - REP_MIN) * REP_STEP - 0.6);
  for (let i = 0; i < 3; i++) {
    const want = up[i] ? FLAG_UP : 0;
    if (calm) { flagAt[i] = want; flagRate[i] = 0; } else [flagAt[i], flagRate[i]] = spring(flagAt[i], flagRate[i], want, dt, 320, 22);
  }
  // the gate bar rises only when all three flags are up: logical AND
  const open = flagAt.every((f) => f > FLAG_UP * 0.85);
  if (calm) { barAt = open ? BAR_UP : 0; barRate = 0; } else [barAt, barRate] = spring(barAt, barRate, open ? BAR_UP : 0, dt, 180, 16);
  if (barAt > BAR_UP * 0.9 && !paid) {
    paid = true;
    if (plates < MAX_PLATES) plates += 1;
    note = "+2,5 кг, снова с 10";
    resetAt = clock + 1.1;
    say();
  }
  if (paid && resetAt && clock >= resetAt) { reps = [REP_MIN, REP_MIN, REP_MIN]; resetAt = 0; }
  pinAt = ease(pinAt, (plates - START_PLATES) * PITCH, 0.45);

  draw();
  frame = visible ? requestAnimationFrame(tick) : 0;
}

const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const manual = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; nextTour = clock + 1; run(); }, 7000);
  nextWorkout();
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
stage.addEventListener("click", manual);
stage.addEventListener("keydown", (event) => {
  if (![" ", "Enter", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  manual();
});
say();
draw();
`;

const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Прогрессия веса",
  hint: "Нажмите: следующая тренировка",
  readout: `Тр. 1 · 60,0 кг · ${first.join("/")} → вес тот же`,
  keys: [
    { mark: "lit", label: "Флажки и штырь: что срабатывает, когда все подходы дошли до 12" },
    { mark: "raised", label: "Три ползунка — повторы в трёх подходах, диапазон 10–12" },
  ],
  caption: "Двойная прогрессия в Orléans Fitness. Каждый подход — стойка, ползунок показывает повторы. На 12 повторах выскакивает флажок. Планка-замок поднимается только когда подняты все три флажка, и штырь опускается на одну пластину: +2,5 кг (для гантелей шаг 2 кг). После этого повторы начинаются снова с 10. Если хотя бы один подход не дошёл до 12, вес остаётся прежним. В первые 2 недели и после «тяжело» вес не растёт.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Стенд прогрессии: пробел или Enter — следующая тренировка">${svg}</div>`,
});

mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, theme === "light" ? "progression-light.html" : "progression.html");
writeFileSync(file, k.pageHtml({ title: "Прогрессия веса", theme, body: plate, script: kitScript() + live }));
console.log("wrote", file);
