"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BagIcon } from "@/components/ui/icons";
import { BAG_CHANGE_EVENT, countItems, parseBag, readBagCookie } from "@/lib/bag";
import { cx } from "@/lib/cx";

function subscribe(onChange: () => void) {
  window.addEventListener(BAG_CHANGE_EVENT, onChange);
  // Another tab may have changed the bag while this one was in the background.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(BAG_CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

function getCount() {
  return countItems(parseBag(readBagCookie(document.cookie)));
}

// The header is static and shared, so the count is read from the cookie in the browser rather
// than on the server. The server snapshot has no count, which keeps hydration consistent.
export function BagLink({ className }: { className?: string }) {
  const count = useSyncExternalStore(subscribe, getCount, () => null);

  return (
    <Link
      href="/bag"
      aria-label={count ? `Shopping bag, ${count} ${count === 1 ? "item" : "items"}` : "Shopping bag"}
      className={cx("relative", className)}
    >
      <BagIcon />
      {count ? (
        <span
          aria-hidden="true"
          className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-2xs leading-none font-medium text-canvas tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
