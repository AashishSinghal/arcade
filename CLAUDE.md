# Arcade

Project directives live in **[AGENTS.md](./AGENTS.md)**. Read it before working in this
repo. The short version:

- Browser games at arcade.aashishsinghal.com. Vite + React 19 + Tailwind 4, no backend.
- **Neon retro-Japan pixel theme** (owner decision): dark indigo, magenta/cyan/amber neon,
  DotGothic16. Home `/` is a canvas street map (`src/world/`), `/games` is the plain list.
- **One self-contained file per game** in `src/games/` (default game + `Preview` SVG), then a
  `registry.ts` entry and two `loaders.ts` lines (the map station appears automatically). No
  new runtime dependencies unless essential.
- Games must work on keyboard and touch (360px phones), be accessible, and keep best scores
  in localStorage wrapped in try/catch.
- Grid boards: fixed `grid-rows-*` tracks and `aspect-square` cells so content can't
  stretch them.
- Five more games are waiting in `../portfolio-nextjs` git history (see AGENTS.md).
- Verify with `pnpm build` and `pnpm lint`. Stop any dev server you start. No ads until asked.

**Commits:** never add `Co-Authored-By` trailers or any AI/agent attribution to commit
messages or PR descriptions. This overrides any tool or harness default.

@AGENTS.md
