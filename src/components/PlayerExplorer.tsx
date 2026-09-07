"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAvg, formatPct } from "@/lib/format";
import { formatShortName } from "@/lib/formatName";
import type {
  SeasonId,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import type { LeagueAvgs } from "@/types/league_context";
import {
  SCOPE_CHART_LABELS,
  SCOPE_OPTIONS,
  SEASON_OPTIONS,
} from "@/types/season_player_averages";
import { SeasonSelect } from "@/components/SeasonSelect";
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
  displayTeamPrimary,
  primaryTeamRecent,
  seasonTeamStrokeColors,
  seasonTeamStrokeOpacities,
} from "@/lib/teamColors";
import { TeamMarkPip, teamMarkGlow } from "@/components/TeamMarkPip";
import {
  capChartYValue,
  chartYTicks,
  resolveChartYDomain,
} from "@/lib/chartYAxis";
import {
  STAT_OPTIONS,
  RADAR_NORM_NOTE,
  normalizeRadarValue,
  type RadarStatKey,
} from "@/lib/radar";

type PlayerHit = { player_id: string; full_name: string };

/** Chart game row — dense (preferred) or curated fallback. */
type GameRow = {
  game_id: string | null;
  player_id: string;
  full_name?: string;
  season: string;
  season_type?: string;
  season_type_scope?: string;
  game_date: string | null;
  /** Dense axis index; absent on curated played-sequence fallback. */
  game_index?: number | null;
  is_played?: boolean;
  min: number | null;
  pts: number | null;
  reb: number | null;
  ast: number | null;
  stl: number | null;
  blk: number | null;
  tov: number | null;
  fg3m: number | null;
  fg_pct: number | null;
  ft_pct: number | null;
  team_id: string | null;
  team_abbreviation?: string | null;
};

type GamesSource = "dense" | "curated";

function isPlayedGame(g: GameRow): boolean {
  if (typeof g.is_played === "boolean") return g.is_played;
  return g.min != null && g.min > 0;
}

type StatKey = RadarStatKey;

/** Season strokes: exact chartPrimary hex + opacity-only recency (wash banned). */

const SEARCH_MIN_LEN = 2;
const SEARCH_DEBOUNCE_MS = 220;

/** Champagne overflow mark (design pack v3 ladder). */
const OVERFLOW_CHAMPAGNE = "#F7E7CE";
const OVERFLOW_GLOW =
  "0 0 10px rgba(247, 231, 206, 0.95), 0 0 18px rgba(247, 231, 206, 0.55)";


/** Format true overflow value for pill / tooltip (display units). */
function formatOverflowLabel(raw: number, isPct: boolean): string {
  if (isPct) return `${raw.toFixed(0)}%`;
  return Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
}

/**
 * Custom Bar shape: team chartPrimary fill capped at Y max.
 * Overflow: champagne glow bloom + pop edge + ▲ chevron + true-value dark pill.
 * Never extends axis; DNP stays null (no shape).
 */
function OverflowBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  fillOpacity?: number;
  payload?: Record<string, string | number | null>;
  dataKey?: string;
  isPct?: boolean;
}) {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    fill = FALLBACK_CHART_STROKE,
    fillOpacity = 1,
    payload,
    dataKey,
    isPct = false,
  } = props;
  if (width <= 0 || height <= 0 || payload == null || !dataKey) return null;
  const season = String(dataKey);
  const raw = payload[`raw_${season}`];
  const overflow = payload[`overflow_${season}`] === 1;
  const visual = payload[season];
  if (visual == null || typeof visual !== "number") return null;

  const cx = x + width / 2;
  const pillY = y - 18;
  const glowFilterId = `ovf-glow-${season}-${payload.game_num ?? "x"}`;

  return (
    <g className={styles.overflowBar} aria-hidden={!overflow}>
      {overflow ? (
        <defs>
          <filter
            id={glowFilterId}
            x="-80%"
            y="-80%"
            width="260%"
            height="260%"
          >
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      ) : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={fillOpacity}
        rx={1}
        ry={1}
        style={
          overflow
            ? {
                filter: `url(#${glowFilterId})`,
                transition: "filter 180ms ease, opacity 180ms ease",
              }
            : { transition: "opacity 180ms ease" }
        }
      />
      {overflow ? (
        <>
          {/* 1–2px champagne pop edge at cap */}
          <rect
            x={x}
            y={y}
            width={width}
            height={Math.min(2, height)}
            fill="#FFFCF5"
            fillOpacity={0.92}
            style={{ transition: "opacity 180ms ease" }}
          />
          {/* soft champagne bloom under label */}
          <ellipse
            cx={cx}
            cy={y}
            rx={Math.max(width * 1.4, 8)}
            ry={5}
            fill="rgba(247, 231, 206, 0.55)"
            style={{ transition: "opacity 180ms ease" }}
          />
          {/* ▲ chevron + true value on dark pill */}
          <g
            transform={`translate(${cx}, ${pillY})`}
            style={{ transition: "opacity 180ms ease, transform 180ms ease" }}
          >
            <text
              textAnchor="middle"
              y={-10}
              fill={OVERFLOW_CHAMPAGNE}
              fontSize={8}
              fontWeight={700}
              style={{ textShadow: OVERFLOW_GLOW }}
            >
              ▲
            </text>
            <rect
              x={-14}
              y={-6}
              width={28}
              height={13}
              rx={4}
              ry={4}
              fill="rgba(12, 14, 22, 0.92)"
              stroke="rgba(247, 231, 206, 0.55)"
              strokeWidth={0.75}
            />
            <text
              textAnchor="middle"
              y={4}
              fill="#FFFCF5"
              fontSize={9}
              fontWeight={700}
              fontFamily="ui-monospace, monospace"
            >
              {typeof raw === "number"
                ? formatOverflowLabel(raw, isPct)
                : ""}
            </text>
          </g>
        </>
      ) : null}
    </g>
  );
}



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
  const v = g[key];
  if (v == null || Number.isNaN(Number(v))) return null;
  return Number(v);
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
  const [gamesSource, setGamesSource] = useState<GamesSource | null>(null);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [avgBySeason, setAvgBySeason] = useState<
    Partial<Record<SeasonId, SeasonAvgBundle>>
  >({});
  const [avgLoading, setAvgLoading] = useState(false);
  const [avgError, setAvgError] = useState<string | null>(null);
  const [leagueAvgs, setLeagueAvgs] = useState<LeagueAvgs | null>(null);

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
    if (!playerId) {
      setSelected((prev) => (prev ? null : prev));
      return;
    }
    if (selected?.player_id === playerId) return;
    const name = searchParams.get("name")?.trim() ?? "";
    setSelected({ player_id: playerId, full_name: name || "…" });
    if (name) setQuery(name);
  }, [searchParams, selected?.player_id]);

  const urlPlayerId = searchParams.get("player_id")?.trim() ?? "";
  const hasUrlPlayer = Boolean(urlPlayerId);

  /** Mobile drill-in: land at top of detail pane when player_id appears. */
  useEffect(() => {
    if (!urlPlayerId) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 800px)").matches) return;
    window.scrollTo(0, 0);
  }, [urlPlayerId]);

  const clearPlayerSelection = useCallback(() => {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : searchParams.toString()
    );
    params.delete("player_id");
    params.delete("name");
    const q = params.toString();
    const href = q ? `/player?${q}` : "/player";
    urlWriteLock.current = true;
    window.history.replaceState(window.history.state, "", href);
    router.replace(href, { scroll: false });
    setSelected(null);
    const settle = () => window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      settle();
      requestAnimationFrame(settle);
    });
    window.setTimeout(() => {
      urlWriteLock.current = false;
      settle();
    }, 0);
  }, [router, searchParams]);

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
      const y = typeof window !== "undefined" ? window.scrollY : 0;
      window.history.replaceState(window.history.state, "", href);
      router.replace(href, { scroll: false });
      const restore = () => window.scrollTo(0, y);
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });
      window.setTimeout(() => {
        urlWriteLock.current = false;
        restore();
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

  // Prefer dense game_index series; curated only if dense parquet missing (503).
  useEffect(() => {
    if (!selected) {
      setGames([]);
      setGamesSource(null);
      setGamesError(null);
      setGamesLoading(false);
      return;
    }
    let cancelled = false;
    setGamesLoading(true);
    setGamesError(null);
    const seasons = chartSeasons.join(",");
    const q = `player_id=${encodeURIComponent(
      selected.player_id
    )}&seasons=${encodeURIComponent(seasons)}&scope=${encodeURIComponent(
      chartScope
    )}`;
    const denseUrl = `/api/player-dense-games?${q}`;
    const curatedUrl = `/api/player-games?${q}`;

    (async () => {
      try {
        const denseRes = await fetch(denseUrl);
        if (denseRes.ok) {
          const data = await denseRes.json();
          if (cancelled) return;
          setGames(Array.isArray(data.rows) ? data.rows : []);
          setGamesSource("dense");
          setGamesError(null);
          return;
        }
        if (denseRes.status !== 503) {
          const body = await denseRes.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : `Dense games request failed (${denseRes.status})`
          );
        }
        // Dense not published — temporary curated fallback (played-sequence).
        const curatedRes = await fetch(curatedUrl);
        if (!curatedRes.ok) {
          const body = await curatedRes.json().catch(() => ({}));
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : `Games request failed (${curatedRes.status})`
          );
        }
        const data = await curatedRes.json();
        if (cancelled) return;
        setGames(
          Array.isArray(data.rows)
            ? data.rows
            : Array.isArray(data.games)
              ? data.games
              : []
        );
        setGamesSource("curated");
        setGamesError(null);
      } catch (err) {
        if (cancelled) return;
        setGames([]);
        setGamesSource(null);
        setGamesError(
          err instanceof Error ? err.message : "Failed to load games"
        );
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    })();

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

  // League/pool 9-cat averages for radar underlay (API only — never client-invented).
  useEffect(() => {
    const season = chartSeasons[0];
    if (!season) {
      setLeagueAvgs(null);
      return;
    }
    let cancelled = false;
    const qs = new URLSearchParams();
    qs.set("season", season);
    qs.set("scope", chartScope);
    qs.set("topPct", "100");
    (async () => {
      try {
        const res = await fetch(`/api/league-context?${qs.toString()}`);
        if (!res.ok) throw new Error(`league-context ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setLeagueAvgs((data.league_avgs as LeagueAvgs) ?? null);
      } catch {
        if (!cancelled) setLeagueAvgs(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chartSeasons, chartScope]);

  function pickPlayer(p: PlayerHit) {
    setSelected(p);
    setQuery(p.full_name);
    setOpen(false);
    setHits([]);
    rememberPlayer(p);
    writePlayerUrl({ player: p });
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
   * Dense preferred: X = game_index (1–82 reg / 1–28 PO), Bar columns on played,
   * DNP/not-reached = null empty slot (no gap connectors). null≠0.
   * Curated fallback only if dense missing — played-sequence i+1 (no fake densify claim).
   */
  const REG_X_MAX = 82;
  const PLAYOFF_X_MAX = 28;

  const chartData = useMemo(() => {
    const useDense = gamesSource === "dense";
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
      const list = (bySeason.get(season) ?? []).slice();
      const m = new Map<number, GameRow>();
      if (useDense) {
        list.sort((a, b) => (a.game_index ?? 0) - (b.game_index ?? 0));
        for (const g of list) {
          if (g.game_index != null && Number.isFinite(g.game_index)) {
            m.set(Number(g.game_index), g);
          }
        }
      } else {
        list.sort((a, b) => {
          const da = a.game_date ?? "";
          const db = b.game_date ?? "";
          if (da < db) return -1;
          if (da > db) return 1;
          const ia = a.game_id ?? "";
          const ib = b.game_id ?? "";
          return ia < ib ? -1 : ia > ib ? 1 : 0;
        });
        // Temporary curated fallback only — not densify.
        list.forEach((g, i) => {
          m.set(i + 1, g);
        });
      }
      indexed.set(season, m);
    }
    const xMax =
      chartScope === "playoff_only" ? PLAYOFF_X_MAX : REG_X_MAX;
    const rows: Record<string, string | number | null>[] = [];
    for (let game_num = 1; game_num <= xMax; game_num++) {
      const row: Record<string, string | number | null> = { game_num };
      for (const season of chartSeasons) {
        const g = indexed.get(season)?.get(game_num);
        if (!g || !isPlayedGame(g)) {
          // DNP / not-reached / missing → null empty slot (never 0)
          row[season] = null;
          row[`raw_${season}`] = null;
          row[`overflow_${season}`] = null;
          row[`date_${season}`] = g?.game_date ?? null;
          row[`dnp_${season}`] = g && !isPlayedGame(g) ? 1 : null;
        } else {
          const v = gameStat(g, stat);
          const capped = capChartYValue(stat, v);
          // Visual bar height capped at fixed Y ceiling; raw kept for tooltip/label.
          row[season] = capped.visual;
          row[`raw_${season}`] = capped.raw;
          row[`overflow_${season}`] = capped.overflow ? 1 : null;
          row[`date_${season}`] = g.game_date;
        }
      }
      rows.push(row);
    }
    // Histogram columns: played games have values; DNP / not-reached = null empty slot.
    // No gap connectors / dotted hold paths (CoS histogram BUILD GO).
    // Overflow: visual capped at ceiling; axis never extends for a spike.
    return rows;
  }, [games, gamesSource, chartSeasons, chartScope, stat]);

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
      const poolRaw = leagueAvgs ? leagueAvgs[opt.key] : null;
      point.pool = normalizeRadarValue(opt.key, poolRaw);
      return point;
    });
  }, [avgBySeason, chartSeasons, leagueAvgs]);

  /** Most recent season's primary team (display / recent accents). */
  const displayTeam = useMemo(() => primaryTeamRecent(games), [games]);

  /** Charts / pips / glow — locked chartPrimary (exact hex). */
  const displayTeamAccent = useMemo(
    () => displayTeamChartPrimary(games) ?? FALLBACK_CHART_STROKE,
    [games]
  );
  /** Chips / denser fills — brand primary (identity). */
  const displayTeamBrand = useMemo(
    () => displayTeamPrimary(games) ?? displayTeamAccent,
    [games, displayTeamAccent]
  );

  const seasonColors = useMemo(
    () => seasonTeamStrokeColors(games, chartSeasons),
    [games, chartSeasons]
  );
  const seasonOpacities = useMemo(
    () => seasonTeamStrokeOpacities(chartSeasons),
    [chartSeasons]
  );

  const yDomain = useMemo(() => resolveChartYDomain(stat), [stat]);

  const yTicks = useMemo(
    () => chartYTicks(stat, yDomain[1]),
    [stat, yDomain]
  );

  const isPct = STAT_OPTIONS.find((s) => s.key === stat)?.pct === true;

  /** Season average for selected stat — mart/API only (display units for chart). */
  const seasonAvgY = useMemo(() => {
    const season = chartSeasons[0];
    if (!season) return null;
    const bundle = avgBySeason[season];
    const raw = avgForStat(bundle?.row, bundle?.avg_fg3m, stat);
    if (raw == null || !Number.isFinite(Number(raw))) return null;
    return isPct ? Number(raw) * 100 : Number(raw);
  }, [avgBySeason, chartSeasons, stat, isPct]);
  const hasAnyAvg = chartSeasons.some((s) => avgBySeason[s]?.row);
  const showDropdown = open && query.trim().length >= SEARCH_MIN_LEN && hits.length > 0;

  function formatCardValue(key: StatKey, raw: number | null): string {
    if (raw == null) return "—";
    if (key === "fg_pct" || key === "ft_pct") return formatPct(raw);
    return formatAvg(raw);
  }

  return (
    <div
      className={`${styles.wrap} ${hasUrlPlayer ? styles.withPlayer : styles.noPlayer}`}
      style={
        {
          ["--fh-team-accent" as string]: displayTeamAccent,
        } as CSSProperties
      }
    >

      <button
        type="button"
        className={styles.backLink}
        onClick={clearPlayerSelection}
        aria-label="Back to players list"
      >
        ← Players
      </button>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {hasUrlPlayer && selected?.full_name && selected.full_name !== "…" ? (
              <span className={styles.titleWithPip}>
                <TeamMarkPip
                  color={displayTeam ? displayTeamAccent : null}
                  size={8}
                  title={displayTeam ?? undefined}
                />
                <span
                  style={
                    displayTeam
                      ? ({
                          textShadow: `0 0 18px color-mix(in srgb, ${displayTeamAccent} 40%, transparent)`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  {selected.full_name}
                </span>
              </span>
            ) : (
              "Player Explorer"
            )}
          </h1>
          <p className={styles.subtitle}>
            {hasUrlPlayer
              ? "Game-by-game · radar · 9-cat"
              : "Search · recent · season averages"}
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
                    {formatShortName(p.full_name)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={styles.listChrome}>
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
                          borderColor: displayTeamBrand,
                          boxShadow: teamMarkGlow(displayTeamAccent, 12),
                        } as CSSProperties)
                      : undefined
                  }
                  onClick={() => pickPlayer(p)}
                >
                  {selected?.player_id === p.player_id ? (
                    <TeamMarkPip color={displayTeamAccent} size={6} />
                  ) : null}
                  {formatShortName(p.full_name)}
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
      </div>

      <div className={styles.detailChrome}>
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
          {/* 1) Game histogram (Bar columns) — X = game_index / game_num; DNP = empty */}
          <section className={`${styles.panel} ${styles.panelHero}`} aria-label="Game chart">
            <h2 className={styles.panelTitle}>
              {selected.full_name} · game-by-game
            </h2>
            <p className={styles.meta}>
              Scope <code>{SCOPE_CHART_LABELS[chartScope]}</code> · season{" "}
              <code>{chartSeasons[0]}</code> · null≠0 · x-axis{" "}
              <code>
                {gamesSource === "dense" ? "game_index" : "game_num"}
              </code>
              {gamesSource === "dense"
                ? " (dense)"
                : gamesSource === "curated"
                  ? " (curated fallback)"
                  : ""}
            </p>

            <div className={`${styles.controls} ${styles.chartControls}`}>
              <SeasonSelect
                options={SEASON_OPTIONS}
                value={chartSeasons[0] ?? "2025-26"}
                onChange={(next) => {
                  const seasons = [next] as SeasonId[];
                  setChartSeasons(seasons);
                  writePlayerUrl({ seasons });
                }}
                label="Chart season"
              />
              <div
                className={styles.seg}
                role="group"
                aria-label="Chart scope"
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
              <div
                className={`${styles.seg} ${styles.statSeg}`}
                role="group"
                aria-label="Stat"
              >
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
                  No games for {selected.full_name} in season{" "}
                  <code>{chartSeasons[0]}</code> and scope{" "}
                  <code>{chartScope}</code>. Try another season or scope.
                </p>
              </div>
            ) : (
              <div className={styles.chartBox}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 40, right: 8, left: 4, bottom: 12 }}
                    barCategoryGap="12%"
                    barGap={1}
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
                      domain={yDomain}
                      ticks={yTicks}
                      allowDataOverflow
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
                      formatter={(
                        value: number | string,
                        name: string,
                        item
                      ) => {
                        const season = String(
                          (item as { dataKey?: string })?.dataKey ?? name
                        );
                        const row = (item as { payload?: Record<string, string | number | null> })
                          ?.payload;
                        const raw = row?.[`raw_${season}`];
                        const overflow = row?.[`overflow_${season}`] === 1;
                        const n =
                          typeof raw === "number" ? raw : Number(value);
                        if (value == null || value === "" || !Number.isFinite(n)) {
                          return ["—", name];
                        }
                        const series = isPct
                          ? `${name} (single-game rate)`
                          : name;
                        const shown = isPct
                          ? `${n.toFixed(1)}%`
                          : Number.isInteger(n)
                            ? String(n)
                            : n.toFixed(1);
                        return [
                          overflow ? `${shown} (overflow)` : shown,
                          series,
                        ];
                      }}
                      labelFormatter={(label, payload) => {
                        const dates = (payload ?? [])
                          .map((p) => {
                            const season = String(p.dataKey ?? p.name ?? "");
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
                    {seasonAvgY != null ? (
                      <ReferenceLine
                        y={seasonAvgY}
                        stroke={OVERFLOW_CHAMPAGNE}
                        strokeDasharray="4 4"
                        strokeOpacity={0.85}
                        strokeWidth={1.25}
                        ifOverflow="discard"
                        label={{
                          value: "avg",
                          position: "insideTopRight",
                          fill: OVERFLOW_CHAMPAGNE,
                          fontSize: 10,
                        }}
                      />
                    ) : null}
                    {chartSeasons.map((s) => {
                      const fill = seasonColors[s] || FALLBACK_CHART_STROKE;
                      const opacity = seasonOpacities[s] ?? 1;
                      return (
                        <Bar
                          key={s}
                          dataKey={s}
                          name={s}
                          fill={fill}
                          fillOpacity={opacity}
                          maxBarSize={10}
                          isAnimationActive={false}
                          // null DNP → empty column slot (no connector)
                          shape={(barProps: {
                            x?: number;
                            y?: number;
                            width?: number;
                            height?: number;
                            payload?: Record<string, string | number | null>;
                          }) => (
                            <OverflowBarShape
                              x={barProps.x}
                              y={barProps.y}
                              width={barProps.width}
                              height={barProps.height}
                              payload={barProps.payload}
                              fill={fill}
                              fillOpacity={opacity}
                              dataKey={s}
                              isPct={isPct}
                            />
                          )}
                        >
                          {chartData.map((entry, i) => (
                            <Cell
                              key={`c-${s}-${i}`}
                              // aria: expose true value when overflow
                              aria-label={
                                entry[`overflow_${s}`] === 1 &&
                                typeof entry[`raw_${s}`] === "number"
                                  ? `Game ${entry.game_num}: ${formatOverflowLabel(
                                      Number(entry[`raw_${s}`]),
                                      isPct
                                    )} (overflow)`
                                  : undefined
                              }
                            />
                          ))}
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className={styles.meta} style={{ marginTop: "0.75rem" }}>
              {gamesLoading
                ? "Loading…"
                : gamesSource === "dense"
                  ? `${games.filter((g) => isPlayedGame(g)).length} played / ${games.length} dense slots`
                  : `${games.length} games loaded`}{" "}
              · x-axis{" "}
              <code>
                {gamesSource === "dense" ? "game_index" : "game_num"}
              </code>
              {chartScope === "playoff_only"
                ? " (playoffs: fixed 1–28; DNP/not-reached = empty column)"
                : " (regular: fixed 1–82; columns for played; DNP = empty; null≠0)"}{" "}
              · overflow caps at Y max (▲ + true value) · counting per-game; FG%/FT% single-game rates
            </p>
          </section>

          {/* 2) Radar — player polygon over league/pool average underlay */}
          <section className={styles.panel} aria-label="9-cat radar">
            <h2 className={styles.panelTitle}>9-cat radar</h2>
            <p className={styles.meta}>
              Mart averages · <code>{SCOPE_CHART_LABELS[chartScope]}</code> ·
              season <code>{chartSeasons[0]}</code> · pool underlay · 3PM ={" "}
              <code>avg_fg3m</code>
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
                  No averages for season <code>{chartSeasons[0]}</code> /{" "}
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
                    {leagueAvgs ? (
                      <Radar
                        name="Pool avg"
                        dataKey="pool"
                        stroke="rgba(247, 231, 206, 0.55)"
                        fill="rgba(247, 231, 206, 0.22)"
                        fillOpacity={0.45}
                        strokeOpacity={0.55}
                        strokeWidth={1.25}
                        isAnimationActive={false}
                      />
                    ) : null}
                    {chartSeasons.map((s) => {
                      const stroke = seasonColors[s] || FALLBACK_CHART_STROKE;
                      const opacity = seasonOpacities[s] ?? 1;
                      return (
                        <Radar
                          key={s}
                          name={s}
                          dataKey={s}
                          stroke={stroke}
                          fill={stroke}
                          fillOpacity={0.12 + 0.12 * opacity}
                          strokeOpacity={opacity}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      );
                    })}
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
                  No averages for the selected season and scope.
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
                              borderColor: displayTeamBrand,
                              boxShadow: `0 0 0 1px color-mix(in srgb, ${displayTeamBrand} 35%, transparent), ${teamMarkGlow(displayTeamAccent, 18)}`,
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
