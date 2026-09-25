import { Link } from "react-router"
import { useDocumentTitle } from "@/lib/use-document-title"

export default function NotFound() {
  useDocumentTitle("Not found")

  return (
    <div className="grid min-h-[60vh] place-content-center gap-4 text-center">
      <p className="font-mono text-sm text-gold">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
      <Link to="/" className="link justify-self-center text-sm">
        Back to the arcade
      </Link>
    </div>
  )
}
