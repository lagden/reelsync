/**
 * Dado o caminho atual de um arquivo já baixado e a classificação nova,
 * devolve o caminho novo se ele mudou de pasta, ou null se já está no lugar
 * certo (nada a mover).
 *
 * `outputDir` e `currentPath` precisam estar na mesma forma (as duas
 * absolutas, idealmente) — comparar um caminho absoluto (o que o yt-dlp
 * grava) contra um outputDir relativo dá falso positivo de "mudou de pasta".
 */
export function resolveNewPath(
  currentPath: string,
  outputDir: string,
  categoria: string,
  subcategoria: string,
): string | null {
  const barra = currentPath.lastIndexOf("/");
  const dirAtual = currentPath.slice(0, barra);
  const nomeArquivo = currentPath.slice(barra + 1);
  const dirNovo = `${outputDir}/${categoria}/${subcategoria}`;
  return dirAtual === dirNovo ? null : `${dirNovo}/${nomeArquivo}`;
}
