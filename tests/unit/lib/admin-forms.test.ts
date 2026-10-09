// Run with: pnpm test (or pnpm exec vitest run tests/unit/lib/admin-forms.test.ts)
import { describe, expect, test } from "vitest";
import {
  formatPriceInput,
  imageUrlError,
  MAX_DETAILS,
  MAX_STOCK_QUANTITY,
  parseCategoryForm,
  parseDetails,
  parsePriceCents,
  parseProductForm,
  parseStockForm,
  slugError,
} from "@/lib/admin-forms";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

const validProduct = {
  name: " Wool coat ",
  slug: "wool-coat",
  categoryId: "3",
  price: "129.50",
  description: "A long coat.",
  details: "100% wool\n\n  Made in Italy  \n",
  imageSrc: "https://images.unsplash.com/photo-123",
  imageAlt: "A wool coat",
  badge: "",
};

describe("slugError", () => {
  test.each(["wool-coat", "a", "coat-2026", "a1-b2-c3"])("accepts %j", (slug) =>
    expect(slugError(slug)).toBeUndefined(),
  );

  test.each(["", "Wool-Coat", "wool coat", "-coat", "coat-", "wool--coat", "wool_coat", "café", "../admin", "a".repeat(81)])(
    "rejects %j",
    (slug) => expect(slugError(slug)).toEqual(expect.any(String)),
  );
});

describe("parsePriceCents", () => {
  test("parses dollars to integer cents without floating point", () => {
    expect(parsePriceCents("129")).toBe(12_900);
    expect(parsePriceCents("129.5")).toBe(12_950);
    expect(parsePriceCents("129.50")).toBe(12_950);
    expect(parsePriceCents("0.29")).toBe(29);
    expect(parsePriceCents("0")).toBe(0);
    // 0.1 + 0.2 style float errors can't happen: 1.15 * 100 is 114.99999999999999.
    expect(parsePriceCents("1.15")).toBe(115);
    expect(parsePriceCents(" 25 ")).toBe(2_500);
    expect(parsePriceCents("100000")).toBe(10_000_000);
  });

  test.each(["", " ", "1e3", "-1", "+1", "12.345", "12.", ".5", "1,299", "$12", "0x10", "Infinity", "NaN", "100000.01", "999999999"])(
    "rejects %j",
    (input) => expect(parsePriceCents(input)).toBeNull(),
  );

  test("formatPriceInput round-trips", () => {
    for (const cents of [0, 29, 115, 12_900, 12_950, 10_000_000]) {
      expect(parsePriceCents(formatPriceInput(cents))).toBe(cents);
    }
    expect(formatPriceInput(12_950)).toBe("129.50");
    expect(formatPriceInput(12_900)).toBe("129");
    expect(formatPriceInput(5)).toBe("0.05");
  });
});

describe("imageUrlError", () => {
  test("accepts Unsplash https URLs", () => {
    expect(imageUrlError("https://images.unsplash.com/photo-123")).toBeUndefined();
    expect(imageUrlError("https://images.unsplash.com/photo-123?w=800")).toBeUndefined();
  });

  test.each([
    "",
    "photo-123",
    "http://images.unsplash.com/photo-123",
    "https://images.unsplash.com",
    "https://images.unsplash.com/",
    "https://images.unsplash.com.evil.example/photo-123",
    "https://evil.example/https://images.unsplash.com/photo-123",
    "https://user:pass@images.unsplash.com/photo-123",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//images.unsplash.com/photo-123",
    `https://images.unsplash.com/${"a".repeat(500)}`,
  ])("rejects %j", (input) => expect(imageUrlError(input)).toEqual(expect.any(String)));
});

test("parseDetails keeps one trimmed detail per non-blank line", () => {
  expect(parseDetails("100% wool\r\n\n  Made in Italy  \n")).toEqual(["100% wool", "Made in Italy"]);
  expect(parseDetails("")).toEqual([]);
});

describe("parseProductForm", () => {
  test("returns trimmed, typed values", () => {
    expect(parseProductForm(form({ ...validProduct, isGiftEdit: "on" }))).toEqual({
      ok: true,
      value: {
        name: "Wool coat",
        slug: "wool-coat",
        categoryId: 3,
        priceCents: 12_950,
        description: "A long coat.",
        details: ["100% wool", "Made in Italy"],
        imageSrc: "https://images.unsplash.com/photo-123",
        imageAlt: "A wool coat",
        badge: null,
        isGiftEdit: true,
      },
    });
  });

  test("ignores stock unless asked, then defaults it to 0", () => {
    const withoutStock = parseProductForm(form({ ...validProduct, stock: "5" }));
    expect(withoutStock.ok && "stock" in withoutStock.value).toBe(false);

    const blank = parseProductForm(form(validProduct), { withStock: true });
    expect(blank.ok && blank.value.stock).toBe(0);
    const five = parseProductForm(form({ ...validProduct, stock: "5" }), { withStock: true });
    expect(five.ok && five.value.stock).toBe(5);
  });

  test("reports every invalid field at once", () => {
    const parsed = parseProductForm(form({}), { withStock: true });
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && Object.keys(parsed.fieldErrors).sort()).toEqual(
      ["categoryId", "description", "imageAlt", "imageSrc", "name", "price", "slug"].sort(),
    );
  });

  test.each(["0", "-3", "1.5", "0x10", "abc", "1e3", ""])("rejects the category ID %j", (categoryId) => {
    const parsed = parseProductForm(form({ ...validProduct, categoryId }));
    expect(!parsed.ok && parsed.fieldErrors.categoryId).toEqual(expect.any(String));
  });

  test.each(["-1", "1.5", "1e3", "0x10", String(MAX_STOCK_QUANTITY + 1)])("rejects the initial stock %j", (stock) => {
    const parsed = parseProductForm(form({ ...validProduct, stock }), { withStock: true });
    expect(!parsed.ok && parsed.fieldErrors.stock).toEqual(expect.any(String));
  });

  test("caps details, badge and name length", () => {
    const tooMany = Array.from({ length: MAX_DETAILS + 1 }, (_, i) => `Detail ${i}`).join("\n");
    const parsed = parseProductForm(
      form({ ...validProduct, details: tooMany, badge: "b".repeat(41), name: "n".repeat(121) }),
    );
    expect(!parsed.ok && Object.keys(parsed.fieldErrors).sort()).toEqual(["badge", "details", "name"]);
  });

  test("treats an uploaded file as a missing value", () => {
    const data = form(validProduct);
    data.set("name", new Blob(["Wool coat"]));
    const parsed = parseProductForm(data);
    expect(!parsed.ok && parsed.fieldErrors.name).toBe("Enter a name.");
  });
});

describe("parseCategoryForm", () => {
  const valid = { name: "Bags", title: "Handbags", slug: "bags", position: "2" };

  test("allows a category without an image", () => {
    expect(parseCategoryForm(form(valid))).toEqual({
      ok: true,
      value: { name: "Bags", title: "Handbags", slug: "bags", imageSrc: null, imageAlt: null, position: 2 },
    });
    const noPosition = parseCategoryForm(form({ ...valid, position: "" }));
    expect(noPosition.ok && noPosition.value.position).toBe(0);
  });

  test("requires alt text and an Unsplash URL when an image is given", () => {
    const parsed = parseCategoryForm(form({ ...valid, imageSrc: "https://evil.example/x.png" }));
    expect(!parsed.ok && Object.keys(parsed.fieldErrors).sort()).toEqual(["imageAlt", "imageSrc"]);
  });

  test("drops alt text without an image", () => {
    const parsed = parseCategoryForm(form({ ...valid, imageAlt: "orphan" }));
    expect(parsed.ok && parsed.value.imageAlt).toBeNull();
  });

  test.each(["-1", "1.5", "1001", "abc"])("rejects the position %j", (position) => {
    const parsed = parseCategoryForm(form({ ...valid, position }));
    expect(!parsed.ok && parsed.fieldErrors.position).toEqual(expect.any(String));
  });
});

describe("parseStockForm", () => {
  test("returns the product, new quantity and the quantity the form showed", () => {
    expect(parseStockForm(form({ productId: "7", quantity: "12", expected: "3" }))).toEqual({
      ok: true,
      value: { productId: 7, quantity: 12, expected: 3 },
    });
    expect(parseStockForm(form({ productId: "7", quantity: "0", expected: "0" })).ok).toBe(true);
  });

  test.each(["-1", "1.5", "1e3", "0x10", "", " ", String(MAX_STOCK_QUANTITY + 1)])(
    "rejects the quantity %j as a field error",
    (quantity) => {
      const parsed = parseStockForm(form({ productId: "7", quantity, expected: "3" }));
      expect(parsed).toEqual({ ok: false, fieldErrors: { quantity: expect.any(String) } });
    },
  );

  test.each([
    { productId: "0", expected: "3" },
    { productId: "-7", expected: "3" },
    { productId: "0x10", expected: "3" },
    { productId: "", expected: "3" },
    { productId: "7", expected: "-1" },
    { productId: "7", expected: "" },
    { productId: "7", expected: "1.5" },
  ])("treats a tampered form as invalid: %j", (fields) => {
    expect(parseStockForm(form({ ...fields, quantity: "5" }))).toEqual({ ok: false, invalid: true });
  });
});
