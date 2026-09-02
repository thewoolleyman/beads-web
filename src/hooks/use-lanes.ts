"use client";

/**
 * Hook for the board's configured lane order.
 *
 * The server reads `BEADS_WEB_LANES` at startup and serves the result from
 * `GET /api/lanes`, so a tenant whose lifecycle differs from the livespec
 * one needs no code change. Any failure — an old server without the route,
 * an offline fetch, a malformed body — leaves the built-in default order in
 * place, so the board always has lanes to render.
 */

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api-base";
import { DEFAULT_LANES } from "@/lib/lanes";

/** Shape of the `GET /api/lanes` response body. */
interface LanesResponse {
  lanes?: unknown;
}

/**
 * Normalize a server lane list: strings only, trimmed, blanks dropped.
 *
 * @returns The lane order, or `null` if the body carries no usable list.
 */
function readLanes(body: LanesResponse | null): string[] | null {
  if (!body || !Array.isArray(body.lanes)) return null;

  const lanes = body.lanes
    .filter((lane): lane is string => typeof lane === "string")
    .map((lane) => lane.trim())
    .filter((lane) => lane.length > 0);

  return lanes.length > 0 ? lanes : null;
}

/**
 * Fetch the configured lane order once, falling back to {@link DEFAULT_LANES}.
 *
 * @returns The lane order to hand to `deriveLanes`.
 */
export function useLanes(): string[] {
  const [lanes, setLanes] = useState<string[]>(DEFAULT_LANES);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(apiUrl("/api/lanes"), { signal: controller.signal });
        if (!res.ok) return;
        const configured = readLanes(await res.json());
        if (configured && !controller.signal.aborted) setLanes(configured);
      } catch {
        // Keep the default order: an unreachable or older server is fine.
      }
    })();

    return () => controller.abort();
  }, []);

  return lanes;
}
