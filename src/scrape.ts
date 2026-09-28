import * as v from "valibot";
import { InstaloaderNodeSchema } from "./schemas.ts";

export interface ScrapedPost {
	shortcode: string;
	url: string;
	caption: string;
	date: number; // unix seconds, taken_at_timestamp
}

export interface ScrapeOptions {
	browser: string;
	limit?: number;
}

/**
 * Roda `instaloader` contra o alvo especial `:saved` (posts salvos do usuário
 * autenticado via cookies do browser) e devolve os posts encontrados.
 * Só baixa metadata (--no-pictures/--no-videos): o download real do vídeo
 * fica a cargo do yt-dlp em download.ts.
 *
 * O instaloader escreve os JSONs numa subpasta `{target}` (aqui, `:saved/`)
 * dentro do cwd — por isso rodamos numa pasta temporária própria desta
 * execução: garante que só os posts pedidos por --limit desta run entram no
 * resultado (nada de acumular metadata de execuções antigas) e limpa sozinho
 * no final.
 */
export async function scrapeSaved(opts: ScrapeOptions): Promise<ScrapedPost[]> {
	const rawDir = await Deno.makeTempDir({ prefix: "reelsync-instaloader-" });
	try {
		const args = [
			"--load-cookies",
			opts.browser,
			"--no-videos",
			"--no-pictures",
			"--no-video-thumbnails",
			"--no-compress-json",
		];
		if (opts.limit) args.push("--count", String(opts.limit));
		args.push("--", ":saved");

		const command = new Deno.Command("instaloader", {
			args,
			cwd: rawDir,
			stdout: "inherit",
			stderr: "inherit",
		});
		const { success, code } = await command.output();
		if (!success) {
			throw new Error(`instaloader saiu com código ${code}`);
		}

		return await readScrapedPosts(rawDir);
	} finally {
		await Deno.remove(rawDir, { recursive: true });
	}
}

/** Varre `dir` recursivamente: o instaloader aninha os JSONs numa subpasta. */
async function readScrapedPosts(dir: string): Promise<ScrapedPost[]> {
	const posts: ScrapedPost[] = [];
	for await (const entry of Deno.readDir(dir)) {
		const path = `${dir}/${entry.name}`;
		if (entry.isDirectory) {
			posts.push(...await readScrapedPosts(path));
		} else if (entry.name.endsWith(".json")) {
			posts.push(...parsePostJson(await Deno.readTextFile(path)));
		}
	}
	return posts;
}

/**
 * O instaloader escreve `{"node": {...GraphQL do post...}, "instaloader": {...}}`.
 * Cada arquivo de `:saved` corresponde a um post (não vem em lote).
 * Arquivo sem `node` é ignorado (não é metadata de post); com `node`
 * presente mas em formato inesperado, `v.parse` lança erro claro em vez de
 * silenciosamente virar `""`/`0`.
 */
export function parsePostJson(raw: string): ScrapedPost[] {
	const parsed = JSON.parse(raw);
	if (!parsed?.node) return [];
	const node = v.parse(InstaloaderNodeSchema, parsed.node);
	return [{
		shortcode: node.shortcode,
		url: `https://www.instagram.com/p/${node.shortcode}/`,
		caption: node.edge_media_to_caption?.edges[0]?.node.text ?? "",
		date: node.taken_at_timestamp,
	}];
}
