# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
deno task dev --limit 3        # run the CLI (add flags after; -- forwarded automatically by `deno task`)
deno task test                 # run all tests (src/*.test.ts)
deno test src/classify.test.ts # run a single test file
deno task compile              # produce standalone ./chupinhador binary
deno task migrate [dir]        # one-off: import legacy .raw/ metadata cache into sqlite (default ./instagram-saved)
deno task reclassify [dir]     # re-apply categories.json to already-scraped posts and move files to match
deno fmt / deno lint           # formatting (tabs, 120 cols) and lint rules are defined in deno.jsonc
```

No `npm install` / `deno install` step — Deno resolves `imports` from `deno.jsonc` on first run.

External CLI dependencies the code shells out to (must be on PATH, read session cookies from Firefox):
`instaloader` (via `pipx install "instaloader[browser-cookie3]"`) and `yt-dlp` (via `brew install yt-dlp`).

## Architecture

Single-pass pipeline driven by [src/cli.ts](src/cli.ts), one post at a time, in this order:

1. **Scrape** ([src/scrape.ts](src/scrape.ts)) — shells out to `instaloader --load-cookies <browser> -- :saved`,
   metadata only (no media), parses/validates the JSON with the `InstaloaderNodeSchema` (valibot).
2. **Classify** ([src/classify.ts](src/classify.ts)) — pulls hashtags out of the caption and matches against the
   hashtag → `{categoria, subcategoria}` map loaded from `categories.json`. Unmatched posts fall back to
   `sem-categoria/geral`. `categories.json` is imported statically (`with { type: "json" }`) rather than read from
   disk, so `deno compile` embeds it in the binary — editing the file after compiling requires recompiling.
3. **Persist metadata** ([src/db.ts](src/db.ts)) — every scraped post is upserted into
   `{output-dir}/chupinhador.sqlite` (`node:sqlite`) immediately, regardless of whether the download succeeds.
   `file_path`/`downloaded_at` stay `NULL` until a download actually completes.
4. **Download** ([src/download.ts](src/download.ts)) — `yt-dlp --download-archive historico_downloads.txt` handles
   incremental dedupe; a carousel is a "playlist" to yt-dlp, and `--ignore-errors` lets photo-only items in a
   carousel fail without aborting the video items. If yt-dlp skips a post because it's already in the archive, no
   post-processor runs, so the file path can't be recovered — `markDownloaded` is only called when a path is
   printed.

The `for` loop in [src/cli.ts](src/cli.ts) wraps each post's download in its own try/catch: one post failing
(unavailable video, photo-only carousel, etc.) must not abort the batch, since metadata for every post is already
committed to sqlite before the download is attempted.

[src/paths.ts](src/paths.ts) (`resolveNewPath`) is the one piece of path-comparison logic shared by the reclassify
script — it decides whether a downloaded file needs to move after `categories.json` changes. Both sides of the
comparison must be in the same absolute/relative form or it produces false-positive moves; see the doc comment there
before touching it.

`scripts/reclassify.ts` and `scripts/migrate-raw.ts` are standalone one-off scripts (not part of the main pipeline),
run directly via `deno task`, operating on an existing `chupinhador.sqlite` from a previous run.
