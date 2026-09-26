/**
 * Migração única: lê o cache órfão de `instagram-saved/.raw/` (gerado antes
 * do scrape passar a usar pasta temporária) e joga tudo no banco sqlite,
 * classificado. Depois de rodar e confirmar, `.raw` pode ser apagada.
 *
 * Uso: deno task migrate [output-dir]  (default: ./instagram-saved)
 */
import { parseCategories, classify } from "../src/classify.ts";
import { openDb, upsertScraped } from "../src/db.ts";
import { parsePostJson, type ScrapedPost } from "../src/scrape.ts";
import categoriesData from "../categories.json" with { type: "json" };

const outputDir = Deno.args[0] ?? "./instagram-saved";
const rawDir = `${outputDir}/.raw`;

async function findJsonFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      files.push(...await findJsonFiles(path));
    } else if (entry.name.endsWith(".json")) {
      files.push(path);
    }
  }
  return files;
}

const categories = parseCategories(categoriesData);
const db = openDb(outputDir);

let migrados = 0;
let ignorados = 0;
for (const path of await findJsonFiles(rawDir)) {
  let posts: ScrapedPost[];
  try {
    posts = parsePostJson(await Deno.readTextFile(path));
  } catch (err) {
    console.error(`Ignorando ${path}: ${err instanceof Error ? err.message : err}`);
    ignorados++;
    continue;
  }
  for (const post of posts) {
    upsertScraped(db, post, classify(post.caption, categories));
    migrados++;
  }
}

db.close();
console.log(`Migrados ${migrados} posts pro banco (${ignorados} arquivo(s) ignorado(s)).`);
