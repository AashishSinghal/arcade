# Arcade

Small browser games by [Aashish Singhal](https://aashishsinghal.com), live at
[arcade.aashishsinghal.com](https://arcade.aashishsinghal.com). A sister site to the portfolio,
with the same look.

Everything runs in the browser. There's no backend, and best scores are kept in `localStorage`.

Built with Vite, React 19, React Router and Tailwind CSS 4.

## Development

```sh
pnpm install
pnpm dev     # start the dev server
pnpm build   # type-check (tsc -b) and build to dist/
pnpm lint    # eslint + prettier
```

## Adding a game

1. Create `src/games/<slug>.tsx`. It should be self-contained and export:
   - a **default** component: the game itself
   - a named **`Preview`** component: a static SVG thumbnail for the index card
2. Add an entry to `games` in `src/registry.ts` (slug, title, description, difficulty, controls).
3. Add a line for it to both `gameComponents` and `gamePreviews` in `src/loaders.ts`:

   ```ts
   "my-game": lazy(() => import("./games/my-game")),
   // and
   "my-game": lazy(() => import("./games/my-game").then((m) => ({ default: m.Preview }))),
   ```

The game then shows up on the index and at `/<slug>`, loaded as its own chunk.

## Deploy

1. Import this repo in [Vercel](https://vercel.com/new). It picks the Vite preset; the output
   directory is `dist`. `vercel.json` rewrites every path to `index.html` so client-side routes work.
2. In Project → Settings → Domains, add `arcade.aashishsinghal.com`.
3. Add the DNS record Vercel shows at your DNS provider, typically a CNAME from `arcade` to
   `cname.vercel-dns.com`.

## License

[MIT](LICENSE)
