import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { parquetReadObjects } from "hyparquet";
import type {
  ScheduleAvailability,
  SeasonSchedulePayload,
  SeasonScheduleRow,
} from "@/types/season_schedule";

const DEFAULT_SCHEDULE = path.join(
  process.cwd(),
  "data/marts/season_schedule_2026_27.parquet"
);

const DRAFT_PREP_SEASON = "2026-27";

let cache: {
  path: string;
  mtimeMs: number;
  rows: SeasonScheduleRow[];
} | null = null;

export function seasonSchedulePath(): string {
  return process.env.NBA_SEASON_SCHEDULE_PATH || DEFAULT_SCHEDULE;
}

export function seasonScheduleAvailable(): boolean {
  try {
    const p = seasonSchedulePath();
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toAvailability(v: unknown): ScheduleAvailability {
  const s = String(v ?? "confirmed");
  if (
    s === "confirmed" ||
    s === "time_tbd" ||
    s === "location_tbd" ||
    s === "scheduled_incomplete" ||
    s === "final"
  ) {
    return s;
  }
  return "confirmed";
}

function mapRow(raw: Record<string, unknown>): SeasonScheduleRow {
  const gameDate = raw.game_date;
  let dateStr = "";
  if (gameDate instanceof Date) {
    dateStr = gameDate.toISOString().slice(0, 10);
  } else {
    dateStr = String(gameDate ?? "").slice(0, 10);
  }
  return {
    season: String(raw.season ?? DRAFT_PREP_SEASON),
    season_type: String(raw.season_type ?? ""),
    game_id: String(raw.game_id ?? ""),
    game_date: dateStr,
    game_time: toStr(raw.game_time),
    matchup: String(raw.matchup ?? ""),
    location: toStr(raw.location),
    availability: toAvailability(raw.availability),
    home_team_abbreviation: toStr(raw.home_team_abbreviation),
    away_team_abbreviation: toStr(raw.away_team_abbreviation),
    game_label: toStr(raw.game_label),
  };
}

async function loadAll(): Promise<SeasonScheduleRow[]> {
  const p = seasonSchedulePath();
  if (!existsSync(p)) return [];
  const st = statSync(p);
  if (cache && cache.path === p && cache.mtimeMs === st.mtimeMs) {
    return cache.rows;
  }
  const buf = readFileSync(p);
  const objects = (await parquetReadObjects({
    file: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  })) as Record<string, unknown>[];
  const rows = objects.map(mapRow);
  cache = { path: p, mtimeMs: st.mtimeMs, rows };
  return rows;
}

/** Regular Season only for Draft Prep UI (season_schedule_reg_only). */
export async function getSeasonSchedule(params?: {
  season?: string;
}): Promise<SeasonSchedulePayload> {
  const season = params?.season ?? DRAFT_PREP_SEASON;
  const all = await loadAll();
  const rows = all
    .filter(
      (r) =>
        r.season === season &&
        r.season_type === "Regular Season" &&
        Boolean(r.game_id)
    )
    .sort((a, b) => {
      if (a.game_date !== b.game_date) {
        return a.game_date < b.game_date ? -1 : 1;
      }
      return a.game_id < b.game_id ? -1 : 1;
    });
  return {
    season,
    season_type_scope: "reg_only",
    row_count: rows.length,
    rows,
    parquet_path: seasonSchedulePath(),
  };
}

export { DRAFT_PREP_SEASON };
