import { lazy } from "react"
import { Route, Routes } from "react-router"
import Layout from "@/components/layout"
import Home from "@/pages/home"

const Game = lazy(() => import("@/pages/game"))
const NotFound = lazy(() => import("@/pages/not-found"))
// Unlisted tool for tuning the rock-paper-scissors hand
const HandDebug = lazy(() =>
  import("@/games/rock-paper-scissors").then((m) => ({ default: m.HandDebug }))
)

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="debug/hand" element={<HandDebug />} />
        <Route path=":slug" element={<Game />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
