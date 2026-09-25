import { useEffect } from "react"
import { site } from "@/site"

// Sets the tab title per page; without a title it falls back to the site default
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${site.name}` : `${site.name} · ${site.author}`
  }, [title])
}
