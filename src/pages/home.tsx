import { Suspense } from "react"
import { Link } from "react-router"
import { games } from "@/registry"
import { gamePreviews } from "@/loaders"
import { useDocumentTitle } from "@/lib/use-document-title"

export default function Home() {
  useDocumentTitle()

  return (
    <>
      <header className="pb-12 pt-20">
        <h1 className="text-3xl font-semibold tracking-tight">Arcade</h1>
        <p className="mt-4 max-w-xl text-muted">
          Small games, built for fun. Everything runs in your browser, and best scores are saved on
          this device.
        </p>
      </header>

      <ul className="grid gap-4 pb-20 sm:grid-cols-2">
        {games.map((game) => {
          const Preview = gamePreviews[game.slug]
          return (
            <li key={game.slug}>
              <Link
                to={`/${game.slug}`}
                className="group block overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-gold/60"
              >
                <div className="aspect-video border-b border-line bg-bg">
                  <Suspense fallback={null}>
                    <Preview />
                  </Suspense>
                </div>
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-medium transition-colors group-hover:text-gold">
                      {game.title}
                    </h2>
                    <span className="text-xs uppercase tracking-wider text-faint">
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
