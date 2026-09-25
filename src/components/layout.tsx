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

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-6 px-5">
        <Link to="/" className="group flex items-center gap-3" aria-label={`${site.name}, home`}>
          {/* The logo sits in greyscale and fills with its gold on hover */}
          <img
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="size-8 grayscale transition-[filter] duration-300 group-hover:grayscale-0"
          />
          <span className="font-medium tracking-tight transition-colors group-hover:text-gold">
            {site.name}
          </span>
        </Link>

        <a
          href={site.portfolio}
          className="rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:text-fg sm:px-3"
        >
          aashishsinghal.com <span aria-hidden="true">↗</span>
        </a>
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
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

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-gold focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
