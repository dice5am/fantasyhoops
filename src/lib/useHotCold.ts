"use client";

import { useEffect, useState } from "react";
import type { HotColdPayload } from "@/types/hot_cold";

/**
 * Client hook for /api/hot-cold (player_hot_cold + baseline_teams).
 * One fetch per page load (module-level promise). Errors surface; nothing is zero-filled.
 */

let inflight: Promise<HotColdPayload> | null = null;

function fetchHotCold(): Promise<HotColdPayload> {
  if (!inflight) {
    inflight = fetch("/api/hot-cold", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as HotColdPayload & { error?: string };
        if (!res.ok) throw new Error(body.error || `hot-cold ${res.status}`);
        return body;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

export function useHotCold(): {
  data: HotColdPayload | null;
  error: string | null;
} {
  const [data, setData] = useState<HotColdPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchHotCold()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  return { data, error };
}
