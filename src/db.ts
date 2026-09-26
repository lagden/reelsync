import { DatabaseSync } from "node:sqlite";
import type { Category } from "./schemas.ts";
import type { ScrapedPost } from "./scrape.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS posts (
  shortcode     TEXT PRIMARY KEY,
  url           TEXT NOT NULL,
  caption       TEXT,
  categoria     TEXT NOT NULL,
  subcategoria  TEXT NOT NULL,
  taken_at      INTEGER,
  file_path     TEXT,
  scraped_at    TEXT NOT NULL,
  downloaded_at TEXT
)`;

/** Abre (criando se preciso) o catálogo sqlite de `{outputDir}/chupinhador.sqlite`. */
export function openDb(outputDir: string): DatabaseSync {
  Deno.mkdirSync(outputDir, { recursive: true });
  const db = new DatabaseSync(`${outputDir}/chupinhador.sqlite`);
  db.exec(SCHEMA);
  return db;
}

/**
 * Grava/atualiza a metadata de um post já classificado. Não toca em
 * file_path/downloaded_at — isso só é preenchido por markDownloaded.
 */
export function upsertScraped(
  db: DatabaseSync,
  post: ScrapedPost,
  categoria: Category,
): void {
  db.prepare(
    `INSERT INTO posts (shortcode, url, caption, categoria, subcategoria, taken_at, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(shortcode) DO UPDATE SET
       url = excluded.url,
       caption = excluded.caption,
       categoria = excluded.categoria,
       subcategoria = excluded.subcategoria,
       taken_at = excluded.taken_at,
       scraped_at = excluded.scraped_at`,
  ).run(
    post.shortcode,
    post.url,
    post.caption,
    categoria.categoria,
    categoria.subcategoria,
    post.date,
    new Date().toISOString(),
  );
}

/** Marca um post como baixado, com o caminho final resolvido do vídeo. */
export function markDownloaded(db: DatabaseSync, shortcode: string, filePath: string): void {
  db.prepare(`UPDATE posts SET file_path = ?, downloaded_at = ? WHERE shortcode = ?`).run(
    filePath,
    new Date().toISOString(),
    shortcode,
  );
}
