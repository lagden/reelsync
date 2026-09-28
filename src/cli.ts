import { parseArgs } from "@std/cli/parse-args";
import * as v from "valibot";
import * as p from "@clack/prompts";
import { scrapeSaved } from "./scrape.ts";
import { classify, parseCategories } from "./classify.ts";
import { downloadPost } from "./download.ts";
import { getCounts, getPendingPosts, markDownloaded, openDb, upsertScraped } from "./db.ts";
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
	console.log(`reelsync

Puxa os posts salvos do Instagram, classifica por categoria/subcategoria
e baixa o vídeo com yt-dlp (sem repetir o que já foi baixado).

Uso:
  deno task dev [flags]
  ./reelsync [flags]   (binário compilado com 'deno task compile')

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

p.intro("reelsync");

const db = openDb(outputDir);

// Um post falhar (vídeo indisponível, carrossel só com fotos, etc.) não pode
// derrubar o resto do lote — a metadata já está commitada no banco antes de
// qualquer download ser tentado, então só esse post específico fica pendente.
async function tentarBaixar(shortcode: string, url: string, categoria: string, subcategoria: string): Promise<boolean> {
	try {
		const filePath = await downloadPost(url, categoria, subcategoria, { browser, outputDir });
		if (filePath) markDownloaded(db, shortcode, filePath);
		return true;
	} catch (err) {
		p.log.warn(`${shortcode}: ${err instanceof Error ? err.message : err}`);
		return false;
	}
}

const counts = getCounts(db);
const acao = await p.select({
	message: `Você tem ${counts.total} posts sincronizados, ${counts.downloaded} baixados e ` +
		`${counts.pending} pendentes. Gostaria de:`,
	options: [
		{ value: "sync", label: "Verificar se tem novos posts sem baixar os vídeos" },
		{ value: "sync-download", label: "Verificar se tem novos posts e baixar os vídeos" },
		{ value: "pending", label: "Baixar os pendentes" },
		{ value: "pending-limit", label: "Baixar os pendentes com limite" },
	] as const,
});
if (p.isCancel(acao)) {
	p.cancel("Operação cancelada.");
	Deno.exit(0);
}

let processados = 0;
let falhas = 0;

if (acao === "sync" || acao === "sync-download") {
	const spinner = p.spinner();
	spinner.start("Buscando posts salvos (instaloader)...");
	const posts = await scrapeSaved({ browser, limit });
	spinner.stop(`${posts.length} posts encontrados.`);

	for (const post of posts) {
		const categoria = classify(post.caption, categories);
		upsertScraped(db, post, categoria);
		p.log.step(`${post.shortcode} -> ${categoria.categoria}/${categoria.subcategoria}`);
		if (acao === "sync-download") {
			if (!await tentarBaixar(post.shortcode, post.url, categoria.categoria, categoria.subcategoria)) falhas++;
		}
		processados++;
	}
} else {
	let limitePendentes = limit;
	if (acao === "pending-limit" && limitePendentes === undefined) {
		const valor = await p.text({
			message: "Quantos pendentes baixar?",
			validate: (v) => {
				if (!Number.isInteger(Number(v)) || Number(v) <= 0) return "Informe um número inteiro maior que 0.";
			},
		});
		if (p.isCancel(valor)) {
			p.cancel("Operação cancelada.");
			Deno.exit(0);
		}
		limitePendentes = Number(valor);
	}

	const pendentes = getPendingPosts(db, limitePendentes);
	p.log.step(`${pendentes.length} post(s) pendente(s) encontrado(s).`);
	for (const post of pendentes) {
		if (!await tentarBaixar(post.shortcode, post.url, post.categoria, post.subcategoria)) falhas++;
		processados++;
	}
}

db.close();

p.outro(
	`Concluído. ${processados} posts processados, ${falhas} falha(s) ` +
		`(yt-dlp pula os que já estão no archive).`,
);
