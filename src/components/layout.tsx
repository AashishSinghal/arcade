import { Suspense, useEffect } from "react"
import { Link, Outlet, useLocation } from "react-router"
import { site } from "@/site"
import VisitCount from "@/components/visit-count"

// React Router doesn't scroll on navigation, so go back to the top of each new page
function useScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
}

function Header({ overlay }: { overlay: boolean }) {
  return (
    <header
      className={`z-40 border-b-2 border-pink/60 bg-bg/80 shadow-[0_0_18px_#ff2e9744] backdrop-blur ${
        overlay ? "fixed inset-x-0 top-0" : "sticky top-0"
      }`}
    >
      <nav
        className={`mx-auto flex h-12 ${overlay ? "" : "max-w-3xl"} items-center justify-between gap-4 px-4 sm:px-5`}
      >
        <Link
          to="/"
          className="group flex items-center gap-3"
          aria-label={`${site.name}, street map`}
        >
          {/* The logo sits in greyscale and fills with its colour on hover */}
          <img
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 grayscale transition-[filter] duration-300 group-hover:grayscale-0"
          />
          <span className="neon-text-pink font-pixel text-lg tracking-wide">
            ARCADE <span className="text-sm text-fg/70">アーケード</span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            to="/games"
            aria-label="Text view: plain list of games (accessible version of the map)"
            className="border-2 border-teal/70 px-2.5 py-1 font-pixel text-sm text-teal transition-colors hover:bg-teal/15"
          >
            Text view
          </Link>
          <a
            href={site.portfolio}
            className="hidden px-2 py-1.5 font-pixel text-sm text-muted transition-colors hover:text-fg sm:block"
          >
            aashishsinghal.com <span aria-hidden="true">↗</span>
          </a>
        </div>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t-2 border-line">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-10 text-sm text-faint sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {site.author}
        </p>
        <div className="flex items-center gap-5">
          <VisitCount />
          <a href={site.repository} target="_blank" rel="noreferrer" className="hover:text-teal">
            Source on GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

export default function Layout() {
  useScrollToTop()
  const onMap = useLocation().pathname === "/"

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <Header overlay={onMap} />
      <main id="main" className={onMap ? "fixed inset-0" : "mx-auto w-full max-w-3xl flex-1 px-5"}>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      {!onMap && <Footer />}
    </div>
  )
}
