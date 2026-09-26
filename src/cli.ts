import { parseArgs } from "@std/cli/parse-args";
import * as v from "valibot";
import * as p from "@clack/prompts";
import { scrapeSaved } from "./scrape.ts";
import { classify, parseCategories } from "./classify.ts";
import { downloadPost } from "./download.ts";
import { markDownloaded, openDb, upsertScraped } from "./db.ts";
import { FlagsSchema } from "./schemas.ts";
// Import estático (não Deno.readTextFile): assim o `deno compile` embute o
// arquivo no binário sozinho, sem precisar de --include nem de ler do disco.
import categoriesData from "../categories.json" with { type: "json" };

const categories = parseCategories(categoriesData);

// `deno task dev -- --limit 1` reencaminha o "--" literal junto com os args
// (é assim que `deno task` funciona); descarta-o pra não confundir parseArgs.
const rawArgs = Deno.args[0] === "--" ? Deno.args.slice(1) : Deno.args;

const rawFlags = parseArgs(rawArgs, {
  string: ["browser", "output-dir", "limit"],
  boolean: ["help"],
  alias: { help: "h" },
  default: { browser: "firefox", "output-dir": "./instagram-saved" },
});

if (rawFlags.help) {
  console.log(`chupinhador-e-organizador

Puxa os posts salvos do Instagram, classifica por categoria/subcategoria
e baixa o vídeo com yt-dlp (sem repetir o que já foi baixado).

Uso:
  deno task dev [flags]
  ./chupinhador [flags]   (binário compilado com 'deno task compile')

Flags:
  --browser <nome>      Browser de onde ler os cookies de sessão. (default: firefox)
  --output-dir <path>   Onde salvar os vídeos, o banco e o historico_downloads.txt. (default: ./instagram-saved)
  --limit <n>           Número máximo de posts salvos a considerar nesta execução.
  -h, --help            Mostra esta ajuda.`);
  Deno.exit(0);
}

const flagsResult = v.safeParse(FlagsSchema, {
  browser: rawFlags.browser,
  outputDir: rawFlags["output-dir"],
  limit: rawFlags.limit ? Number(rawFlags.limit) : undefined,
});
if (!flagsResult.success) {
  console.error(`Flags inválidas:\n${v.summarize(flagsResult.issues)}`);
  Deno.exit(1);
}
const { browser, outputDir, limit } = flagsResult.output;

p.intro("chupinhador-e-organizador");

const db = openDb(outputDir);

const spinner = p.spinner();
spinner.start("Buscando posts salvos (instaloader)...");
const posts = await scrapeSaved({ browser, limit });
spinner.stop(`${posts.length} posts encontrados.`);

let processados = 0;
for (const post of posts) {
  const categoria = classify(post.caption, categories);
  upsertScraped(db, post, categoria);
  p.log.step(`${post.shortcode} -> ${categoria.categoria}/${categoria.subcategoria}`);
  const filePath = await downloadPost(post.url, categoria.categoria, categoria.subcategoria, {
    browser,
    outputDir,
  });
  if (filePath) markDownloaded(db, post.shortcode, filePath);
  processados++;
}

db.close();

p.outro(`Concluído. ${processados} posts processados (yt-dlp pula os que já estão no archive).`);
