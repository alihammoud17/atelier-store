// Parsing for values that arrive from forms or server action arguments. Client-safe.

/**
 * A safe integer from a number or a string of plain digits, else null. Only plain digits
 * count: Number() would also turn "", " ", "1e3" and "0x10" into numbers.
 */
export function toInt(value: unknown) {
  const number = typeof value === "string" ? (/^\d{1,15}$/.test(value) ? Number(value) : NaN) : value;
  return typeof number === "number" && Number.isSafeInteger(number) ? number : null;
}

/** A positive integer (such as a database ID), else null. */
export function toPositiveInt(value: unknown) {
  const number = toInt(value);
  return number !== null && number > 0 ? number : null;
}
