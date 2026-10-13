import { lazy } from "react"
import { Route, Routes } from "react-router"
import Layout from "@/components/layout"

const MapPage = lazy(() => import("@/world/map-page"))
const Games = lazy(() => import("@/pages/games"))
const Game = lazy(() => import("@/pages/game"))
const NotFound = lazy(() => import("@/pages/not-found"))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MapPage />} />
        <Route path="games" element={<Games />} />
        <Route path=":slug" element={<Game />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
