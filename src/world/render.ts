// Rendering: static layers are painted once into world-sized offscreen canvases; each frame
// only blits the camera window and draws the dynamic bits (signs, player, lanterns, rain...).

import {
  ALLEY_L,
  ALLEY_R,
  BASE_ROWS,
  COURT_L,
  COURT_R,
  PLAZA_L,
  PLAZA_R,
  SHOP_ROWS,
  SKY_ROWS,
  STREET_ROWS,
  TAIL_COURT,
  TAIL_NARROW,
  TILE,
  shopRow,
  streetRow,
  type Prop,
  type Station,
  type World,
} from "./world"
import {
  INK,
  NEON,
  ellipse,
  line,
  makeLantern,
  makePlayerFrames,
  makePropSprites,
  newCanvas,
  px,
  rng,
  type Ctx,
  type Dir,
  type PropSprite,
} from "./sprites"

const FONT = '"DotGothic16", "Hiragino Sans", "Yu Gothic", sans-serif'

/* ------------------------------------------------------------------------------------ */
/* Fonts                                                                                */
/* ------------------------------------------------------------------------------------ */

export function signLines(st: Station): [string, string] {
  return st.kind === "soon" ? ["COMING SOON", st.en] : [st.jp, st.en]
}

/** Resolve once the sign font (and the glyphs we need) is ready, or after a short timeout. */
export async function ensureFonts(stations: Station[]) {
  if (!("fonts" in document)) return
  const text =
    stations.map((s) => signLines(s).join("") + s.jp).join("") +
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789"
  const load = Promise.all([
    document.fonts.load(`10px ${FONT}`, text),
    document.fonts.load(`8px ${FONT}`, text),
  ]).catch(() => undefined)
  await Promise.race([load, new Promise((r) => setTimeout(r, 2500))])
}

/* ------------------------------------------------------------------------------------ */
/* Signs                                                                                */
/* ------------------------------------------------------------------------------------ */

function fitText(ctx: Ctx, text: string, cx: number, cy: number, maxW: number, size: number) {
  let s = size
  ctx.font = `${s}px ${FONT}`
  while (s > 5 && ctx.measureText(text).width > maxW) {
    s -= 1
    ctx.font = `${s}px ${FONT}`
  }
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, cx, cy)
}

/** Enterable games get the full neon palette; everything else is cooler and quieter. */
function signPalette(st: Station, lit: boolean) {
  const n = NEON[st.neon]
  if (st.kind === "game") {
    return lit
      ? { border: n.main, a: n.light, b: n.main, glow: n.main }
      : { border: n.dim, a: "#4a4180", b: "#3a3270", glow: "" }
  }
  if (st.kind === "soon") {
    return lit
      ? { border: "#6d62a8", a: "#b4abe0", b: "#8a80c4", glow: "" }
      : { border: "#2c2656", a: "#3a3270", b: "#2f2960", glow: "" }
  }
  return lit
    ? { border: "#4d4a80", a: "#8a88b8", b: "#6c6a9c", glow: "" }
    : { border: "#2c2a52", a: "#3a3868", b: "#2f2d58", glow: "" }
}

function makeSignCanvas(st: Station, lit: boolean) {
  const W = 88
  const H = 24
  const { c, ctx } = newCanvas(W, H)
  const pal = signPalette(st, lit)
  px(ctx, INK, 0, 0, W, H)
  px(ctx, "#0e0830", 1, 1, W - 2, H - 2)
  px(ctx, pal.border, 1, 0, W - 2, 1)
  px(ctx, pal.border, 1, H - 1, W - 2, 1)
  px(ctx, pal.border, 0, 1, 1, H - 2)
  px(ctx, pal.border, W - 1, 1, 1, H - 2)
  if (lit && st.kind === "game") {
    px(ctx, pal.a, 2, 1, W - 4, 1)
    px(ctx, `${pal.b}66`, 2, H - 2, W - 4, 1)
    // second inner line makes the enterable signs read as "double neon"
    px(ctx, `${pal.border}88`, 3, 3, W - 6, 1)
    px(ctx, `${pal.border}88`, 3, H - 4, W - 6, 1)
  }
  const [a, b] = signLines(st)
  if (pal.glow) {
    ctx.shadowColor = pal.glow
    ctx.shadowBlur = 2
  }
  ctx.fillStyle = pal.a
  fitText(ctx, a, W / 2, 9, W - 10, 10)
  ctx.fillStyle = pal.b
  if (pal.glow) ctx.shadowBlur = 1
  fitText(ctx, b, W / 2, 17, W - 10, 8)
  return c
}

function makeVerticalSign(st: Station, lit: boolean) {
  const chars = Array.from(st.jp).slice(0, 5)
  const W = 11
  const H = chars.length * 9 + 4
  const { c, ctx } = newCanvas(W, H)
  const pal = signPalette(st, lit)
  px(ctx, INK, 0, 0, W, H)
  px(ctx, "#0e0830", 1, 1, W - 2, H - 2)
  px(ctx, pal.border, 1, 0, W - 2, 1)
  px(ctx, pal.border, 1, H - 1, W - 2, 1)
  px(ctx, pal.border, 0, 1, 1, H - 2)
  px(ctx, pal.border, W - 1, 1, 1, H - 2)
  if (pal.glow) {
    ctx.shadowColor = pal.glow
    ctx.shadowBlur = 3
  }
  ctx.fillStyle = pal.a
  chars.forEach((ch, i) => fitText(ctx, ch, W / 2, 7 + i * 9, 9, 8))
  return c
}

type SignSprite = {
  x: number
  y: number
  lit: HTMLCanvasElement
  dim: HTMLCanvasElement
  st: Station
  phase: number
  vertical: boolean
}

/* ------------------------------------------------------------------------------------ */
/* Static layers                                                                        */
/* ------------------------------------------------------------------------------------ */

type Layers = {
  ground: HTMLCanvasElement
  buildings: HTMLCanvasElement
  overlay: HTMLCanvasElement
  glow: HTMLCanvasElement
}

function paverTile(
  ctx: Ctx,
  x: number,
  y: number,
  base: string,
  alt: string,
  grout: string,
  r: () => number
) {
  px(ctx, ((x / TILE + y / TILE) & 1) === 0 ? base : alt, x, y, TILE, TILE)
  px(ctx, grout, x, y + TILE - 1, TILE, 1)
  px(ctx, grout, x + TILE - 1, y, 1, TILE)
  px(ctx, "#ffffff10", x, y, TILE - 1, 1)
  for (let i = 0; i < 4; i++)
    px(
      ctx,
      r() > 0.5 ? "#00000026" : "#ffffff0d",
      x + Math.floor(r() * 14),
      y + Math.floor(r() * 14)
    )
}

function drawSkyline(ctx: Ctx, width: number) {
  const bottom = SKY_ROWS * TILE
  const g = ctx.createLinearGradient(0, 0, 0, bottom)
  g.addColorStop(0, "#04030f")
  g.addColorStop(0.7, "#1a0f45")
  g.addColorStop(1, "#3a1860")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, bottom)
  const r = rng(11)
  for (let i = 0; i < 70; i++)
    px(ctx, r() > 0.5 ? "#e9e4ff66" : "#ffffff33", Math.floor(r() * width), Math.floor(r() * 22))
  const towers = (color: string, minH: number, maxH: number) => {
    let x = -4
    while (x < width) {
      const w = 10 + Math.floor(r() * 14)
      const h = minH + Math.floor(r() * (maxH - minH))
      px(ctx, color, x, bottom - h, w, h)
      px(ctx, "#ffffff10", x, bottom - h, w, 1)
      for (let k = 0; k < w * h * 0.015; k++) {
        const c = ["#ffb34766", "#19f0ff55", "#ff2e9755", "#ffe2b066"][Math.floor(r() * 4)]
        px(
          ctx,
          c,
          x + 1 + Math.floor(r() * (w - 2)),
          bottom - h + 2 + Math.floor(r() * (h - 4)),
          1,
          1
        )
      }
      x += w + Math.floor(r() * 3)
    }
  }
  towers("#150b3d", 22, 40)
  towers("#0d0728", 10, 26)
  ellipse(ctx, "#ffe2b0", 760, 14, 6, 6)
  ellipse(ctx, "#1a0f45", 763, 12, 5, 5)
}

type Surface = "pave" | "asphalt" | "stone" | "court"

/** What the walkable tile at (col,row) is made of. Blocked tiles are scenery, drawn elsewhere. */
function surfaceAt(world: World, col: number, row: number): Surface {
  const inAlley = col >= ALLEY_L && col <= ALLEY_R
  for (let t = 0; t < world.tiers; t++) {
    const s = streetRow(world.tiers, t)
    if (row >= s && row < s + STREET_ROWS) {
      if (inAlley) return "asphalt"
      return row - s < 2 ? "pave" : "asphalt"
    }
  }
  const topShop = shopRow(world.tiers, world.tiers - 1)
  if (row >= topShop && row < topShop + SHOP_ROWS && col >= PLAZA_L && col <= PLAZA_R && !inAlley)
    return "stone"
  if (row >= world.rows - BASE_ROWS - TAIL_COURT && col >= COURT_L && col <= COURT_R) return "court"
  return "asphalt"
}

function drawGround(ctx: Ctx, world: World) {
  const r = rng(3)
  const { w: W, h: H, cols, rows, tiers } = world
  // Scenery and blocked areas stay very dark; walkable surfaces are clearly lighter.
  px(ctx, "#0a0720", 0, 0, W, H)
  drawSkyline(ctx, W)

  for (let row = SKY_ROWS; row < rows - BASE_ROWS; row++) {
    for (let col = 0; col < cols; col++) {
      if (world.void_[row * cols + col]) continue
      const x = col * TILE
      const y = row * TILE
      const k = surfaceAt(world, col, row)
      if (k === "pave") paverTile(ctx, x, y, "#3a2f86", "#3e3390", "#2a2068", r)
      else if (k === "stone") paverTile(ctx, x, y, "#4a3f8c", "#4f4494", "#322868", r)
      else if (k === "court") paverTile(ctx, x, y, "#372c80", "#3b3086", "#281f62", r)
      else {
        px(ctx, "#2b2166", x, y, TILE, TILE)
        for (let i = 0; i < 10; i++)
          px(
            ctx,
            r() > 0.5 ? "#342a74" : "#231a58",
            x + Math.floor(r() * 16),
            y + Math.floor(r() * 16)
          )
      }
      // wet sheen
      if (r() > 0.55)
        px(
          ctx,
          "#ffffff14",
          x + Math.floor(r() * 8),
          y + Math.floor(r() * 16),
          5 + Math.floor(r() * 5),
          1
        )
    }
  }

  // light edge wherever walkable ground meets a wall or prop, so boundaries are visible
  for (let row = SKY_ROWS; row < rows - BASE_ROWS; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (world.solid[row * cols + col]) continue
      if (world.solid[(row - 1) * cols + col]) px(ctx, "#9d8cf0", col * TILE, row * TILE, TILE, 1)
      if (world.solid[row * cols + col - 1]) px(ctx, "#6a5cc0", col * TILE, row * TILE, 1, TILE)
      if (world.solid[row * cols + col + 1])
        px(ctx, "#6a5cc0", col * TILE + 15, row * TILE, 1, TILE)
    }
  }

  // lane markings: alley centre line and street edges
  for (let y = SKY_ROWS * TILE + 4; y < H - BASE_ROWS * TILE - 8; y += 28) {
    const row = Math.floor(y / TILE)
    if (world.solid[row * cols + ALLEY_L]) continue
    if (surfaceAt(world, ALLEY_L, row) === "asphalt" && row < rows - BASE_ROWS - TAIL_COURT)
      px(ctx, "#e8c86acc", 30 * TILE - 1, y, 2, 14)
  }
  for (let t = 0; t < tiers; t++) {
    const s = streetRow(tiers, t)
    px(ctx, "#a597f0", TILE, (s + 2) * TILE - 1, (cols - 2) * TILE, 1)
    px(ctx, "#0b0724", TILE, (s + 2) * TILE, (cols - 2) * TILE, 1)
    for (let x = 18; x < (cols - 1) * TILE; x += 28) {
      if (x > ALLEY_L * TILE - 14 && x < (ALLEY_R + 1) * TILE) continue
      if (t === tiers - 1 && x > PLAZA_L * TILE && x < (PLAZA_R + 1) * TILE) continue
      px(ctx, "#e8c86aaa", x, (s + 3) * TILE - 1, 14, 2)
    }
    // zebra crossing over the pavement where the alley meets the street
    for (let x = ALLEY_L * TILE + 3; x < (ALLEY_R + 1) * TILE - 3; x += 6)
      px(ctx, "#d8d0ff77", x, s * TILE + 3, 3, 26)
    // manhole
    ellipse(ctx, "#0b0724", 24 * TILE + 8, (s + 2) * TILE + 8, 6, 4)
    ellipse(ctx, "#3a3080", 24 * TILE + 8, (s + 2) * TILE + 8, 5, 3)
    line(ctx, "#150f33", 24 * TILE + 4, (s + 2) * TILE + 8, 24 * TILE + 12, (s + 2) * TILE + 8)
  }
  // plaza: stepping stones toward the torii
  const topShop = shopRow(tiers, tiers - 1)
  for (let y = (topShop + 1) * TILE; y < (topShop + SHOP_ROWS) * TILE; y += 12) {
    px(ctx, "#6a5cb4", 29 * TILE + 4, y, 8, 5)
    px(ctx, "#6a5cb4", 30 * TILE + 4, y + 6, 8, 5)
  }

  // Back wall at the foot of the forecourt
  const baseY = (rows - BASE_ROWS) * TILE
  px(ctx, "#150d38", 0, baseY, W, BASE_ROWS * TILE)
  for (let y = baseY; y < H; y += 8) {
    px(ctx, "#00000044", 0, y + 7, W, 1)
    for (let x = (y / 8) % 2 ? 0 : 8; x < W; x += 16) px(ctx, "#00000033", x, y, 1, 8)
  }
  px(ctx, "#2f2565", 0, baseY, W, 2)
  const posters = ["#6c6aa0", "#5a5a90", "#7a6aa8", "#58709a"]
  for (let x = 20; x < W - 20; x += 46 + Math.floor(r() * 30)) {
    px(ctx, "#8a88b8", x, baseY + 6, 10, 14)
    px(ctx, posters[Math.floor(r() * posters.length)], x + 1, baseY + 7, 8, 7)
  }
  for (const fx of [0, cols - 1]) {
    px(ctx, "#120d30", fx * TILE, SKY_ROWS * TILE, TILE, (rows - SKY_ROWS) * TILE)
    for (let y = SKY_ROWS * TILE; y < baseY; y += 4) px(ctx, "#2b2466", fx * TILE + 6, y, 3, 3)
  }

  // Puddles with a little sky in them
  for (const p of world.puddles) {
    ellipse(ctx, "#2d2290", p.x, p.y, p.rx, p.ry)
    ellipse(ctx, "#4a3cc0", p.x, p.y - 1, Math.max(2, p.rx - 3), Math.max(1, p.ry - 2))
    px(ctx, "#a58bff88", p.x - p.rx + 4, p.y - 1, Math.floor(p.rx * 0.8), 1)
  }

  // Wet-neon reflections under shops: strong for games, faint for scenery
  for (const st of world.stations) {
    const n = NEON[st.neon]
    const k = st.kind === "game" ? 0.3 : st.kind === "soon" ? 0.06 : 0.05
    const baseYr = st.y + st.h + 2
    for (let i = 0; i < 46; i += 2) {
      const a = Math.max(0, k * (1 - i / 46))
      for (let x = st.x + 6; x < st.x + st.w - 6; x += 2) {
        if (r() > 0.78) continue
        ctx.globalAlpha = a
        px(
          ctx,
          st.kind === "game" ? n.main : "#8a88c8",
          x + (i % 4 === 0 ? 1 : 0),
          baseYr + i,
          2,
          1
        )
      }
    }
    ctx.globalAlpha = 1
  }
}

type GlowAdd = (color: string, x: number, y: number, w: number, h: number, alpha: number) => void

const WALLS: [string, string][] = [
  ["#2c2066", "#241a58"],
  ["#341a58", "#2a1448"],
  ["#1d2a66", "#162258"],
  ["#2f1c5c", "#251652"],
]
const DECOR_WALL: [string, string] = ["#1f1f48", "#18183a"]
const WINDOW_LIGHTS = ["#ffcf86", "#ffb347", "#8fe9ff", "#ff9ccf", "#d9c8ff"]
const QUIET_LIGHTS = ["#6f7ba6", "#8a8fb8", "#7a7298"]

function drawShop(ctx: Ctx, st: Station, glow: GlowAdd) {
  const r = rng(st.index * 977 + 5)
  const { x, y, w, h } = st
  const n = NEON[st.neon]
  const soon = st.kind === "soon"
  const game = st.kind === "game"
  const wall = game ? WALLS[(st.index + st.slot) % WALLS.length] : DECOR_WALL

  // wall with clapboard lines and joints
  px(ctx, soon ? "#16123a" : wall[0], x, y, w, 56)
  px(ctx, soon ? "#110d2e" : wall[1], x, y + 56, w, h - 56)
  if (game) px(ctx, `${n.main}22`, x, y, w, h)
  for (let yy = y + 8; yy < y + h; yy += 6) {
    px(ctx, "#00000026", x, yy, w, 1)
    for (let xx = x + ((yy / 6) % 2 ? 4 : 10); xx < x + w; xx += 12)
      px(ctx, "#00000018", xx, yy - 5, 1, 5)
  }
  px(ctx, "#ffffff10", x, y, 1, h)
  px(ctx, "#00000055", x + w - 2, y, 2, h)

  // roof clutter above the cornice (top tier only: it hangs over open sky)
  if (st.topTier) {
    const k = r()
    if (k < 0.4) {
      px(ctx, "#8a85b8", x + 12, y - 9, 12, 8)
      px(ctx, "#b6b0dc", x + 12, y - 9, 12, 1)
      for (let i = 0; i < 4; i++) px(ctx, "#4a4678", x + 14 + i * 2, y - 7, 1, 5)
    } else if (k < 0.75) {
      px(ctx, "#5b3a22", x + 60, y - 14, 14, 10)
      px(ctx, "#3c2515", x + 60, y - 10, 14, 1)
      px(ctx, "#2a2060", x + 62, y - 4, 2, 4)
      px(ctx, "#2a2060", x + 70, y - 4, 2, 4)
      px(ctx, "#7c5230", x + 59, y - 16, 16, 2)
    } else {
      line(ctx, "#4a4678", x + 70, y, x + 70, y - 18)
      line(ctx, "#4a4678", x + 66, y - 14, x + 74, y - 14)
      line(ctx, "#4a4678", x + 67, y - 9, x + 73, y - 9)
      px(ctx, "#ff4d5e", x + 69, y - 20, 2, 2)
      glow("#ff4d5e", x + 68, y - 21, 4, 4, 0.8)
    }
  }

  // cornice
  px(ctx, "#3a2d82", x - 1, y, w + 2, 6)
  px(ctx, "#5b4cb0", x - 1, y, w + 2, 1)
  px(ctx, INK, x - 1, y + 5, w + 2, 1)
  px(ctx, "#00000066", x, y + 6, w, 2)

  // upper windows
  for (let k = 0; k < 3; k++) {
    const wx = x + 8 + k * 32
    const wy = y + 10
    const lit = !soon && r() > (game ? 0.15 : 0.6)
    const col = game
      ? WINDOW_LIGHTS[Math.floor(r() * WINDOW_LIGHTS.length)]
      : QUIET_LIGHTS[Math.floor(r() * QUIET_LIGHTS.length)]
    px(ctx, INK, wx - 1, wy - 1, 18, 19)
    px(ctx, lit ? col : "#0d0a2a", wx, wy, 16, 17)
    if (lit) {
      for (let yy = wy + 1; yy < wy + 17; yy += 3) px(ctx, "#00000022", wx, yy, 16, 1)
      const kind = r()
      if (kind < 0.35) {
        px(ctx, "#3b1f55", wx + 9, wy + 7, 4, 4)
        px(ctx, "#3b1f55", wx + 8, wy + 11, 6, 6)
      } else if (kind < 0.6) {
        px(ctx, "#2f9e5a", wx + 3, wy + 11, 4, 3)
        px(ctx, "#b4452f", wx + 3, wy + 14, 4, 3)
      }
      if (game) glow(col, wx, wy, 16, 17, 0.6)
    } else {
      px(ctx, "#ffffff0a", wx + 1, wy + 1, 5, 2)
    }
    px(ctx, INK, wx + 7, wy, 2, 17)
    px(ctx, INK, wx, wy + 8, 16, 1)
    px(ctx, "#4a3d9a", wx - 2, wy + 17, 20, 2)
    if (r() > 0.55) {
      px(ctx, "#8a85b8", wx + 2, wy + 19, 12, 5)
      px(ctx, "#b6b0dc", wx + 2, wy + 19, 12, 1)
      for (let i = 0; i < 4; i++) px(ctx, "#4a4678", wx + 4 + i * 2, wy + 21, 1, 3)
    }
  }

  // sign brackets (the sign itself is dynamic)
  px(ctx, INK, x + 5, y + 29, 3, 4)
  px(ctx, INK, x + w - 8, y + 29, 3, 4)

  // awning with scalloped edge
  const stripeA = game ? n.main : soon ? "#2a2458" : "#3a3a70"
  const stripeB = game ? "#f3ecff" : soon ? "#1e1946" : "#585890"
  px(ctx, INK, x - 3, y + 57, w + 6, 1)
  for (let i = 0, xx = x - 2; xx < x + w + 2; i++, xx += 6) {
    px(ctx, i % 2 ? stripeB : stripeA, xx, y + 58, 6, 8)
    px(ctx, i % 2 ? stripeB : stripeA, xx + 1, y + 66, 4, 2)
    px(ctx, "#00000033", xx, y + 58, 6, 1)
  }
  px(ctx, "#00000055", x, y + 70, w, 3)

  // shopfront
  px(ctx, "#0f0a26", x, y + 70, w, h - 70)
  const frontWin = (wx: number) => {
    px(ctx, INK, wx - 1, y + 75, 26, 28)
    px(ctx, soon ? "#120e30" : game ? "#4a2866" : "#262650", wx, y + 76, 24, 26)
    if (!soon) {
      px(ctx, game ? "#6a3a80" : "#33336a", wx, y + 76, 24, 6)
      // arcade cabinets or shelves inside
      if (st.kind === "game") {
        for (let i = 0; i < 2; i++) {
          const cx = wx + 3 + i * 11
          px(ctx, "#150c35", cx, y + 82, 9, 20)
          px(ctx, [n.main, "#19f0ff"][i], cx + 1, y + 84, 7, 6)
          px(ctx, "#ffffff", cx + 2, y + 85, 3, 1)
          px(ctx, "#ffb347", cx + 2, y + 93, 2, 2)
          px(ctx, "#ff2e97", cx + 5, y + 94, 2, 2)
          glow([n.main, "#19f0ff"][i], cx + 1, y + 84, 7, 6, 0.9)
        }
      } else {
        for (const sy of [86, 94, 102]) px(ctx, "#2a1448", wx + 1, y + sy - 1, 22, 1)
        for (const sy of [86, 94]) {
          for (let xx = wx + 2; xx < wx + 22; xx += 3 + Math.floor(r() * 3)) {
            px(
              ctx,
              (game
                ? [n.main, "#ffb347", "#19f0ff", "#e9e4ff"]
                : ["#5a5a8c", "#6a6a98", "#4e5a86", "#7a7aa8"])[Math.floor(r() * 4)],
              xx,
              y + sy - 5,
              2,
              4
            )
          }
        }
      }
      if (game) glow("#ffb347", wx, y + 76, 24, 26, 0.3)
    }
    px(ctx, "#ffffff14", wx + 2, y + 77, 3, 24)
    px(ctx, "#ffffff0d", wx + 7, y + 77, 2, 24)
  }
  frontWin(x + 4)
  frontWin(x + w - 28)

  // door: games glow and invite, coming-soon is shuttered, scenery is closed and dark
  const d = st.door
  px(ctx, INK, d.x - 2, d.y - 2, d.w + 4, d.h + 2)
  if (soon) {
    px(ctx, "#1f1b44", d.x, d.y, d.w, d.h)
    for (let yy = d.y; yy < d.y + d.h; yy += 3)
      px(ctx, yy % 6 ? "#2c2758" : "#191538", d.x, yy, d.w, 2)
    px(ctx, "#8a7a3a", d.x + 2, d.y + d.h - 6, 28, 2)
    for (let xx = d.x + 2; xx < d.x + 30; xx += 6) px(ctx, INK, xx, d.y + d.h - 6, 3, 2)
  } else if (!game) {
    px(ctx, "#191838", d.x, d.y, d.w, d.h)
    px(ctx, "#222250", d.x + 3, d.y + 3, 12, 26)
    px(ctx, "#222250", d.x + 17, d.y + 3, 12, 26)
    px(ctx, "#33336a", d.x + 15, d.y + 3, 2, 26)
    px(ctx, "#6a6a98", d.x + 12, d.y + 16, 2, 3)
    px(ctx, "#6a6a98", d.x + 18, d.y + 16, 2, 3)
    for (let i = 0; i < 3; i++) {
      const nx = d.x + 1 + i * 10
      px(ctx, "#232a5a", nx, d.y, 9, 11)
      px(ctx, "#8a88b8", nx + 3, d.y + 3, 3, 1)
    }
  } else {
    px(ctx, "#ff9b4a", d.x, d.y, d.w, d.h)
    px(ctx, "#ffcf86", d.x, d.y, d.w, 14)
    px(ctx, "#ffe2b0", d.x + 4, d.y + 14, d.w - 8, 12)
    px(ctx, n.main, d.x - 2, d.y - 3, d.w + 4, 2)
    px(ctx, n.main, d.x - 3, d.y - 3, 2, d.h + 3)
    px(ctx, n.main, d.x + d.w + 1, d.y - 3, 2, d.h + 3)
    for (let i = 0; i < 3; i++) {
      const nx = d.x + 1 + i * 10
      px(ctx, "#233a8a", nx, d.y, 9, 13)
      px(ctx, "#1a2a6a", nx, d.y + 11, 9, 2)
      px(ctx, "#e9e4ff", nx + 3, d.y + 3, 3, 1)
      px(ctx, "#e9e4ff", nx + 4, d.y + 3, 1, 5)
    }
    glow("#ffb347", d.x - 2, d.y - 2, d.w + 4, d.h + 2, 0.4)
  }
  px(ctx, "#4a3d9a", d.x - 3, d.y + d.h - 2, d.w + 6, 2)
  px(ctx, "#00000066", d.x - 3, d.y + d.h - 1, d.w + 6, 1)
}

/** A blank, dim side wall seen face-on (alley walls, forecourt walls, gaps between shops). */
function drawSideWall(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  const r = rng(seed)
  px(ctx, "#100c2a", x, y, w, h)
  for (let xx = x; xx < x + w; xx += 8) px(ctx, r() > 0.5 ? "#130e30" : "#0d0a24", xx, y, 8, h)
  for (let yy = y + 6; yy < y + h; yy += 6) px(ctx, "#00000030", x, yy, w, 1)
  px(ctx, "#2a2560", x, y, w, 4)
  px(ctx, "#1a1640", x, y + 4, w, 2)
  for (let yy = y + 14; yy + 18 < y + h; yy += 30) {
    for (let xx = x + 8; xx + 14 < x + w; xx += 28) {
      const lit = r() > 0.7
      px(ctx, INK, xx - 1, yy - 1, 16, 18)
      px(ctx, lit ? "#5d6690" : "#0b0922", xx, yy, 14, 16)
      px(ctx, INK, xx + 6, yy, 2, 16)
      px(ctx, "#2a2760", xx - 2, yy + 16, 18, 2)
    }
  }
  px(ctx, "#2a2560", x + w - 8, y + 6, 3, h - 6)
}

function drawHoarding(ctx: Ctx, x: number, y: number, text: string, vertical: boolean) {
  const chars = Array.from(text)
  const w = vertical ? 13 : chars.length * 9 + 8
  const h = vertical ? chars.length * 9 + 6 : 15
  px(ctx, INK, x, y, w, h)
  px(ctx, "#0e0a28", x + 1, y + 1, w - 2, h - 2)
  px(ctx, "#4d4a80", x + 1, y, w - 2, 1)
  px(ctx, "#4d4a80", x + 1, y + h - 1, w - 2, 1)
  px(ctx, "#4d4a80", x, y + 1, 1, h - 2)
  px(ctx, "#4d4a80", x + w - 1, y + 1, 1, h - 2)
  ctx.fillStyle = "#8a88b8"
  chars.forEach((ch, i) => {
    if (vertical) fitText(ctx, ch, x + w / 2, y + 8 + i * 9, 10, 8)
    else fitText(ctx, ch, x + 8 + i * 9 + 0.5, y + h / 2, 10, 8)
  })
}

function drawShrine(ctx: Ctx, glow: GlowAdd) {
  const x = 26 * TILE
  const y = SKY_ROWS * TILE
  const w = 8 * TILE
  px(ctx, "#2a1a3a", x, y + 22, w, 26)
  px(ctx, "#7a2a3a", x + 8, y + 22, 6, 26)
  px(ctx, "#7a2a3a", x + w - 14, y + 22, 6, 26)
  px(ctx, "#3a2440", x + 16, y + 26, w - 32, 22)
  px(ctx, "#8a6a3a", x + 52, y + 30, 24, 18)
  px(ctx, "#1a1230", x + 56, y + 34, 16, 14)
  px(ctx, "#0f0a22", x - 8, y + 8, w + 16, 14)
  px(ctx, "#0f0a22", x - 12, y + 4, w + 24, 6)
  px(ctx, "#241a44", x - 8, y + 8, w + 16, 2)
  px(ctx, "#0f0a22", x + 20, y, w - 40, 8)
  px(ctx, "#4a3a70", x - 12, y + 4, w + 24, 1)
  for (const lx of [x + 4, x + w - 12]) {
    px(ctx, "#8a5a3a", lx, y + 24, 8, 10)
    px(ctx, "#c8a070", lx + 2, y + 26, 4, 6)
  }
  glow("#c8905a", x + 56, y + 34, 16, 14, 0.3)
}

function drawBackdrops(ctx: Ctx, world: World, glow: GlowAdd) {
  const { w: W, tiers, rows } = world
  const alleyX0 = ALLEY_L * TILE
  const alleyX1 = (ALLEY_R + 1) * TILE
  for (let t = 0; t < tiers; t++) {
    const y0 = shopRow(tiers, t) * TILE
    const h = SHOP_ROWS * TILE
    if (t === tiers - 1) {
      drawSideWall(ctx, 0, y0, PLAZA_L * TILE, h, 40 + t)
      drawSideWall(ctx, (PLAZA_R + 1) * TILE, y0, W - (PLAZA_R + 1) * TILE, h, 50 + t)
    } else {
      drawSideWall(ctx, 0, y0, alleyX0, h, 40 + t)
      drawSideWall(ctx, alleyX1, y0, W - alleyX1, h, 50 + t)
    }
  }
  const s0 = streetRow(tiers, 0) + STREET_ROWS
  const narrowEnd = (s0 + TAIL_NARROW) * TILE
  const tailEnd = (rows - BASE_ROWS) * TILE
  drawSideWall(ctx, 0, s0 * TILE, alleyX0, narrowEnd - s0 * TILE, 61)
  drawSideWall(ctx, alleyX1, s0 * TILE, W - alleyX1, narrowEnd - s0 * TILE, 62)
  drawSideWall(ctx, 0, narrowEnd, COURT_L * TILE, tailEnd - narrowEnd, 63)
  drawSideWall(
    ctx,
    (COURT_R + 1) * TILE,
    narrowEnd,
    W - (COURT_R + 1) * TILE,
    tailEnd - narrowEnd,
    64
  )
  // upright hoardings on the walls (scenery, intentionally muted)
  drawHoarding(ctx, 4 * TILE, narrowEnd + 20, "ゲームセンター", false)
  drawHoarding(ctx, 14 * TILE, narrowEnd + 10, "酒場", true)
  drawHoarding(ctx, 41 * TILE, narrowEnd + 20, "ラーメン", false)
  drawHoarding(ctx, 52 * TILE, narrowEnd + 10, "旅館", true)
  drawHoarding(ctx, 6 * TILE, s0 * TILE + 14, "電気", true)
  drawHoarding(ctx, 50 * TILE, s0 * TILE + 14, "薬局", true)
  drawShrine(ctx, glow)
}

function drawRope(ctx: Ctx, x0: number, x1: number, y: number, sag: number) {
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0)
    px(ctx, "#2a1f55", x, Math.round(y + Math.sin(t * Math.PI) * sag), 1, 1)
  }
}

/* ------------------------------------------------------------------------------------ */
/* Assets                                                                               */
/* ------------------------------------------------------------------------------------ */

type Lantern = {
  x: number
  y: number
  phase: number
  sprite: HTMLCanvasElement
  on: boolean
  color: string
}

export type Assets = {
  world: World
  layers: Layers
  signs: SignSprite[]
  lanterns: Lantern[]
  props: { p: Prop; s: PropSprite }[]
  player: Record<Dir, HTMLCanvasElement[]>
  steam: { x: number; y: number }[]
}

/** Desaturate and darken a sprite so scenery sits behind the glowing, enterable shops. */
function muteSprite(c: HTMLCanvasElement, amount: number) {
  const ctx = c.getContext("2d")!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15
    d[i] = (d[i] + (lum * 0.85 - d[i]) * amount) * 0.78
    d[i + 1] = (d[i + 1] + (lum * 0.85 - d[i + 1]) * amount) * 0.8
    d[i + 2] = (d[i + 2] + (lum * 1.05 - d[i + 2]) * amount) * 0.9
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export function buildAssets(world: World): Assets {
  const mk = () => newCanvas(world.w, world.h)
  const ground = mk()
  const buildings = mk()
  const overlay = mk()
  const glow = mk()
  const add: GlowAdd = (color, x, y, w, h, alpha) => {
    glow.ctx.globalAlpha = alpha
    px(glow.ctx, color, x, y, w, h)
    glow.ctx.globalAlpha = 1
  }

  drawGround(ground.ctx, world)
  drawBackdrops(buildings.ctx, world, add)

  const signs: SignSprite[] = []
  const lanterns: Lantern[] = []
  const lanternSprites = {
    red: makeLantern("#ff4d5e", "#ffd6dc"),
    amber: makeLantern("#ffb347", "#fff0d0"),
    pink: makeLantern("#ff2e97", "#ffd6ec"),
    off: makeLantern("#3a3470", "#55508a"),
  }

  for (const st of world.stations) {
    drawShop(buildings.ctx, st, add)
    signs.push({
      st,
      x: st.x + 4,
      y: st.y + 31,
      lit: makeSignCanvas(st, true),
      dim: makeSignCanvas(st, false),
      phase: (st.index * 1.7) % 7,
      vertical: false,
    })
    signs.push({
      st,
      x: st.x + st.w - 1,
      y: st.y + 14,
      lit: makeVerticalSign(st, true),
      dim: makeVerticalSign(st, false),
      phase: (st.index * 2.3 + 1) % 7,
      vertical: true,
    })
    const on = st.kind === "game"
    const k: "red" | "amber" | "pink" =
      st.index % 3 === 0 ? "red" : st.index % 3 === 1 ? "amber" : "pink"
    for (const [lx, ph] of [
      [st.x + 1, 0],
      [st.x + st.w - 10, 1.9],
    ] as const) {
      lanterns.push({
        x: lx,
        y: st.y + 68,
        phase: ph + st.index,
        sprite: on ? lanternSprites[k] : lanternSprites.off,
        on,
        color: k === "red" ? "#ff4d5e" : k === "amber" ? "#ffb347" : "#ff2e97",
      })
    }
    // pool of light on the pavement: only enterable shops cast one
    if (st.kind === "game") {
      const g = glow.ctx.createRadialGradient(
        st.door.x + 16,
        st.door.y + 40,
        2,
        st.door.x + 16,
        st.door.y + 40,
        40
      )
      g.addColorStop(0, "rgba(255,200,130,0.4)")
      g.addColorStop(1, "rgba(255,200,130,0)")
      glow.ctx.fillStyle = g
      glow.ctx.fillRect(st.door.x - 30, st.door.y + 8, 92, 70)
    }
  }

  // Ropes of dull paper lanterns strung across the alley (scenery)
  const dull = [makeLantern("#9a5a3a", "#c89870"), makeLantern("#7a4a5a", "#b08090")]
  const ropes: number[] = []
  for (let t = 0; t < world.tiers; t++) ropes.push((shopRow(world.tiers, t) + 3) * TILE)
  const tail = (streetRow(world.tiers, 0) + STREET_ROWS) * TILE
  ropes.push(tail + 10, tail + 52)
  for (const ry of ropes) {
    const x0 = ALLEY_L * TILE - 2
    const x1 = (ALLEY_R + 1) * TILE + 2
    drawRope(overlay.ctx, x0, x1, ry, 5)
    for (let i = 0; i < 4; i++) {
      lanterns.push({
        x: x0 + 6 + i * 15,
        y: ry + 3 + Math.round(Math.sin(((i * 15 + 10) / (x1 - x0)) * Math.PI) * 5),
        phase: ry + i,
        sprite: dull[i % 2],
        on: false,
        color: "#c89870",
      })
    }
  }

  // Props: muted so they read as scenery
  const sprites = makePropSprites()
  for (const k of Object.keys(sprites) as (keyof typeof sprites)[])
    muteSprite(sprites[k].canvas, 0.55)
  const props = world.props.map((p) => ({ p, s: sprites[p.kind] })).sort((a, b) => a.p.y - b.p.y)
  const poles: Prop[] = []
  for (const { p, s } of props) {
    if (p.kind === "lamp") {
      const grad = glow.ctx.createRadialGradient(p.x, p.y - 2, 2, p.x, p.y - 2, 30)
      grad.addColorStop(0, "rgba(190,190,255,0.12)")
      grad.addColorStop(1, "rgba(190,190,255,0)")
      glow.ctx.fillStyle = grad
      glow.ctx.fillRect(p.x - 34, p.y - 30, 68, 60)
    }
    if (p.kind === "pole") poles.push(p)
    void s
  }

  // Power lines between neighbouring poles on the same pavement
  poles.sort((a, b) => a.y - b.y || a.x - b.x)
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i]
    const b = poles[i + 1]
    if (a.y !== b.y || b.x - a.x > 150) continue
    for (const [oy, dx] of [
      [-44, -8],
      [-44, 8],
      [-38, -5],
      [-38, 5],
    ]) {
      const x0 = a.x + dx
      const x1 = b.x + dx
      for (let x = Math.round(x0); x <= x1; x++) {
        const t = (x - x0) / (x1 - x0)
        px(overlay.ctx, "#0b0724", x, Math.round(a.y + oy + Math.sin(t * Math.PI) * 7), 1, 1)
      }
    }
  }

  const yatai = world.props.find((p) => p.kind === "yatai")
  const steam = yatai
    ? [
        { x: yatai.x - 6, y: yatai.y - 34 },
        { x: yatai.x + 8, y: yatai.y - 34 },
      ]
    : []
  for (let t = 0; t < world.tiers; t++)
    steam.push({ x: 24 * TILE + 8, y: (streetRow(world.tiers, t) + 3) * TILE + 6 })

  return {
    world,
    layers: { ground: ground.c, buildings: buildings.c, overlay: overlay.c, glow: glow.c },
    signs,
    lanterns,
    props,
    player: makePlayerFrames(),
    steam,
  }
}

/* ------------------------------------------------------------------------------------ */
/* Per-frame drawing                                                                    */
/* ------------------------------------------------------------------------------------ */

export type FrameState = {
  camX: number
  camY: number
  t: number
  px: number
  py: number
  dir: Dir
  frame: number
  moving: boolean
  near: Station | null
  reduced: boolean
}

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Sign brightness 0..1: games shine steadily, coming-soon is held low, scenery flickers gently. */
function signBrightness(s: SignSprite, t: number, reduced: boolean, near: boolean) {
  if (s.st.kind === "game") return 1
  if (s.st.kind === "soon") return near ? 0.85 : 0.5
  if (reduced || !s.st.flicker) return 0.9
  const u = (t + s.phase * 3.1) % 6
  if (u < 0.45) return Math.floor(u * 22) % 3 === 0 ? 0.3 : 0.9
  return 0.9
}

/** Neon chevron marker; `big` is used for the station the player stands at. */
function drawArrow(ctx: Ctx, ax: number, ay: number, main: string, light: string, big: boolean) {
  const h = big ? 6 : 4
  px(ctx, INK, ax - h - 1, ay - 2, 2 * h + 3, 3)
  for (let i = 0; i < h + 1; i++) px(ctx, INK, ax - h + i, ay + 1 + i, 2 * (h - i) + 1, 1)
  for (let i = 0; i < h; i++) px(ctx, main, ax - h + 1 + i, ay + 1 + i, 2 * (h - i) - 1, 1)
  px(ctx, light, ax - h, ay - 1, 2 * h + 1, 2)
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private glowCtx: CanvasRenderingContext2D
  private half = newCanvas(1, 1)
  private quarter = newCanvas(1, 1)
  private glowBuf = newCanvas(1, 1)
  private vignette: HTMLCanvasElement | null = null
  private rain: { x: number; y: number; v: number }[] = []
  w = 0
  h = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: Assets
  ) {
    this.ctx = canvas.getContext("2d", { alpha: false })!
    this.glowCtx = this.glowBuf.ctx
  }

  resize(w: number, h: number) {
    this.w = w
    this.h = h
    this.canvas.width = w
    this.canvas.height = h
    this.ctx = this.canvas.getContext("2d", { alpha: false })!
    this.ctx.imageSmoothingEnabled = false
    this.glowBuf = newCanvas(w, h)
    this.glowCtx = this.glowBuf.ctx
    this.half = newCanvas(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)))
    this.quarter = newCanvas(Math.max(1, Math.ceil(w / 5)), Math.max(1, Math.ceil(h / 5)))
    this.half.ctx.imageSmoothingEnabled = true
    this.quarter.ctx.imageSmoothingEnabled = true
    // vignette
    const v = newCanvas(w, h)
    const g = v.ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.35,
      w / 2,
      h / 2,
      Math.hypot(w, h) * 0.55
    )
    g.addColorStop(0, "rgba(5,3,20,0)")
    g.addColorStop(1, "rgba(5,3,20,0.6)")
    v.ctx.fillStyle = g
    v.ctx.fillRect(0, 0, w, h)
    this.vignette = v.c
    this.rain = Array.from({ length: Math.round((w * h) / 900) }, (_, i) => ({
      x: hash(i) * (w + 60),
      y: hash(i + 99) * h,
      v: 110 + hash(i + 7) * 90,
    }))
  }

  draw(s: FrameState, dt: number) {
    const ctx = this.ctx
    const { layers, signs, lanterns, props, player, steam, world } = this.assets
    const cx = s.camX
    const cy = s.camY
    ctx.fillStyle = "#07051a"
    ctx.fillRect(0, 0, this.w, this.h)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(layers.ground, -cx, -cy)

    // puddle ripples
    if (!s.reduced) {
      ctx.strokeStyle = "rgba(190,170,255,0.5)"
      ctx.lineWidth = 1
      world.puddles.forEach((p, i) => {
        const ph = (s.t * 0.35 + i * 0.37) % 1
        ctx.globalAlpha = (1 - ph) * 0.6
        ctx.beginPath()
        ctx.ellipse(
          Math.round(p.x - cx + Math.sin(i) * 6) + 0.5,
          Math.round(p.y - cy) + 0.5,
          ph * p.rx * 0.5 + 1,
          ph * p.ry * 0.5 + 0.5,
          0,
          0,
          Math.PI * 2
        )
        ctx.stroke()
      })
      ctx.globalAlpha = 1
    }

    ctx.drawImage(layers.buildings, -cx, -cy)

    // signs (lit/dim crossfade)
    const glowSigns: { s: SignSprite; a: number }[] = []
    for (const sg of signs) {
      const x = sg.x - cx
      const y = sg.y - cy
      if (x > this.w || y > this.h || x + sg.lit.width < 0 || y + sg.lit.height < 0) continue
      const isNear = s.near?.id === sg.st.id
      const a = signBrightness(sg, s.t, s.reduced, isNear)
      ctx.drawImage(sg.dim, x, y)
      ctx.globalAlpha = a
      ctx.drawImage(sg.lit, x, y)
      ctx.globalAlpha = 1
      glowSigns.push({ s: sg, a })
    }

    // markers: every enterable shop has a bobbing arrow and twinkling sparkles
    for (const st of world.stations) {
      if (st.kind !== "game") continue
      const mx = st.door.x + st.door.w / 2 - cx
      const my = st.y + 14 - cy
      if (mx < -20 || mx > this.w + 20 || my < -30 || my > this.h + 10) continue
      const n = NEON[st.neon]
      const isNear = s.near?.id === st.id
      const bob = s.reduced ? 0 : Math.round(Math.sin(s.t * 4 + st.index) * 2)
      drawArrow(ctx, Math.round(mx), Math.round(my) + bob, n.main, n.light, isNear)
      if (!s.reduced) {
        const tw = Math.floor(s.t * 3 + st.index) % 3
        const sx = Math.round(st.x - cx) + 2 + tw * 3
        px(ctx, n.light, sx, Math.round(st.y - cy) + 24, 1, 3)
        px(ctx, n.light, sx - 1, Math.round(st.y - cy) + 25, 3, 1)
      }
    }

    // door highlight for the station the player is standing at
    if (s.near) {
      const d = s.near.door
      const pulse = s.reduced ? 0.85 : 0.6 + 0.4 * Math.sin(s.t * 6)
      const n = NEON[s.near.neon]
      ctx.globalAlpha = pulse
      ctx.fillStyle = n.light
      const dx = d.x - cx - 4
      const dy = d.y - cy - 4
      ctx.fillRect(dx, dy, d.w + 8, 2)
      ctx.fillRect(dx, dy, 2, d.h + 4)
      ctx.fillRect(dx + d.w + 6, dy, 2, d.h + 4)
      ctx.globalAlpha = 1
    }

    // hanging lanterns
    for (const l of lanterns) {
      const sway = s.reduced ? 0 : Math.round(Math.sin(s.t * 1.8 + l.phase) * 1)
      ctx.drawImage(l.sprite, Math.round(l.x - cx + sway), Math.round(l.y - cy))
    }

    // y-sorted props and player
    const py = s.py
    const drawProp = (e: { p: Prop; s: PropSprite }) => {
      const x = Math.round(e.p.x - e.s.canvas.width / 2 - cx)
      const y = Math.round(e.p.y - e.s.canvas.height - cy)
      if (x > this.w || y > this.h || x + e.s.canvas.width < 0 || y + e.s.canvas.height < 0) return
      if (e.p.solid) {
        // blocked props get a contact shadow so they look solid; walk-over props do not
        ctx.fillStyle = "rgba(0,0,0,0.35)"
        const fw = e.s.canvas.width - 2
        ctx.fillRect(x + 1, y + e.s.canvas.height - 1, fw, 3)
      }
      ctx.drawImage(e.s.canvas, x, y)
    }
    let i = 0
    while (i < props.length && props[i].p.y <= py) drawProp(props[i++])
    this.drawPlayer(s, player)
    while (i < props.length) drawProp(props[i++])

    ctx.drawImage(layers.overlay, -cx, -cy)

    // steam and petals
    if (!s.reduced) {
      for (const e of steam) {
        for (let k = 0; k < 6; k++) {
          const ph = (s.t * 0.45 + k / 6) % 1
          ctx.globalAlpha = (1 - ph) * 0.45
          const sz = 2 + Math.floor(ph * 3)
          px(
            ctx,
            "#e9e4ff",
            Math.round(e.x - cx + Math.sin(ph * 7 + k * 2) * 3),
            Math.round(e.y - cy - ph * 22),
            sz,
            sz
          )
        }
      }
      ctx.globalAlpha = 1
      const petalCols = ["#ffb3dc", "#ff8fc8", "#ffd6ec"]
      for (let k = 0; k < 38; k++) {
        const ph = (s.t * (0.1 + hash(k) * 0.08) + hash(k + 40)) % 1
        const wx = PLAZA_L * TILE + hash(k + 3) * 22 * TILE + Math.sin(s.t * 1.2 + k) * 8 - ph * 40
        const wy = SKY_ROWS * TILE + ph * 7 * TILE
        px(ctx, petalCols[k % 3], Math.round(wx - cx), Math.round(wy - cy), 2, 1)
      }
    }

    this.drawGlow(s, glowSigns)

    // rain, then vignette
    if (!s.reduced) {
      ctx.fillStyle = "rgba(170,200,255,0.35)"
      for (const d of this.rain) {
        d.y += d.v * dt
        d.x -= d.v * 0.25 * dt
        if (d.y > this.h) {
          d.y = -4
          d.x = hash(d.v + d.x) * (this.w + 60)
        }
        if (d.x < -4) d.x += this.w + 60
        ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 3)
      }
    }
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0)
  }

  private drawPlayer(s: FrameState, player: Record<Dir, HTMLCanvasElement[]>) {
    const ctx = this.ctx
    const x = Math.round(s.px - s.camX)
    const y = Math.round(s.py - s.camY)
    ctx.fillStyle = "rgba(0,0,0,0.4)"
    ctx.fillRect(x - 5, y - 2, 10, 3)
    ctx.fillStyle = "rgba(0,0,0,0.25)"
    ctx.fillRect(x - 4, y - 3, 8, 1)
    const sprite = player[s.dir][s.moving ? s.frame : 0]
    ctx.drawImage(sprite, x - 7, y - 17)
  }

  private drawGlow(s: FrameState, signs: { s: SignSprite; a: number }[]) {
    const g = this.glowCtx
    const { layers, lanterns } = this.assets
    g.globalCompositeOperation = "source-over"
    g.clearRect(0, 0, this.w, this.h)
    g.drawImage(layers.glow, -s.camX, -s.camY)
    for (const e of signs) {
      const kind = e.s.st.kind
      if (kind !== "game") continue // scenery and coming-soon signs do not bloom
      const isNear = s.near?.id === e.s.st.id
      g.globalAlpha = Math.min(1, e.a)
      g.drawImage(e.s.lit, e.s.x - s.camX, e.s.y - s.camY)
      if (isNear) {
        g.drawImage(e.s.lit, e.s.x - s.camX, e.s.y - s.camY)
        g.drawImage(e.s.lit, e.s.x - s.camX, e.s.y - s.camY)
      }
    }
    g.globalAlpha = 1
    if (s.near?.kind === "game") {
      const d = s.near.door
      const n = NEON[s.near.neon]
      const pulse = s.reduced ? 0.8 : 0.65 + 0.35 * Math.sin(s.t * 6)
      g.globalAlpha = 0.55 * pulse
      g.fillStyle = n.main
      g.fillRect(d.x - s.camX - 6, d.y - s.camY - 6, d.w + 12, d.h + 8)
      g.globalAlpha = 0.18
      g.fillStyle = "#ffe9c4"
      g.fillRect(d.x - s.camX, d.y - s.camY, d.w, d.h)
      g.globalAlpha = 1
    }
    for (const l of lanterns) {
      if (!l.on) continue
      g.fillStyle = l.color
      g.globalAlpha = 0.9
      g.fillRect(Math.round(l.x - s.camX + 2), Math.round(l.y - s.camY + 4), 5, 6)
    }
    g.globalAlpha = 1

    // cheap bloom: downscale twice with smoothing, then add the blurred copies
    const h2 = this.half
    const q = this.quarter
    h2.ctx.clearRect(0, 0, h2.c.width, h2.c.height)
    h2.ctx.drawImage(this.glowBuf.c, 0, 0, h2.c.width, h2.c.height)
    q.ctx.clearRect(0, 0, q.c.width, q.c.height)
    q.ctx.drawImage(h2.c, 0, 0, q.c.width, q.c.height)

    const ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    ctx.imageSmoothingEnabled = true
    ctx.globalAlpha = 0.25
    ctx.drawImage(this.glowBuf.c, 0, 0)
    ctx.globalAlpha = 0.7
    ctx.drawImage(h2.c, 0, 0, this.w, this.h)
    ctx.globalAlpha = 0.9
    ctx.drawImage(q.c, 0, 0, this.w, this.h)
    ctx.restore()
    ctx.imageSmoothingEnabled = false
  }
}
