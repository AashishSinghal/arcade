import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Link, useNavigate } from "react-router"
import { games } from "@/registry"
import { useDocumentTitle } from "@/lib/use-document-title"
import { MapAudio, readSoundPref, writeSoundPref } from "./audio"
import { loadPos, MapEngine } from "./engine"
import { comingSoon, type Station } from "./world"

const SEEN_KEY = "arcade-intro-seen"

function introSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1"
  } catch {
    return false
  }
}

function markIntroSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1")
  } catch {
    /* ignore */
  }
}

function KeyCap({ children, wide }: { children: string; wide?: boolean }) {
  return (
    <kbd
      className={`grid h-9 place-items-center border-2 border-teal bg-surface-2 font-label text-[11px] text-fg shadow-[0_3px_0_#0b0820,0_0_10px_#19f0ff66] ${
        wide ? "min-w-16 px-2" : "w-9"
      }`}
    >
      {children}
    </kbd>
  )
}

function IntroModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startRef.current?.focus()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== "Tab") return
    const items = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]")
    if (!items?.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-bg/75 p-4 backdrop-blur-[2px]"
      onKeyDown={onKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        className="neon-box w-full max-w-md bg-surface/95 p-5 text-center sm:p-7"
      >
        <p className="font-pixel text-sm text-teal">ようこそ</p>
        <h2
          id="intro-title"
          className="neon-text-pink mt-1 font-pixel text-2xl leading-tight sm:text-3xl"
        >
          WELCOME TO THE ARCADE
        </h2>
        <p className="mt-3 text-sm text-muted">
          A rainy night in a tiny neon alley. Walk up it and explore.
        </p>

        <div
          className="mt-5 flex items-center justify-center gap-5"
          aria-label="Controls: W A S D or the arrow keys"
        >
          <div className="grid grid-cols-3 gap-1">
            <span />
            <KeyCap>W</KeyCap>
            <span />
            <KeyCap>A</KeyCap>
            <KeyCap>S</KeyCap>
            <KeyCap>D</KeyCap>
          </div>
          <span className="font-pixel text-sm text-faint">or</span>
          <div className="grid grid-cols-3 gap-1">
            <span />
            <KeyCap>↑</KeyCap>
            <span />
            <KeyCap>←</KeyCap>
            <KeyCap>↓</KeyCap>
            <KeyCap>→</KeyCap>
          </div>
        </div>

        <p className="mt-5 font-pixel text-base text-fg">Walk into a door or press Enter to play</p>
        <Legend />
        <p className="mt-1 text-xs text-faint">On a phone, use the on-screen pad.</p>

        <button
          ref={startRef}
          type="button"
          onClick={onClose}
          className="mt-6 w-full border-2 border-pink bg-pink/15 px-6 py-3 font-label text-sm text-fg shadow-[0_0_16px_#ff2e9788] transition-colors hover:bg-pink/30"
        >
          START
        </button>
        <Link
          to="/games"
          className="mt-4 inline-block font-pixel text-sm text-teal underline underline-offset-4"
        >
          Prefer a plain text list?
        </Link>
      </div>
    </div>
  )
}

/** Tiny pixel swatches: a glowing playable shop, a dim coming-soon shop, plain scenery. */
function Swatch({ kind }: { kind: "game" | "soon" | "scenery" }) {
  const c =
    kind === "game"
      ? { wall: "#4a2a7a", sign: "#ff2e97", door: "#ffe2b0", edge: "#ff2e97" }
      : kind === "soon"
        ? { wall: "#16123a", sign: "#6d62a8", door: "#2c2758", edge: "#3a3470" }
        : { wall: "#1f1f48", sign: "#4d4a80", door: "#191838", edge: "#2c2a52" }
  return (
    <svg
      width="36"
      height="30"
      viewBox="0 0 18 15"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {kind === "game" && <rect x="0" y="4" width="18" height="11" fill="#ff2e9744" />}
      <rect x="2" y="3" width="14" height="12" fill={c.wall} />
      <rect x="3" y="4" width="12" height="3" fill={c.sign} />
      <rect x="7" y="9" width="4" height="6" fill={c.door} stroke={c.edge} strokeWidth="0.5" />
      {kind === "game" && <path d="M7 0h4v1h-1v1H8V1H7z" fill="#ff2e97" />}
      {kind === "soon" && <rect x="7" y="12" width="4" height="1" fill="#8a7a3a" />}
    </svg>
  )
}

function Legend() {
  const rows = [
    ["game", "Glowing shop with a bouncing arrow: a playable game"],
    ["soon", "Dim shop with a shutter: coming soon"],
    ["scenery", "Everything else is scenery"],
  ] as const
  return (
    <ul className="mt-4 space-y-1.5 text-left" aria-label="Legend">
      {rows.map(([kind, text]) => (
        <li key={kind} className="flex items-center gap-3 text-sm text-muted">
          <Swatch kind={kind} />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

const padBtn =
  "grid size-14 touch-none select-none place-items-center border-2 border-teal/80 bg-surface/80 font-label text-lg text-teal active:bg-teal/30"

function TouchControls({ engine }: { engine: React.RefObject<MapEngine | null> }) {
  const dirs = useRef({ up: false, down: false, left: false, right: false })
  const push = () => {
    const d = dirs.current
    engine.current?.setVirtual(
      (d.right ? 1 : 0) - (d.left ? 1 : 0),
      (d.down ? 1 : 0) - (d.up ? 1 : 0)
    )
  }
  const bind = (dir: keyof typeof dirs.current) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      dirs.current[dir] = true
      push()
    },
    onPointerUp: () => {
      dirs.current[dir] = false
      push()
    },
    onPointerCancel: () => {
      dirs.current[dir] = false
      push()
    },
  })
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 hidden items-end justify-between p-4 [@media(pointer:coarse)]:flex">
      <div className="pointer-events-auto grid grid-cols-3 gap-1" role="group" aria-label="Move">
        <span />
        <button type="button" aria-label="Move up" className={padBtn} {...bind("up")}>
          ▲
        </button>
        <span />
        <button type="button" aria-label="Move left" className={padBtn} {...bind("left")}>
          ◀
        </button>
        <span />
        <button type="button" aria-label="Move right" className={padBtn} {...bind("right")}>
          ▶
        </button>
        <span />
        <button type="button" aria-label="Move down" className={padBtn} {...bind("down")}>
          ▼
        </button>
        <span />
      </div>
      <button
        type="button"
        aria-label="Enter the shop or action"
        onClick={() => engine.current?.interact()}
        className="pointer-events-auto mb-2 grid size-20 touch-none select-none place-items-center rounded-full border-2 border-pink bg-pink/20 font-label text-xl text-fg shadow-[0_0_14px_#ff2e97aa] active:bg-pink/50"
      >
        A
      </button>
    </div>
  )
}

function Prompt({ station, onPlay }: { station: Station; onPlay: () => void }) {
  const game = station.kind === "game"
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center px-4 [@media(pointer:coarse)]:bottom-auto [@media(pointer:coarse)]:top-16">
      <div className="neon-box pointer-events-auto max-w-sm bg-surface/95 px-4 py-3 text-center">
        <p className="neon-text-cyan font-pixel text-xl leading-tight">
          {station.title}{" "}
          <span className="text-base text-fg/80">
            {station.kind === "soon" ? "近日公開" : station.jp}
          </span>
        </p>
        {game ? (
          <>
            <p className="mt-1 text-xs uppercase tracking-widest text-gold">{station.difficulty}</p>
            <p className="mt-1 text-sm text-muted">{station.controls}</p>
            <p className="mt-2 hidden font-pixel text-sm text-fg [@media(pointer:fine)]:block">
              Press Enter / E or walk into the door to play
            </p>
            <button
              type="button"
              onClick={onPlay}
              className="mt-2 border-2 border-pink bg-pink/15 px-5 py-1.5 font-label text-[11px] text-fg hover:bg-pink/30"
            >
              PLAY
            </button>
          </>
        ) : (
          <p className="mt-1 font-pixel text-sm text-muted">
            Coming soon. This shop is still being built.
          </p>
        )}
      </div>
    </div>
  )
}

const hudBtn =
  "grid size-10 place-items-center border-2 border-line bg-surface/80 font-label text-xs text-fg backdrop-blur transition-colors hover:border-teal hover:text-teal"

export default function MapPage() {
  useDocumentTitle()
  const navigate = useNavigate()
  const navRef = useRef(navigate)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<MapEngine | null>(null)
  const [audio] = useState(() => new MapAudio())
  const [near, setNear] = useState<Station | null>(null)
  const [help, setHelp] = useState(() => !introSeen())
  const [sound, setSound] = useState(readSoundPref)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    navRef.current = navigate
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    let cancelled = false
    let engine: MapEngine | null = null
    let ro: ResizeObserver | null = null
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    MapEngine.create(
      canvas,
      { onNear: setNear, onEnter: (st) => navRef.current(`/${st.slug}`) },
      audio,
      reduced,
      loadPos()
    ).then((e) => {
      if (cancelled) return
      engine = e
      engineRef.current = e
      const fit = () => e.resize(wrap.clientWidth, wrap.clientHeight)
      fit()
      ro = new ResizeObserver(fit)
      ro.observe(wrap)
      e.start()
      setReady(true)
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      engine?.dispose()
      engineRef.current = null
    }
  }, [audio])

  useEffect(() => {
    engineRef.current?.setInputEnabled(!help)
  }, [help, ready])

  // Remembered "sound on" still needs a user gesture before the audio context can start
  useEffect(() => {
    if (!sound) return
    const go = () => void audio.setEnabled(true)
    window.addEventListener("pointerdown", go, { once: true })
    window.addEventListener("keydown", go, { once: true })
    return () => {
      window.removeEventListener("pointerdown", go)
      window.removeEventListener("keydown", go)
    }
  }, [audio, sound])

  useEffect(() => () => audio.dispose(), [audio])

  const closeHelp = useCallback(() => {
    markIntroSeen()
    setHelp(false)
    wrapRef.current?.focus()
  }, [])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    writeSoundPref(next)
    void audio.setEnabled(next)
  }

  const playNear = () => engineRef.current?.interact()
  const soon = comingSoon.map((s) => s.title)

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      role="application"
      aria-label="Neon street map. Use W A S D or the arrow keys to walk. Walk into a shop door or press Enter to play that game. The question mark button shows help."
      className="relative h-full w-full overflow-hidden bg-bg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute left-0 top-0 [image-rendering:pixelated]"
      />

      {!ready && (
        <p className="absolute inset-0 grid place-items-center font-pixel text-lg text-muted">
          Lighting the neon…
        </p>
      )}

      <div className="absolute right-3 top-16 z-20 flex flex-col gap-2">
        <button
          type="button"
          aria-label="Show help"
          onClick={() => setHelp(true)}
          className={hudBtn}
        >
          ?
        </button>
        <button
          type="button"
          aria-label={sound ? "Mute ambient sound" : "Turn ambient sound on"}
          aria-pressed={sound}
          onClick={toggleSound}
          className={hudBtn}
        >
          {sound ? "♪" : "×"}
        </button>
      </div>

      {near && !help && <Prompt station={near} onPlay={playNear} />}
      <p role="status" aria-live="polite" className="sr-only">
        {near
          ? near.kind === "game"
            ? `Near ${near.title}. Press Enter to play.`
            : `Near ${near.title}. Coming soon.`
          : ""}
      </p>

      <nav aria-label="Games">
        <ul className="sr-only">
          {games.map((g) => (
            <li key={g.slug}>
              <Link
                to={`/${g.slug}`}
                className="focus:not-sr-only focus:fixed focus:bottom-4 focus:left-4 focus:z-50 focus:bg-surface focus:px-3 focus:py-2"
              >
                Play {g.title}: {g.description}
              </Link>
            </li>
          ))}
          <li>Coming soon: {soon.join(", ")}</li>
        </ul>
      </nav>

      <TouchControls engine={engineRef} />
      {help && <IntroModal onClose={closeHelp} />}
    </div>
  )
}
