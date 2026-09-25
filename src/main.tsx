import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router"
import App from "./app"
import { inject } from "@vercel/analytics"
import "./styles/globals.css"

// Vercel Web Analytics: page views, referrers, countries. Enable it in this project's Vercel
// dashboard; it tracks client-side route changes on its own.
inject()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
