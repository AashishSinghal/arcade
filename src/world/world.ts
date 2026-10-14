// World layout: tiles, stations, props and collision. Pure data, no canvas.
//
// Shape: one vertical alley runs from the spawn forecourt at the bottom up to a shrine plaza.
// Every few rows it crosses a "tier": a horizontal street with shops on its north side. All
// shops face the viewer (door at the bottom of the facade, reached from the street below).
// Stations come from the `games` registry, so a new game gets a shop automatically; more
// games than slots add another tier.

import { games as registryGames, type Difficulty, type GameMeta } from "@/registry"
import type { Neon, PropKind } from "./sprites"

export const TILE = 16
export const COLS = 60

export const SKY_ROWS = 3
export const SHOP_ROWS = 7
export const STREET_ROWS = 4 // 2 pavement + 2 asphalt
export const TIER_ROWS = SHOP_ROWS + STREET_ROWS
export const TAIL_NARROW = 5 // alley rows below the first junction
export const TAIL_COURT = 5 // forecourt rows (spawn)
export const BASE_ROWS = 2

export const ALLEY_L = 28 // alley columns 28..31
export const ALLEY_R = 31
export const PLAZA_L = 19 // shrine plaza columns 19..40 (top tier only)
export const PLAZA_R = 40
export const COURT_L = 20 // forecourt columns 20..39
export const COURT_R = 39
const MIN_TIERS = 2

export type StationKind = "game" | "soon" | "decor"
export type Side = "left" | "right"

export type Station = {
  id: string
  kind: StationKind
  slug?: string
  title: string
  /** Japanese sign text (first line) */
  jp: string
  /** Second sign line */
  en: string
  difficulty?: Difficulty
  controls?: string
  description?: string
  side: Side
  /** 0 = nearest the alley */
  slot: number
  tier: number
  topTier: boolean
  index: number
  /** Building rectangle in world pixels */
  x: number
  y: number
  w: number
  h: number
  door: { x: number; y: number; w: number; h: number }
  /** Foot position that puts the player in front of the door */
  stand: { x: number; y: number }
  neon: Neon
  flicker: boolean
}

export type Prop = {
  kind: PropKind
  /** Bottom-centre of the sprite, in world pixels */
  x: number
  y: number
  /** Whether the player is blocked by it (drawn the same way, used by the renderer for hints) */
  solid: boolean
}

type SoonGame = { slug: string; title: string; jp: string }

// Games that are planned but not built yet: display only. Remove an entry when it ships.
// Only the first MAX_SOON are shown so the street does not feel empty or cluttered.
const MAX_SOON = 3
export const comingSoon: SoonGame[] = [
  { slug: "snake", title: "Snake", jp: "ヘビ" },
  { slug: "breakout", title: "Breakout", jp: "ブロック崩し" },
  { slug: "memory-match", title: "Memory Match", jp: "神経衰弱" },
  { slug: "puzzle-slider", title: "Puzzle Slider", jp: "スライドパズル" },
  { slug: "word-scramble", title: "Word Scramble", jp: "ことばパズル" },
]

const decorShops: { jp: string; en: string; neon: Neon }[] = [
  { jp: "ラーメン", en: "RAMEN", neon: "red" },
  { jp: "居酒屋", en: "IZAKAYA", neon: "amber" },
  { jp: "コンビニ", en: "KONBINI", neon: "cyan" },
  { jp: "カラオケ", en: "KARAOKE", neon: "pink" },
  { jp: "パチンコ", en: "PACHINKO", neon: "violet" },
  { jp: "喫茶", en: "CAFE", neon: "green" },
  { jp: "寿司", en: "SUSHI", neon: "red" },
  { jp: "古本屋", en: "BOOKS", neon: "amber" },
  { jp: "電気", en: "DENKI", neon: "cyan" },
]

const gameNeon: Neon[] = ["pink", "cyan", "amber", "green", "violet"]

export type World = {
  stations: Station[]
  props: Prop[]
  /** 1 = solid tile */
  solid: Uint8Array
  /** 1 = no floor (wall/scenery); props standing on floor still have floor drawn under them */
  void_: Uint8Array
  spawn: { x: number; y: number }
  puddles: { x: number; y: number; rx: number; ry: number }[]
  cols: number
  rows: number
  w: number
  h: number
  tiers: number
}

/** First row of the shop band of a tier (tier 0 is the lowest, nearest the spawn). */
export const shopRow = (tiers: number, tier: number) => SKY_ROWS + (tiers - 1 - tier) * TIER_ROWS
export const streetRow = (tiers: number, tier: number) => shopRow(tiers, tier) + SHOP_ROWS

/** Slots in nearest-first order: tier by tier, alternating left and right of the alley. */
function slotOrder(tiers: number) {
  const out: { tier: number; side: Side; slot: number }[] = []
  for (let tier = 0; tier < tiers; tier++) {
    for (let slot = tier === tiers - 1 ? 1 : 0; slot < 3; slot++) {
      out.push({ tier, side: "left", slot }, { tier, side: "right", slot })
    }
  }
  return out
}

export function tierCount(stationCount: number) {
  let t = MIN_TIERS
  while (slotOrder(t).length < stationCount) t++
  return t
}

const shopCol = (side: Side, slot: number) => (side === "left" ? 21 - 8 * slot : 33 + 8 * slot)

export function layoutStations(gameList: GameMeta[] = registryGames): {
  stations: Station[]
  tiers: number
} {
  const soon = comingSoon.filter((s) => !gameList.some((g) => g.slug === s.slug)).slice(0, MAX_SOON)
  const tiers = tierCount(gameList.length + soon.length)
  const slots = slotOrder(tiers)
  const out: Station[] = []

  const make = (
    spot: (typeof slots)[number],
    partial: Pick<Station, "id" | "kind" | "title" | "jp" | "en" | "neon" | "flicker"> &
      Partial<Station>
  ): Station => {
    const x = shopCol(spot.side, spot.slot) * TILE
    const y = shopRow(tiers, spot.tier) * TILE
    const w = 6 * TILE
    const h = SHOP_ROWS * TILE
    const door = { x: x + 32, y: y + h - 32, w: 32, h: 32 }
    const st: Station = {
      side: spot.side,
      slot: spot.slot,
      tier: spot.tier,
      topTier: spot.tier === tiers - 1,
      index: out.length,
      x,
      y,
      w,
      h,
      door,
      stand: { x: door.x + door.w / 2, y: door.y + door.h + 6 },
      ...partial,
    }
    out.push(st)
    return st
  }

  let next = 0
  gameList.forEach((g, i) => {
    const spot = slots[next++]
    make(spot, {
      id: g.slug,
      kind: "game",
      slug: g.slug,
      title: g.title,
      jp: g.jp ?? "ゲーム",
      en: g.title.toUpperCase(),
      difficulty: g.difficulty,
      controls: g.controls,
      description: g.description,
      neon: gameNeon[i % gameNeon.length],
      flicker: false,
    })
  })
  // Coming-soon shops go to the far end of the street so games and previews are spread out
  const soonSpots = slots.slice(next).reverse().slice(0, soon.length)
  soon.forEach((s, i) => {
    make(soonSpots[i], {
      id: `soon-${s.slug}`,
      kind: "soon",
      title: s.title,
      jp: "近日公開",
      en: s.title.toUpperCase(),
      neon: "violet",
      flicker: false,
    })
  })

  // Everything else is a decorative shop
  let d = 0
  for (const spot of slots) {
    if (out.some((s) => s.tier === spot.tier && s.side === spot.side && s.slot === spot.slot))
      continue
    const shop = decorShops[(d * 4 + spot.tier) % decorShops.length]
    make(spot, {
      id: `decor-${spot.tier}-${spot.side}-${spot.slot}`,
      kind: "decor",
      title: shop.en,
      jp: shop.jp,
      en: shop.en,
      neon: shop.neon,
      flicker: (spot.slot + d) % 3 === 0,
    })
    d++
  }
  return { stations: out, tiers }
}

type Footprint = [col: number, row: number, w: number, h: number]

/** Props are placed by tile footprint; the sprite is centred on it and bottom-aligned. */
function layoutProps(tiers: number, rows: number): { props: Prop[]; blocks: Footprint[] } {
  const props: Prop[] = []
  const blocks: Footprint[] = []
  const add = (kind: PropKind, col: number, row: number, w = 1, h = 1, solid = true) => {
    props.push({ kind, x: col * TILE + (w * TILE) / 2, y: (row + h) * TILE, solid })
    if (solid) blocks.push([col, row, w, h])
  }

  for (let t = 0; t < tiers; t++) {
    const s = streetRow(tiers, t)
    const top = t === tiers - 1
    for (const side of ["left", "right"] as Side[]) {
      for (let j = top ? 1 : 0; j < 3; j++) {
        const c = shopCol(side, j)
        // vending machines in the gap beside each shop (bottom of the shop band)
        const gx = side === "left" ? c + 6 : c - (j === 0 ? 1 : 2)
        add((j + t) % 2 ? "vendingB" : "vending", gx, s - 1)
        if (j > 0)
          add((j + t) % 3 === 0 ? "bin" : (j + t) % 3 === 1 ? "crate" : "vending", gx + 1, s - 1)
        // pavement furniture, kept clear of the door tiles
        if ((j + t) % 2 === 0) add("lamp", side === "left" ? c : c + 5, s)
        if ((j + t + (side === "left" ? 0 : 1)) % 3 === 1) add("bikeB", c + 4, s, 2)
        else add("plant", side === "left" ? c + 5 : c, s)
      }
    }
    // utility poles on the lower pavement row, wired together per side
    for (const col of [3, 11, 19, 38, 46, 54]) {
      if (top && col >= PLAZA_L - 1 && col <= PLAZA_R + 1) continue
      add("pole", col, s + 1)
    }
    // street furniture on the asphalt edge
    add("scooter", t % 2 ? 8 : 47, s + 2, 2)
    add("bike", t % 2 ? 51 : 14, s + 3, 2)
  }

  // Forecourt at the bottom: arcade cabinets, ramen cart, vending, bikes, a cat
  const f = streetRow(tiers, 0) + STREET_ROWS + TAIL_NARROW // first forecourt row
  const last = rows - BASE_ROWS - 1
  add("cabinet", COURT_L + 1, last)
  add("cabinetB", COURT_L + 2, last)
  add("cabinetC", COURT_L + 3, last)
  add("bike", COURT_L + 6, last, 2)
  add("yatai", COURT_R - 7, last - 1, 4, 2)
  add("vending", COURT_R - 2, last)
  add("vendingB", COURT_R - 1, last)
  add("lamp", COURT_L, f + 1)
  add("lamp", COURT_R, f + 1)
  add("plant", COURT_L + 1, f + 3)
  add("crate", COURT_R - 1, f + 3)
  add("cat", COURT_L + 4, f + 3, 1, 1, false)

  // Shrine plaza at the top of the alley
  const hall = shopRow(tiers, tiers - 1)
  add("tree", 21, hall + 5)
  add("tree", 38, hall + 5)
  add("stoneLamp", 25, hall + 5)
  add("stoneLamp", 34, hall + 5)
  add("torii", ALLEY_L, hall + 6, 4, 1, false)
  blocks.push([ALLEY_L, hall + 6, 1, 1], [ALLEY_R, hall + 6, 1, 1])
  return { props, blocks }
}

export function buildWorld(gameList: GameMeta[] = registryGames): World {
  const { stations, tiers } = layoutStations(gameList)
  const rows = streetRow(tiers, 0) + STREET_ROWS + TAIL_NARROW + TAIL_COURT + BASE_ROWS
  const { props, blocks } = layoutProps(tiers, rows)
  const solid = new Uint8Array(COLS * rows).fill(1)
  const open = (c0: number, r0: number, c1: number, r1: number) => {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) solid[r * COLS + c] = 0
  }

  // The alley, top to bottom, then every street, the plaza and the forecourt
  open(ALLEY_L, SKY_ROWS, ALLEY_R, rows - BASE_ROWS - 1)
  for (let t = 0; t < tiers; t++) {
    const s = streetRow(tiers, t)
    open(1, s, COLS - 2, s + STREET_ROWS - 1)
  }
  open(PLAZA_L, SKY_ROWS, PLAZA_R, shopRow(tiers, tiers - 1) + SHOP_ROWS - 1)
  open(COURT_L, rows - BASE_ROWS - TAIL_COURT, COURT_R, rows - BASE_ROWS - 1)
  const void_ = solid.slice()
  // The shrine hall sits at the back of the plaza
  for (let r = SKY_ROWS; r < SKY_ROWS + 3; r++)
    for (let c = 26; c <= 33; c++) solid[r * COLS + c] = 1
  for (const [c, r, w, h] of blocks) {
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) solid[y * COLS + x] = 1
  }

  // Two rows above the bottom: the bottom rows hold the cabinets, bike and ramen cart, so
  // spawning there boxed the player in with barely a tile of room either side.
  const spawn = { x: 30 * TILE, y: (rows - BASE_ROWS - 3) * TILE + 10 }

  // Puddles: deterministic scatter on the walkable ground
  const puddles: World["puddles"] = []
  for (let t = 0; t < tiers; t++) {
    const s = streetRow(tiers, t)
    for (const [c, dr, rx] of [
      [9, 2, 8],
      [24, 3, 7],
      [44, 2, 9],
      [53, 3, 6],
    ]) {
      puddles.push({ x: c * TILE, y: (s + dr) * TILE + 6, rx: rx * 2, ry: 3 })
    }
    puddles.push({ x: 30 * TILE, y: (s - 3) * TILE + 6, rx: 9, ry: 3 })
  }
  const f = streetRow(tiers, 0) + STREET_ROWS
  puddles.push(
    { x: 30 * TILE, y: (f + 2) * TILE + 6, rx: 8, ry: 3 },
    { x: 26 * TILE, y: (rows - 4) * TILE, rx: 14, ry: 3 }
  )

  return {
    stations,
    props,
    solid,
    void_,
    spawn,
    puddles,
    cols: COLS,
    rows,
    w: COLS * TILE,
    h: rows * TILE,
    tiers,
  }
}

export function isSolidAt(world: World, px: number, py: number) {
  const c = Math.floor(px / TILE)
  const r = Math.floor(py / TILE)
  if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) return true
  return world.solid[r * world.cols + c] === 1
}

/** Player foot box: 8px wide, 4px tall, anchored at (x, y) bottom-centre. */
export function boxBlocked(world: World, x: number, y: number) {
  return (
    isSolidAt(world, x - 4, y - 4) ||
    isSolidAt(world, x + 3.99, y - 4) ||
    isSolidAt(world, x - 4, y - 0.01) ||
    isSolidAt(world, x + 3.99, y - 0.01)
  )
}

/** The station whose door the player is standing in front of, if it can be interacted with. */
export function nearStation(world: World, x: number, y: number): Station | null {
  for (const s of world.stations) {
    if (s.kind === "decor") continue
    const d = s.door
    const below = y - (d.y + d.h)
    if (x >= d.x - 8 && x <= d.x + d.w + 8 && below >= -2 && below <= 30) return s
  }
  return null
}
