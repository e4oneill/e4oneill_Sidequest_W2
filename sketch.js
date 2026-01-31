// ================================
// Spikey Platformer (Integrated)
// Pure random spike heights + Click-to-lock + Glow
// R = reroll heights of UNLOCKED spikes (random within range)
// G = new layout preserving LOCKED spikes (Shift+G = full reset)
// ================================

// ----- Spike height range (CUSTOMIZE HERE) -----
const SPIKE_MIN_H = 20; // minimum spike height (try 10–40)
const SPIKE_MAX_H = 260; // maximum spike height (try 200–320)

// Optional: extra randomness added on R rerolls (set to 0 for strictly within range)
const HEIGHT_JITTER_MIN = -10;
const HEIGHT_JITTER_MAX = 10;

// Y-position of the floor (ground level)
let floorY3;

// Player character (spikey blob)
let blob3 = {
  x: 80,
  y: 0,
  r: 26,
  points: 64,
  wobble: 9,
  wobbleFreq: 1.0,
  spikeAmp: 16,

  t: 0,
  tSpeed: 0.01,

  vx: 0,
  vy: 0,

  accel: 0.55,
  maxRun: 4.0,
  gravity: 0.65,
  jumpV: -11.0,

  onGround: false,

  frictionAir: 0.995,
  frictionGround: 0.88,
};

// Platforms
let platforms = [];

// Floaters (non-lethal, red & grey palette)
let floaters = [];
const NUM_FLOATERS = 10;

// Ceiling spikes (lethal). Each: {x, w, h, locked}
let ceilingSpikes = [];

// Damage & invulnerability feedback
let hitFlashTimer = 0;
let invulnTimer = 0;

// ==========================================
// SETUP
// ==========================================
function setup() {
  createCanvas(640, 360);

  floorY3 = height - 36;
  noStroke();
  textFont("sans-serif");
  textSize(14);

  // Platforms
  platforms = [
    { x: 0, y: floorY3, w: width, h: height - floorY3 },
    { x: 120, y: floorY3 - 70, w: 120, h: 12 },
    { x: 300, y: floorY3 - 120, w: 90, h: 12 },
    { x: 440, y: floorY3 - 180, w: 130, h: 12 },
    { x: 520, y: floorY3 - 70, w: 90, h: 12 },
  ];

  blob3.y = floorY3 - blob3.r - 1;

  for (let i = 0; i < NUM_FLOATERS; i++) {
    floaters.push(new SpikeyFloater());
  }

  buildCeilingSpikesLayout(); // initial layout
}

// ==========================================
// DRAW LOOP
// ==========================================
function draw() {
  background(0);

  // Floaters (background)
  for (const f of floaters) {
    f.update();
    f.draw();
  }

  // Platforms (dark red)
  fill(120, 0, 0);
  noStroke();
  for (const p of platforms) {
    rect(p.x, p.y, p.w, p.h);
  }

  // Ceiling spikes (with glow + lock indicator)
  drawCeilingSpikes();

  // Input
  let move = 0;
  if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) move -= 1;
  if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) move += 1;
  blob3.vx += blob3.accel * move;

  // Physics
  blob3.vx *= blob3.onGround ? blob3.frictionGround : blob3.frictionAir;
  blob3.vx = constrain(blob3.vx, -blob3.maxRun, blob3.maxRun);
  blob3.vy += blob3.gravity;

  // Collision box
  let box = {
    x: blob3.x - blob3.r,
    y: blob3.y - blob3.r,
    w: blob3.r * 2,
    h: blob3.r * 2,
  };

  // Horizontal move + collisions
  box.x += blob3.vx;
  for (const s of platforms) {
    if (overlap(box, s)) {
      if (blob3.vx > 0) box.x = s.x - box.w;
      else if (blob3.vx < 0) box.x = s.x + s.w;
      blob3.vx = 0;
    }
  }

  // Vertical move + collisions
  box.y += blob3.vy;
  blob3.onGround = false;
  for (const s of platforms) {
    if (overlap(box, s)) {
      if (blob3.vy > 0) {
        box.y = s.y - box.h;
        blob3.vy = 0;
        blob3.onGround = true;
      } else if (blob3.vy < 0) {
        box.y = s.y + s.h;
        blob3.vy = 0;
      }
    }
  }

  // Update blob position
  blob3.x = box.x + box.w / 2;
  blob3.y = box.y + box.h / 2;
  blob3.x = constrain(blob3.x, blob3.r, width - blob3.r);

  // Spike hazard collision
  if (invulnTimer <= 0) {
    for (const spike of ceilingSpikes) {
      if (circleTriangleHit(blob3.x, blob3.y, blob3.r, spike)) {
        onHitHazard();
        break;
      }
    }
  }

  // Draw player blob
  blob3.t += blob3.tSpeed;
  drawBlobSpikey(blob3);

  // HUD
  fill(255);
  text(
    "Click spikes to lock/unlock • R: reroll heights • G: new layout (Shift+G = full reset) • U: unlock all",
    10,
    18,
  );

  // Flash overlay
  if (hitFlashTimer > 0) {
    hitFlashTimer--;
    fill(255, 0, 0, map(hitFlashTimer, 0, 15, 0, 120));
    rect(0, 0, width, height);
  }
  if (invulnTimer > 0) invulnTimer--;
}

// ==========================================
// COLLISION + UTILITY FUNCTIONS
// ==========================================
function overlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function drawBlobSpikey(b) {
  // Flicker when invulnerable
  const visible = invulnTimer > 0 ? frameCount % 6 < 3 : true;
  if (!visible) return;

  fill(220, 30, 30);
  noStroke();
  beginShape();

  for (let i = 0; i < b.points; i++) {
    const a = (i / b.points) * TAU;
    const n = noise(
      cos(a) * b.wobbleFreq + 100,
      sin(a) * b.wobbleFreq + 100,
      b.t,
    );
    const wobble = map(n, 0, 1, -b.wobble, b.wobble);
    const isTip = i % 2 === 0;
    const spikeOffset = isTip ? b.spikeAmp : -b.spikeAmp * 0.45;
    const r = max(4, b.r + wobble + spikeOffset);
    vertex(b.x + cos(a) * r, b.y + sin(a) * r);
  }

  endShape(CLOSE);
}

// ==========================================
// FLOATING SPIKEY DECORATIONS (red & grey)
// ==========================================
class SpikeyFloater {
  constructor() {
    this.anchorX = random(20, width - 20);
    this.anchorY = 0;

    this.baseX = this.anchorX + random(-12, 12);
    this.baseY = random(40, height * 0.55);

    this.r = random(10, 26);
    this.points = random([32, 40, 48]);
    this.spikeAmp = random(8, 18);
    this.wobble = random(2, 6);
    this.wobbleFreq = random(0.7, 1.3);
    this.t = random(1000);

    this.bobAmp = random(6, 16);
    this.bobSpeed = random(0.005, 0.012);
    this.spin = random(-0.01, 0.01);
    this.angle = random(TWO_PI);

    // Red & Grey palette only
    const palettes = [
      [200, 40, 40], // Red
      [160, 30, 30], // Darker red
      [120, 120, 120], // Grey
      [80, 80, 80], // Dark grey
      [180, 180, 180], // Light grey
    ];
    this.col = random(palettes);
  }

  update() {
    this.t += this.bobSpeed;
    this.angle += this.spin;
  }

  draw() {
    // Hanging string
    stroke(60);
    strokeWeight(1);
    const yBob = sin(this.t * TAU) * this.bobAmp;
    const xSway = cos(this.t * 0.7 * TAU) * 3;
    const cx = this.baseX + xSway;
    const cy = this.baseY + yBob;

    line(this.anchorX, this.anchorY, cx, cy - (this.r + this.spikeAmp) * 0.9);

    // Body
    noStroke();
    fill(this.col[0], this.col[1], this.col[2]);

    push();
    translate(cx, cy);
    rotate(this.angle);
    beginShape();

    for (let i = 0; i < this.points; i++) {
      const a = (i / this.points) * TAU;
      const n = noise(
        cos(a) * this.wobbleFreq + 33,
        sin(a) * this.wobbleFreq + 33,
        this.t * 0.4,
      );
      const wobble = map(n, 0, 1, -this.wobble, this.wobble);
      const isTip = i % 2 === 0;
      const spikeOffset = isTip ? this.spikeAmp : -this.spikeAmp * 0.45;
      const r = max(3, this.r + wobble + spikeOffset);
      vertex(cos(a) * r, sin(a) * r);
    }

    endShape(CLOSE);
    pop();
  }
}

// ==========================================
// CEILING SPIKES: layout + heights + drawing
// ==========================================

// Build a new layout (random x, w). Resets locks.
function buildCeilingSpikesLayout() {
  ceilingSpikes = [];
  let x = 8;
  while (x < width - 8) {
    const w = random(28, 56);
    const h = random(SPIKE_MIN_H, SPIKE_MAX_H); // PURE RANDOM HEIGHT
    ceilingSpikes.push({ x, w, h, locked: false });
    x += random(22, 60);
  }
}

// Build a new layout, but **preserve locked spikes** as-is.
// Fills the gaps on the left/right of each locked spike.
function buildLayoutPreservingLocked() {
  const locked = ceilingSpikes
    .filter((s) => s.locked)
    .sort((a, b) => a.x - b.x);
  const newSpikes = [];
  let x = 8;

  function fillSegment(limitX) {
    while (x < limitX - 8) {
      const w = random(28, 56);
      if (x + w > limitX) break; // don't overlap next locked
      const h = random(SPIKE_MIN_H, SPIKE_MAX_H); // PURE RANDOM HEIGHT
      newSpikes.push({ x, w, h, locked: false });
      x += random(22, 60);
    }
  }

  for (const s of locked) {
    fillSegment(s.x); // left gap
    newSpikes.push({ ...s }); // preserve locked exactly
    x = s.x + s.w; // continue after locked
  }

  fillSegment(width - 8); // rightmost gap
  ceilingSpikes = newSpikes;
}

// Recompute heights for unlocked spikes only (keeps layout).
function rerollSpikeHeights() {
  for (const s of ceilingSpikes) {
    if (!s.locked) {
      let h = random(SPIKE_MIN_H, SPIKE_MAX_H); // PURE RANDOM HEIGHT
      // optional small jitter to avoid ties
      h += random(HEIGHT_JITTER_MIN, HEIGHT_JITTER_MAX);
      s.h = constrain(h, 10, 9999);
    }
  }
}

function drawCeilingSpikes() {
  for (const s of ceilingSpikes) {
    const ax = s.x,
      ay = 0;
    const bx = s.x + s.w,
      by = 0;
    const cx = s.x + s.w / 2,
      cy = s.h;

    // Glow scales with height (taller -> brighter)
    const glowAlpha = map(constrain(s.h, 40, 260), 40, 260, 30, 100);
    noStroke();
    fill(150, 0, 0, glowAlpha);
    triangle(ax, ay, bx, by, cx, cy + 12);

    // Solid spike
    if (s.locked) {
      stroke(255, 220, 0); // yellow outline when locked
      strokeWeight(2);
    } else {
      stroke(80, 0, 0);
      strokeWeight(1);
    }
    fill(150, 0, 0);
    triangle(ax, ay, bx, by, cx, cy);

    // Lock indicator dot at tip
    if (s.locked) {
      noStroke();
      fill(255, 220, 0);
      ellipse(cx, cy - 6, 6, 6);
    }
  }
}

// ==========================================
// COLLISION FOR TRIANGLE SPIKES
// ==========================================
function circleTriangleHit(cx, cy, r, spike) {
  const ax = spike.x,
    ay = 0;
  const bx = spike.x + spike.w,
    by = 0;
  const tx = spike.x + spike.w / 2,
    ty = spike.h;

  const minX = min(ax, bx, tx) - r;
  const maxX = max(ax, bx, tx) + r;
  const minY = -r;
  const maxY = spike.h + r;
  if (cx < minX || cx > maxX || cy < minY || cy > maxY) return false;

  if (pointInTriangle(cx, cy, ax, ay, bx, by, tx, ty)) return true;

  if (distToSegment(cx, cy, ax, ay, bx, by) <= r) return true;
  if (distToSegment(cx, cy, bx, by, tx, ty) <= r) return true;
  if (distToSegment(cx, cy, tx, ty, ax, ay) <= r) return true;

  return false;
}

function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const b0 = sign(px, py, ax, ay, bx, by) < 0.0;
  const b1 = sign(px, py, bx, by, cx, cy) < 0.0;
  const b2 = sign(px, py, cx, cy, ax, ay) < 0.0;
  return b0 === b1 && b1 === b2;
}

function sign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist(px, py, x1, y1);

  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist(px, py, x2, y2);

  const t = c1 / c2;
  return dist(px, py, x1 + t * vx, y1 + t * vy);
}

// ==========================================
// DAMAGE HANDLING
// ==========================================
function onHitHazard() {
  hitFlashTimer = 15;
  invulnTimer = 45;

  blob3.x = 80;
  blob3.y = floorY3 - blob3.r - 1;
  blob3.vx = 0;
  blob3.vy = 0;
}

// ==========================================
// INPUT (keyboard + mouse)
// ==========================================
function keyPressed() {
  if (
    (key === " " || key === "W" || key === "w" || keyCode === UP_ARROW) &&
    blob3.onGround
  ) {
    blob3.vy = blob3.jumpV;
    blob3.onGround = false;
  }

  // Reroll heights (unlocked only)
  if (key === "r" || key === "R") {
    rerollSpikeHeights();
  }

  // New layout:
  //  - 'g'/'G' alone  => preserve LOCKED spikes and fill gaps
  //  - Shift + 'g'    => full reset (clears locks)
  if (key === "g" || key === "G") {
    if (keyIsDown(SHIFT)) {
      buildCeilingSpikesLayout(); // full reset
    } else {
      buildLayoutPreservingLocked(); // preserve locks
    }
  }

  // Unlock all spikes
  if (key === "u" || key === "U") {
    for (const s of ceilingSpikes) s.locked = false;
  }
}

// Click to toggle lock on a spike
function mousePressed() {
  // Click the triangle to toggle its lock state
  for (let i = ceilingSpikes.length - 1; i >= 0; i--) {
    const s = ceilingSpikes[i];
    const ax = s.x,
      ay = 0;
    const bx = s.x + s.w,
      by = 0;
    const cx = s.x + s.w / 2,
      cy = s.h;

    if (pointInTriangle(mouseX, mouseY, ax, ay, bx, by, cx, cy)) {
      s.locked = !s.locked;
      break;
    }
  }
}
