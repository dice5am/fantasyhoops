"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatAvg, formatPct } from "@/lib/format";
import { nameMatches } from "@/lib/normalize";
import type {
  SeasonId,
  SeasonPlayerAverage,
  SeasonTypeScope,
} from "@/types/season_player_averages";
import {
  SCOPE_OPTIONS,
  SEASON_OPTIONS,
} from "@/types/season_player_averages";
import styles from "./PlayerTable.module.css";
import { SeasonSelect } from "@/components/SeasonSelect";

type Props = {
  rows: SeasonPlayerAverage[];
  scope: SeasonTypeScope;
  season: string;
  /** Compact mode for Player tab (tighter name col, quieter chrome). */
  compact?: boolean;
  /** Where season/scope filters navigate. Default /player. */
  filterBasePath?: "/" | "/player";
  /** When true, selecting a row only updates ?player_id= on current path. */
  selectInPlace?: boolean;
};

export function PlayerTable({
  rows: initialRows,
  scope: initialScope,
  season: initialSeason,
  compact = false,
  filterBasePath = "/player",
  selectInPlace = false,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [scope, setScopeState] = useState(initialScope);
  const [season, setSeasonState] = useState(initialSeason);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "avg_pts", desc: true },
  ]);
  const [query, setQuery] = useState("");
  const fetchGen = useRef(0);

  const filtered = useMemo(
    () => rows.filter((r) => nameMatches(r.full_name, query)),
    [rows, query]
  );

  const columns = useMemo<ColumnDef<SeasonPlayerAverage>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: "Player",
        cell: (info) => {
          const row = info.row.original;
          const href = `/player?player_id=${encodeURIComponent(row.player_id)}&name=${encodeURIComponent(row.full_name)}`;
          return (
            <span className={styles.playerCellInner}>
              <Link
                href={href}
                className={styles.playerLink}
                onClick={(e) => e.stopPropagation()}
              >
                {info.getValue<string>()}
                {!compact ? (
                  <span className={styles.rowHint} aria-hidden>
                    → profile
                  </span>
                ) : null}
              </Link>
              {!compact ? (
                <span className={styles.openHint} aria-hidden>
                  Open profile →
                </span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: "gp",
        header: "GP",
        cell: (info) => info.getValue<number>(),
      },
      {
        accessorKey: "avg_min",
        header: "MIN",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_pts",
        header: "PTS",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_reb",
        header: "REB",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_ast",
        header: "AST",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_stl",
        header: "STL",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_blk",
        header: "BLK",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "avg_tov",
        header: "TOV",
        cell: (info) => formatAvg(info.getValue<number>()),
      },
      {
        accessorKey: "fg_pct",
        header: "FG%",
        cell: (info) => formatPct(info.getValue<number | null>()),
        sortingFn: (a, b, id) => {
          const av = a.getValue<number | null>(id);
          const bv = b.getValue<number | null>(id);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        },
      },
      {
        accessorKey: "fg3_pct",
        header: "3P%",
        cell: (info) => formatPct(info.getValue<number | null>()),
        sortingFn: (a, b, id) => {
          const av = a.getValue<number | null>(id);
          const bv = b.getValue<number | null>(id);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        },
      },
      {
        accessorKey: "ft_pct",
        header: "FT%",
        cell: (info) => formatPct(info.getValue<number | null>()),
        sortingFn: (a, b, id) => {
          const av = a.getValue<number | null>(id);
          const bv = b.getValue<number | null>(id);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        },
      },
    ],
    [compact]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const navigate = useCallback(
    async (nextSeason: string, nextScope: SeasonTypeScope) => {
      const s = nextScope === "reg_plus_playoffs" ? "reg_only" : nextScope;
      setSeasonState(nextSeason);
      setScopeState(s);

      // Preserve other query params (player_id/name/stat/seasons) when on /player
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : ""
      );
      params.set("season", nextSeason);
      params.set("scope", s);
      const url = `${filterBasePath}?${params.toString()}`;
      const y = typeof window !== "undefined" ? window.scrollY : 0;
      window.history.replaceState(window.history.state, "", url);
      // Restore scroll in case any layout shift occurs
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });

      const gen = ++fetchGen.current;
      try {
        const qs = new URLSearchParams();
        qs.set("season", nextSeason);
        qs.set("scope", s);
        const res = await fetch(`/api/players?${qs.toString()}`);
        if (!res.ok) throw new Error(`players ${res.status}`);
        const data = (await res.json()) as { rows?: SeasonPlayerAverage[] };
        if (gen !== fetchGen.current) return;
        setRows(Array.isArray(data.rows) ? data.rows : []);
      } catch {
        // Keep prior rows on failure
      }
    },
    [filterBasePath]
  );

  function setSeason(next: SeasonId) {
    void navigate(next, scope);
  }

  function setScope(next: SeasonTypeScope) {
    void navigate(season, next);
  }

  function goToPlayer(row: SeasonPlayerAverage) {
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : ""
    );
    params.set("player_id", String(row.player_id));
    if (row.full_name) params.set("name", row.full_name);
    if (selectInPlace) {
      params.set("season", season);
      const s = scope === "reg_plus_playoffs" ? "reg_only" : scope;
      params.set("scope", s);
      const href = `/player?${params.toString()}`;
      const narrow =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 800px)").matches;
      const y = window.scrollY;
      window.history.replaceState(window.history.state, "", href);
      router.replace(href, { scroll: false });
      if (narrow) {
        requestAnimationFrame(() => window.scrollTo(0, 0));
      } else {
        const restore = () => window.scrollTo(0, y);
        requestAnimationFrame(() => {
          restore();
          requestAnimationFrame(restore);
        });
      }
      return;
    }
    router.push(`/player?${params.toString()}`);
  }

  const emptyMart = rows.length === 0;
  const emptySearch = !emptyMart && filtered.length === 0;

  return (
    <div className={`${styles.wrap}${compact ? ` ${styles.compact}` : ""}`}>
      {!compact ? (
        <>
          <div className={styles.glowOrange} aria-hidden />
          <div className={styles.glowCyan} aria-hidden />
          <div className={styles.glowMagenta} aria-hidden />
        </>
      ) : null}

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {compact ? "Season averages" : "Player averages"}
          </h1>
          <p className={styles.subtitle}>
            {compact
              ? "Tap a player to open profile"
              : "Season averages · live mart"}
          </p>
        </div>
        <div className={styles.controls}>
          <SeasonSelect
            options={SEASON_OPTIONS}
            value={season}
            onChange={(s) => setSeason(s)}
            label="Season"
          />
          <div className={styles.seg} role="group" aria-label="Season type scope">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={scope === opt.value ? styles.active : undefined}
                onClick={() => setScope(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <span className={styles.srOnly}>Search players</span>
            <input
              type="search"
              placeholder="Search players (e.g. doncic)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
      </header>

      <p className={styles.meta}>
        {filtered.length} players · season <code>{season}</code> · scope{" "}
        <code>{scope}</code>
      </p>

      <div className={styles.panel}>
        {emptyMart ? (
          <div className={styles.empty} role="status">
            <p className={styles.emptyTitle}>No data for this selection</p>
            <p className={styles.emptyBody}>
              Season <code>{season}</code> with scope <code>{scope}</code> is
              not in the mart yet. Try <code>2025-26</code> +{" "}
              <code>reg_only</code>.
            </p>
          </div>
        ) : emptySearch ? (
          <div className={styles.empty} role="status">
            <p className={styles.emptyTitle}>No players match your search</p>
            <p className={styles.emptyBody}>
              Try a different spelling — unicode search folds accents (e.g.{" "}
              <code>doncic</code> → Dončić).
            </p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <th key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              className={styles.thBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                const handler =
                                  header.column.getToggleSortingHandler();
                                handler?.(e);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              <span className={styles.sortMark}>
                                {sorted === "asc"
                                  ? " ▲"
                                  : sorted === "desc"
                                    ? " ▼"
                                    : ""}
                              </span>
                            </button>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={styles.rowClickable}
                    role="link"
                    tabIndex={0}
                    onClick={() => goToPlayer(row.original)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goToPlayer(row.original);
                      }
                    }}
                    title={`Open ${row.original.full_name} profile`}
                    aria-label={`Open ${row.original.full_name} profile`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={
                          cell.column.id === "full_name"
                            ? styles.player
                            : styles.num
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
