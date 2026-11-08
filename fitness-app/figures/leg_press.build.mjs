// Fig: Seated leg press with a selectorized weight stack.
// The footplate carriage runs on two rails; a cable from the carriage runs under the seat, round a floor
// pulley, up the tower and over two head pulleys to the stack. Pressing the plate away by d lifts the
// selected plates by d (1:1). Tempo: press 1 s, hold 0.3 s, lower 2 s. An end stop keeps the knees soft.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const SKILL = "/root/.claude/skills/anatomy";
const k = await import(`${SKILL}/kit/iso-kit.mjs`);
const G = await import(`${SKILL}/kit/lathe.mjs`);
const { kitScript } = await import(`${SKILL}/scripts/inline-kit.mjs`);

const OUT_DIR = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? process.cwd();
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---------- Truth ----------
const PLATE_KG = 5, ADDON_KG = 2.5, PLATES = 14;           // 14 × 5 kg + a 2.5 kg add-on = 72.5 kg max
const TEMPO = { press: 1.0, hold: 0.3, lower: 2.0, bottom: 0.4 };
const STROKE = 36;                                         // carriage travel = stack lift (1:1 cable)

// ---------- World ----------
const WIDTH = 640, HEIGHT = 440;
const BASE = { x: -132, y: -36, w: 284, d: 72, r: 6 };
const BASE_H = 8, FOOT_H = 4;
const CY = -3;                                             // cable plane
const RAIL_Y = [-16, 10], RAIL_W = 6, RAIL_Z = 20, RAIL_H = 6, RAIL_X = [-118, -22];
const CAR_X0 = -38;                                        // carriage centre at rest (knees bent)
const CAR_Z = RAIL_Z + RAIL_H;                              // 26
const ANCHOR = [CAR_X0 + 15, CY, 22];
const B = [82, CY, 27], R_B = 5;                           // floor pulley (turns the cable up)
const STACK = { x: 94, y: -12, w: 32, d: 24, r: 1.2 };
const PITCH = 4.6, PLATE_T = 4.0, STACK_Z = 6;
const STACK_TOP = STACK_Z + PLATES * PITCH;                // top of the top plate
const HEAD_H = 5;
const ROD_Y = [-16, 16], ROD_X = 110;
const TOP_C = 126, R_C = 5;
const C1 = [92, CY, TOP_C], C2 = [105, CY, TOP_C];
const CROSS_Z = TOP_C + 8;

const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [ROD_X, ROD_Y[0], CROSS_Z + 6], [ROD_X, ROD_Y[1], CROSS_Z + 6], [52, -24, 100], [-118, -28, 90]],
  WIDTH, HEIGHT, { pad: 26, azimuth: 36 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const byDepth = (pts) => [...pts].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const screws = (plan, z, inset = 2.2, size = 0.45) => D(k.corners(plan, inset).map(([x, y]) => at([x, y, z])), { size });
const yFrame = (x, z, y0) => G.frameOf([x, y0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const pulley = ([x, , z], r) => {
  const F = yFrame(x, z, CY - 3);
  return S(G.disc(0, 6, r, F, P), { tone: "mid" }) + L(G.circleOf(G.frameOf([x, CY + 3, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]), 0, r - 1.6, P, 32), { tone: "lo" }) + D([at([x, CY + 3, z])], { size: 0.6 });
};

// ---------- Static parts ----------
function base() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 16))) {
    out.push(S(k.cylinder(x, y, 6, -BASE_H - FOOT_H, 1.4, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 4.6, -BASE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 6, 1.4), { tone: "mid", inner: L(k.sideSeam(BASE, -4, P, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 4.5), 0, P), { tone: "lo" }));
  const cs = k.corners(BASE, 8);
  out.push(L(cs.map(([x, y]) => k.ring(x, y, 2, 0, P, 16)).join(""), { tone: "lo" }), D(cs.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // label plate near the seat
  const label = { x: 0, y: BASE.y + BASE.d - 14, w: 40, d: 9, r: 1 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "mid", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P, 3), { tone: "faint" }));
  [26, 18, 22].forEach((len, i) => out.push(L(k.lineOnTop([label.x + 4, label.y + 2.8 + i * 2], [label.x + 4 + len, label.y + 2.8 + i * 2], 0.8, P), { tone: "lo", free: true })));
  return out.join("");
}

function railLegs(yRail) {
  const out = [];
  for (const x of [-112, -70, -30]) {
    const leg = { x: x - 3, y: yRail, w: 6, d: RAIL_W, r: 0.8 };
    out.push(S(k.slabOf({ x: x - 5, y: yRail - 2, w: 10, d: RAIL_W + 4, r: 1 }, 0, 2, P, 3, 0.3), { tone: "lo" }));
    out.push(S(k.slabOf(leg, 2, RAIL_Z - 2, P, 3, 0.3), { tone: "mid" }));
  }
  return out.join("");
}

function rail(yRail, ruler) {
  const out = [];
  const plan = { x: RAIL_X[0], y: yRail, w: RAIL_X[1] - RAIL_X[0], d: RAIL_W, r: 1 };
  out.push(S(k.slabOf(plan, RAIL_Z, RAIL_H, P, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(plan, RAIL_Z + 2, P, 3), { tone: "faint" }) }));
  out.push(D([RAIL_X[0] + 4, RAIL_X[1] - 4].map((x) => at([x, yRail + RAIL_W / 2, RAIL_Z + RAIL_H])), { size: 0.4 }));
  // end stop with rubber bumper at the far end: stroke ends before the knees lock
  const stopX = CAR_X0 - 16 - STROKE - 5;
  const stop = { x: stopX - 3, y: yRail - 1, w: 5, d: RAIL_W + 2, r: 1 };
  out.push(S(k.slabOf(stop, RAIL_Z + RAIL_H, 7, P, 3, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: stopX + 2, y: yRail + 0.5, w: 3, d: RAIL_W - 1, r: 0.8 }, RAIL_Z + RAIL_H + 1, 5, P, 2), { tone: "lo" }));
  out.push(D([at([stopX - 0.5, yRail + RAIL_W / 2, RAIL_Z + RAIL_H + 7])], { size: 0.45 }));
  if (ruler) {
    // ruler ledge on the outside of the near rail, ticks every 4, majors every 5th
    const strip = { x: CAR_X0 - 14 - STROKE - 2, y: yRail + RAIL_W, w: STROKE + 8, d: 4, r: 0.6 };
    out.push(S(k.slabOf(strip, RAIL_Z + RAIL_H - 1.2, 1.2, P, 2), { tone: "lo", crease: "none" }));
    const t = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.4, RAIL_Z + RAIL_H, [1.4, 2.6], P);
    out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  }
  return out.join("");
}

function pulleyB() {
  const out = [];
  const bracket = { x: 76, y: CY - 6.2, w: 12, d: 3, r: 0.8 };
  out.push(S(k.slabOf({ x: 72, y: CY - 9, w: 20, d: 9, r: 1.2 }, 0, 3, P, 3, 0.4), { tone: "mid" }), screws({ x: 72, y: CY - 9, w: 20, d: 9, r: 1.2 }, 3, 1.8, 0.4));
  out.push(S(k.slabOf(bracket, 3, B[2] + 3, P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

function seat() {
  const out = [];
  for (const y of [-18, 8]) {
    const foot = { x: 8, y: y - 2, w: 30, d: 10, r: 1.2 };
    out.push(S(k.slabOf(foot, 0, 3, P, 3, 0.4), { tone: "lo" }), screws(foot, 3, 2));
    out.push(S(k.slabOf({ x: 18, y, w: 8, d: 6, r: 1 }, 3, 31, P, 3, 0.4), { tone: "mid" }));
    // seat-height holes on the post's outer face, a closed slot for the pin
    out.push(L([12, 18, 24].map((z) => k.sideRing([22, y + 6, z], 1, "y", P, 14)).join(""), { tone: "lo" }));
  }
  const frame = { x: 2, y: -22, w: 50, d: 40, r: 2 };
  out.push(S(k.slabOf(frame, 34, 3, P, 4, 0.4), { tone: "mid" }));
  const pad = { x: 4, y: -21, w: 40, d: 38, r: 4 };
  out.push(S(k.slabOf(pad, 37, 7, P, 8, 1.2), { tone: "hi", crease: "lo", inner: L(k.sideSeam(pad, 40.5, P, 8), { tone: "faint" }) }));
  // backrest: frame upright plus a padded cushion facing the footplate
  const back = { x: 46, y: -20, w: 5, d: 36, r: 1 };
  out.push(S(k.slabOf(back, 37, 58, P, 3, 0.4), { tone: "mid" }));
  const cushion = { x: 40, y: -21, w: 6, d: 38, r: 2.4 };
  out.push(S(k.slabOf(cushion, 46, 48, P, 6, 0.8), { tone: "hi", crease: "lo", inner: L(k.sideSeam(cushion, 70, P, 6), { tone: "faint" }) }));
  // side handles
  for (const y of [-27, 21]) {
    out.push(S(k.slabOf({ x: 8, y: y < 0 ? y + 2 : y - 2, w: 10, d: 6, r: 1 }, 31, 3, P, 2, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(13, y + 3, 2.6, 22, 12, P, 20), { tone: "mid" }));
    out.push(L(k.knurl(13, y + 3, 2.6, 22, 34, 16, P), { tone: "lo" }));
  }
  return out.join("");
}

function towerBack() {
  const out = [];
  const foot = { x: 90, y: -22, w: 40, d: 44, r: 2 };
  out.push(S(k.slabOf(foot, 0, STACK_Z, P, 4, 0.6), { tone: "mid" }), screws(foot, STACK_Z, 2.6, 0.5));
  out.push(S(k.cylinder(ROD_X, ROD_Y[0], 1.8, STACK_Z, CROSS_Z - STACK_Z, P, 22), { tone: "mid", crease: "none" }));
  // rubber bumpers under the stack
  for (const x of [100, 120]) out.push(S(k.cylinder(x, 0, 2.6, STACK_Z, 1.2, P, 18), { tone: "lo" }));
  return out.join("");
}

function plateSvg(i) {
  const z = STACK_Z + (PLATES - 1 - i) * PITCH;   // i = 0 is the top plate
  const out = [S(k.slabOf(STACK, z, PLATE_T, P, 4, 0.4), { tone: "mid", crease: "lo" })];
  out.push(L(k.sideRing([STACK.x + STACK.w / 2, STACK.y + STACK.d, z + PLATE_T / 2], 1, "y", P, 14), { tone: "lo" }));
  return out.join("");
}

function head() {
  const z = STACK_TOP;
  const plan = k.insetPlan(STACK, -1);
  const out = [S(k.slabOf(plan, z, HEAD_H, P, 4, 0.6), { tone: "mid" })];
  out.push(k.faceTextSvg(k.topMatrix([STACK.x + 26, STACK.y + 18], z + HEAD_H, P, "x"), "5 kg", { size: 2.6, tone: "lo", anchor: "middle" }));
  out.push(S(k.cylinder(ROD_X, CY, 2.4, z + HEAD_H, 2.4, P, 20), { tone: "mid" }));
  return out.join("");
}

function addon() {
  const plan = { x: STACK.x + 2, y: STACK.y + 2, w: 9, d: 20, r: 1 };
  return S(k.slabOf(plan, STACK_TOP + HEAD_H, 3, P, 3, 0.4), { tone: "hi", crease: "lo" }) + screws(plan, STACK_TOP + HEAD_H + 3, 1.6, 0.4);
}

function pin(n) {
  // selector pin in plate n (1-based from top), on the stack's front face
  const z = STACK_Z + (PLATES - n) * PITCH + PLATE_T / 2 - 1.1;
  const cx = STACK.x + STACK.w / 2;
  const shaft = { x: cx - 1, y: STACK.y + STACK.d, w: 2, d: 6, r: 0.6 };
  const grip = { x: cx - 4, y: shaft.y + shaft.d, w: 8, d: 3, r: 1.2 };
  return S(k.slabOf(shaft, z, 2.2, P, 2), { tone: "hi", crease: "none", lit: true })
    + S(k.slabOf(grip, z - 2, 6.2, P, 3, 0.4), { tone: "hi", lit: true })
    + D([at([cx, grip.y + grip.d, z + 1.1])], { size: 0.5 });
}

function towerTop() {
  const out = [];
  const bracket = { x: 86, y: CY - 6.2, w: 24, d: 3, r: 0.8 };
  out.push(S(k.slabOf(bracket, TOP_C - 7, CROSS_Z - TOP_C + 7, P, 2, 0.3), { tone: "mid" }));
  out.push(pulley(C1, R_C), pulley(C2, R_C));
  return out.join("");
}

function towerFront() {
  const out = [];
  out.push(S(k.cylinder(ROD_X, ROD_Y[1], 1.8, STACK_Z, CROSS_Z - STACK_Z, P, 22), { tone: "mid", crease: "none" }));
  const cross = { x: 84, y: -20, w: 32, d: 40, r: 2 };
  out.push(S(k.slabOf(cross, CROSS_Z, 4, P, 4, 0.6), { tone: "mid" }));
  out.push(L(k.ring(ROD_X, ROD_Y[0], 2.6, CROSS_Z + 4, P, 16) + k.ring(ROD_X, ROD_Y[1], 2.6, CROSS_Z + 4, P, 16), { tone: "lo" }));
  out.push(D([at([ROD_X, ROD_Y[0], CROSS_Z + 4]), at([ROD_X, ROD_Y[1], CROSS_Z + 4])], { size: 0.5 }));
  return out.join("");
}

function carriage() {
  // built at rest, moved along x
  const cx = CAR_X0;
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: cx - 16, y: -22, w: 30, d: 44, r: 2 }, CAR_Z - 2, 0.1, P)}" style="filter:blur(3px);opacity:.5"/>`];
  for (const y of RAIL_Y) {
    const bush = { x: cx - 12, y: y - 1, w: 22, d: RAIL_W + 2, r: 1 };
    out.push(S(k.slabOf(bush, CAR_Z, 4, P, 3, 0.4), { tone: "mid" }), screws(bush, CAR_Z + 4, 2, 0.4));
  }
  const deck = { x: cx - 16, y: -22, w: 30, d: 44, r: 2 };
  out.push(S(k.slabOf(deck, CAR_Z + 4, 3, P, 4, 0.5), { tone: "mid" }));
  // cable eye under the deck, on the seat side
  out.push(S(k.slabOf({ x: cx + 11, y: CY - 1.5, w: 4, d: 3, r: 0.6 }, 20, CAR_Z + 4 - 20, P, 2), { tone: "lo", crease: "none" }));
  // braces behind the footplate
  for (const y of [-18, 13]) out.push(S(k.slabOf({ x: cx - 15, y, w: 5, d: 4, r: 0.8 }, CAR_Z + 7, 36, P, 2, 0.3), { tone: "mid" }));
  // the footplate (lit: this is what the feet push), ribbed face toward the seat
  const plate = { x: cx - 10, y: -26, w: 4, d: 52, r: 0.3 };
  const z0 = CAR_Z + 7, z1 = z0 + 54;
  const ribs = [];
  for (let z = z0 + 6; z < z1 - 3; z += 4) ribs.push(k.sideSeam(plate, z, P, 2));
  out.push(S(k.slabOf(plate, z0, z1 - z0, P, 2, 0.5), { tone: "hi", lit: true, inner: L(ribs.join(""), { tone: "lo" }) }));
  // heel lip at the bottom of the plate
  out.push(S(k.slabOf({ x: cx - 6, y: -24, w: 4, d: 48, r: 1 }, z0, 3, P, 3, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---------- Assemble (back to front) ----------
const body = [
  base(),
  railLegs(RAIL_Y[0]),
  rail(RAIL_Y[0], false),
  towerBack(),
  pulleyB(),
  `<g class="iso-wire" data-tone="lo" data-part="cable"><path class="iso-line" data-tone="lo" d=""/><circle class="iso-wire-end" r="1.1"/></g>`,
  pulley(B, R_B),
  railLegs(RAIL_Y[1]),
  rail(RAIL_Y[1], true),
  `<g data-part="carriage">${carriage()}</g>`,
];
for (let i = PLATES - 1; i >= 0; i--) body.push(`<g data-plate="${i}">${plateSvg(i)}</g>`);
body.push(`<g data-plate="head">${head()}</g>`, `<g data-part="addon">${addon()}</g>`);
body.push(`<g data-part="pin">${pin(1)}</g>`);
body.push(towerTop());
body.push(`<g class="iso-wire" data-tone="lo" data-part="drop"><path class="iso-line" data-tone="lo" d=""/><circle class="iso-wire-end" r="1.1"/></g>`);
body.push(seat(), towerFront());

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT,
  label: "Жим ногами сидя с весовой колонной. Платформа для ног стоит на каретке на двух рельсах. Трос от каретки идёт под сиденьем к нижнему ролику, вверх по колонне и через два верхних ролика к грузу. Когда платформу толкают от сиденья, выбранные пластины поднимаются на то же расстояние. Упор в конце рельсов не даёт выпрямить колени до конца.",
  body,
});

const live = `
const P = ${JSON.stringify(P)};
const PLATE_KG = ${PLATE_KG}, ADDON_KG = ${ADDON_KG}, PLATES = ${PLATES}, PITCH = ${PITCH}, STROKE = ${STROKE};
const TEMPO = ${JSON.stringify(TEMPO)};
const CY = ${CY}, ANCHOR = ${JSON.stringify(ANCHOR)}, B = ${JSON.stringify(B)}, R_B = ${R_B}, C1 = ${JSON.stringify(C1)}, C2 = ${JSON.stringify(C2)}, R_C = ${R_C};
const HEAD_TOP = ${STACK_TOP + HEAD_H + 2.4};
const q = new URLSearchParams(location.search);
if (q.has("embed")) document.body.classList.add("embed");
const want = Math.max(PLATE_KG, Math.min(PLATES * PLATE_KG + ADDON_KG, Number(q.get("kg")) || 62.5));
const n = Math.max(1, Math.min(PLATES, Math.floor(want / PLATE_KG)));
const addonOn = want - n * PLATE_KG >= ADDON_KG - 0.01;
const KG = n * PLATE_KG + (addonOn ? ADDON_KG : 0);
const REPS = Math.max(1, Math.min(20, Number(q.get("reps")) || 10));

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const carriage = svg.querySelector('[data-part="carriage"]');
const plates = [...svg.querySelectorAll("[data-plate]")];
const addon = svg.querySelector('[data-part="addon"]');
const pinEl = svg.querySelector('[data-part="pin"]');
const cable = svg.querySelector('[data-part="cable"]');
const drop = svg.querySelector('[data-part="drop"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
if (!addonOn) addon.style.display = "none";
// plates that ride with the head: the head and plates 0..n-1 (from the top)
const riding = plates.filter((el) => el.dataset.plate === "head" || Number(el.dataset.plate) < n);
pinEl.setAttribute("data-shift", String((n - 1) * PITCH));

const arc = (c, r, a0, a1, steps = 8) => Array.from({ length: steps + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / steps; return [c[0] + r * Math.cos(a), CY, c[2] + r * Math.sin(a)]; });
const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + iso(p, P).map((v) => v.toFixed(1)).join(" ")).join("");
function cablePoints(d) {
  const a = [ANCHOR[0] - d, CY, ANCHOR[2]];
  return [a, ...arc(B, R_B, -Math.PI / 2, 0), ...arc(C1, R_C, Math.PI, Math.PI / 2), ...arc(C2, R_C, Math.PI / 2, 0)];
}
const fmt = (kg) => kg.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
let pos = 0, manual = null, clock = 0, last = 0, frame = 0, visible = false, idle = 0;
const CYCLE = TEMPO.press + TEMPO.hold + TEMPO.lower + TEMPO.bottom;
const REST = 3;
const smooth = (x) => x * x * (3 - 2 * x);
function tour(t) {
  const set = REPS * CYCLE + REST;
  const inSet = t % set;
  if (inSet >= REPS * CYCLE) return { d: 0, phase: "отдых между подходами", rep: REPS };
  const rep = Math.floor(inSet / CYCLE) + 1;
  let u = inSet % CYCLE;
  if (u < TEMPO.press) return { d: STROKE * smooth(u / TEMPO.press), phase: "жим · 1 с", rep };
  u -= TEMPO.press;
  if (u < TEMPO.hold) return { d: STROKE, phase: "колени чуть согнуты", rep };
  u -= TEMPO.hold;
  if (u < TEMPO.lower) return { d: STROKE * (1 - smooth(u / TEMPO.lower)), phase: "опускание · 2 с", rep };
  return { d: 0, phase: "внизу", rep };
}
function draw(d, text) {
  carriage.setAttribute("transform", translateAlong(P, [-d, 0, 0]));
  riding.forEach((el) => el.setAttribute("transform", translateAlong(P, [0, 0, d])));
  addon.setAttribute("transform", translateAlong(P, [0, 0, d]));
  pinEl.setAttribute("transform", translateAlong(P, [0, 0, d - (n - 1) * PITCH]));
  const pts = cablePoints(d);
  cable.querySelector("path").setAttribute("d", path(pts));
  const [ax, ay] = iso(pts[0], P);
  const end = cable.querySelector("circle"); end.setAttribute("cx", ax.toFixed(1)); end.setAttribute("cy", ay.toFixed(1));
  const top = [C2[0] + R_C, CY, C2[2]], low = [C2[0] + R_C, CY, HEAD_TOP + d];
  drop.querySelector("path").setAttribute("d", path([top, low]));
  const [hx, hy] = iso(low, P);
  const e2 = drop.querySelector("circle"); e2.setAttribute("cx", hx.toFixed(1)); e2.setAttribute("cy", hy.toFixed(1));
  if (readout.textContent !== text) readout.textContent = text;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  let text;
  if (manual !== null) {
    pos += (manual - pos) * (still.matches ? 1 : 1 - Math.exp(-dt / 0.2));
    text = fmt(KG) + " кг · ход " + Math.round(pos / STROKE * 100) + "%";
  } else {
    clock += still.matches ? 0 : dt;
    const s = tour(clock);
    pos = s.d;
    text = fmt(KG) + " кг · повтор " + s.rep + "/" + REPS + " · " + s.phase;
  }
  draw(pos, text);
  frame = visible ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const release = () => { clearTimeout(idle); idle = setTimeout(() => { manual = null; run(); }, 2500); };
stage.addEventListener("pointermove", (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, (0.62 - (event.clientX - box.left) / box.width) / 0.4));
  manual = share * STROKE; release(); run();
});
stage.addEventListener("keydown", (event) => {
  const step = { ArrowLeft: 4, ArrowRight: -4 }[event.key];
  if (!step) return;
  event.preventDefault();
  manual = Math.min(STROKE, Math.max(0, (manual ?? pos) + step)); release(); run();
});
draw(0, fmt(KG) + " кг · повтор 1/" + REPS + " · внизу");
`;

const css = `<style>.embed .iso-page{width:100%;margin:0}.embed .iso-figure{margin:0}.embed .iso-legend{display:none}.embed{background:transparent}</style>`;
const card = k.plateHtml({
  fig: "Жим ногами",
  title: "Тренажёр",
  hint: "Ведите влево: толкнуть платформу",
  readout: "62,5 кг · повтор 1/10 · внизу",
  keys: [
    { mark: "lit", label: "Платформа и штырь: куда давят ноги и сколько поднимается" },
    { mark: "raised", label: "Сиденье и спинка" },
  ],
  caption: "Жим ногами сидя. Ноги толкают платформу от сиденья, трос через три ролика поднимает выбранные пластины на то же расстояние: шаг пластины 5 кг, верхняя добавочная — 2,5 кг. Темп: жим 1 с, опускание 2 с. Упор на рельсах не даёт выпрямить колени до щелчка; поясница всё время прижата к спинке.",
  body: `<div class="iso-stage" tabindex="0" role="img" aria-label="Жим ногами: стрелки влево-вправо двигают платформу">${svg}</div>`,
});

mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, theme === "light" ? "leg_press-light.html" : "leg_press.html");
writeFileSync(file, k.pageHtml({ title: "Жим ногами", theme, body: css + card, script: kitScript() + live }));
console.log("wrote", file);
