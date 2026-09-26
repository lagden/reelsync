import * as v from "valibot";
import { type Category, CategoryMapSchema, type CategoryMap } from "./schemas.ts";

export type { Category, CategoryMap };

export const FALLBACK: Category = { categoria: "sem-categoria", subcategoria: "geral" };

/** Valida o conteúdo de categories.json; lança erro claro se estiver malformado. */
export function parseCategories(data: unknown): CategoryMap {
  return v.parse(CategoryMapSchema, data);
}

/** Extrai hashtags (sem #, minúsculas) de uma legenda. */
export function extractHashtags(caption: string): string[] {
  return [...caption.matchAll(/#(\w+)/g)].map((m) => m[1].toLowerCase());
}

/** Casa a primeira hashtag conhecida no mapa; sem match, cai no fallback. */
export function classify(caption: string, categories: CategoryMap): Category {
  for (const tag of extractHashtags(caption)) {
    if (tag in categories) return categories[tag];
  }
  return FALLBACK;
}
