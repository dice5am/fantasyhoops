import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_SCOPE,
  DEFAULT_SEASON,
  getSeasonPlayerAverages,
} from "@/lib/loadMart";
import type { SeasonTypeScope } from "@/types/season_player_averages";

export const runtime = "nodejs";

/** Forbidden response keys that signal an illegal 3PM fallback path. */
const FORBIDDEN_FALLBACK_KEYS = [
  "avg_fg3m_source",
  "avg_fg3m_resolved",
  "fg3m_source",
  "resolved_avg_fg3m",
] as const;

function parseScope(v: string | null): SeasonTypeScope {
  // Hybrid A1+A3: reg_plus_playoffs falls back to reg_only (no UI option).
  if (v === "playoff_only") return "playoff_only";
  if (v === "reg_only") return "reg_only";
  if (v === "reg_plus_playoffs") return "reg_only";
  return DEFAULT_SCOPE;
}

function assertNoFg3mFallbackPayload(payload: Record<string, unknown>): void {
  for (const key of FORBIDDEN_FALLBACK_KEYS) {
    if (key in payload) {
      throw new Error(
        `HARD GUARD: illegal 3PM fallback field "${key}" — mart avg_fg3m only`
      );
    }
  }
  const src = payload.avg_fg3m_source;
  if (typeof src === "string" && src.includes("sum_fg3m")) {
    throw new Error("HARD GUARD: sum_fg3m/gp fallback is forbidden");
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const player_id = searchParams.get("player_id");
  if (!player_id) {
    return NextResponse.json({ error: "player_id is required" }, { status: 400 });
  }
  const season = searchParams.get("season") || DEFAULT_SEASON;
  const season_type_scope = parseScope(
    searchParams.get("season_type_scope") ?? searchParams.get("scope")
  );
  try {
    const rows = await getSeasonPlayerAverages({
      season,
      season_type_scope,
      player_id,
    });
    const row = rows[0] ?? null;
    // Contract / single-writer lock: 9-cat 3PM = mart avg_fg3m ONLY.
    // Never compute sum_fg3m/gp. Never emit source/resolved fallback fields.
    const payload: Record<string, unknown> = {
      season,
      season_type_scope,
      player_id,
      row,
      avg_fg3m: row?.avg_fg3m ?? null,
    };
    assertNoFg3mFallbackPayload(payload);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.startsWith("HARD GUARD") ? 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
