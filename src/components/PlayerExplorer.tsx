"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAvg, formatPct } from "@/lib/format";
import type {
  SeasonId,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import {
  SCOPE_CHART_LABELS,
  SCOPE_OPTIONS,
  SEASON_OPTIONS,
} from "@/types/season_player_averages";
import styles from "./PlayerExplorer.module.css";
import {
  buildPlayerUrl,
  parseSeasonsParam as parseSeasonsParamRaw,
  parseScopeParam as parseScopeParamRaw,
  parseStatParam as parseStatParamRaw,
  type ChartStatKey,
} from "@/lib/playerUrl";
import {
  pushRecentPlayer as pushRecentPlayerLib,
  readRecentPlayers,
  type RecentPlayer,
} from "@/lib/recentPlayers";
import {
  FALLBACK_CHART_STROKE,
  displayTeamChartPrimary,
  primaryTeamRecent,
  seasonTeamStrokeColors,
} from "@/lib/teamColors";
import {
  STAT_OPTIONS,
  RADAR_NORM_NOTE,
  normalizeRadarValue,
  type RadarStatKey,
} from "@/lib/radar";

type PlayerHit = { player_id: string; full_name: string };

type GameRow = {
  game_id: string;
  player_id: string;
  full_name: string;
  season: string;
  season_type: string;
  game_date: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fg_pct: number | null;
  ft_pct: number | null;
  team_id: string;
  team_abbreviation: string;
};

type StatKey = RadarStatKey;

/** Season strokes: team chartPrimary + brightness-by-recency (see teamColors). */

const SEARCH_MIN_LEN = 2;
const SEARCH_DEBOUNCE_MS = 220;


function parseSeasonsParam(raw: string | null): SeasonId[] {
  return parseSeasonsParamRaw(raw) ?? ["2025-26"];
}

function parseScopeParam(raw: string | null): SeasonTypeScope {
  return parseScopeParamRaw(raw) ?? "reg_only";
}

function parseStatParam(raw: string | null): StatKey {
  return (parseStatParamRaw(raw) as StatKey | null) ?? "pts";
}

function seasonsEqual(a: SeasonId[], b: SeasonId[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s === b[i]);
}

function loadRecentPlayers(): RecentPlayer[] {
  return readRecentPlayers();
}

function pushRecentPlayer(player: PlayerHit): RecentPlayer[] {
  if (!player.player_id || !player.full_name || player.full_name === "…") {
    return loadRecentPlayers();
  }
  return pushRecentPlayerLib(player);
}

function gameStat(g: GameRow, key: StatKey): number | null {
  if (key === "fg_pct" || key === "ft_pct") {
    const v = g[key];
    if (v == null || Number.isNaN(v)) return null;
    return v * 100;
  }
  return g[key];
}

function avgForStat(
  row: SeasonPlayerAverage | null | undefined,
  avgFg3m: number | null | undefined,
  key: StatKey
): number | null {
  if (!row) return null;
  switch (key) {
    case "pts":
      return row.avg_pts;
    case "ast":
      return row.avg_ast;
    case "fg3m":
      // Client contract: mart avg_fg3m only.
      return avgFg3m ?? row.avg_fg3m ?? null;
    case "reb":
      return row.avg_reb;
    case "stl":
      return row.avg_stl;
    case "blk":
      return row.avg_blk;
    case "fg_pct":
      return row.fg_pct;
    case "ft_pct":
      return row.ft_pct;
    case "tov":
      return row.avg_tov;
    default:
      return null;
  }
}

type SeasonAvgBundle = {
  row: SeasonPlayerAverage | null;
  avg_fg3m: number | null;
};

function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-busy="true" aria-label={label}>
      <div className={styles.skeletonBar} />
      <div className={styles.skeletonBar} style={{ width: "78%" }} />
      <div className={styles.skeletonBar} style={{ width: "92%" }} />
      <div className={styles.skeletonChart} />
      <p className={styles.skeletonLabel}>{label}</p>
    </div>
  );
}

function PlayerExplorerInner({ hideRecent = false, averagesTable, outsideTop250 = false }: { hideRecent?: boolean; averagesTable?: ReactNode; outsideTop250?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerHit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PlayerHit | null>(null);
  const [recent, setRecent] = useState<PlayerHit[]>([]);

  const [chartSeasons, setChartSeasons] = useState<SeasonId[]>(() =>
    parseSeasonsParam(searchParams.get("seasons"))
  );
  const [chartScope, setChartScope] = useState<SeasonTypeScope>(() =>
    parseScopeParam(searchParams.get("scope"))
  );
  const [stat, setStat] = useState<StatKey>(() =>
    parseStatParam(searchParams.get("stat"))
  );

  const [games, setGames] = useState<GameRow[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [avgBySeason, setAvgBySeason] = useState<
    Partial<Record<SeasonId, SeasonAvgBundle>>
  >({});
  const [avgLoading, setAvgLoading] = useState(false);
  const [avgError, setAvgError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlWriteLock = useRef(false);

  useEffect(() => {
    setRecent(loadRecentPlayers());
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /** Hydrate chart controls from URL (validate; fallback defaults). */
  useEffect(() => {
    if (urlWriteLock.current) return;
    const nextSeasons = parseSeasonsParam(searchParams.get("seasons"));
    const nextScope = parseScopeParam(searchParams.get("scope"));
    const nextStat = parseStatParam(searchParams.get("stat"));
    setChartSeasons((prev) =>
      seasonsEqual(prev, nextSeasons) ? prev : nextSeasons
    );
    setChartScope((prev) => (prev === nextScope ? prev : nextScope));
    setStat((prev) => (prev === nextStat ? prev : nextStat));
  }, [searchParams]);

  /** Hydrate selection from URL so charts load immediately (player_id is SoT). */
  useEffect(() => {
    const playerId = searchParams.get("player_id")?.trim() ?? "";
    if (!playerId) return;
    if (selected?.player_id === playerId) return;
    const name = searchParams.get("name")?.trim() ?? "";
    setSelected({ player_id: playerId, full_name: name || "…" });
    if (name) setQuery(name);
  }, [searchParams, selected?.player_id]);

  const writePlayerUrl = useCallback(
    (opts: {
      player?: PlayerHit | null;
      seasons?: SeasonId[];
      scope?: SeasonTypeScope;
      stat?: StatKey;
    }) => {
      const player = opts.player !== undefined ? opts.player : selected;
      if (!player?.player_id) return;
      const seasons = opts.seasons ?? chartSeasons;
      const scope = opts.scope ?? chartScope;
      const nextStat = opts.stat ?? stat;
      const href = buildPlayerUrl({
        player_id: player.player_id,
        name: player.full_name,
        seasons,
        scope,
        stat: nextStat as ChartStatKey,
      });
      const curHref = buildPlayerUrl({
        player_id: searchParams.get("player_id")?.trim() ?? "",
        name: searchParams.get("name")?.trim() ?? "",
        seasons: parseSeasonsParam(searchParams.get("seasons")),
        scope: parseScopeParam(searchParams.get("scope")),
        stat: parseStatParam(searchParams.get("stat")) as ChartStatKey,
      });
      if (href === curHref) return;
      urlWriteLock.current = true;
      router.replace(href, { scroll: false });
      window.setTimeout(() => {
        urlWriteLock.current = false;
      }, 0);
    },
    [selected, chartSeasons, chartScope, stat, searchParams, router]
  );

  const rememberPlayer = useCallback((p: PlayerHit) => {
    if (!p.full_name || p.full_name === "…" || p.full_name.startsWith("Player ")) {
      return;
    }
    setRecent(pushRecentPlayer(p));
  }, []);

  /** Resolve placeholder / missing display name via averages row or directory. */
  useEffect(() => {
    if (!selected) return;
    const needsName =
      !selected.full_name ||
      selected.full_name === "…" ||
      selected.full_name.startsWith("Player ");
    if (!needsName) {
      rememberPlayer(selected);
      return;
    }

    for (const season of chartSeasons) {
      const fromAvg = avgBySeason[season]?.row?.full_name;
      if (fromAvg) {
        const next = { ...selected, full_name: fromAvg };
        setSelected((prev) =>
          prev && prev.player_id === selected.player_id
            ? { ...prev, full_name: fromAvg }
            : prev
        );
        setQuery(fromAvg);
        rememberPlayer(next);
        writePlayerUrl({ player: next });
        return;
      }
    }
    const fromGame = games[0]?.full_name;
    if (fromGame) {
      const next = { ...selected, full_name: fromGame };
      setSelected((prev) =>
        prev && prev.player_id === selected.player_id
          ? { ...prev, full_name: fromGame }
          : prev
      );
      setQuery(fromGame);
      rememberPlayer(next);
      writePlayerUrl({ player: next });
      return;
    }

    let cancelled = false;
    async function resolveName() {
      try {
        const avgUrl = `/api/player-averages?player_id=${encodeURIComponent(
          selected!.player_id
        )}&season=2025-26&scope=reg_only`;
        const avgRes = await fetch(avgUrl);
        if (avgRes.ok) {
          const data = await avgRes.json();
          const full_name = data.row?.full_name as string | undefined;
          if (full_name && !cancelled) {
            const next = { player_id: selected!.player_id, full_name };
            setSelected((prev) =>
              prev && prev.player_id === selected!.player_id
                ? { ...prev, full_name }
                : prev
            );
            setQuery(full_name);
            rememberPlayer(next);
            writePlayerUrl({ player: next });
            return;
          }
        }
      } catch {
        /* fall through */
      }
      // Directory lookup only — never empty-q player-search (would flash full list).
      try {
        const dirRes = await fetch("/api/players?directory=1");
        if (!dirRes.ok) return;
        const dirData = await dirRes.json();
        const hit = (dirData.players as PlayerHit[] | undefined)?.find(
          (p) => String(p.player_id) === String(selected!.player_id)
        );
        if (hit?.full_name && !cancelled) {
          const next = {
            player_id: selected!.player_id,
            full_name: hit.full_name,
          };
          setSelected((prev) =>
            prev && prev.player_id === selected!.player_id
              ? { ...prev, full_name: hit.full_name }
              : prev
          );
          setQuery(hit.full_name);
          rememberPlayer(next);
          writePlayerUrl({ player: next });
        }
      } catch {
        /* keep placeholder */
      }
    }
    void resolveName();
    return () => {
      cancelled = true;
    };
  }, [
    selected,
    chartSeasons,
    avgBySeason,
    games,
    rememberPlayer,
    writePlayerUrl,
  ]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < SEARCH_MIN_LEN) {
      setHits([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/player-search?q=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setHits(data.players ?? []);
    } catch {
      /* keep prior hits */
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < SEARCH_MIN_LEN) {
      // Gate empty / short queries — API returns top-40 for empty q.
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Load games when player / chart controls change
  useEffect(() => {
    if (!selected) {
      setGames([]);
      setGamesError(null);
      setGamesLoading(false);
      return;
    }
    let cancelled = false;
    setGamesLoading(true);
    setGamesError(null);
    const seasons = chartSeasons.join(",");
    const url = `/api/player-games?player_id=${encodeURIComponent(
      selected.player_id
    )}&seasons=${encodeURIComponent(seasons)}&scope=${encodeURIComponent(
      chartScope
    )}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : `Games request failed (${r.status})`
          );
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setGames(
          Array.isArray(data.rows)
            ? data.rows
            : Array.isArray(data.games)
              ? data.games
              : []
        );
        setGamesError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setGames([]);
        setGamesError(
          err instanceof Error ? err.message : "Failed to load games"
        );
      })
      .finally(() => {
        if (!cancelled) setGamesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, chartSeasons, chartScope]);

  // Load mart averages for each chartSeason @ chartScope (radar + metric cards)
  useEffect(() => {
    if (!selected) {
      setAvgBySeason({});
      setAvgError(null);
      setAvgLoading(false);
      return;
    }
    let cancelled = false;
    setAvgLoading(true);
    setAvgError(null);
    const seasons = [...chartSeasons];
    Promise.all(
      seasons.map(async (season) => {
        const url = `/api/player-averages?player_id=${encodeURIComponent(
          selected.player_id
        )}&season=${encodeURIComponent(season)}&scope=${encodeURIComponent(
          chartScope
        )}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : `Averages request failed (${res.status})`
          );
        }
        const data = await res.json();
        // 3PM: mart avg_fg3m only (no client fallbacks).
        const avg_fg3m =
          data.avg_fg3m != null
            ? Number(data.avg_fg3m)
            : data.row?.avg_fg3m != null
              ? Number(data.row.avg_fg3m)
              : null;
        return {
          season,
          bundle: {
            row: (data.row as SeasonPlayerAverage | null) ?? null,
            avg_fg3m,
          } satisfies SeasonAvgBundle,
        };
      })
    )
      .then((results) => {
        if (cancelled) return;
        const next: Partial<Record<SeasonId, SeasonAvgBundle>> = {};
        for (const r of results) next[r.season] = r.bundle;
        setAvgBySeason(next);
        setAvgError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setAvgBySeason({});
        setAvgError(
          err instanceof Error ? err.message : "Failed to load averages"
        );
      })
      .finally(() => {
        if (!cancelled) setAvgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, chartSeasons, chartScope]);

  function pickPlayer(p: PlayerHit) {
    setSelected(p);
    setQuery(p.full_name);
    setOpen(false);
    setHits([]);
    rememberPlayer(p);
    writePlayerUrl({ player: p });
  }

  function toggleSeason(s: SeasonId) {
    let next: SeasonId[] | null = null;
    setChartSeasons((prev) => {
      if (prev.includes(s)) {
        if (prev.length === 1) return prev;
        next = prev.filter((x) => x !== s);
        return next;
      }
      if (prev.length >= 3) return prev;
      next = [...prev, s].sort() as SeasonId[];
      return next;
    });
    if (next) writePlayerUrl({ seasons: next });
  }

  function onScopeChange(next: SeasonTypeScope) {
    setChartScope(next);
    writePlayerUrl({ scope: next });
  }

  function onStatChange(next: StatKey) {
    setStat(next);
    writePlayerUrl({ stat: next });
  }

  /**
   * Line chart consistency (Option B):
   * - Regular scopes: X domain always 1–82 (pad nulls).
   * - playoff_only: X domain always 1–28 (pad nulls; not real-length-only, not fake 82).
   * - DNP / not-reached / min<=0 / missing → null (never 0).
   * - Solid across adjacent played; dashed connectors across null gaps.
   */
  const REG_X_MAX = 82;
  const PLAYOFF_X_MAX = 28;

  const chartData = useMemo(() => {
    const bySeason = new Map<string, GameRow[]>();
    for (const g of games) {
      let list = bySeason.get(g.season);
      if (!list) {
        list = [];
        bySeason.set(g.season, list);
      }
      list.push(g);
    }
    const indexed = new Map<string, Map<number, GameRow>>();
    for (const season of chartSeasons) {
      const list = (bySeason.get(season) ?? [])
        .slice()
        .sort((a, b) => {
          if (a.game_date < b.game_date) return -1;
          if (a.game_date > b.game_date) return 1;
          return a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : 0;
        });
      const m = new Map<number, GameRow>();
      list.forEach((g, i) => {
        m.set(i + 1, g);
      });
      indexed.set(season, m);
    }
    // Fixed shared domains for multi-player overlay alignment.
    const xMax =
      chartScope === "playoff_only" ? PLAYOFF_X_MAX : REG_X_MAX;
    const rows: Record<string, string | number | null>[] = [];
    for (let game_num = 1; game_num <= xMax; game_num++) {
      const row: Record<string, string | number | null> = { game_num };
      for (const season of chartSeasons) {
        const g = indexed.get(season)?.get(game_num);
        if (!g || !(g.min > 0)) {
          // DNP / not-reached / missing → omit (undefined), never 0 — Recharts null→0 trap
          row[season] = undefined as unknown as null;
          row[`date_${season}`] = g ? g.game_date : null;
          row[`dnp_${season}`] = g && !(g.min > 0) ? 1 : null;
        } else {
          const v = gameStat(g, stat);
          row[season] =
            v == null || Number.isNaN(Number(v))
              ? (undefined as unknown as null)
              : v;
          row[`date_${season}`] = g.game_date;
        }
      }
      rows.push(row);
    }
    // Gap path: hold-last / hold-first / linear mid-interp — NEVER coerce to 0.
    // Value series stays null for DNP; gap series is finite for full domain.
    for (const season of chartSeasons) {
      const gapKey = `${season}__gap`;
      const played: { i: number; v: number }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const v = rows[i][season];
        if (typeof v === "number" && Number.isFinite(v)) {
          played.push({ i, v });
        }
      }
      if (played.length === 0) {
        for (let i = 0; i < rows.length; i++) {
          // No played points — leave gap undefined (not 0)
          delete rows[i][gapKey];
        }
        continue;
      }
      const first = played[0];
      const last = played[played.length - 1];
      for (let i = 0; i < rows.length; i++) {
        const v = rows[i][season];
        if (typeof v === "number" && Number.isFinite(v)) {
          rows[i][gapKey] = v;
          continue;
        }
        if (i < first.i) {
          rows[i][gapKey] = first.v; // leading hold — not 0
          continue;
        }
        if (i > last.i) {
          rows[i][gapKey] = last.v; // trailing hold — not 0
          continue;
        }
        // Mid DNP: linear interpolate between neighboring played points
        let lo = played[0];
        let hi = played[played.length - 1];
        for (let p = 0; p < played.length - 1; p++) {
          if (played[p].i <= i && played[p + 1].i >= i) {
            lo = played[p];
            hi = played[p + 1];
            break;
          }
        }
        if (hi.i === lo.i) {
          rows[i][gapKey] = lo.v;
        } else {
          const t = (i - lo.i) / (hi.i - lo.i);
          rows[i][gapKey] = lo.v + (hi.v - lo.v) * t;
        }
      }
    }
    return rows;
  }, [games, chartSeasons, chartScope, stat]);

  const xDomainMax = useMemo(() => {
    return chartScope === "playoff_only" ? PLAYOFF_X_MAX : REG_X_MAX;
  }, [chartScope]);

  const radarData = useMemo(() => {
    return STAT_OPTIONS.map((opt) => {
      const point: Record<string, string | number | null> = {
        cat: opt.label,
        catKey: opt.key,
      };
      for (const season of chartSeasons) {
        const bundle = avgBySeason[season];
        const raw = avgForStat(bundle?.row, bundle?.avg_fg3m, opt.key);
        point[season] = normalizeRadarValue(opt.key, raw);
      }
      return point;
    });
  }, [avgBySeason, chartSeasons]);

  /** Most recent season's primary team (display / recent accents). */
  const displayTeam = useMemo(() => primaryTeamRecent(games), [games]);

  const displayTeamAccent = useMemo(
    () => displayTeamChartPrimary(games) ?? FALLBACK_CHART_STROKE,
    [games]
  );

  const seasonColors = useMemo(
    () => seasonTeamStrokeColors(games, chartSeasons),
    [games, chartSeasons]
  );

  const isPct = STAT_OPTIONS.find((s) => s.key === stat)?.pct === true;
  const hasAnyAvg = chartSeasons.some((s) => avgBySeason[s]?.row);
  const showDropdown = open && query.trim().length >= SEARCH_MIN_LEN && hits.length > 0;

  function formatCardValue(key: StatKey, raw: number | null): string {
    if (raw == null) return "—";
    if (key === "fg_pct" || key === "ft_pct") return formatPct(raw);
    return formatAvg(raw);
  }

  return (
    <div
      className={styles.wrap}
      style={
        {
          ["--fh-team-accent" as string]: displayTeamAccent,
        } as CSSProperties
      }
    >
      <div className={styles.glowOrange} aria-hidden />
      <div className={styles.glowCyan} aria-hidden />
      <div className={styles.glowMagenta} aria-hidden />

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Player Explorer</h1>
          <p className={styles.subtitle}>
            Game-by-game · radar · 9-cat · Phase 3
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.searchWrap} ref={searchRef}>
            <label>
              <span className={styles.srOnly}>Search players</span>
              <input
                type="search"
                placeholder="Search players (e.g. doncic)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
              />
            </label>
            {showDropdown && (
              <div className={styles.dropdown} role="listbox">
                {hits.map((p) => (
                  <button
                    key={p.player_id}
                    type="button"
                    role="option"
                    aria-selected={selected?.player_id === p.player_id}
                    onClick={() => pickPlayer(p)}
                  >
                    {p.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {!hideRecent && recent.length > 0 && (
        <div className={styles.recentRow} aria-label="Recent players">
          <span className={styles.recentLabel}>Recent</span>
          <div className={styles.recentChips}>
            {recent.map((p) => (
              <button
                key={p.player_id}
                type="button"
                className={`${styles.recentChip}${
                  selected?.player_id === p.player_id
                    ? ` ${styles.recentChipActive}`
                    : ""
                }`}
                style={
                  selected?.player_id === p.player_id
                    ? ({
                        borderColor: displayTeamAccent,
                        boxShadow: `0 0 12px ${displayTeamAccent}55`,
                      } as CSSProperties)
                    : undefined
                }
                onClick={() => pickPlayer(p)}
              >
                {p.full_name}
                {selected?.player_id === p.player_id && displayTeam
                  ? ` · ${displayTeam}`
                  : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {averagesTable ? (
        <div className={styles.averagesSlot}>{averagesTable}</div>
      ) : null}

      {!selected ? (
        <div className={styles.panel}>
          <p className={styles.empty}>
            Search and select a player from the mart to load charts.
          </p>
        </div>
      ) : (
        <>
          {outsideTop250 ? (
            <p className={styles.outsidePoolNote} role="note">
              Outside active top-250 pool
            </p>
          ) : null}
          {/* 1) Line chart — X = game_num */}
          <section className={styles.panel} aria-label="Game chart">
            <h2 className={styles.panelTitle}>
              {selected.full_name} · game-by-game
            </h2>
            <p className={styles.meta}>
              Scope <code>{SCOPE_CHART_LABELS[chartScope]}</code> · up to 3
              seasons · skip <code>min≤0</code> · x-axis{" "}
              <code>game_num</code>
            </p>

            <div className={`${styles.controls} ${styles.chartControls}`}>
              <div className={styles.seg} role="group" aria-label="Chart seasons">
                {SEASON_OPTIONS.map((s) => {
                  const on = chartSeasons.includes(s);
                  const atCap = !on && chartSeasons.length >= 3;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={on ? styles.active : undefined}
                      disabled={atCap}
                      onClick={() => toggleSeason(s)}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div
                className={styles.seg}
                role="group"
                aria-label="Chart: raw curated per-game · scope"
              >
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={
                      chartScope === opt.value ? styles.active : undefined
                    }
                    onClick={() => onScopeChange(opt.value)}
                  >
                    {SCOPE_CHART_LABELS[opt.value]}
                  </button>
                ))}
              </div>
              <div className={styles.seg} role="group" aria-label="Stat">
                {STAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={stat === opt.key ? styles.active : undefined}
                    onClick={() => onStatChange(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {gamesLoading ? (
              <ChartSkeleton label="Loading games…" />
            ) : gamesError ? (
              <div className={styles.stateError} role="alert">
                <p className={styles.stateTitle}>Couldn’t load games</p>
                <p className={styles.stateBody}>{gamesError}</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className={styles.stateEmpty} role="status">
                <p className={styles.stateTitle}>No games for this scope</p>
                <p className={styles.stateBody}>
                  No games for {selected.full_name} with seasons{" "}
                  <code>{chartSeasons.join(", ")}</code> and scope{" "}
                  <code>{chartScope}</code>. Try another season or scope.
                </p>
              </div>
            ) : (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 4, bottom: 12 }}
                  >
                    <CartesianGrid
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="game_num"
                      type="number"
                      domain={[1, xDomainMax]}
                      allowDecimals={false}
                      stroke="#cbd5e1"
                      tick={{ fill: "#cbd5e1", fontSize: 10 }}
                      minTickGap={20}
                      label={{
                        value: "Game #",
                        position: "insideBottomRight",
                        offset: -2,
                        fill: "#94a3b8",
                        fontSize: 11,
                      }}
                    />
                    <YAxis
                      width={36}
                      stroke="#cbd5e1"
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                      domain={isPct ? [0, 100] : ["dataMin", "dataMax"]}
                      allowDataOverflow={false}
                      tickFormatter={(v) =>
                        isPct ? `${Number(v).toFixed(0)}` : String(v)
                      }
                    />
                    <Tooltip
                      wrapperStyle={{ maxWidth: 280, zIndex: 20 }}
                      contentStyle={{
                        background: "rgba(12,14,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number | string, name: string) => {
                        if (value == null || value === "") return ["—", name];
                        const n = Number(value);
                        const series =
                          isPct
                            ? `${name} (single-game rate)`
                            : name;
                        if (isPct) return [`${n.toFixed(1)}%`, series];
                        return [
                          Number.isInteger(n) ? n : n.toFixed(1),
                          series,
                        ];
                      }}
                      labelFormatter={(label, payload) => {
                        const dates = (payload ?? [])
                          .map((p) => {
                            const rawKey = String(p.dataKey ?? p.name ?? "");
                            const season = rawKey.replace(/__gap$/, "");
                            const row = p.payload as Record<
                              string,
                              string | number | null
                            >;
                            const d = row[`date_${season}`];
                            return d ? `${season}: ${d}` : null;
                          })
                          .filter(Boolean);
                        const extra =
                          dates.length > 0 ? ` · ${dates.join(" · ")}` : "";
                        return `Game #${label}${extra}`;
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 12, maxWidth: "100%" }}
                    />
                    {chartSeasons.flatMap((s) => {
                      const stroke = seasonColors[s] || FALLBACK_CHART_STROKE;
                      return [
                        <Line
                          key={`${s}-gap`}
                          type="monotone"
                          dataKey={`${s}__gap`}
                          name={`${s} gaps`}
                          stroke={stroke}
                          strokeWidth={chartScope === "playoff_only" ? 1.5 : 2}
                          strokeOpacity={0.85}
                          strokeDasharray={
                            chartScope === "playoff_only" ? "5 4" : "2 6"
                          }
                          dot={false}
                          activeDot={false}
                          legendType="none"
                          connectNulls
                          isAnimationActive={false}
                        />,
                        <Line
                          key={s}
                          type="monotone"
                          dataKey={s}
                          name={s}
                          stroke={stroke}
                          strokeWidth={2.25}
                          dot={{ r: 2, strokeWidth: 0, fill: stroke }}
                          connectNulls={false}
                          isAnimationActive={false}
                          // null ≠ 0: Recharts must not draw missing games at baseline
                        />,
                      ];
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
              {gamesLoading
                ? "Loading…"
                : `${games.length} games loaded`}{" "}
              · x-axis <code>game_num</code>
              {chartScope === "playoff_only"
                ? " (playoffs: fixed 1–28; DNP/not-reached = null; dashed gaps)"
                : " (regular: fixed 1–82; solid played; dotted gaps; null≠0; newest season brightest)"}{" "}
              · counting stats are per-game; FG%/FT% are single-game rates
            </p>
          </section>

          {/* 2) Radar — Recharts RadarChart, ≤3 season polygons */}
          <section className={styles.panel} aria-label="9-cat radar">
            <h2 className={styles.panelTitle}>9-cat radar</h2>
            <p className={styles.meta}>
              Mart averages · <code>{SCOPE_CHART_LABELS[chartScope]}</code> ·
              seasons match line chart · 3PM = <code>avg_fg3m</code>
            </p>
            {avgLoading ? (
              <ChartSkeleton label="Loading averages…" />
            ) : avgError ? (
              <div className={styles.stateError} role="alert">
                <p className={styles.stateTitle}>Couldn’t load averages</p>
                <p className={styles.stateBody}>{avgError}</p>
              </div>
            ) : !hasAnyAvg ? (
              <div className={styles.stateEmpty} role="status">
                <p className={styles.stateTitle}>No mart rows for this scope</p>
                <p className={styles.stateBody}>
                  No averages for selected seasons /{" "}
                  <code>{chartScope}</code>. Try another season or scope.
                </p>
              </div>
            ) : (
              <div className={styles.radarBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
                    <PolarGrid stroke="rgba(255,255,255,0.12)" />
                    <PolarAngleAxis
                      dataKey="cat"
                      tick={(props) => {
                        const { x, y, payload, textAnchor } = props;
                        const label = String(payload?.value ?? "");
                        const opt = STAT_OPTIONS.find((o) => o.label === label);
                        const highlighted = opt?.key === stat;
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor={textAnchor}
                            fill={highlighted ? displayTeamAccent : "#cbd5e1"}
                            fontSize={highlighted ? 13 : 11}
                            fontWeight={highlighted ? 700 : 500}
                            style={{
                              cursor: "pointer",
                              textShadow: highlighted
                                ? `0 0 10px ${displayTeamAccent}`
                                : undefined,
                            }}
                            onClick={() => opt && onStatChange(opt.key)}
                          >
                            {label}
                          </text>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    {chartSeasons.map((s) => (
                      <Radar
                        key={s}
                        name={s}
                        dataKey={s}
                        stroke={seasonColors[s] || FALLBACK_CHART_STROKE}
                        fill={seasonColors[s] || FALLBACK_CHART_STROKE}
                        fillOpacity={0.22}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                    <Legend
                      wrapperStyle={{ fontSize: 12, maxWidth: "100%" }}
                    />
                    <Tooltip
                      wrapperStyle={{ maxWidth: 280, zIndex: 20 }}
                      contentStyle={{
                        background: "rgba(12,14,22,0.95)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 10,
                        color: "#f1f5f9",
                      }}
                      formatter={(value: number | string, name: string) => {
                        if (value == null || value === "") return ["—", name];
                        return [`${Number(value).toFixed(0)} / 100`, name];
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className={styles.normNote}>{RADAR_NORM_NOTE}</p>
          </section>

          {/* 3) Metric cards — toggles update cards + highlight radar spoke */}
          <section className={styles.panel} aria-label="9-cat metric cards">
            <h2 className={styles.panelTitle}>9-cat metrics</h2>
            <p className={styles.meta}>
              Select a card to highlight that radar spoke and set the line-chart
              stat · values from <code>/api/player-averages</code> (
              <code>avg_fg3m</code> for 3PM)
            </p>
            {avgLoading ? (
              <ChartSkeleton label="Loading averages…" />
            ) : avgError ? (
              <div className={styles.stateError} role="alert">
                <p className={styles.stateTitle}>Couldn’t load averages</p>
                <p className={styles.stateBody}>{avgError}</p>
              </div>
            ) : !hasAnyAvg ? (
              <div className={styles.stateEmpty} role="status">
                <p className={styles.stateTitle}>No mart averages to show</p>
                <p className={styles.stateBody}>
                  No averages for the selected seasons and scope.
                </p>
              </div>
            ) : (
              <div className={styles.metricGrid}>
                {STAT_OPTIONS.map((opt) => {
                  const active = stat === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className={`${styles.metricCard}${
                        active ? ` ${styles.metricCardActive}` : ""
                      }`}
                      style={
                        active
                          ? ({
                              borderColor: displayTeamAccent,
                              boxShadow: `0 0 0 1px ${displayTeamAccent}55, 0 0 18px ${displayTeamAccent}40`,
                            } as CSSProperties)
                          : undefined
                      }
                      onClick={() => onStatChange(opt.key)}
                      aria-pressed={active}
                    >
                      <span className={styles.metricLabel}>{opt.label}</span>
                      <div className={styles.metricValues}>
                        {chartSeasons.map((s) => {
                          const bundle = avgBySeason[s];
                          const raw = avgForStat(
                            bundle?.row,
                            bundle?.avg_fg3m,
                            opt.key
                          );
                          return (
                            <div key={s} className={styles.metricSeasonRow}>
                              <span
                                className={styles.metricDot}
                                style={{
                                  background: seasonColors[s] || FALLBACK_CHART_STROKE,
                                }}
                                aria-hidden
                              />
                              <span className={styles.metricSeason}>{s}</span>
                              <span className={styles.metricVal}>
                                {formatCardValue(opt.key, raw)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function PlayerExplorer({
  hideRecent = false,
  averagesTable,
  outsideTop250 = false,
}: {
  hideRecent?: boolean;
  averagesTable?: ReactNode;
  outsideTop250?: boolean;
} = {}) {
  return (
    <Suspense
      fallback={
        <div className={styles.wrap}>
          <div className={styles.panel}>
            <ChartSkeleton label="Loading player explorer…" />
          </div>
        </div>
      }
    >
      <PlayerExplorerInner
        hideRecent={hideRecent}
        averagesTable={averagesTable}
        outsideTop250={outsideTop250}
      />
    </Suspense>
  );
}
