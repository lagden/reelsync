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
 */
export async function downloadPost(
  url: string,
  categoria: string,
  subcategoria: string,
  opts: DownloadOptions,
): Promise<string | undefined> {
  const pathFile = await Deno.makeTempFile({ prefix: "chupinhador-ytdlp-path-" });
  try {
    const args = [
      "--cookies-from-browser",
      opts.browser,
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
    if (!success) {
      throw new Error(`yt-dlp saiu com código ${code} para ${url}`);
    }

    const resolved = (await Deno.readTextFile(pathFile)).trim();
    return resolved || undefined;
  } finally {
    await Deno.remove(pathFile);
  }
}
