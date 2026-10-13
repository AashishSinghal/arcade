import { Suspense } from "react"
import { Link, useParams } from "react-router"
import { getGame } from "@/registry"
import { gameComponents } from "@/loaders"
import NotFound from "@/pages/not-found"
import { useDocumentTitle } from "@/lib/use-document-title"

export default function GamePage() {
  const { slug = "" } = useParams()
  const game = getGame(slug)
  const Game = gameComponents[slug]
  useDocumentTitle(game?.title)

  if (!game || !Game) return <NotFound />

  return (
    <div className="pb-20 pt-12">
      <nav className="flex gap-5 font-pixel text-sm text-muted">
        <Link to="/" className="transition-colors hover:text-teal">
          ← Back to the street
        </Link>
        <Link to="/games" className="transition-colors hover:text-teal">
          Text view
        </Link>
      </nav>
      <h1 className="neon-text-pink mt-8 font-pixel text-3xl tracking-tight">{game.title}</h1>
      <p className="mt-2 text-sm text-faint">{game.controls}</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Game />
        </Suspense>
      </div>
    </div>
  )
}
