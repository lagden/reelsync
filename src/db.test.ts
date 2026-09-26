import { assertEquals } from "jsr:@std/assert@^1";
import { markDownloaded, openDb, upsertScraped } from "./db.ts";
import type { ScrapedPost } from "./scrape.ts";

const post: ScrapedPost = {
  shortcode: "ABC123",
  url: "https://www.instagram.com/p/ABC123/",
  caption: "Bolo de cenoura #bolo",
  date: 1700000000,
};

function tempOutputDir(): string {
  return Deno.makeTempDirSync({ prefix: "chupinhador-db-test-" });
}

Deno.test("upsertScraped grava e classify pode ser lido de volta", () => {
  const dir = tempOutputDir();
  const db = openDb(dir);
  upsertScraped(db, post, { categoria: "culinaria", subcategoria: "bolos" });

  const row = db.prepare("SELECT * FROM posts WHERE shortcode = ?").get("ABC123") as Record<
    string,
    unknown
  >;
  assertEquals(row.categoria, "culinaria");
  assertEquals(row.subcategoria, "bolos");
  assertEquals(row.file_path, null);

  db.close();
  Deno.removeSync(dir, { recursive: true });
});

Deno.test("upsertScraped duas vezes não duplica linha (upsert por shortcode)", () => {
  const dir = tempOutputDir();
  const db = openDb(dir);
  upsertScraped(db, post, { categoria: "culinaria", subcategoria: "bolos" });
  upsertScraped(db, post, { categoria: "culinaria", subcategoria: "receitas" });

  const rows = db.prepare("SELECT * FROM posts WHERE shortcode = ?").all("ABC123");
  assertEquals(rows.length, 1);
  assertEquals((rows[0] as Record<string, unknown>).subcategoria, "receitas");

  db.close();
  Deno.removeSync(dir, { recursive: true });
});

Deno.test("markDownloaded preenche file_path sem apagar o resto", () => {
  const dir = tempOutputDir();
  const db = openDb(dir);
  upsertScraped(db, post, { categoria: "culinaria", subcategoria: "bolos" });
  markDownloaded(db, "ABC123", `${dir}/culinaria/bolos/ABC123_bolo.mp4`);

  const row = db.prepare("SELECT * FROM posts WHERE shortcode = ?").get("ABC123") as Record<
    string,
    unknown
  >;
  assertEquals(row.file_path, `${dir}/culinaria/bolos/ABC123_bolo.mp4`);
  assertEquals(row.categoria, "culinaria");

  db.close();
  Deno.removeSync(dir, { recursive: true });
});
