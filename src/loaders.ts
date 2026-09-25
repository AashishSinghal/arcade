import { type ComponentType, type LazyExoticComponent } from "react"

type Lazy = LazyExoticComponent<ComponentType>

// Each game is its own chunk, fetched only when someone opens it
export const gameComponents: Record<string, Lazy> = {}

export const gamePreviews: Record<string, Lazy> = {}
