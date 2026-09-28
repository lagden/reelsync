export interface DownloadOptions {
	browser: string;
	outputDir: string;
}

/**
 * Baixa um post via yt-dlp na pasta categoria/subcategoria e devolve o
 * caminho final do arquivo (pra guardar no banco).
 * Dedupe é 100% da flag --download-archive: se o id já estiver no archive,
 * o yt-dlp pula o download sozinho — e nesse caso não roda pós-processador
 * nenhum, então não temos como recuperar o path aqui (fica undefined).
 *
 * Post em carrossel (várias fotos/vídeos) vira uma "playlist" pro yt-dlp:
 * cada foto do carrossel dá erro "No video formats found" (não é bloqueio
 * do Instagram, é só o item não ter vídeo). --ignore-errors evita que isso
 * aborte o carrossel inteiro — segue baixando os outros itens.
 *
 * ponytail: se o carrossel tiver mais de um vídeo, só guardamos o path do
 * primeiro (o schema é 1 file_path por shortcode); todos são baixados no
 * disco, só o catálogo no banco não reflete os extras. Ajustar se isso
 * virar um caso comum.
 */
export async function downloadPost(
	url: string,
	categoria: string,
	subcategoria: string,
	opts: DownloadOptions,
): Promise<string | undefined> {
	const pathFile = await Deno.makeTempFile({ prefix: "reelsync-ytdlp-path-" });
	try {
		const args = [
			"--cookies-from-browser",
			opts.browser,
			"--ignore-errors",
			"--download-archive",
			`${opts.outputDir}/historico_downloads.txt`,
			"-o",
			`${opts.outputDir}/${categoria}/${subcategoria}/%(id)s_%(title).50s.%(ext)s`,
			"--print-to-file",
			"after_move:filepath",
			pathFile,
			url,
		];
		const command = new Deno.Command("yt-dlp", { args, stdout: "inherit", stderr: "inherit" });
		const { success, code } = await command.output();

		const printed = await Deno.readTextFile(pathFile);
		const resolved = printed.split("\n").find((line) => line.length > 0);

		// Só falha de verdade se nada foi baixado (nem o --ignore-errors salvou
		// nenhum item). Sucesso parcial (alguns itens do carrossel ok) conta.
		if (!success && !resolved) {
			throw new Error(`yt-dlp saiu com código ${code} para ${url}`);
		}
		return resolved;
	} finally {
		await Deno.remove(pathFile);
	}
}
