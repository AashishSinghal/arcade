import { useEffect, useState } from "react"
import { site } from "@/site"

const COUNTED_KEY = "visit-counted-on"

// One request per page load, shared by every mount (StrictMode runs effects twice in dev,
// and a second POST would count the visit twice)
let request: Promise<number | null> | null = null

function recordVisit(): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10)
  let countedToday = false
  try {
    countedToday = localStorage.getItem(COUNTED_KEY) === today
  } catch {
    // Storage blocked: count the visit anyway
  }
  // Local development reads the live count but never adds to it
  const record = !countedToday && !import.meta.env.DEV

  return fetch(site.visitCounter, { method: record ? "POST" : "GET" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (typeof data?.count !== "number") return null
      if (record) {
        try {
          localStorage.setItem(COUNTED_KEY, today)
        } catch {
          // Ignore: worst case this browser is counted again
        }
      }
      return data.count as number
    })
    .catch(() => null)
}

// Counts this browser at most once a day, then shows the running total. Stays hidden
// when the counter is unavailable, so it never shows a made-up number.
export default function VisitCount() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    request ??= recordVisit()
    request.then((value) => {
      if (active) setCount(value)
    })
    return () => {
      active = false
    }
  }, [])

  if (count === null) return null

  return (
    <span className="font-mono tabular-nums">
      {count.toLocaleString()} {count === 1 ? "visit" : "visits"}
    </span>
  )
}
