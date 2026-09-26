import { assertEquals } from "jsr:@std/assert@^1";
import { classify, extractHashtags, FALLBACK } from "./classify.ts";

const categories = {
  bolo: { categoria: "culinaria", subcategoria: "bolos" },
};

Deno.test("extractHashtags pega as tags em minúsculas", () => {
  assertEquals(extractHashtags("Bolo de cenoura #Bolo #receita"), ["bolo", "receita"]);
});

Deno.test("classify casa por hashtag conhecida", () => {
  assertEquals(classify("#Bolo de chocolate", categories), {
    categoria: "culinaria",
    subcategoria: "bolos",
  });
});

Deno.test("classify cai no fallback sem match", () => {
  assertEquals(classify("nada a ver aqui", categories), FALLBACK);
});
