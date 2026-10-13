// Procedural pixel art helpers and sprites. Nothing is loaded from disk: every sprite is
// drawn once into a tiny offscreen canvas at start-up.

export type Neon = "pink" | "cyan" | "amber" | "violet" | "green" | "red"

export const INK = "#07051a"

export const NEON: Record<Neon, { main: string; light: string; dim: string }> = {
  pink: { main: "#ff2e97", light: "#ffb3dc", dim: "#4a1a4a" },
  cyan: { main: "#19f0ff", light: "#bffaff", dim: "#154a62" },
  amber: { main: "#ffb347", light: "#ffe2b0", dim: "#4f3a2a" },
  violet: { main: "#8b5cf6", light: "#d2bfff", dim: "#33295f" },
  green: { main: "#4dff9a", light: "#c4ffdf", dim: "#1c4a45" },
  red: { main: "#ff4d5e", light: "#ffc0c6", dim: "#4d1c3a" },
}

export type Ctx = CanvasRenderingContext2D

export function newCanvas(w: number, h: number) {
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")!
  ctx.imageSmoothingEnabled = false
  return { c, ctx }
}

export function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** Bresenham line made of 1px squares. */
export function line(ctx: Ctx, color: string, x0: number, y0: number, x1: number, y1: number) {
  ctx.fillStyle = color
  let x = Math.round(x0)
  let y = Math.round(y0)
  const ex = Math.round(x1)
  const ey = Math.round(y1)
  const dx = Math.abs(ex - x)
  const dy = -Math.abs(ey - y)
  const sx = x < ex ? 1 : -1
  const sy = y < ey ? 1 : -1
  let err = dx + dy
  for (let i = 0; i < 4000; i++) {
    ctx.fillRect(x, y, 1, 1)
    if (x === ex && y === ey) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Filled pixel ellipse. */
export function ellipse(ctx: Ctx, color: string, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = color
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) <= 1) {
        ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
      }
    }
  }
}

/** Small deterministic PRNG (mulberry32) so the street looks the same every visit. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Build a sprite from a string grid; each character indexes the palette, "." is clear. */
export function fromGrid(rows: string[], pal: Record<string, string>) {
  const { c, ctx } = newCanvas(rows[0].length, rows.length)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]]
      if (col) px(ctx, col, x, y)
    }
  })
  return c
}

/** Adds a 1px outline around the opaque pixels (canvas grows by 2px each way). */
export function outline(src: HTMLCanvasElement, color: string) {
  const w = src.width
  const h = src.height
  const { c, ctx } = newCanvas(w + 2, h + 2)
  const data = src.getContext("2d")!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 0
  ctx.fillStyle = color
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (
        !solid(x, y) &&
        (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))
      ) {
        ctx.fillRect(x + 1, y + 1, 1, 1)
      }
    }
  }
  ctx.drawImage(src, 1, 1)
  return c
}

export function flipX(src: HTMLCanvasElement) {
  const { c, ctx } = newCanvas(src.width, src.height)
  ctx.translate(src.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(src, 0, 0)
  return c
}

/* ------------------------------------------------------------------------------------ */
/* Player                                                                               */
/* ------------------------------------------------------------------------------------ */

export type Dir = "down" | "up" | "left" | "right"

const HAIR = "#2b1b5e"
const HAIR_HI = "#ff2e97"
const SKIN = "#ffd5b5"
const JACKET = "#19c9e6"
const JACKET_DK = "#0f8aa8"
const PANTS = "#3b2d7a"
const SHOES = "#ff2e97"
const EYE = "#1a0f3a"

function drawLegs(ctx: Ctx, frame: number, side: boolean) {
  // frames: 0 contact, 1 passing, 2 contact (other foot), 3 passing
  const raise = [0, 1, 0, 0]
  const raiseR = [0, 0, 0, 1]
  const lRaise = raise[frame]
  const rRaise = raiseR[frame]
  if (side) {
    const o = frame === 0 ? 1 : frame === 2 ? -1 : 0
    px(ctx, PANTS, 5 + o, 12, 2, 3 - lRaise)
    px(ctx, SHOES, 5 + o, 15 - lRaise, 3, 1)
    px(ctx, PANTS, 6 - o, 12, 2, 3 - rRaise)
    px(ctx, SHOES, 6 - o, 15 - rRaise, 3, 1)
    return
  }
  px(ctx, PANTS, 4, 12, 2, 3 - lRaise)
  px(ctx, SHOES, 4, 15 - lRaise, 2, 1)
  px(ctx, PANTS, 6, 12, 2, 3 - rRaise)
  px(ctx, SHOES, 6, 15 - rRaise, 2, 1)
}

function drawPlayerFrame(dir: Exclude<Dir, "right">, frame: number) {
  const { c, ctx } = newCanvas(12, 16)
  const bob = frame === 1 || frame === 3 ? -1 : 0
  drawLegs(ctx, frame, dir === "left")
  ctx.save()
  ctx.translate(0, bob)
  if (dir === "left") {
    // torso (side)
    px(ctx, JACKET, 3, 8, 6, 4)
    px(ctx, JACKET_DK, 3, 11, 6, 1)
    px(ctx, HAIR_HI, 3, 11, 6, 1)
    const swing = frame === 0 ? -1 : frame === 2 ? 1 : 0
    px(ctx, JACKET_DK, 5 + swing, 9, 2, 3)
    px(ctx, SKIN, 5 + swing, 12, 2, 1)
    // head
    px(ctx, SKIN, 2, 3, 7, 5)
    px(ctx, HAIR, 3, 1, 7, 3)
    px(ctx, HAIR, 6, 3, 4, 5)
    px(ctx, HAIR, 2, 2, 2, 1)
    px(ctx, HAIR_HI, 8, 2, 1, 1)
    px(ctx, EYE, 3, 5, 1, 2)
    px(ctx, "#ff8fb8", 2, 7, 1, 1)
  } else if (dir === "up") {
    px(ctx, JACKET, 3, 8, 6, 4)
    px(ctx, JACKET_DK, 2, 9, 1, 3)
    px(ctx, JACKET_DK, 9, 9, 1, 3)
    px(ctx, SKIN, 2, 12, 1, 1)
    px(ctx, SKIN, 9, 12, 1, 1)
    px(ctx, HAIR_HI, 3, 11, 6, 1)
    px(ctx, HAIR, 2, 1, 8, 7)
    px(ctx, HAIR, 3, 0, 6, 1)
    px(ctx, HAIR_HI, 5, 3, 2, 1)
    px(ctx, SKIN, 3, 8, 6, 0)
  } else {
    // down
    px(ctx, JACKET, 3, 8, 6, 4)
    px(ctx, HAIR_HI, 3, 11, 6, 1)
    px(ctx, "#ffffff", 5, 8, 2, 1)
    const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0
    px(ctx, JACKET_DK, 2, 9 + Math.max(0, swing), 1, 3)
    px(ctx, JACKET_DK, 9, 9 + Math.max(0, -swing), 1, 3)
    px(ctx, SKIN, 2, 12 + Math.max(0, swing), 1, 1)
    px(ctx, SKIN, 9, 12 + Math.max(0, -swing), 1, 1)
    px(ctx, SKIN, 3, 3, 6, 5)
    px(ctx, HAIR, 3, 0, 6, 1)
    px(ctx, HAIR, 2, 1, 8, 2)
    px(ctx, HAIR, 2, 3, 1, 3)
    px(ctx, HAIR, 9, 3, 1, 3)
    px(ctx, HAIR, 3, 3, 2, 1)
    px(ctx, HAIR, 7, 3, 2, 1)
    px(ctx, HAIR_HI, 8, 1, 1, 1)
    px(ctx, EYE, 4, 5, 1, 2)
    px(ctx, EYE, 7, 5, 1, 2)
    px(ctx, "#ff8fb8", 3, 7, 1, 1)
    px(ctx, "#ff8fb8", 8, 7, 1, 1)
  }
  ctx.restore()
  return outline(c, INK)
}

export function makePlayerFrames(): Record<Dir, HTMLCanvasElement[]> {
  const make = (d: Exclude<Dir, "right">) => [0, 1, 2, 3].map((f) => drawPlayerFrame(d, f))
  const left = make("left")
  return { down: make("down"), up: make("up"), left, right: left.map(flipX) }
}

/* ------------------------------------------------------------------------------------ */
/* Props                                                                                */
/* ------------------------------------------------------------------------------------ */

export type PropKind =
  | "vending"
  | "vendingB"
  | "bike"
  | "bikeB"
  | "lamp"
  | "bin"
  | "plant"
  | "cat"
  | "crate"
  | "cabinet"
  | "cabinetB"
  | "cabinetC"
  | "pole"
  | "yatai"
  | "torii"
  | "tree"
  | "stoneLamp"
  | "scooter"

export type Glow = { x: number; y: number; w: number; h: number; color: string; alpha: number }
export type PropSprite = { canvas: HTMLCanvasElement; glow?: Glow[] }

function vending(body: string, accent: string): PropSprite {
  const { c, ctx } = newCanvas(16, 28)
  px(ctx, body, 1, 1, 14, 26)
  px(ctx, accent, 1, 1, 14, 1)
  px(ctx, "#ffffff22", 1, 1, 1, 26)
  px(ctx, "#00000044", 14, 1, 1, 26)
  px(ctx, "#0a0720", 2, 3, 12, 12)
  const cans = ["#ff2e97", "#19f0ff", "#ffb347", "#4dff9a", "#e9e4ff"]
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 4; k++) {
      px(ctx, cans[(r * 2 + k) % cans.length], 3 + k * 3, 4 + r * 4, 2, 3)
      px(ctx, "#ffffff88", 3 + k * 3, 4 + r * 4, 1, 1)
    }
  }
  px(ctx, "#05030f", 2, 17, 12, 3)
  for (let k = 0; k < 4; k++) px(ctx, k === 1 ? "#ff2e97" : "#e9e4ff", 3 + k * 2, 18, 1, 1)
  px(ctx, "#ffb347", 12, 18, 1, 1)
  px(ctx, "#05030f", 3, 22, 10, 3)
  px(ctx, "#2a2060", 3, 22, 10, 1)
  px(ctx, "#00000066", 1, 26, 14, 1)
  return {
    canvas: outline(c, INK),
    glow: [{ x: 3, y: 4, w: 12, h: 12, color: "#fff0d8", alpha: 0.55 }],
  }
}

function bike(frame: string, basket: boolean): PropSprite {
  const { c, ctx } = newCanvas(22, 13)
  const wheel = (cx: number) => {
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const d = Math.sqrt(x * x + y * y)
        if (d <= 4.2 && d >= 3.1) px(ctx, "#2a2160", cx + x, 8 + y)
      }
    }
    px(ctx, "#6a5acd", cx, 8)
    line(ctx, "#4a3d9a", cx - 3, 8, cx + 3, 8)
    line(ctx, "#4a3d9a", cx, 5, cx, 11)
  }
  wheel(5)
  wheel(17)
  line(ctx, frame, 5, 8, 10, 4)
  line(ctx, frame, 10, 4, 15, 8)
  line(ctx, frame, 10, 4, 17, 8)
  line(ctx, frame, 5, 8, 10, 8)
  line(ctx, frame, 10, 8, 15, 8)
  px(ctx, frame, 14, 3, 4, 1)
  px(ctx, "#e9e4ff", 9, 2, 3, 1)
  if (basket) {
    px(ctx, "#a06a3c", 17, 4, 4, 3)
    px(ctx, "#6b4424", 17, 4, 4, 1)
  }
  return { canvas: outline(c, INK) }
}

function lamp(): PropSprite {
  const { c, ctx } = newCanvas(14, 40)
  px(ctx, "#2a2060", 6, 8, 2, 31)
  px(ctx, "#3b2f80", 5, 36, 4, 3)
  px(ctx, "#2a2060", 4, 5, 8, 3)
  px(ctx, "#ffe2b0", 3, 2, 9, 4)
  px(ctx, "#ffb347", 4, 5, 7, 1)
  px(ctx, "#ffffff", 5, 3, 5, 1)
  return { canvas: outline(c, INK), glow: [{ x: 4, y: 3, w: 9, h: 4, color: "#ffc977", alpha: 1 }] }
}

function bin(): PropSprite {
  const { c, ctx } = newCanvas(9, 11)
  px(ctx, "#33a49a", 1, 2, 7, 8)
  px(ctx, "#1f6f6a", 1, 2, 1, 8)
  px(ctx, "#4dd6c8", 0, 1, 9, 2)
  px(ctx, "#0f3d3c", 3, 5, 3, 1)
  px(ctx, "#0f3d3c", 3, 7, 3, 1)
  return { canvas: outline(c, INK) }
}

function plant(): PropSprite {
  const { c, ctx } = newCanvas(11, 16)
  px(ctx, "#b4452f", 2, 10, 7, 5)
  px(ctx, "#7c2c20", 2, 14, 7, 1)
  px(ctx, "#d6603f", 1, 9, 9, 2)
  px(ctx, "#2f9e5a", 3, 5, 5, 4)
  px(ctx, "#4dd67e", 1, 3, 4, 4)
  px(ctx, "#4dd67e", 6, 2, 4, 4)
  px(ctx, "#8bffb0", 4, 0, 3, 4)
  px(ctx, "#ff8fb8", 2, 3, 1, 1)
  px(ctx, "#ff8fb8", 8, 3, 1, 1)
  return { canvas: outline(c, INK) }
}

function cat(): PropSprite {
  const pal = { k: "#1b1440", g: "#f0ede6", o: "#ffb347", e: "#4dff9a", p: "#ff8fb8", ".": "" }
  const c = fromGrid(
    [
      "..k.k.....",
      ".kkkkk....",
      ".kgkgk....",
      ".keken....",
      ".kkpkk.kk.",
      "..kkkkkokk",
      ".kkkkkkkk.",
      ".kkkkkkkk.",
    ],
    { ...pal, n: "#1b1440" }
  )
  return { canvas: outline(c, INK) }
}

function crate(): PropSprite {
  const { c, ctx } = newCanvas(16, 13)
  px(ctx, "#8a5a32", 0, 4, 10, 8)
  px(ctx, "#b27c47", 0, 4, 10, 1)
  line(ctx, "#5e3b1f", 0, 4, 9, 11)
  px(ctx, "#a06a3c", 6, 0, 9, 8)
  px(ctx, "#c98f55", 6, 0, 9, 1)
  px(ctx, "#5e3b1f", 6, 4, 9, 1)
  px(ctx, "#ff4d5e", 9, 1, 3, 3)
  px(ctx, "#ffffff", 10, 2, 1, 1)
  px(ctx, "#a06a3c", 3, 9, 12, 3)
  return { canvas: outline(c, INK) }
}

function cabinet(screen: string, body: string): PropSprite {
  const { c, ctx } = newCanvas(14, 28)
  px(ctx, body, 1, 4, 12, 23)
  px(ctx, "#ffffff22", 1, 4, 1, 23)
  px(ctx, screen, 2, 0, 10, 4)
  px(ctx, "#ffffff", 3, 1, 8, 1)
  px(ctx, "#05030f", 3, 6, 8, 8)
  px(ctx, screen, 4, 7, 6, 6)
  px(ctx, "#05030f", 5, 8, 1, 1)
  px(ctx, "#05030f", 8, 10, 2, 1)
  px(ctx, "#ffffff", 6, 11, 1, 1)
  px(ctx, "#15102f", 2, 16, 10, 4)
  px(ctx, "#ffb347", 4, 17, 1, 1)
  px(ctx, "#e9e4ff", 4, 18, 1, 2)
  px(ctx, "#ff2e97", 8, 17, 2, 2)
  px(ctx, "#19f0ff", 10, 18, 2, 1)
  px(ctx, "#0b0820", 2, 21, 10, 5)
  return {
    canvas: outline(c, INK),
    glow: [
      { x: 4, y: 7, w: 8, h: 8, color: screen, alpha: 0.9 },
      { x: 3, y: 1, w: 10, h: 4, color: screen, alpha: 0.9 },
    ],
  }
}

function pole(): PropSprite {
  const { c, ctx } = newCanvas(22, 52)
  px(ctx, "#2f2565", 10, 4, 3, 46)
  px(ctx, "#3d3180", 10, 4, 1, 46)
  px(ctx, "#3d3180", 8, 48, 7, 3)
  px(ctx, "#2f2565", 2, 6, 19, 2)
  px(ctx, "#2f2565", 5, 12, 13, 2)
  for (const x of [3, 7, 15, 19]) px(ctx, "#e9e4ff", x, 4, 2, 2)
  for (const x of [6, 16]) px(ctx, "#e9e4ff", x, 10, 2, 2)
  px(ctx, "#4a4a68", 13, 20, 5, 9)
  px(ctx, "#6f6f95", 13, 20, 5, 1)
  px(ctx, "#ffb347", 4, 28, 4, 3)
  px(ctx, "#ffffff", 5, 29, 2, 1)
  return { canvas: outline(c, INK) }
}

function stoneLamp(): PropSprite {
  const { c, ctx } = newCanvas(12, 24)
  px(ctx, "#6a6a8a", 1, 0, 10, 3)
  px(ctx, "#8d8db0", 2, 0, 8, 1)
  px(ctx, "#55557a", 2, 3, 8, 8)
  px(ctx, "#ffb347", 4, 5, 4, 4)
  px(ctx, "#ffe2b0", 5, 6, 2, 2)
  px(ctx, "#6a6a8a", 1, 11, 10, 2)
  px(ctx, "#55557a", 4, 13, 4, 7)
  px(ctx, "#6a6a8a", 2, 20, 8, 3)
  return { canvas: outline(c, INK), glow: [{ x: 5, y: 6, w: 4, h: 4, color: "#ffb347", alpha: 1 }] }
}

function scooter(): PropSprite {
  const { c, ctx } = newCanvas(24, 16)
  const wheel = (cx: number) => {
    ellipse(ctx, "#1a1440", cx, 12, 3, 3)
    px(ctx, "#6a5acd", cx, 12)
  }
  wheel(5)
  wheel(19)
  px(ctx, "#ff2e97", 5, 6, 12, 5)
  px(ctx, "#ff77bd", 6, 6, 10, 1)
  px(ctx, "#c91f73", 5, 10, 12, 1)
  px(ctx, "#e9e4ff", 8, 3, 6, 3)
  px(ctx, "#2a2060", 8, 5, 6, 1)
  px(ctx, "#2a2060", 18, 1, 4, 1)
  line(ctx, "#8478b8", 19, 2, 19, 8)
  px(ctx, "#ffe2b0", 21, 5, 2, 2)
  return {
    canvas: outline(c, INK),
    glow: [{ x: 22, y: 6, w: 2, h: 2, color: "#ffe2b0", alpha: 1 }],
  }
}

function torii(): PropSprite {
  const W = 84
  const { c, ctx } = newCanvas(W, 66)
  const red = "#ff4d5e"
  const dark = "#b02446"
  const black = "#16102e"
  // upper beam (kasagi) with upturned ends
  px(ctx, black, 0, 4, W, 3)
  px(ctx, black, 2, 2, W - 4, 2)
  px(ctx, black, 0, 2, 3, 2)
  px(ctx, black, W - 3, 2, 3, 2)
  px(ctx, red, 3, 7, W - 6, 4)
  px(ctx, "#ff8a96", 3, 7, W - 6, 1)
  px(ctx, dark, 3, 10, W - 6, 1)
  // pillars
  for (const x of [10, W - 18]) {
    px(ctx, red, x, 11, 8, 54)
    px(ctx, "#ff8a96", x, 11, 1, 54)
    px(ctx, dark, x + 7, 11, 1, 54)
    px(ctx, black, x - 1, 60, 10, 6)
    px(ctx, "#2b2158", x - 1, 61, 10, 1)
  }
  // lower beam (nuki)
  px(ctx, red, 10, 24, W - 20, 4)
  px(ctx, dark, 10, 27, W - 20, 1)
  px(ctx, black, 33, 14, 18, 10)
  px(ctx, "#ffb347", 34, 15, 16, 8)
  px(ctx, black, 38, 17, 8, 1)
  px(ctx, black, 41, 17, 2, 5)
  return {
    canvas: outline(c, INK),
    glow: [{ x: 35, y: 16, w: 16, h: 8, color: "#ffb347", alpha: 0.6 }],
  }
}

function tree(): PropSprite {
  const { c, ctx } = newCanvas(52, 56)
  px(ctx, "#4b2f45", 23, 28, 6, 26)
  px(ctx, "#2f1c2f", 26, 28, 3, 26)
  line(ctx, "#4b2f45", 25, 34, 14, 24)
  line(ctx, "#4b2f45", 26, 32, 38, 22)
  const r = rng(7)
  const cols = ["#ff8fc8", "#ffb3dc", "#ff5fb0", "#ffd6ec", "#e84a9c"]
  const blobs = [
    [26, 14, 20, 12],
    [14, 22, 12, 9],
    [38, 22, 12, 9],
    [26, 26, 14, 8],
  ]
  for (const [cx, cy, rx, ry] of blobs) {
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r())
      px(
        ctx,
        cols[Math.floor(r() * cols.length)],
        Math.round(cx + Math.cos(a) * rx * d),
        Math.round(cy + Math.sin(a) * ry * d),
        2,
        2
      )
    }
  }
  return { canvas: outline(c, INK) }
}

/** Ramen cart (yatai). The lantern text is drawn with the loaded pixel font. */
function yatai(): PropSprite {
  const { c, ctx } = newCanvas(66, 40)
  px(ctx, "#5b3a22", 4, 18, 58, 18)
  px(ctx, "#7c5230", 4, 18, 58, 2)
  px(ctx, "#3c2515", 4, 34, 58, 2)
  px(ctx, "#2a2060", 8, 36, 4, 4)
  px(ctx, "#2a2060", 54, 36, 4, 4)
  // counter and bowls
  px(ctx, "#e9e4ff", 8, 15, 50, 3)
  for (const x of [14, 28, 42]) {
    px(ctx, "#ff4d5e", x, 12, 8, 3)
    px(ctx, "#ffb347", x + 1, 11, 6, 1)
  }
  // roof
  px(ctx, "#8a1e3d", 0, 2, 66, 8)
  for (let x = 0; x < 66; x += 6) {
    px(ctx, "#ff4d5e", x, 2, 3, 8)
    px(ctx, "#ffd6ec", x + 3, 2, 3, 8)
    px(ctx, "#ffd6ec", x + 3, 10, 3, 2)
    px(ctx, "#ff4d5e", x, 10, 3, 2)
  }
  px(ctx, "#4a1230", 0, 10, 66, 1)
  // noren with gaps
  for (const x of [10, 30, 50]) {
    px(ctx, "#1f2f7a", x, 18, 6, 12)
    px(ctx, "#e9e4ff", x + 2, 21, 2, 4)
  }
  // lanterns
  for (const x of [-2, 62]) {
    ellipse(ctx, "#ff4d5e", x + 4, 22, 3, 5)
    px(ctx, "#ffd6ec", x + 3, 20, 2, 5)
  }
  return {
    canvas: outline(c, INK),
    glow: [
      { x: 14, y: 12, w: 50, h: 3, color: "#ffb347", alpha: 0.7 },
      { x: 11, y: 22, w: 8, h: 8, color: "#ff4d5e", alpha: 0.7 },
      { x: 63, y: 22, w: 8, h: 8, color: "#ff4d5e", alpha: 0.7 },
    ],
  }
}

export function makePropSprites(): Record<PropKind, PropSprite> {
  return {
    vending: vending("#9b1d58", "#ff77bd"),
    vendingB: vending("#1d4f9b", "#7fd6ff"),
    bike: bike("#19f0ff", true),
    bikeB: bike("#ff2e97", false),
    lamp: lamp(),
    bin: bin(),
    plant: plant(),
    cat: cat(),
    crate: crate(),
    cabinet: cabinet("#ff2e97", "#3a2480"),
    cabinetB: cabinet("#19f0ff", "#2a2a7a"),
    cabinetC: cabinet("#ffb347", "#4a2470"),
    pole: pole(),
    yatai: yatai(),
    torii: torii(),
    tree: tree(),
    stoneLamp: stoneLamp(),
    scooter: scooter(),
  }
}

/** Small hanging paper lantern (chochin); pass the colour so shops can vary. */
export function makeLantern(color: string, light: string) {
  const { c, ctx } = newCanvas(9, 13)
  px(ctx, "#1b1440", 3, 0, 3, 2)
  px(ctx, "#1b1440", 2, 2, 5, 1)
  ellipse(ctx, color, 4, 7, 4, 4)
  px(ctx, light, 3, 5, 2, 4)
  for (const y of [5, 7, 9]) px(ctx, "#00000033", 1, y, 7, 1)
  px(ctx, "#1b1440", 2, 11, 5, 1)
  px(ctx, "#1b1440", 4, 12, 1, 1)
  return c
}
