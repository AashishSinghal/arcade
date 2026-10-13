import { Suspense } from "react"
import { Link } from "react-router"
import { games } from "@/registry"
import { gamePreviews } from "@/loaders"
import { useDocumentTitle } from "@/lib/use-document-title"

// The plain list: the escape hatch from the street map
export default function Games() {
  useDocumentTitle("Plain list")

  return (
    <>
      <header className="pb-10 pt-14">
        <Link to="/" className="font-pixel text-sm text-muted transition-colors hover:text-teal">
          ← Back to the street map
        </Link>
        <h1 className="neon-text-pink mt-6 font-pixel text-4xl tracking-tight">
          ゲーム <span className="text-fg">PLAIN LIST</span>
        </h1>
        <p className="mt-4 max-w-xl text-muted">
          This is the accessible plain-text version of the street map, for keyboards, screen readers
          and anyone who prefers a simple list. The map is the main way to browse. Everything runs
          in your browser, and best scores are saved on this device.
        </p>
      </header>

      <ul className="grid gap-4 pb-20 sm:grid-cols-2">
        {games.map((game) => {
          const Preview = gamePreviews[game.slug]
          return (
            <li key={game.slug}>
              <Link
                to={`/${game.slug}`}
                className="group block overflow-hidden border-2 border-line bg-surface transition-[border-color,box-shadow] hover:border-pink hover:shadow-[0_0_16px_#ff2e9777]"
              >
                <div className="aspect-video border-b-2 border-line bg-bg">
                  <Suspense fallback={null}>
                    <Preview />
                  </Suspense>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-pixel text-xl transition-colors group-hover:text-teal">
                      {game.title}
                    </h2>
                    <span className="font-label text-[10px] uppercase tracking-wider text-gold">
                      {game.difficulty}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{game.description}</p>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
