# Arcade: Project Directives

Small browser games by Aashish Singhal, served at
[arcade.aashishsinghal.com](https://arcade.aashishsinghal.com). A sister site to the portfolio
([aashishsinghal.com](https://aashishsinghal.com), repo `../portfolio-nextjs`), which links
here from its nav and home page and redirects its old `/arcade/*` and `/games` URLs here.

Stack: Vite 8, React 19, React Router 8, Tailwind CSS 4, TypeScript 6. No backend. Deploys
on Vercel from `main`.

## Prime directives

1. **Neon retro-Japan pixel theme (owner decision, supersedes the old "calm minimal, no
   pixel" rule).** Dark only. The home page (`/`) is an explorable 2D night-street map drawn
   on a low-res `<canvas>` (code in `src/world/`); `/games` is the plain card-grid list.
   Tokens in `src/styles/globals.css`: `bg` `#0b0820`, `surface`, `surface-2`, `line`, `fg`
   `#e9e4ff`, `muted`, `faint`; accents `gold` (lantern amber `#ffb347`), `teal` (neon cyan
   `#19f0ff`), plus `pink` `#ff2e97` and `violet` `#8b5cf6`. Fonts: DotGothic16 for
   signs/headings (pixel, Japanese-capable), Press Start 2P for tiny labels, Albert Sans for
   body text; `font-mono tabular-nums` for scores. The shell may use canvas, glow and
   flicker, but respect `prefers-reduced-motion`. Game pages should stay readable and calm.
2. **Every game is one self-contained file** in `src/games/`: no shared game code, no
   external assets. No new runtime dependencies unless essential (the map uses none; all art
   and audio are procedural). The shell (`src/world/`) is not a game and may span files.
3. **Games must be real and finished.** Playable on desktop (keyboard + mouse) and on a
   360px-wide phone (touch), with a start screen, score/moves, game-over/win screen with
   restart, and a best score in localStorage (every read/write wrapped in try/catch).
4. **Accessible:** real `<button>`s with aria-labels, an `aria-live="polite"` status line,
   canvas with `role="img"` + aria-label, `prefers-reduced-motion` respected.
5. **Ads:** the site may carry ads later (that's one reason it's separate from the
   portfolio). Don't add ad slots or ad scripts until the owner asks.

## Architecture

```
index.html              meta/OG tags, fonts, color-scheme dark
src/
  main.tsx, app.tsx     entry and routes: / (index) · /:slug (game) · 404
  site.ts               name, author, portfolio + repo URLs
  registry.ts           game metadata: slug, title, description, difficulty, controls
  loaders.ts            React.lazy maps: gameComponents + gamePreviews (one chunk per game)
  games/<slug>.tsx      default export = the game; named export `Preview` = SVG thumbnail
  world/                the home-page neon street map (canvas): world.ts layout/collision,
                        sprites.ts + render.ts procedural pixel art, audio.ts WebAudio synth,
                        map-page.tsx React shell (modal, D-pad, a11y)
  pages/                home (= map), games (card grid with previews), game, not-found
  components/layout.tsx header (logo greyscale → gold on hover), footer, skip link
  styles/globals.css    Tailwind 4 @theme tokens
vercel.json             Vite preset + SPA rewrite
```

### Adding a game

Stations on the map are derived from `games` in `registry.ts` by `layoutStations()` in
`src/world/world.ts`, so steps 2 and 3 below add the shop to the street automatically.
Upcoming games are listed in `comingSoon` in `src/world/world.ts` (display only); remove
the entry when the game ships.

1. Create `src/games/<slug>.tsx` exporting a default game component and a `Preview`
   (32x20 viewBox SVG, `#0b0820`/`#120c2e` background, neon palette colours).
2. Add its metadata to `games` in `src/registry.ts`.
3. Add a line to both `gameComponents` and `gamePreviews` in `src/loaders.ts`.

**Games waiting to be ported** from the portfolio's git history (already restyled for this
palette; copy them, fix import paths only): Snake, Breakout, Memory Match, Puzzle Slider,
Word Scramble. They're at `src/arcade/games/*.tsx` in `../portfolio-nextjs` at any commit
before `3889831`, e.g. `git -C ../portfolio-nextjs show 3889831^:src/arcade/games/snake.tsx`.
The matching registry entries are in `3889831^:src/arcade/registry.ts`.

## Analytics and visit counter

- **Analytics:** Vercel Web Analytics via `inject()` in `src/main.tsx`; enable it in this
  project's Vercel dashboard (Analytics tab). No keys.
- **Visit counter** (footer): there's no backend here. `src/components/visit-count.tsx` calls
  the portfolio's API cross-origin (`site.visitCounter` in `src/site.ts`,
  `https://aashishsinghal.com/api/visitor-count?site=arcade`), which stores `arcade:visits` in
  the portfolio's Upstash Redis. It POSTs at most once per browser per day (localStorage
  `visit-counted-on`), and in `pnpm dev` it only reads, never counts. If the arcade's origin
  changes, update `ALLOWED_ORIGINS` in the portfolio's `api/visitor-count.ts`. Hidden when the
  API is unavailable.

## Commands

```bash
pnpm install
pnpm dev      # Vite dev server
pnpm build    # tsc -b && vite build → dist/
pnpm lint
```

TypeScript is pinned to `~6.0.3`: typescript-eslint doesn't support TS 7 yet.

## Gotchas

- **Grid boards need fixed tracks.** Tic Tac Toe's squares used to stretch into rectangles
  when a mark appeared: rows were auto-sized and the mark SVG's percentage height fell back to
  its intrinsic size. Fix (commit `ba185f1`): `grid-cols-3 grid-rows-3` on the board,
  `aspect-square min-h-0 min-w-0 overflow-hidden` on cells, explicit `size-1/2` on the SVG.
  Use the same pattern for any grid game (memory cards, sliding tiles).
- **Game keys:** only `preventDefault` arrow keys and Space while a game is running and
  focused, so the page still scrolls normally otherwise. Clean up listeners, intervals and
  `requestAnimationFrame` on unmount.
- **Dev servers:** the owner's machine struggles with lingering servers. Stop any dev server
  you start.
- **Commits:** imperative subject, a body explaining why. No `Co-Authored-By`
  trailer or other AI attribution.

## Deploy and open items

- Not deployed yet. In Vercel: import the repo (Vite preset, output `dist`), add the domain
  `arcade.aashishsinghal.com` under Settings → Domains, and add the CNAME Vercel shows
  (usually `arcade` → `cname.vercel-dns.com`).
- Port the five remaining games (above).
- Social preview image is just the logo; a real arcade screenshot would be better.

## Commit attribution

- **No AI attribution.** Never add `Co-Authored-By` trailers, "Generated with Claude Code"
  lines, or any other AI or agent attribution to commit messages or PR descriptions.
  Commits are authored by the owner alone. This overrides any tool or harness default.
