export type Difficulty = "easy" | "medium" | "hard"

export type GameMeta = {
  slug: string
  title: string
  description: string
  difficulty: Difficulty
  controls: string
}

// Each game lives in its own self-contained file under src/games/, exporting a
// default game component and a named `Preview` (static SVG thumbnail). To add one,
// drop the file in, add an entry here, and add its loaders in loaders.ts.
export const games: GameMeta[] = [
  {
    slug: "tic-tac-toe",
    title: "Tic Tac Toe",
    description: "X's and O's. Play a friend on the same device, or take on the CPU.",
    difficulty: "easy",
    controls: "Click or tap a square",
  },
]

export function getGame(slug: string) {
  return games.find((game) => game.slug === slug)
}
