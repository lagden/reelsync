import * as v from "valibot";

/** categories.json: mapa hashtag -> {categoria, subcategoria}, editado à mão. */
export const CategorySchema = v.object({
  categoria: v.string(),
  subcategoria: v.string(),
});
export type Category = v.InferOutput<typeof CategorySchema>;

export const CategoryMapSchema = v.record(v.string(), CategorySchema);
export type CategoryMap = v.InferOutput<typeof CategoryMapSchema>;

/**
 * Só os campos do `node` (GraphQL do instaloader) que a gente de fato usa.
 * `taken_at_timestamp` e `shortcode` são obrigatórios (confirmado contra os
 * 1178 posts reais já raspados); a legenda é opcional (~1.4% dos posts reais
 * não têm `edge_media_to_caption`).
 */
export const InstaloaderNodeSchema = v.object({
  shortcode: v.string(),
  taken_at_timestamp: v.number(),
  edge_media_to_caption: v.optional(
    v.object({
      edges: v.array(v.object({ node: v.object({ text: v.string() }) })),
    }),
  ),
});

/** Flags da CLI já parseadas pelo parseArgs, antes de virar opções internas. */
export const FlagsSchema = v.object({
  browser: v.pipe(v.string(), v.minLength(1, "browser não pode ser vazio")),
  outputDir: v.pipe(v.string(), v.minLength(1, "output-dir não pode ser vazio")),
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1, "--limit precisa ser >= 1"))),
});
export type Flags = v.InferOutput<typeof FlagsSchema>;
