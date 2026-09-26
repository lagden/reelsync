/**
 * Reaplica categories.json em cima do que já está no banco (a legenda de
 * cada post já foi salva por upsertScraped, não precisa raspar de novo).
 * Se o post já tinha vídeo baixado, move o arquivo pra pasta nova também —
 * compara a pasta real do arquivo com a pasta esperada pela classificação
 * atual (não só "mudou desde a última vez?"), então também conserta um
 * banco que já tenha ficado dessincronizado do disco.
 *
 * Uso: deno task reclassify [output-dir]  (default: ./instagram-saved)
 */
import { classify, parseCategories } from "../src/classify.ts";
import { openDb } from "../src/db.ts";
import { resolveNewPath } from "../src/paths.ts";
import categoriesData from "../categories.json" with { type: "json" };

const categories = parseCategories(categoriesData);
const db = openDb(Deno.args[0] ?? "./instagram-saved"); // garante que a pasta existe
// Resolve pra absoluto: file_path já vem absoluto (o yt-dlp resolve assim),
// comparar contra um outputDir relativo dava falso positivo de "mudou de pasta".
const outputDir = await Deno.realPath(Deno.args[0] ?? "./instagram-saved");

const rows = db.prepare(
	"SELECT shortcode, caption, categoria, subcategoria, file_path FROM posts",
).all() as {
	shortcode: string;
	caption: string | null;
	categoria: string;
	subcategoria: string;
	file_path: string | null;
}[];

const updateMetadata = db.prepare(
	"UPDATE posts SET categoria = ?, subcategoria = ? WHERE shortcode = ?",
);
const updateWithFile = db.prepare(
	"UPDATE posts SET categoria = ?, subcategoria = ?, file_path = ? WHERE shortcode = ?",
);

let alterados = 0;
let arquivosMovidos = 0;
for (const row of rows) {
	const nova = classify(row.caption ?? "", categories);

	if (!row.file_path) {
		if (nova.categoria !== row.categoria || nova.subcategoria !== row.subcategoria) {
			updateMetadata.run(nova.categoria, nova.subcategoria, row.shortcode);
			alterados++;
		}
		continue;
	}

	const pathNovo = resolveNewPath(row.file_path, outputDir, nova.categoria, nova.subcategoria);
	if (!pathNovo) {
		if (nova.categoria !== row.categoria || nova.subcategoria !== row.subcategoria) {
			updateMetadata.run(nova.categoria, nova.subcategoria, row.shortcode);
			alterados++;
		}
		continue;
	}

	try {
		const dirNovo = pathNovo.slice(0, pathNovo.lastIndexOf("/"));
		await Deno.mkdir(dirNovo, { recursive: true });
		await Deno.rename(row.file_path, pathNovo);
	} catch (err) {
		console.error(
			`Pulei ${row.shortcode}: não consegui mover o arquivo (${err instanceof Error ? err.message : err}).`,
		);
		continue;
	}
	updateWithFile.run(nova.categoria, nova.subcategoria, pathNovo, row.shortcode);
	alterados++;
	arquivosMovidos++;
}

db.close();
console.log(`Reclassificados ${alterados} de ${rows.length} posts (${arquivosMovidos} arquivo(s) movido(s) de pasta).`);
