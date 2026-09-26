import { assertEquals, assertThrows } from "jsr:@std/assert@^1";
import * as v from "valibot";
import { CategoryMapSchema, InstaloaderNodeSchema } from "./schemas.ts";

Deno.test("CategoryMapSchema aceita um mapa válido", () => {
	const data = { bolo: { categoria: "culinaria", subcategoria: "bolos" } };
	assertEquals(v.parse(CategoryMapSchema, data), data);
});

Deno.test("CategoryMapSchema rejeita categoria com tipo errado", () => {
	const data = { bolo: { categoria: 123, subcategoria: "bolos" } };
	assertThrows(() => v.parse(CategoryMapSchema, data));
});

Deno.test("InstaloaderNodeSchema aceita node sem legenda (post sem caption)", () => {
	const node = { shortcode: "ABC123", taken_at_timestamp: 1700000000 };
	assertEquals(v.parse(InstaloaderNodeSchema, node).shortcode, "ABC123");
});

Deno.test("InstaloaderNodeSchema rejeita node sem shortcode", () => {
	const node = { taken_at_timestamp: 1700000000 };
	assertThrows(() => v.parse(InstaloaderNodeSchema, node));
});
