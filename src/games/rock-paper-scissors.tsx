import { useEffect, useRef, useState } from "react"
import type { GestureRecognizer, NormalizedLandmark } from "@mediapipe/tasks-vision"

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type Move = "rock" | "paper" | "scissors"
type Phase = "start" | "play" | "over"
type Step = "ready" | "shake" | "reveal"
type CamStatus = "off" | "loading" | "on" | "error"
type Outcome = "win" | "lose" | "tie"

const MOVES: Move[] = ["rock", "paper", "scissors"]
const LABEL: Record<Move, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" }
const KEYS: Record<string, Move> = { r: "rock", p: "paper", s: "scissors" }
const WINS_AGAINST: Record<Move, Move> = { rock: "scissors", paper: "rock", scissors: "paper" }
const GESTURE_TO_MOVE: Record<string, Move> = {
  Closed_Fist: "rock",
  Open_Palm: "paper",
  Victory: "scissors",
}

const WIN_SCORE = 3
const BEST_KEY = "pixel-games:rock-paper-scissors:best-streak"
const BEAT_MS = 700
const BEATS = ["Rock", "Paper", "Scissors", "Shoot!"]
const HAND_HOLD_MS = 500
const HAND_WAIT_MAX_MS = 8000
const THROW_FROM_MS = 120 // gestures count from this long after SHOOT
const THROW_WAIT_MS = 700 // ...until this long after SHOOT
const LOCK_MS = 600
const THUMB_HOLD_MS = 600 // hold a thumbs up this long to start
const MIN_SCORE = 0.6
const WASM_PATH = "/mediapipe/wasm"
const MODEL_PATH = "/mediapipe/gesture_recognizer.task"

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */

function readBest(): number {
  try {
    const raw = window.localStorage.getItem(BEST_KEY)
    const n = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch (_e) {
    return 0
  }
}

function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value))
  } catch (_e) {
    // storage unavailable (private mode, blocked) - ignore
  }
}

/* ------------------------------------------------------------------ */
/* Game logic                                                          */
/* ------------------------------------------------------------------ */

function judge(player: Move, cpu: Move): Outcome {
  if (player === cpu) return "tie"
  return WINS_AGAINST[player] === cpu ? "win" : "lose"
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch (_e) {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Gesture detection helpers                                           */
/* ------------------------------------------------------------------ */

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

// Fallback when the recognizer has no confident label: count extended fingers.
function moveFromLandmarks(lm: NormalizedLandmark[]): Move | null {
  if (lm.length < 21) return null
  const wrist = lm[0]
  // [tip, pip] for index, middle, ring, pinky
  const pairs: [number, number][] = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ]
  const ext = pairs.map(([tip, pip]) => dist(lm[tip], wrist) > dist(lm[pip], wrist) * 1.1)
  const count = ext.filter(Boolean).length
  if (count === 0) return "rock"
  if (ext[0] && ext[1] && !ext[2] && !ext[3]) return "scissors"
  if (count >= 4) return "paper"
  return null
}

// Bones of the 21-point hand model, used to draw the tracking overlay
const HAND_BONES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

// Draws only the tracked hand skeleton (mirrored like a mirror); the camera
// image itself is never shown.
function drawHand(canvas: HTMLCanvasElement | null, lm: NormalizedLandmark[] | null) {
  const ctx = canvas?.getContext("2d")
  if (!canvas || !ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  if (!lm || lm.length < 21) return
  const px = (p: NormalizedLandmark): [number, number] => [(1 - p.x) * w, p.y * h]
  ctx.lineWidth = 2
  ctx.lineCap = "round"
  ctx.strokeStyle = "#C49D71"
  ctx.beginPath()
  for (const [a, b] of HAND_BONES) {
    const [x1, y1] = px(lm[a])
    const [x2, y2] = px(lm[b])
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  ctx.stroke()
  ctx.fillStyle = "#2DD4BF"
  for (const p of lm) {
    const [x, y] = px(p)
    ctx.beginPath()
    ctx.arc(x, y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
}

type Sample = { t: number; move: Move | null; hand: boolean }

function readVote(samples: Sample[], from: number, to: number): Move | null {
  const counts: Record<Move, number> = { rock: 0, paper: 0, scissors: 0 }
  let valid = 0
  for (const s of samples) {
    if (s.t >= from && s.t <= to && s.move) {
      counts[s.move]++
      valid++
    }
  }
  if (valid < 3) return null
  const top = MOVES.reduce((a, b) => (counts[b] > counts[a] ? b : a))
  return counts[top] / valid >= 0.6 ? top : null
}

async function loadRecognizer(): Promise<GestureRecognizer> {
  const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision")
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
  const make = (delegate: "GPU" | "CPU") =>
    GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO",
      numHands: 1,
    })
  try {
    return await make("GPU")
  } catch (_e) {
    return await make("CPU")
  }
}

/* ------------------------------------------------------------------ */
/* Pixel hand sprites                                                  */
/* ------------------------------------------------------------------ */

// "Pixel Hand Gesture Cursor Asset" by Lintnaya, CC0: https://lintnaya.itch.io/pixel-hand-gesture-asset
// 16x16 sprites in public/sprites/hands, drawn scaled up with nearest-neighbour.
export type PoseName = Move | "fist" | "thumbsUp" | "middleFinger" | "rockOn" | "point"

const SPRITE: Record<PoseName, string> = {
  rock: "/sprites/hands/rock.png",
  fist: "/sprites/hands/rock.png",
  paper: "/sprites/hands/paper.png",
  scissors: "/sprites/hands/scissors.png",
  thumbsUp: "/sprites/hands/thumbs-up.png",
  middleFinger: "/sprites/hands/middle-finger.png",
  rockOn: "/sprites/hands/rock-on.png",
  point: "/sprites/hands/point.png",
}
const POSE_LABEL: Record<PoseName, string> = {
  rock: "Rock",
  fist: "Fist",
  paper: "Paper",
  scissors: "Scissors",
  thumbsUp: "Thumbs up",
  middleFinger: "Middle finger",
  rockOn: "Rock on",
  point: "Point",
}
const CYCLE: PoseName[] = [
  "rock",
  "paper",
  "scissors",
  "thumbsUp",
  "middleFinger",
  "rockOn",
  "point",
]

const PIXEL_FONT = { fontFamily: '"Press Start 2P", ui-monospace, monospace' } as const

type HandAnim = "pump" | "pop" | "shake" | "flip"

// Motion for a sprite swap. Skipped entirely for reduced-motion users.
function animateHand(el: HTMLElement | null, kind: HandAnim) {
  if (!el || prefersReducedMotion()) return
  const frames: Record<HandAnim, [Keyframe[], KeyframeAnimationOptions]> = {
    pump: [
      [
        { transform: "translateY(0)" },
        { transform: "translateY(-24px)" },
        { transform: "translateY(0)" },
      ],
      { duration: BEAT_MS * 0.7, easing: "ease-in-out" },
    ],
    pop: [
      [
        { transform: "scale(0.4) rotate(-10deg)", filter: "brightness(2.2)" },
        { transform: "scale(1.3) rotate(4deg)", filter: "brightness(1.5)", offset: 0.55 },
        { transform: "scale(1) rotate(0)", filter: "brightness(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(.2,1.3,.4,1)" },
    ],
    shake: [
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-10px)" },
        { transform: "translateX(10px)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "steps(5)" },
    ],
    flip: [
      [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: 320, easing: "steps(4)" },
    ],
  }
  const [keyframes, options] = frames[kind]
  el.animate(keyframes, options)
}

function HandSprite({
  pose,
  anim,
  size,
  className = "",
}: {
  pose: PoseName
  anim?: { kind: HandAnim; tick: number }
  size?: number
  className?: string
}) {
  const ref = useRef<HTMLImageElement>(null)
  const tick = anim?.tick ?? 0
  const kind = anim?.kind
  useEffect(() => {
    if (tick > 0 && kind) animateHand(ref.current, kind)
  }, [tick, kind])
  return (
    <img
      ref={ref}
      src={SPRITE[pose]}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={16}
      height={16}
      className={`select-none ${className}`}
      style={{ imageRendering: "pixelated", width: size }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Game component                                                      */
/* ------------------------------------------------------------------ */

export default function RockPaperScissors() {
  const [phase, setPhase] = useState<Phase>("start")
  const [step, setStep] = useState<Step>("ready")
  const [you, setYou] = useState(0)
  const [cpu, setCpu] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(readBest)
  const [beat, setBeat] = useState("")
  const [cue, setCue] = useState(-1)
  const [locked, setLocked] = useState<Move | null>(null)
  const [thumbP, setThumbP] = useState(0)
  const [status, setStatus] = useState("")
  const [cpuMove, setCpuMove] = useState<Move | null>(null)
  const [cpuPose, setCpuPose] = useState<PoseName>("rock")
  const [pumpTick, setPumpTick] = useState(0)
  const [popTick, setPopTick] = useState(0)
  const [cam, setCam] = useState<CamStatus>("off")
  const [camError, setCamError] = useState("")
  const [seen, setSeen] = useState<Move | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizerRef = useRef<GestureRecognizer | null>(null)
  const samplesRef = useRef<Sample[]>([])
  const seenRef = useRef<Move | null>(null)
  const timersRef = useRef(new Set<number>())
  const aliveRef = useRef(true)
  const stepRef = useRef<Step>("ready")
  const phaseRef = useRef<Phase>("start")
  const startRef = useRef<() => void>(() => {})
  const armedRef = useRef(true)
  const thumbSinceRef = useRef<number | null>(null)
  const thumbPRef = useRef(0)
  const scoreRef = useRef({ you: 0, cpu: 0, streak: 0, best: 0 })

  const stageOn = phase !== "start"

  useEffect(() => {
    scoreRef.current.best = best
  }, [best])

  const goStep = (next: Step) => {
    stepRef.current = next
    setStep(next)
  }

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        timersRef.current.delete(id)
        resolve()
      }, ms)
      timersRef.current.add(id)
    })

  const cancelRound = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current.clear()
  }

  /* ---------- camera + recognizer ---------- */
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recognizerRef.current?.close()
    recognizerRef.current = null
    samplesRef.current = []
    seenRef.current = null
    setSeen(null)
    setCam("off")
  }

  const startCamera = async () => {
    if (cam === "loading" || cam === "on") return
    setCam("loading")
    setCamError("")
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser can't use the camera.")
      }
      const [streamRes, recRes] = await Promise.allSettled([
        navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        }),
        loadRecognizer(),
      ])
      const stream = streamRes.status === "fulfilled" ? streamRes.value : null
      const rec = recRes.status === "fulfilled" ? recRes.value : null
      if (!aliveRef.current || !stream || !rec) {
        stream?.getTracks().forEach((t) => t.stop())
        rec?.close()
        if (!aliveRef.current) return
        if (!stream) {
          const denied =
            streamRes.status === "rejected" &&
            streamRes.reason instanceof DOMException &&
            streamRes.reason.name === "NotAllowedError"
          throw new Error(
            denied
              ? "Camera permission was denied."
              : "No camera was found or it couldn't be opened."
          )
        }
        throw new Error("The hand tracker failed to load.")
      }
      stream.getVideoTracks().forEach((t) => {
        t.onended = () => {
          if (aliveRef.current && streamRef.current === stream) {
            stopCamera()
            setCam("error")
            setCamError("The camera disconnected.")
          }
        }
      })
      streamRef.current = stream
      recognizerRef.current = rec
      setCam("on")
      setStatus("Camera ready. Show a thumbs up to start a round.")
    } catch (e) {
      setCam("error")
      setCamError(e instanceof Error ? e.message : "The camera couldn't start.")
    }
  }

  // Attach the stream to the preview element once both exist
  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (cam !== "on" || !video || !stream) return
    if (video.srcObject !== stream) {
      video.srcObject = stream
      video.play().catch(() => {})
    }
  }, [cam, stageOn])

  // Detection loop: runs only while the camera is on
  useEffect(() => {
    if (cam !== "on") return
    let raf = 0
    let lastRun = 0
    let lastTime = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const video = videoRef.current
      const rec = recognizerRef.current
      if (!video || !rec || video.readyState < 2) return
      const now = performance.now()
      if (now - lastRun < 33 || video.currentTime === lastTime) return
      lastRun = now
      lastTime = video.currentTime
      let move: Move | null = null
      let hand: boolean
      let thumb: boolean
      try {
        const res = rec.recognizeForVideo(video, now)
        drawHand(trackRef.current, res.landmarks[0] ?? null)
        hand = res.landmarks.length > 0
        const top = res.gestures[0]?.[0]
        thumb = !!top && top.categoryName === "Thumb_Up" && top.score >= MIN_SCORE
        if (top && top.score >= MIN_SCORE && GESTURE_TO_MOVE[top.categoryName]) {
          move = GESTURE_TO_MOVE[top.categoryName]
        } else if (res.landmarks[0] && !thumb) {
          move = moveFromLandmarks(res.landmarks[0])
        }
      } catch (_e) {
        return
      }
      // A held thumbs up starts the next round (or a rematch)
      let progress = 0
      if (thumb && stepRef.current === "ready" && phaseRef.current !== "start") {
        thumbSinceRef.current ??= now
        progress = Math.min(1, (now - thumbSinceRef.current) / THUMB_HOLD_MS)
        if (progress >= 1 && armedRef.current) {
          armedRef.current = false
          thumbSinceRef.current = null
          progress = 0
          startRef.current()
        }
      } else {
        thumbSinceRef.current = null
        if (stepRef.current === "ready") armedRef.current = true
      }
      const stepped = Math.round(progress * 5) / 5
      if (thumbPRef.current !== stepped) {
        thumbPRef.current = stepped
        setThumbP(stepped)
      }
      const samples = samplesRef.current
      samples.push({ t: now, move, hand })
      while (samples.length && samples[0].t < now - 1500) samples.shift()
      if (seenRef.current !== move) {
        seenRef.current = move
        setSeen(move)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cam])

  /* ---------- cleanup on unmount, pause when hidden ---------- */
  useEffect(() => {
    aliveRef.current = true
    const timers = timersRef.current
    const onVisibility = () => {
      if (document.hidden && stepRef.current === "shake") {
        timers.forEach((id) => window.clearTimeout(id))
        timers.clear()
        setCpuPose("rock")
        stepRef.current = "ready"
        setStep("ready")
        setBeat("")
        setCue(-1)
        setStatus("Round paused. Throw again when you're ready.")
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      aliveRef.current = false
      document.removeEventListener("visibilitychange", onVisibility)
      timers.forEach((id) => window.clearTimeout(id))
      timers.clear()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      recognizerRef.current?.close()
      recognizerRef.current = null
    }
  }, [])

  /* ---------- round flow ---------- */
  const runRound = async (picked: Move | null) => {
    if (stepRef.current !== "ready" || phase !== "play") return
    const reduced = prefersReducedMotion()
    const beatMs = reduced ? 380 : BEAT_MS
    // The CPU commits to its move now, before it can see anything of yours
    const cpuPick = MOVES[Math.floor(Math.random() * MOVES.length)]
    goStep("shake")
    setCpuMove(null)
    setLocked(null)
    setCue(-1)
    samplesRef.current = []
    setCpuPose("rock")

    // 1. Camera mode: wait until the hand is steadily in view
    if (!picked) {
      setBeat("Show your hand")
      setStatus("Hold your hand up so the camera can see it.")
      const t0 = performance.now()
      for (;;) {
        await sleep(100)
        const now = performance.now()
        const recent = samplesRef.current.filter((x) => x.t >= now - HAND_HOLD_MS)
        if (recent.length >= 6 && recent.every((x) => x.hand)) break
        if (now - t0 > HAND_WAIT_MAX_MS) {
          setBeat("")
          goStep("ready")
          setStatus("I couldn't see your hand. Move it into the frame and try again.")
          return
        }
      }
      setBeat("Got it")
      setStatus("Pump your fist with each beat and throw on SHOOT.")
      await sleep(900)
    } else {
      setStatus(`You chose ${LABEL[picked]}. Get ready…`)
      await sleep(250)
    }

    // 2. Rock... Paper... Scissors... SHOOT
    let shootAt = 0
    for (let i = 0; i < BEATS.length; i++) {
      setCue(i)
      setBeat(BEATS[i])
      if (i < 3) setPumpTick((t) => t + 1)
      if (i === 3) {
        shootAt = performance.now()
        setStatus(picked ? "Shoot!" : "Throw now!")
        break
      }
      await sleep(beatMs)
    }

    // 3. Read the throw, show what was locked in, then reveal the CPU's move
    let player = picked
    if (!player) {
      await sleep(THROW_WAIT_MS)
      player = readVote(samplesRef.current, shootAt + THROW_FROM_MS, shootAt + THROW_WAIT_MS)
    } else {
      await sleep(350)
    }
    if (!player) {
      setBeat("")
      setCue(-1)
      goStep("ready")
      setStatus("I didn't catch a clear throw. Hold your shape through SHOOT and try again.")
      return
    }
    setLocked(player)
    setBeat(`You: ${LABEL[player]}`)
    setStatus(`Locked in ${LABEL[player]}…`)
    await sleep(reduced ? 300 : LOCK_MS)

    setCpuPose(cpuPick)
    setPopTick((t) => t + 1)
    setCpuMove(cpuPick)
    goStep("reveal")

    const outcome = judge(player, cpuPick)
    const sc = scoreRef.current
    if (outcome === "win") {
      sc.you++
      sc.streak++
      if (sc.streak > sc.best) {
        sc.best = sc.streak
        setBest(sc.best)
        writeBest(sc.best)
      }
    } else if (outcome === "lose") {
      sc.cpu++
      sc.streak = 0
    }
    setYou(sc.you)
    setCpu(sc.cpu)
    setStreak(sc.streak)
    const text =
      outcome === "tie"
        ? `Both chose ${LABEL[player]}. Tie, go again.`
        : outcome === "win"
          ? `${LABEL[player]} beats ${LABEL[cpuPick]}. You win the round!`
          : `${LABEL[cpuPick]} beats ${LABEL[player]}. CPU wins the round.`
    setBeat(outcome === "tie" ? "Tie" : outcome === "win" ? "You win" : "CPU wins")
    setStatus(text)
    await sleep(reduced ? 900 : 1800)

    setBeat("")
    setCue(-1)
    setLocked(null)
    if (sc.you >= WIN_SCORE || sc.cpu >= WIN_SCORE) {
      setPhase("over")
      setStatus(
        sc.you >= WIN_SCORE ? "You won the match!" : "The CPU hand took the match. Rematch?"
      )
    }
    goStep("ready")
  }

  const resetMatch = () => {
    cancelRound()
    scoreRef.current = { ...scoreRef.current, you: 0, cpu: 0, streak: 0 }
    setYou(0)
    setCpu(0)
    setStreak(0)
    setCpuMove(null)
    setBeat("")
    setCue(-1)
    setLocked(null)
    setStatus("First to 3 wins. Pick a move or throw with your hand.")
    setCpuPose("rock")
    goStep("ready")
    setPhase("play")
  }

  const begin = (withCamera: boolean) => {
    resetMatch()
    if (withCamera) void startCamera()
  }

  // R / P / S keyboard shortcuts while a round can start
  useEffect(() => {
    if (phase !== "play") return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const move = KEYS[e.key.toLowerCase()]
      if (move && stepRef.current === "ready") void runRound(move)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // runRound reads only refs and setters, so the latest render's copy is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    phaseRef.current = phase
    startRef.current = () => {
      if (phaseRef.current === "over") resetMatch()
      else void runRound(null)
    }
  })

  const busy = step !== "ready"
  const stageLabel = cpuMove
    ? `CPU shows ${LABEL[cpuMove]}`
    : "The CPU hand is pumping its fist, ready to play"

  return (
    <div className="mx-auto w-full max-w-md font-sans text-fg">
      <div className="mb-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface text-center">
        {[
          { label: "You", value: you, color: "text-gold" },
          { label: "CPU", value: cpu, color: "text-teal" },
          { label: "Streak", value: streak, color: "text-muted" },
        ].map((s) => (
          <div key={s.label} className="px-2 py-3">
            <div className={`text-xs uppercase tracking-wider ${s.color}`}>{s.label}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>
      <p className="mb-3 text-center text-xs uppercase tracking-wider text-faint">
        First to {WIN_SCORE} · Best streak{" "}
        <span className="font-mono tabular-nums text-muted">{best}</span>
      </p>

      <p
        role="status"
        aria-live="polite"
        className="mb-4 min-h-[3rem] text-center text-base text-muted"
      >
        {status}
      </p>

      {phase === "start" ? (
        <div className="flex flex-col items-center gap-5 rounded-xl border border-line bg-surface px-4 py-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Rock Paper Scissors</h2>
          <p className="max-w-xs text-sm text-muted">
            Face a 3D CPU hand. Throw rock, paper or scissors with your own hand on camera, or just
            tap a button. Your camera image is never shown or sent anywhere. Only a hand outline is
            drawn.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => begin(true)}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-gold/90"
            >
              Play with camera
            </button>
            <button
              type="button"
              onClick={() => begin(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-teal hover:text-teal"
            >
              Play with buttons
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            role="img"
            aria-label={stageLabel}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 border-line bg-surface"
          >
            {/* CRT scanlines */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 opacity-40"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center pb-10">
              <HandSprite
                pose={cpuPose}
                anim={
                  popTick > pumpTick
                    ? { kind: "pop", tick: popTick }
                    : { kind: "pump", tick: pumpTick }
                }
                className="w-[44%] max-w-[15rem]"
              />
            </div>
            <span
              className="absolute left-3 top-3 text-[10px] uppercase tracking-wider text-teal"
              style={PIXEL_FONT}
            >
              CPU
            </span>
            {locked && (
              <div className="absolute bottom-12 left-3 z-10 flex flex-col items-center gap-1">
                <HandSprite pose={locked} anim={{ kind: "shake", tick: 1 }} className="w-14" />
                <span className="text-[8px] uppercase text-gold" style={PIXEL_FONT}>
                  You
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
              {beat && (
                <span
                  aria-hidden="true"
                  className={`inline-block border-2 bg-bg/90 px-3 py-2 text-sm uppercase ${cue === 3 ? "border-teal text-teal" : "border-gold text-gold"}`}
                  style={PIXEL_FONT}
                >
                  {beat}
                </span>
              )}
            </div>
            {(cam === "on" || cam === "loading") && (
              <div className="absolute bottom-3 right-3 w-[30%] overflow-hidden rounded-lg border border-line bg-surface-2">
                {/* Feeds the tracker only: kept in the DOM so it decodes, but never visible */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  aria-hidden="true"
                  tabIndex={-1}
                  className="pointer-events-none absolute left-0 top-0 size-px opacity-0"
                />
                <canvas
                  ref={trackRef}
                  width={160}
                  height={120}
                  role="img"
                  aria-label="Hand tracking view"
                  className="block aspect-[4/3] w-full"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 origin-left bg-teal transition-transform"
                  style={{ transform: `scaleX(${thumbP})` }}
                />
                <span className="absolute inset-x-0 bottom-0 bg-bg/70 py-0.5 text-center text-[10px] uppercase tracking-wider text-muted">
                  {cam === "loading"
                    ? "Loading…"
                    : thumbP > 0
                      ? "Thumbs up…"
                      : seen
                        ? LABEL[seen]
                        : "No hand"}
                </span>
              </div>
            )}
          </div>

          <ol
            aria-hidden="true"
            className="mt-3 grid grid-cols-4 gap-2 text-center text-[9px] uppercase"
            style={PIXEL_FONT}
          >
            {BEATS.map((word, i) => (
              <li
                key={word}
                className={`border-2 py-2 transition-colors ${
                  cue >= i
                    ? i === 3
                      ? "border-teal bg-teal-soft text-teal"
                      : "border-gold bg-gold-soft text-gold"
                    : "border-line text-faint"
                }`}
              >
                {word}
              </li>
            ))}
          </ol>
          {cam === "on" && step === "ready" && (
            <p className="mt-2 text-center text-sm text-teal">
              {thumbP > 0
                ? "Hold it…"
                : phase === "over"
                  ? "Show a thumbs up to play again"
                  : "Show a thumbs up to start the round"}
            </p>
          )}
          {locked && (
            <p className="mt-2 text-center text-sm text-muted">
              Your throw: <span className="text-gold">{LABEL[locked]}</span>
            </p>
          )}

          {cam === "error" && (
            <p className="mt-3 text-center text-sm text-faint">
              {camError} You can still play with the buttons below.
            </p>
          )}

          {phase === "over" ? (
            <div className="mt-5 flex flex-col items-center gap-3 text-center">
              <h2 className="text-lg font-semibold">
                {you >= WIN_SCORE ? "You win the match" : "CPU wins the match"}
              </h2>
              <p className="font-mono text-sm tabular-nums text-muted">
                {you} – {cpu}
              </p>
              <button
                type="button"
                onClick={() => resetMatch()}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-gold/90"
              >
                Play again
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-3">
              {cam === "on" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runRound(null)}
                  aria-label="Throw with your hand on camera"
                  className="rounded-lg bg-gold px-5 py-2 text-sm font-medium text-bg transition-colors hover:bg-gold/90 disabled:opacity-50"
                >
                  Throw with camera
                </button>
              )}
              <div
                className="flex flex-wrap justify-center gap-2"
                role="group"
                aria-label="Choose a move"
              >
                {MOVES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={busy}
                    onClick={() => void runRound(m)}
                    aria-label={`Play ${LABEL[m]}`}
                    className="rounded-lg border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-teal hover:text-teal disabled:opacity-50"
                  >
                    {LABEL[m]}
                    <span className="ml-1.5 font-mono text-xs uppercase text-faint">{m[0]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => (cam === "on" ? stopCamera() : void startCamera())}
                disabled={cam === "loading" || busy}
                className="text-sm text-faint underline-offset-4 transition-colors hover:text-teal hover:underline disabled:opacity-50"
              >
                {cam === "on"
                  ? "Turn camera off"
                  : cam === "loading"
                    ? "Starting camera…"
                    : "Turn camera on"}
              </button>
            </div>
          )}
        </>
      )}
      <p className="mt-6 text-center text-xs text-faint">
        Hand sprites:{" "}
        <a
          href="https://lintnaya.itch.io/pixel-hand-gesture-asset"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:text-teal hover:underline"
        >
          Pixel Hand Gesture Cursor Asset
        </a>{" "}
        by Lintnaya (CC0)
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Hand debug page (route: /debug/hand)                                */
/* ------------------------------------------------------------------ */

const ANIMS: { id: HandAnim; label: string }[] = [
  { id: "pop", label: "Pop" },
  { id: "pump", label: "Pump" },
  { id: "shake", label: "Shake" },
  { id: "flip", label: "Flip" },
]

export function HandDebug() {
  const [pose, setPose] = useState<PoseName>("rock")
  const [kind, setKind] = useState<HandAnim>("pop")
  const [tick, setTick] = useState(0)
  const [auto, setAuto] = useState(false)
  const [scale, setScale] = useState(12)
  const indexRef = useRef(0)

  const choose = (name: PoseName) => {
    setPose(name)
    setTick((t) => t + 1)
    const at = CYCLE.indexOf(name)
    if (at >= 0) indexRef.current = at
  }
  const next = () => choose(CYCLE[(indexRef.current + 1) % CYCLE.length])

  useEffect(() => {
    if (!auto) return
    const id = window.setInterval(() => {
      indexRef.current = (indexRef.current + 1) % CYCLE.length
      setPose(CYCLE[indexRef.current])
      setTick((t) => t + 1)
    }, 1400)
    return () => window.clearInterval(id)
  }, [auto])

  const btn =
    "border-2 border-line px-3 py-2 text-[10px] uppercase text-fg transition-colors hover:border-teal hover:text-teal"

  return (
    <div className="mx-auto w-full max-w-xl font-sans text-fg">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Hand sprites</h1>
      <p className="mb-4 text-sm text-muted">
        Click the hand to cycle gestures, pick a transition, or auto-cycle to watch the swaps.
      </p>
      <button
        type="button"
        onClick={next}
        aria-label={`Hand showing ${POSE_LABEL[pose]}. Click for the next gesture.`}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-2 border-line bg-surface"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)",
          }}
        />
        <HandSprite pose={pose} anim={{ kind, tick }} size={scale * 16} />
      </button>
      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Gestures"
        style={PIXEL_FONT}
      >
        {CYCLE.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => choose(name)}
            aria-pressed={pose === name}
            className={`${btn} ${pose === name ? "!border-gold !text-gold" : ""}`}
          >
            {POSE_LABEL[name]}
          </button>
        ))}
      </div>
      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Transition"
        style={PIXEL_FONT}
      >
        {ANIMS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setKind(a.id)
              setTick((t) => t + 1)
            }}
            aria-pressed={kind === a.id}
            className={`${btn} ${kind === a.id ? "!border-teal !text-teal" : ""}`}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAuto((v) => !v)}
          aria-pressed={auto}
          className={btn}
        >
          {auto ? "Stop" : "Auto-cycle"}
        </button>
      </div>
      <label className="mt-4 flex items-center gap-3 text-xs text-muted">
        Scale
        <input
          type="range"
          min={4}
          max={20}
          value={scale}
          onChange={(e) => setScale(parseInt(e.target.value, 10))}
          aria-label="Sprite scale"
          className="accent-gold"
        />
        <span className="font-mono tabular-nums">{scale}x</span>
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

export function Preview() {
  // 32x20 thumbnail: a fist, an open palm and a pair of scissor fingers
  return (
    <svg
      viewBox="0 0 32 20"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect width="32" height="20" fill="#0a0a0a" />
      <rect x="3" y="7" width="7" height="7" rx="2.5" fill="#C49D71" />
      <rect x="12.5" y="9" width="7" height="6" rx="1.5" fill="#141414" stroke="#C49D71" />
      {[13.4, 15, 16.6, 18.2].map((x) => (
        <rect key={x} x={x} y="4" width="1.1" height="5.5" rx="0.55" fill="#C49D71" />
      ))}
      <rect x="23" y="11" width="6" height="5" rx="1.5" fill="#C49D71" />
      <line
        x1="24.6"
        y1="11"
        x2="23.4"
        y2="4.5"
        stroke="#2DD4BF"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <line
        x1="27.2"
        y1="11"
        x2="28.4"
        y2="4.5"
        stroke="#2DD4BF"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
