import { lazy, type ComponentType, type LazyExoticComponent } from "react"

type Lazy = LazyExoticComponent<ComponentType>

// Each game is its own chunk, fetched only when someone opens it
export const gameComponents: Record<string, Lazy> = {
  "tic-tac-toe": lazy(() => import("./games/tic-tac-toe")),
  "rock-paper-scissors": lazy(() => import("./games/rock-paper-scissors")),
}

export const gamePreviews: Record<string, Lazy> = {
  "tic-tac-toe": lazy(() => import("./games/tic-tac-toe").then((m) => ({ default: m.Preview }))),
  "rock-paper-scissors": lazy(() =>
    import("./games/rock-paper-scissors").then((m) => ({ default: m.Preview }))
  ),
}
