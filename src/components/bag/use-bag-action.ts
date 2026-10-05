"use client";

import { useState, useTransition } from "react";
import { BAG_CHANGE_EVENT, type BagActionState } from "@/lib/bag";

/**
 * Runs a bag server action in a transition, keeps its result for inline messages and tells the
 * header badge to re-read the cookie once the action has written it.
 */
export function useBagAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<BagActionState>,
) {
  const [state, setState] = useState<BagActionState>(null);
  const [pending, startTransition] = useTransition();

  function run(...args: Args) {
    if (pending) return;
    startTransition(async () => {
      try {
        setState(await action(...args));
      } catch {
        setState({ ok: false, message: "We couldn't update your bag. Please try again." });
      }
      window.dispatchEvent(new Event(BAG_CHANGE_EVENT));
    });
  }

  return { state, pending, run };
}
