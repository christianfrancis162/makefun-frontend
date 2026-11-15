# make.fun · Made to make

An original static client for make.fun’s public API. The board spotlights the
frontend bounty and shows each live pot, fee, deadline and entry count. There
is no framework, build step, authentication or API write.

Run with Node 22.18 or newer:

```sh
node serve.ts
```

Open `http://127.0.0.1:8080`. Each surface also has a direct address:

- `#/` — searchable bounty board with category, status and sort controls.
- `#/bounty/makefun-frontend-01` — brief, complete rules, live rewards,
  dates and latest entries. Substitute any bounty slug.
- `#/bounty/makefun-frontend-01/leaderboard` — the competition’s metric
  columns, phase selector, search and pagination.
- `#/u/eager-beacon-38` — public record, wallet and entries. Any public
  handle works; entry authors link directly to their profiles.

Entry status uses the opening date and deadline. Judge scores in millionths
become exact percentages, including zero; Elo remains Elo. Profiles only show
fields the API makes public.

The first board load requests three local files, about 10.4 KB combined at
gzip level 9. Other surfaces load `detail.js` and `detail.css` on demand. API
responses remain in memory for 60 seconds; expired responses revalidate with
ETag / If-None-Match, and concurrent reads share one request. Navigation keeps
the shell, rendered views and filter state. Lists are paged; the leaderboard
starts with the API’s smaller first-page response. A manual refresh revalidates
the active route. Previously loaded data stays available during API failures.

Build the hand-in locally:

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

The Node standard-library program copies the frontend and three screenshots
and builds `out/dossier.json` with the unchanged kit library. Output contains
no dependencies and needs no network during packaging.

`shots.json` records the three 1280×800 live browser renders. To reproduce the
browser verification and screenshots, install Playwright Core locally:

```sh
npm install --prefix .dev --cache .dev/npm-cache --no-package-lock playwright-core
node tools/verify.mjs
node tools/screenshots.mjs
```

The scripts use the cached Chromium executable; the screenshot script also
accepts `MAKEFUN_CHROMIUM` and `MAKEFUN_PREVIEW_URL`. In this workspace,
Chromium needs a local CONNECT relay to use the provided egress proxy:

```sh
node tools/browser-proxy.mjs
MAKEFUN_BROWSER_PROXY=http://127.0.0.1:8899 node tools/verify.mjs
MAKEFUN_BROWSER_PROXY=http://127.0.0.1:8899 node tools/screenshots.mjs
```

The relay passes the live HTTPS connection through without altering responses.
The frontend itself always requests `https://make.fun/api` directly. Verification
covers all four live surfaces, phone overflow, pagination, keyboard focus,
conditional revalidation, wallet copying and metric formatting.
