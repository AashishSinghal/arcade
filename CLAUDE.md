# Arcade

Project directives live in **[AGENTS.md](./AGENTS.md)**. Read it before working in this
repo. The short version:

- Browser games at arcade.aashishsinghal.com. Vite + React 19 + Tailwind 4, no backend.
- **Same look as the portfolio:** dark only, gold `#C49D71` + teal `#2DD4BF` accents, Albert
  Sans. Calm and minimal; no pixel/8-bit styling.
- **One self-contained file per game** in `src/games/` (default game + `Preview` SVG), then a
  `registry.ts` entry and two `loaders.ts` lines. No new dependencies.
- Games must work on keyboard and touch (360px phones), be accessible, and keep best scores
  in localStorage wrapped in try/catch.
- Grid boards: fixed `grid-rows-*` tracks and `aspect-square` cells so content can't
  stretch them.
- Five more games are waiting in `../portfolio-nextjs` git history (see AGENTS.md).
- Verify with `pnpm build` and `pnpm lint`. Stop any dev server you start. No ads until asked.

@AGENTS.md
