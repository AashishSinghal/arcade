import { lazy } from "react"
import { Route, Routes } from "react-router"
import Layout from "@/components/layout"
import Home from "@/pages/home"

const Game = lazy(() => import("@/pages/game"))
const NotFound = lazy(() => import("@/pages/not-found"))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path=":slug" element={<Game />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
