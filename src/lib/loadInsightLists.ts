import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * Insight lists (Analyst insights.json, baked at data/insights/insights.json).
 * Validated on load. Missing or malformed → null (the list section hides; the
 * rest of /insights renders). Null values stay null — rendered "n/a", never 0.
 * Env override: NBA_INSIGHTS_JSON_PATH.
 */

/** Known ids today (informational only — rendering follows the file). */
export const KNOWN_INSIGHT_LIST_IDS = [
  "off",
  "def",
  "eff",
  "young",
  "prime_breakout",
  "avoid",
  "availability",
  "rarity",
  "hot",
  "cold",
] as const;

export type InsightRow = {
  rank: number | null;
  player_id: string;
  full_name: string;
  age: number | null;
  exp_year: number | null;
  value: number | null;
  value_label: string;
  reason: string;
  stats: Record<string, number | null>;
};

export type InsightList = {
  id: string;
  title: string;
  status: "final" | "provisional";
  metric_label: string;
  method: string;
  rows: InsightRow[];
};

export type InsightLeap = {
  summary: string;
  peak_age: number | null;
  decline_start_age: number | null;
  decline_start_year: number | null;
  leap_ages: number[];
  leap_years: number[];
  year3_verdict: string | null;
  year7_verdict: string | null;
  n_pairs: number | null;
};

export type InsightListsPayload = {
  generated_at: string;
  status: "preliminary" | "final";
  leap: InsightLeap | null;
  lists: InsightList[];
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Finite number → number; null/undefined/NaN → null. Anything else is malformed. */
function num(v: unknown, where: string): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  throw new Error(`${where}: expected number or null`);
}

function numList(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
}

function parseRow(raw: unknown, where: string): InsightRow {
  if (!isObj(raw)) throw new Error(`${where}: row not an object`);
  const full_name = str(raw.full_name);
  if (!full_name) throw new Error(`${where}: full_name missing`);
  const stats: Record<string, number | null> = {};
  if (raw.stats != null) {
    if (!isObj(raw.stats)) throw new Error(`${where}: stats not an object`);
    for (const [k, v] of Object.entries(raw.stats)) {
      // Schema: object of numbers. Null stays null; non-numeric entries are dropped, not zeroed.
      if (v == null) stats[k] = null;
      else if (typeof v === "number") stats[k] = Number.isFinite(v) ? v : null;
    }
  }
  return {
    rank: num(raw.rank, `${where}.rank`),
    player_id: raw.player_id == null ? "" : String(raw.player_id),
    full_name,
    age: num(raw.age, `${where}.age`),
    exp_year: num(raw.exp_year, `${where}.exp_year`),
    value: num(raw.value, `${where}.value`),
    value_label: str(raw.value_label) ?? "",
    reason: str(raw.reason) ?? "",
    stats,
  };
}

function parseList(raw: unknown, i: number): InsightList {
  const where = `lists[${i}]`;
  if (!isObj(raw)) throw new Error(`${where}: not an object`);
  const id = str(raw.id);
  const title = str(raw.title);
  if (!id || !title) throw new Error(`${where}: id/title missing`);
  if (!Array.isArray(raw.rows)) throw new Error(`${where}: rows not an array`);
  return {
    id,
    title,
    status: raw.status === "final" ? "final" : "provisional",
    metric_label: str(raw.metric_label) ?? "",
    method: str(raw.method) ?? "",
    rows: raw.rows.map((r, j) => parseRow(r, `${where}.rows[${j}]`)),
  };
}

function parseLeap(raw: unknown): InsightLeap | null {
  if (!isObj(raw)) return null;
  const summary = str(raw.summary);
  if (!summary) return null;
  return {
    summary,
    peak_age: num(raw.peak_age, "leap.peak_age"),
    decline_start_age: num(raw.decline_start_age, "leap.decline_start_age"),
    decline_start_year: num(raw.decline_start_year, "leap.decline_start_year"),
    leap_ages: numList(raw.leap_ages),
    leap_years: numList(raw.leap_years),
    year3_verdict: str(raw.year3_verdict),
    year7_verdict: str(raw.year7_verdict),
    n_pairs: num(raw.n_pairs, "leap.n_pairs"),
  };
}

/** Throws on malformed input (used by tests / validator). */
export function parseInsightLists(raw: unknown): InsightListsPayload {
  if (!isObj(raw)) throw new Error("insights.json: not an object");
  const status = raw.status;
  if (status !== "preliminary" && status !== "final") {
    throw new Error("insights.json: status must be preliminary|final");
  }
  if (!Array.isArray(raw.lists)) throw new Error("insights.json: lists missing");
  // Render every list in the file's order (no hard-coded order or count).
  const lists = raw.lists.map(parseList);
  return {
    generated_at: str(raw.generated_at) ?? "",
    status,
    leap: parseLeap(raw.leap),
    lists,
  };
}

export function insightListsPath(): string {
  return (
    process.env.NBA_INSIGHTS_JSON_PATH ||
    path.join(process.cwd(), "data/insights/insights.json")
  );
}

/** Graceful: any problem → null (section hides) with a server log line. */
export function getInsightLists(): InsightListsPayload | null {
  try {
    const p = insightListsPath();
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as unknown;
    const payload = parseInsightLists(raw);
    return payload.lists.length > 0 || payload.leap ? payload : null;
  } catch (err) {
    console.error("[insights] list section hidden:", err instanceof Error ? err.message : err);
    return null;
  }
}
