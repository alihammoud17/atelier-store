import { getAccessFallbackHTTPStatus, isHTTPAccessFallbackError } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { isRedirectError } from "next/dist/client/components/redirect-error";

// `redirect()` and `notFound()` from next/navigation throw special errors that Next.js catches
// to navigate. These helpers run code that should throw one and return what it carried.
// They rely on Next.js internals, kept in this one file so an upgrade only breaks here.

async function caught(run: () => unknown) {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected a redirect() or notFound(), but nothing was thrown.");
}

/** Runs `run`, expects it to call `redirect()`, and returns the target URL. */
export async function expectRedirect(run: () => unknown) {
  const error = await caught(run);
  if (!isRedirectError(error)) throw error;
  return getURLFromRedirectError(error);
}

/** Runs `run` and expects it to call `notFound()`. */
export async function expectNotFound(run: () => unknown) {
  const error = await caught(run);
  if (!isHTTPAccessFallbackError(error) || getAccessFallbackHTTPStatus(error) !== 404) throw error;
}
