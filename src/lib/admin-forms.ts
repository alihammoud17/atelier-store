// Admin form parsing and validation. Client-safe and pure: the same rules back the server
// actions (the real check) and can be shown next to fields. Server-side writes live in
// `@/lib/admin-catalog`.
import { toInt, toPositiveInt } from "@/lib/form-values";

export const MAX_STOCK_QUANTITY = 100_000;
/** $100,000. Prices are stored as integer cents. */
export const MAX_PRICE_CENTS = 10_000_000;
export const MAX_POSITION = 1_000;
export const MAX_DETAILS = 12;

const MAX_SLUG_LENGTH = 80;
const MAX_NAME_LENGTH = 120;
const MAX_ALT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_DETAIL_LENGTH = 200;
const MAX_BADGE_LENGTH = 40;
const MAX_URL_LENGTH = 500;

/** The only image host `next/image` can load (see CatalogImage); next.config has no remotePatterns. */
export const IMAGE_ORIGIN = "https://images.unsplash.com";

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type ParseResult<Value, Field extends string> =
  | { ok: true; value: Value }
  | { ok: false; fieldErrors: FieldErrors<Field> };

/** What admin forms get back from their server action, for `useActionState`. */
export type AdminFormState<Field extends string = string> = {
  ok: boolean;
  message: string;
  fieldErrors?: FieldErrors<Field>;
  /**
   * What was submitted, on failure. React resets a form after its action runs, so the form
   * uses these as default values to keep the admin's input.
   */
  values?: Record<string, string>;
} | null;

/** The text fields of a submission, to hand back with errors (files are dropped). */
export function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [name, value] of formData) {
    if (typeof value === "string" && !name.startsWith("$")) values[name] = value;
  }
  return values;
}

// ---------------------------------------------------------------------------------------------
// Field helpers

/** A trimmed string field; files and missing fields read as "". */
function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(value: string, label: string, max: number) {
  if (!value) return `Enter ${label}.`;
  if (value.length > max) return `Use ${max} characters or fewer.`;
  return undefined;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugError(slug: string) {
  if (!slug) return "Enter a URL slug.";
  if (slug.length > MAX_SLUG_LENGTH) return `Use ${MAX_SLUG_LENGTH} characters or fewer.`;
  if (!slugPattern.test(slug)) return "Use lowercase letters, numbers and single hyphens, like wool-coat.";
  return undefined;
}

/**
 * Dollars as typed ("129", "129.5", "129.50") to integer cents, or null. Parsed from the
 * string, never through floating point.
 */
export function parsePriceCents(input: string) {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

/** Cents back to the form's dollar notation: 12950 → "129.50", 12900 → "129". */
export function formatPriceInput(cents: number) {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(dollars) : `${dollars}.${String(rest).padStart(2, "0")}`;
}

/** An https://images.unsplash.com/… URL, else an error message. */
export function imageUrlError(input: string) {
  if (!input) return "Enter an image URL.";
  if (input.length > MAX_URL_LENGTH) return `Use ${MAX_URL_LENGTH} characters or fewer.`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return `Enter a full URL starting with ${IMAGE_ORIGIN}/.`;
  }
  if (url.origin !== IMAGE_ORIGIN || url.username || url.password || url.pathname.length < 2) {
    return `Use an image from ${IMAGE_ORIGIN}/.`;
  }
  return undefined;
}

/** One detail per line; blank lines dropped. */
export function parseDetails(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A whole number from 0 to `max`, else null. */
function boundedInt(input: string, max: number) {
  const number = toInt(input);
  return number !== null && number >= 0 && number <= max ? number : null;
}

function result<Value, Field extends string>(
  errors: FieldErrors<Field>,
  value: () => Value,
): ParseResult<Value, Field> {
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([, message]) => message !== undefined),
  ) as FieldErrors<Field>;
  return Object.keys(fieldErrors).length > 0 ? { ok: false, fieldErrors } : { ok: true, value: value() };
}

// ---------------------------------------------------------------------------------------------
// Products

export type ProductField =
  | "name"
  | "slug"
  | "categoryId"
  | "price"
  | "description"
  | "details"
  | "imageSrc"
  | "imageAlt"
  | "badge"
  | "stock";

export type ProductInput = {
  name: string;
  slug: string;
  categoryId: number;
  priceCents: number;
  description: string;
  details: string[];
  imageSrc: string;
  imageAlt: string;
  badge: string | null;
  isGiftEdit: boolean;
};

/**
 * Product create/edit form. `withStock` reads the initial quantity too (create form only;
 * stock is edited separately afterwards).
 */
export function parseProductForm(
  formData: FormData,
  { withStock = false }: { withStock?: boolean } = {},
): ParseResult<ProductInput & { stock?: number }, ProductField> {
  const name = text(formData, "name");
  const slug = text(formData, "slug");
  const categoryId = toPositiveInt(text(formData, "categoryId"));
  const price = text(formData, "price");
  const priceCents = parsePriceCents(price);
  const description = text(formData, "description");
  const details = parseDetails(text(formData, "details"));
  const imageSrc = text(formData, "imageSrc");
  const imageAlt = text(formData, "imageAlt");
  const badge = text(formData, "badge");
  const stockInput = text(formData, "stock");
  const stock = stockInput === "" ? 0 : boundedInt(stockInput, MAX_STOCK_QUANTITY);

  return result<ProductInput & { stock?: number }, ProductField>(
    {
      name: requiredText(name, "a name", MAX_NAME_LENGTH),
      slug: slugError(slug),
      categoryId: categoryId === null ? "Choose a category." : undefined,
      price: !price
        ? "Enter a price."
        : priceCents === null
          ? `Enter a price in dollars, like 129 or 129.50, up to $${(MAX_PRICE_CENTS / 100).toLocaleString("en-US")}.`
          : undefined,
      description: requiredText(description, "a description", MAX_DESCRIPTION_LENGTH),
      details:
        details.length > MAX_DETAILS
          ? `Use ${MAX_DETAILS} lines or fewer.`
          : details.some((line) => line.length > MAX_DETAIL_LENGTH)
            ? `Keep each line to ${MAX_DETAIL_LENGTH} characters or fewer.`
            : undefined,
      imageSrc: imageUrlError(imageSrc),
      imageAlt: requiredText(imageAlt, "image alt text", MAX_ALT_LENGTH),
      badge: badge.length > MAX_BADGE_LENGTH ? `Use ${MAX_BADGE_LENGTH} characters or fewer.` : undefined,
      stock:
        withStock && stock === null ? `Enter a whole number from 0 to ${MAX_STOCK_QUANTITY}.` : undefined,
    },
    () => ({
      name,
      slug,
      categoryId: categoryId!,
      priceCents: priceCents!,
      description,
      details,
      imageSrc,
      imageAlt,
      badge: badge || null,
      isGiftEdit: formData.get("isGiftEdit") === "on",
      ...(withStock ? { stock: stock! } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Categories

export type CategoryField = "name" | "title" | "slug" | "imageSrc" | "imageAlt" | "position";

export type CategoryInput = {
  name: string;
  title: string;
  slug: string;
  imageSrc: string | null;
  imageAlt: string | null;
  position: number;
};

/** Category create/edit form. The image is optional; without one the category stays off the home grid. */
export function parseCategoryForm(formData: FormData): ParseResult<CategoryInput, CategoryField> {
  const name = text(formData, "name");
  const title = text(formData, "title");
  const slug = text(formData, "slug");
  const imageSrc = text(formData, "imageSrc");
  const imageAlt = text(formData, "imageAlt");
  const positionInput = text(formData, "position");
  const position = positionInput === "" ? 0 : boundedInt(positionInput, MAX_POSITION);

  return result<CategoryInput, CategoryField>(
    {
      name: requiredText(name, "a name", MAX_NAME_LENGTH),
      title: requiredText(title, "a title", MAX_NAME_LENGTH),
      slug: slugError(slug),
      imageSrc: imageSrc ? imageUrlError(imageSrc) : undefined,
      imageAlt: imageSrc ? requiredText(imageAlt, "image alt text", MAX_ALT_LENGTH) : undefined,
      position: position === null ? `Enter a whole number from 0 to ${MAX_POSITION}.` : undefined,
    },
    () => ({
      name,
      title,
      slug,
      imageSrc: imageSrc || null,
      imageAlt: imageSrc ? imageAlt : null,
      position: position!,
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Stock

export type StockField = "quantity";

/** Stock form result; `quantity` is the stock now in the database, for the next `expected`. */
export type StockFormState = (NonNullable<AdminFormState<StockField>> & { quantity?: number }) | null;

export type StockInput = {
  productId: number;
  quantity: number;
  /** The quantity the form showed; the update only applies if stock still has this value. */
  expected: number;
};

/** Stock form. A bad product ID or expected value means a tampered form, not a field error. */
export function parseStockForm(
  formData: FormData,
): ParseResult<StockInput, StockField> | { ok: false; invalid: true } {
  const productId = toPositiveInt(text(formData, "productId"));
  const expected = toInt(text(formData, "expected"));
  if (productId === null || expected === null || expected < 0) return { ok: false, invalid: true };

  const quantity = boundedInt(text(formData, "quantity"), MAX_STOCK_QUANTITY);
  return result<StockInput, StockField>(
    { quantity: quantity === null ? `Enter a whole number from 0 to ${MAX_STOCK_QUANTITY}.` : undefined },
    () => ({ productId, quantity: quantity!, expected }),
  );
}

export type AdjustStockField = "amount";

/** Adjust form result; `quantity` is the stock now in the database, when known. */
export type AdjustStockFormState = (NonNullable<AdminFormState<AdjustStockField>> & { quantity?: number }) | null;

export type AdjustStockInput = {
  productId: number;
  /** Units to add (positive) or remove (negative); never 0. */
  delta: number;
};

/**
 * Adjust form: a positive amount plus the button pressed (`direction`: add or remove). Whether
 * the result stays within 0 to MAX_STOCK_QUANTITY is checked by the update itself, against the
 * stock at that moment. A bad product ID or direction means a tampered form.
 */
export function parseAdjustStockForm(
  formData: FormData,
): ParseResult<AdjustStockInput, AdjustStockField> | { ok: false; invalid: true } {
  const productId = toPositiveInt(text(formData, "productId"));
  const direction = text(formData, "direction");
  if (productId === null || (direction !== "add" && direction !== "remove")) return { ok: false, invalid: true };

  const amount = boundedInt(text(formData, "amount"), MAX_STOCK_QUANTITY);
  return result<AdjustStockInput, AdjustStockField>(
    { amount: amount === null || amount === 0 ? `Enter a whole number from 1 to ${MAX_STOCK_QUANTITY}.` : undefined },
    () => ({ productId, delta: direction === "add" ? amount! : -amount! }),
  );
}
