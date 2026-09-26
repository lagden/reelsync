import { assertEquals } from "jsr:@std/assert@^1";
import { resolveNewPath } from "./paths.ts";

Deno.test("resolveNewPath: null quando já está na pasta certa", () => {
  const r = resolveNewPath("/out/culinaria/bolos/x.mp4", "/out", "culinaria", "bolos");
  assertEquals(r, null);
});

Deno.test("resolveNewPath: caminho novo quando a categoria muda", () => {
  const r = resolveNewPath("/out/sem-categoria/geral/x.mp4", "/out", "agro", "geral");
  assertEquals(r, "/out/agro/geral/x.mp4");
});

Deno.test("resolveNewPath: falso positivo se outputDir não estiver na mesma forma (regressão)", () => {
  // currentPath absoluto vs outputDir relativo: pastas diferentes na string,
  // mesmo apontando pro mesmo lugar no disco. Documenta a responsabilidade
  // do chamador de normalizar antes de comparar.
  const r = resolveNewPath("/Users/x/instagram-saved/agro/geral/v.mp4", "./instagram-saved", "agro", "geral");
  assertEquals(r, "./instagram-saved/agro/geral/v.mp4");
});
