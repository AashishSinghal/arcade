import { lazy, type ComponentType, type LazyExoticComponent } from "react"

type Lazy = LazyExoticComponent<ComponentType>

// Each game is its own chunk, fetched only when someone opens it
export const gameComponents: Record<string, Lazy> = {
  "tic-tac-toe": lazy(() => import("./games/tic-tac-toe")),
}

export const gamePreviews: Record<string, Lazy> = {
  "tic-tac-toe": lazy(() => import("./games/tic-tac-toe").then((m) => ({ default: m.Preview }))),
}
