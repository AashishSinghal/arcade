// Game loop for the street map: input, movement + collision, camera, interaction.

import { buildAssets, ensureFonts, Renderer, type Assets } from "./render"
import { boxBlocked, buildWorld, nearStation, type Station, type World } from "./world"
import type { Dir } from "./sprites"
import type { MapAudio } from "./audio"

const POS_KEY = "arcade-map-pos"
const SPEED = 62 // logical px per second
const MOVE_KEYS: Record<string, "up" | "down" | "left" | "right"> = {
  KeyW: "up",
  ArrowUp: "up",
  KeyS: "down",
  ArrowDown: "down",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
}
const ACT_KEYS = new Set(["Enter", "KeyE", "Space"])

export function loadPos(): { x: number; y: number } | null {
  try {
    const raw = sessionStorage.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as { x?: unknown; y?: unknown }
    return typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : null
  } catch {
    return null
  }
}

function savePos(x: number, y: number) {
  try {
    sessionStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) }))
  } catch {
    /* private mode: position just won't be remembered */
  }
}

export type EngineHandlers = {
  onNear: (station: Station | null) => void
  onEnter: (station: Station) => void
}

export class MapEngine {
  readonly world: World
  private assets: Assets
  private renderer: Renderer
  private keys = new Set<string>()
  private pad = { x: 0, y: 0 }
  private x: number
  private y: number
  private dir: Dir = "down"
  private animT = 0
  private lastFrame = 0
  private moving = false
  private camX = 0
  private camY = 0
  private firstFrame = true
  private near: Station | null = null
  private raf = 0
  private last = 0
  private time = 0
  private inputOn = true
  private entered = false
  private armedAt = 0
  private disposed = false
  private scale = 4

  constructor(
    private canvas: HTMLCanvasElement,
    private handlers: EngineHandlers,
    private audio: MapAudio,
    private reduced: boolean,
    world: World,
    assets: Assets,
    start: { x: number; y: number }
  ) {
    this.world = world
    this.assets = assets
    this.renderer = new Renderer(canvas, assets)
    this.x = start.x
    this.y = start.y
    this.armedAt = performance.now() + 600
  }

  /** Build the world and art (waits for the pixel font so signs render with it). */
  static async create(
    canvas: HTMLCanvasElement,
    handlers: EngineHandlers,
    audio: MapAudio,
    reduced: boolean,
    start: { x: number; y: number } | null
  ) {
    const world = buildWorld()
    await ensureFonts(world.stations)
    const assets = buildAssets(world)
    let p = start ?? world.spawn
    if (boxBlocked(world, p.x, p.y)) p = world.spawn
    return new MapEngine(canvas, handlers, audio, reduced, world, assets, p)
  }

  start() {
    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)
    window.addEventListener("blur", this.clearInput)
    document.addEventListener("visibilitychange", this.onVisibility)
    this.last = 0
    this.raf = requestAnimationFrame(this.tick)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener("keydown", this.onKeyDown)
    window.removeEventListener("keyup", this.onKeyUp)
    window.removeEventListener("blur", this.clearInput)
    document.removeEventListener("visibilitychange", this.onVisibility)
    if (!this.entered) savePos(this.x, this.y)
  }

  /** Fit the canvas to the container with an integer pixel scale. */
  resize(cssW: number, cssH: number) {
    this.scale = Math.max(2, Math.round(cssW / 380))
    const w = Math.ceil(cssW / this.scale)
    const h = Math.ceil(cssH / this.scale)
    this.canvas.style.width = `${w * this.scale}px`
    this.canvas.style.height = `${h * this.scale}px`
    this.renderer.resize(w, h)
    this.firstFrame = true
  }

  setInputEnabled(on: boolean) {
    this.inputOn = on
    if (!on) this.clearInput()
  }

  setVirtual(x: number, y: number) {
    this.pad.x = x
    this.pad.y = y
  }

  interact() {
    if (!this.inputOn || this.entered) return
    const n = this.near
    if (!n) return
    if (n.kind === "game") this.enter(n)
    else this.audio.bump()
  }

  private enter(st: Station) {
    if (this.entered) return
    this.entered = true
    savePos(st.stand.x, st.stand.y)
    this.audio.enter()
    this.handlers.onEnter(st)
  }

  private clearInput = () => {
    this.keys.clear()
    this.pad.x = 0
    this.pad.y = 0
  }

  private onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf)
      this.clearInput()
    } else if (!this.disposed) {
      this.last = 0
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  private static isFormControl(t: EventTarget | null) {
    return t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.inputOn || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.code in MOVE_KEYS) {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
        return
      this.keys.add(e.code)
      e.preventDefault()
    } else if (ACT_KEYS.has(e.code)) {
      // Let focused buttons and links keep their own Enter/Space behaviour
      if (MapEngine.isFormControl(e.target)) return
      e.preventDefault()
      if (!e.repeat) this.interact()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private tick = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.tick)
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0
    this.last = now
    this.time += dt
    this.update(dt, now)
    this.renderer.draw(
      {
        camX: Math.round(this.camX),
        camY: Math.round(this.camY),
        t: this.time,
        px: this.x,
        py: this.y,
        dir: this.dir,
        frame: this.animFrame(),
        moving: this.moving,
        near: this.near,
        reduced: this.reduced,
      },
      dt
    )
  }

  private animFrame() {
    return Math.floor(this.animT / 0.12) % 4
  }

  private move(dx: number, dy: number) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2))
    let moved = false
    for (let i = 0; i < n; i++) {
      const nx = this.x + dx / n
      const ny = this.y + dy / n
      if (boxBlocked(this.world, nx, ny)) break
      this.x = nx
      this.y = ny
      moved = true
    }
    return moved
  }

  private update(dt: number, now: number) {
    let ix = 0
    let iy = 0
    if (this.inputOn && !this.entered) {
      for (const k of this.keys) {
        const m = MOVE_KEYS[k]
        if (m === "left") ix -= 1
        else if (m === "right") ix += 1
        else if (m === "up") iy -= 1
        else if (m === "down") iy += 1
      }
      ix = Math.max(-1, Math.min(1, ix + this.pad.x))
      iy = Math.max(-1, Math.min(1, iy + this.pad.y))
    }
    this.moving = false
    let blockedUp = false
    if (ix || iy) {
      const len = Math.hypot(ix, iy)
      const vx = (ix / len) * SPEED * dt
      const vy = (iy / len) * SPEED * dt
      const movedX = vx ? this.move(vx, 0) : false
      const movedY = vy ? this.move(0, vy) : false
      this.moving = movedX || movedY
      blockedUp = iy < 0 && vy !== 0 && !movedY
      const h: Dir = ix < 0 ? "left" : "right"
      const v: Dir = iy < 0 ? "up" : "down"
      if (ix && !iy) this.dir = h
      else if (iy && !ix) this.dir = v
      else if (this.dir !== h && this.dir !== v) this.dir = h
    }
    if (this.moving) {
      this.animT += dt
      const f = this.animFrame()
      if (f !== this.lastFrame && (f === 0 || f === 2)) this.audio.step()
      this.lastFrame = f
    } else {
      this.animT = 0
      this.lastFrame = 0
    }

    // proximity prompt
    const near = this.entered ? null : nearStation(this.world, this.x, this.y)
    if (near?.id !== this.near?.id) {
      this.near = near
      this.handlers.onNear(near)
      if (near) this.audio.blip()
    }
    // walking into the door enters it
    if (blockedUp && this.near?.kind === "game" && now > this.armedAt) this.enter(this.near)

    // camera: smooth follow, clamped to the world (centred when the view is larger)
    const vw = this.renderer.w
    const vh = this.renderer.h
    const tx =
      vw >= this.world.w
        ? (this.world.w - vw) / 2
        : Math.max(0, Math.min(this.world.w - vw, this.x - vw / 2))
    const ty =
      vh >= this.world.h
        ? (this.world.h - vh) / 2
        : Math.max(0, Math.min(this.world.h - vh, this.y - vh * 0.6))
    if (this.firstFrame || this.reduced) {
      this.camX = tx
      this.camY = ty
      this.firstFrame = false
    } else {
      const k = 1 - Math.exp(-7 * dt)
      this.camX += (tx - this.camX) * k
      this.camY += (ty - this.camY) * k
    }
  }
}
