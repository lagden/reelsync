# reelsync

CLI that pulls your saved Instagram posts, classifies them by category/subcategory from the caption's hashtags, and
downloads the video with `yt-dlp` incrementally (never downloads the same post twice).

Pipeline: `instaloader` lists the saved posts (metadata only) → rules in `categories.json` classify them →
`yt-dlp --download-archive` downloads what's new → everything (metadata, category, downloaded file path) is cataloged in
`{output-dir}/chupinhador.sqlite`.

## Prerequisites

```
brew install yt-dlp pipx
pipx install "instaloader[browser-cookie3]"
```

The `browser-cookie3` extra is required: it's what enables instaloader's `--load-cookies firefox`. The Homebrew bottle
doesn't include that extra, which is why instaloader is installed via `pipx` instead of `brew install
instaloader`.

Firefox needs to be logged into Instagram (both tools read the session cookies from Firefox).

## Running locally

1. Install the prerequisites above and confirm you're logged into Instagram in Firefox.
2. Clone/enter the project folder (no `npm install`/`deno install` needed — Deno resolves dependencies on first run).
3. Run with a low `--limit` to test without scanning every saved post:
   ```
   deno task dev --limit 3
   ```
4. If everything looks right, run without `--limit` (or with a high value) to process the rest. Running it again is
   safe: `yt-dlp` skips anything already in `historico_downloads.txt`.

See all flags: `deno task dev --help`.

## Usage

```
deno task dev --limit 10
```

On startup, the CLI shows how many posts are already synced/downloaded/pending (from the sqlite catalog) and asks what
to do:

- Check for new posts without downloading videos
- Check for new posts and download videos
- Download the pending posts already cataloged
- Download pending posts with a limit

If `--limit` was already passed as a flag, it's used directly for the "download pending with a limit" option instead of
asking.

Flags:

- `--browser` (default `firefox`) — browser to read session cookies from.
- `--output-dir` (default `./instagram-saved`) — where videos and `historico_downloads.txt` (yt-dlp's dedupe archive)
  are saved.
- `--limit` — maximum number of saved posts to consider in this run.
- `-h, --help` — show help and exit.

Edit `categories.json` to map hashtag → `{categoria, subcategoria}`. Posts with no known hashtag fall back to
`sem-categoria/geral`. The file is validated at startup (via schema) — a typo in it fails the CLI with a clear error
instead of silently becoming an `undefined` category.

## Database (post catalog)

Every scraped post — downloaded or not — becomes a row in `{output-dir}/chupinhador.sqlite`, table `posts` (`shortcode`,
`url`, `caption`, `categoria`, `subcategoria`, `taken_at`, `file_path`, `scraped_at`, `downloaded_at`). That's what it's
for: finding where a post's file lives, or analyzing your saved history, without digging through folders by hand. Sqlite
is a plain file — open it with `sqlite3` (ships with macOS), DB Browser for SQLite, or any client. Examples:

```
sqlite3 instagram-saved/chupinhador.sqlite "select categoria, subcategoria, count(*) from posts group by 1,2;"
sqlite3 instagram-saved/chupinhador.sqlite "select file_path from posts where shortcode = 'ABC123';"
```

`file_path` stays `NULL` until the video is downloaded. If a post was already in `historico_downloads.txt` from a run
before this version, `yt-dlp` skips the download and there's no way to retroactively recover the path — it stays `NULL`
until a later run rediscovers the file.

### Migrating old data

If you ran an earlier version of this CLI, you may have an orphaned cache at `{output-dir}/.raw/` (metadata scraped
before the database existed). To import it into the database:

```
deno task migrate           # defaults to ./instagram-saved
deno task migrate ./other-folder
```

Once migrated and verified (`sqlite3 ... "select count(*) from posts;"`), `.raw/` can be deleted — nothing else uses it.

### Edited categories.json? Reclassify

Editing `categories.json` only affects new posts. To reapply it to posts already in the database (and move an
already-downloaded file to the right folder):

```
deno task reclassify           # defaults to ./instagram-saved
deno task reclassify ./other-folder
```

Compares the folder a file actually lives in against the folder the current classification says it should be in — safe
to run as many times as you want, it only moves what actually changed category.

## Tests

```
deno task test
```

## Standalone binary

```
deno task compile
./reelsync --limit 10
```

Produces `./reelsync`, no Deno install needed to run it. `categories.json` is embedded in the binary at compile time —
edited the file? Recompile for it to take effect in the binary (`deno task dev` always reads the current version from
disk, no such issue there).

## Buy Me a Coffee

bitcoin:BC1P6SYW5V8GA6YEMF66C5Z6XQ0ZM5GKRPXE60GH9V6UW5SESFQLG92SNU6NEU?label=Github&message=Buy%20me%20a%20coffee
