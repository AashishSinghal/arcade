import { useEffect, useReducer, useRef, type KeyboardEvent, type ReactNode } from "react"

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type Mark = "X" | "O"
type Cell = Mark | null
type Mode = "pvp" | "cpu"
type CpuLevel = "easy" | "hard"
type Phase = "start" | "playing" | "over"

const HUMAN: Mark = "X"
const CPU: Mark = "O"
const BEST_KEY = "pixel-games:tic-tac-toe:best-streak"
const CPU_DELAY = 420

const LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

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

function findWinner(board: Cell[]): { winner: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line
    const v = board[a]
    if (v && v === board[b] && v === board[c]) return { winner: v, line }
  }
  return null
}

function emptyCells(board: Cell[]): number[] {
  const out: number[] = []
  board.forEach((c, i) => {
    if (!c) out.push(i)
  })
  return out
}

function other(mark: Mark): Mark {
  return mark === "X" ? "O" : "X"
}

// Classic minimax with depth so the CPU prefers quick wins and slow losses.
function minimax(board: Cell[], toMove: Mark, me: Mark, depth: number): number {
  const result = findWinner(board)
  if (result) return result.winner === me ? 10 - depth : depth - 10
  const moves = emptyCells(board)
  if (moves.length === 0) return 0

  let best = toMove === me ? -Infinity : Infinity
  for (const m of moves) {
    board[m] = toMove
    const score = minimax(board, other(toMove), me, depth + 1)
    board[m] = null
    best = toMove === me ? Math.max(best, score) : Math.min(best, score)
  }
  return best
}

function pickCpuMove(board: Cell[], level: CpuLevel): number {
  const moves = emptyCells(board)
  if (moves.length === 0) return -1
  if (level === "easy") return moves[Math.floor(Math.random() * moves.length)]

  const scratch = [...board]
  let bestScore = -Infinity
  let bestMoves: number[] = []
  for (const m of moves) {
    scratch[m] = CPU
    const score = minimax(scratch, HUMAN, CPU, 1)
    scratch[m] = null
    if (score > bestScore) {
      bestScore = score
      bestMoves = [m]
    } else if (score === bestScore) {
      bestMoves.push(m)
    }
  }
  // random among equally good moves keeps it from feeling robotic
  return bestMoves[Math.floor(Math.random() * bestMoves.length)]
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

type Scores = { X: number; O: number; draw: number }

type State = {
  phase: Phase
  mode: Mode
  level: CpuLevel
  board: Cell[]
  turn: Mark
  starter: Mark
  winner: Mark | "draw" | null
  line: number[] | null
  scores: Scores
  streak: number
  best: number
}

type Action =
  | { type: "setMode"; mode: Mode }
  | { type: "setLevel"; level: CpuLevel }
  | { type: "start" }
  | { type: "move"; index: number }
  | { type: "nextRound" }
  | { type: "menu" }
  | { type: "loadBest"; best: number }

const emptyBoard = (): Cell[] => Array(9).fill(null)
const zeroScores = (): Scores => ({ X: 0, O: 0, draw: 0 })

const initialState: State = {
  phase: "start",
  mode: "cpu",
  level: "hard",
  board: emptyBoard(),
  turn: "X",
  starter: "X",
  winner: null,
  line: null,
  scores: zeroScores(),
  streak: 0,
  best: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode }
    case "setLevel":
      return { ...state, level: action.level }
    case "loadBest":
      return { ...state, best: Math.max(state.best, action.best) }
    case "start":
      return {
        ...state,
        phase: "playing",
        board: emptyBoard(),
        turn: "X",
        starter: "X",
        winner: null,
        line: null,
        scores: zeroScores(),
        streak: 0,
      }
    case "menu":
      return { ...state, phase: "start", board: emptyBoard(), winner: null, line: null }
    case "nextRound": {
      // alternate who goes first each round
      const starter = other(state.starter)
      return {
        ...state,
        phase: "playing",
        board: emptyBoard(),
        starter,
        turn: starter,
        winner: null,
        line: null,
      }
    }
    case "move": {
      if (state.phase !== "playing" || state.board[action.index]) return state
      const board = [...state.board]
      board[action.index] = state.turn
      const result = findWinner(board)
      const full = emptyCells(board).length === 0
      if (!result && !full) return { ...state, board, turn: other(state.turn) }

      const scores = { ...state.scores }
      let { streak, best } = state
      if (result) {
        scores[result.winner] += 1
        if (state.mode === "cpu") {
          if (result.winner === HUMAN) {
            streak += 1
            best = Math.max(best, streak)
          } else {
            streak = 0
          }
        }
      } else {
        scores.draw += 1
      }
      return {
        ...state,
        board,
        phase: "over",
        winner: result ? result.winner : "draw",
        line: result ? result.line : null,
        scores,
        streak,
        best,
      }
    }
    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/* Marks                                                               */
/* ------------------------------------------------------------------ */

function MarkGlyph({ mark }: { mark: Mark }) {
  return mark === "X" ? <path d="M6 6 L18 18 M18 6 L6 18" /> : <circle cx="12" cy="12" r="6.5" />
}

function MarkIcon({ mark }: { mark: Mark }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`block size-1/2 shrink-0 ${mark === "X" ? "text-gold" : "text-teal"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
    >
      <MarkGlyph mark={mark} />
    </svg>
  )
}

export function Preview() {
  // 32x20 thumbnail: a board with a winning diagonal
  const cells: { x: number; y: number; mark: Mark | null; win?: boolean }[] = [
    { x: 7, y: 1, mark: "X", win: true },
    { x: 13, y: 1, mark: "O" },
    { x: 19, y: 1, mark: null },
    { x: 7, y: 7, mark: null },
    { x: 13, y: 7, mark: "X", win: true },
    { x: 19, y: 7, mark: "O" },
    { x: 7, y: 13, mark: "O" },
    { x: 13, y: 13, mark: null },
    { x: 19, y: 13, mark: "X", win: true },
  ]
  return (
    <svg
      viewBox="0 0 32 20"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <rect width="32" height="20" fill="#0a0a0a" />
      {cells.map((cell) => (
        <g key={`${cell.x}-${cell.y}`}>
          <rect
            x={cell.x + 0.25}
            y={cell.y + 0.25}
            width={5.5}
            height={5.5}
            rx={1}
            fill={cell.win ? "#c49d7126" : "#141414"}
            stroke={cell.win ? "#c49d71" : "#262626"}
            strokeWidth={0.25}
          />
          {cell.mark && (
            <g
              transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) scale(0.2083)`}
              fill="none"
              stroke={cell.mark === "X" ? "#c49d71" : "#2dd4bf"}
              strokeWidth={3}
              strokeLinecap="round"
            >
              <MarkGlyph mark={cell.mark} />
            </g>
          )}
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* UI bits                                                             */
/* ------------------------------------------------------------------ */

function ToggleButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-gold bg-gold-soft text-gold"
          : "border-line text-muted hover:border-teal hover:text-teal"
      }`}
    >
      {children}
    </button>
  )
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-gold/90"
    >
      {children}
    </button>
  )
}

function SecondaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-line px-4 py-2 text-sm text-fg transition-colors hover:border-teal hover:text-teal"
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Game                                                                */
/* ------------------------------------------------------------------ */

export default function TicTacToe() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const { phase, mode, level, board, turn, winner, line, scores, streak, best } = state

  const cpuTurn = mode === "cpu" && turn === CPU && phase === "playing"

  // load best streak once
  useEffect(() => {
    dispatch({ type: "loadBest", best: readBest() })
  }, [])

  // persist best streak when it grows
  useEffect(() => {
    if (best > 0) writeBest(best)
  }, [best])

  // CPU move (timeout cleaned up on unmount / state change)
  useEffect(() => {
    if (!cpuTurn) return
    const t = window.setTimeout(() => {
      const move = pickCpuMove(board, level)
      if (move >= 0) dispatch({ type: "move", index: move })
    }, CPU_DELAY)
    return () => window.clearTimeout(t)
  }, [cpuTurn, board, level])

  const nameOf = (m: Mark) =>
    mode === "cpu" ? (m === HUMAN ? "You" : "CPU") : m === "X" ? "Player 1" : "Player 2"

  let status = ""
  if (phase === "start") status = "Press start to play."
  else if (phase === "playing")
    status = cpuTurn ? "CPU is thinking..." : `${nameOf(turn)} (${turn}) to move.`
  else if (winner === "draw") status = "It's a draw!"
  else if (winner)
    status =
      mode === "cpu"
        ? winner === HUMAN
          ? "You win!"
          : "CPU wins!"
        : `${nameOf(winner)} (${winner}) wins!`

  const handleGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = cellRefs.current.findIndex((el) => el === document.activeElement)
    if (idx < 0) return
    let next: number
    if (e.key === "ArrowRight") next = idx % 3 === 2 ? idx - 2 : idx + 1
    else if (e.key === "ArrowLeft") next = idx % 3 === 0 ? idx + 2 : idx - 1
    else if (e.key === "ArrowDown") next = (idx + 3) % 9
    else if (e.key === "ArrowUp") next = (idx + 6) % 9
    else return
    e.preventDefault()
    cellRefs.current[next]?.focus()
  }

  return (
    <div className="mx-auto w-full max-w-md font-sans text-fg">
      {/* Scoreboard */}
      <div className="mb-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface text-center">
        {(
          [
            { key: "X", label: nameOf("X"), value: scores.X, color: "text-gold" },
            { key: "draw", label: "Draws", value: scores.draw, color: "text-faint" },
            { key: "O", label: nameOf("O"), value: scores.O, color: "text-teal" },
          ] as const
        ).map((s) => (
          <div key={s.key} className="px-2 py-3">
            <div className={`text-xs uppercase tracking-wider ${s.color}`}>{s.label}</div>
            <div className="mt-1 font-mono text-lg tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {mode === "cpu" && (
        <p className="mb-3 text-center text-xs uppercase tracking-wider text-faint">
          Streak <span className="font-mono tabular-nums text-muted">{streak}</span> · Best{" "}
          <span className="font-mono tabular-nums text-muted">{best}</span>
        </p>
      )}

      <p
        aria-live="polite"
        role="status"
        className="mb-4 min-h-[1.5rem] text-center text-base text-muted"
      >
        {status}
      </p>

      {phase === "start" ? (
        <div className="flex flex-col items-center gap-6 rounded-xl border border-line bg-surface px-4 py-8 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Tic Tac Toe</h2>
          <div className="flex gap-3" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center">
              <MarkIcon mark="X" />
            </span>
            <span className="flex h-12 w-12 items-center justify-center">
              <MarkIcon mark="O" />
            </span>
          </div>

          <fieldset className="flex flex-col items-center gap-2">
            <legend className="mb-2 text-xs uppercase tracking-wider text-faint">Mode</legend>
            <div className="flex flex-wrap justify-center gap-2">
              <ToggleButton
                active={mode === "pvp"}
                onClick={() => dispatch({ type: "setMode", mode: "pvp" })}
              >
                2 Players
              </ToggleButton>
              <ToggleButton
                active={mode === "cpu"}
                onClick={() => dispatch({ type: "setMode", mode: "cpu" })}
              >
                Vs CPU
              </ToggleButton>
            </div>
          </fieldset>

          {mode === "cpu" && (
            <fieldset className="flex flex-col items-center gap-2">
              <legend className="mb-2 text-xs uppercase tracking-wider text-faint">CPU</legend>
              <div className="flex flex-wrap justify-center gap-2">
                <ToggleButton
                  active={level === "easy"}
                  onClick={() => dispatch({ type: "setLevel", level: "easy" })}
                >
                  Easy
                </ToggleButton>
                <ToggleButton
                  active={level === "hard"}
                  onClick={() => dispatch({ type: "setLevel", level: "hard" })}
                >
                  Hard
                </ToggleButton>
              </div>
            </fieldset>
          )}

          <PrimaryButton onClick={() => dispatch({ type: "start" })}>
            <span className="motion-safe:animate-pulse">Press Start</span>
          </PrimaryButton>
          <p className="text-sm text-muted">
            {mode === "cpu"
              ? level === "hard"
                ? "Hard CPU never loses. Can you force a draw?"
                : "Easy CPU plays at random."
              : "Pass the device between turns."}
          </p>
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label="Tic tac toe board"
            onKeyDown={handleGridKey}
            className="mx-auto grid aspect-square w-full max-w-[22rem] grid-cols-3 grid-rows-3 gap-2"
          >
            {board.map((cell, i) => {
              const inLine = line?.includes(i) ?? false
              const disabled = phase !== "playing" || cell !== null || cpuTurn
              const row = Math.floor(i / 3) + 1
              const col = (i % 3) + 1
              return (
                <button
                  key={i}
                  ref={(el) => {
                    cellRefs.current[i] = el
                  }}
                  type="button"
                  aria-label={`Row ${row}, column ${col}: ${cell ?? "empty"}${inLine ? ", winning line" : ""}`}
                  aria-disabled={disabled}
                  onClick={() => {
                    if (!disabled) dispatch({ type: "move", index: i })
                  }}
                  className={`flex aspect-square min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border transition-colors focus-visible:relative focus-visible:z-10 ${
                    inLine
                      ? winner === "O"
                        ? "border-teal bg-teal-soft"
                        : "border-gold bg-gold-soft"
                      : "border-line bg-surface"
                  } ${!disabled ? "cursor-pointer hover:border-faint hover:bg-surface-2" : "cursor-default"}`}
                >
                  {cell && <MarkIcon mark={cell} />}
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {phase === "over" ? (
              <PrimaryButton onClick={() => dispatch({ type: "nextRound" })}>
                Play Again
              </PrimaryButton>
            ) : (
              <SecondaryButton onClick={() => dispatch({ type: "nextRound" })}>
                Restart
              </SecondaryButton>
            )}
            <SecondaryButton onClick={() => dispatch({ type: "menu" })}>Menu</SecondaryButton>
          </div>
          {phase === "over" && (
            <p className="mt-3 text-center text-sm text-faint">
              {state.starter === "X" ? nameOf("O") : nameOf("X")} starts next round.
            </p>
          )}
        </>
      )}
    </div>
  )
}
