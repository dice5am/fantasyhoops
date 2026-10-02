"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { TeamMarkPip } from "@/components/TeamMarkPip";
import { SeasonSelect } from "@/components/SeasonSelect";
import { formatAvg } from "@/lib/format";
import { formatShortName } from "@/lib/formatName";
import {
  readTeamRoster,
  writeTeamRoster,
  rosterHasPlayer,
  type RosterPlayer,
} from "@/lib/teamRoster";
import {
  TEAM_DEFAULT_SEASON,
  TEAM_PRIOR_SEASON,
  TEAM_DEFAULT_SCOPE,
  seasonShortLabel,
  deltaValue,
  formatDelta,
  formatDeltaVsPy,
  deltaPolarity,
} from "@/lib/teamCompare";
import {
  SEASON_OPTIONS,
  type SeasonId,
} from "@/types/season_player_averages";
import { getTeamColors } from "@/lib/teamColors";
import {
  TeamSubnav,
  type TeamView,
} from "@/components/ux/TeamSubnav";
import { WeekChip } from "@/components/ux/WeekChip";
import { DoubleWeekBanner } from "@/components/ux/DoubleWeekBanner";
import { ScheduleStrip } from "@/components/ux/ScheduleStrip";
import { DensityCard } from "@/components/ux/DensityCard";
import { FilterMenu, type HaFilter } from "@/components/ux/FilterMenu";
import { AutosaveToast } from "@/components/ux/AutosaveToast";
import {
  EmptyShell,
  LoadingShell,
  ErrorShell,
} from "@/components/ux/Shells";
import {
  YAHOO_WEEKS_2026_27,
  defaultWeekNumber,
  getYahooWeek,
  type YahooWeek,
} from "@/lib/yahooWeeks";
import type { DayStripCell, RosterDensity } from "@/lib/scheduleWeek";
import styles from "./TeamBoard.module.css";

type SearchHit = { player_id: string; full_name: string };

type RosterMetrics = {
  gp: number;
  avg_min?: number;
  avg_pts: number;
  avg_reb: number;
  avg_ast: number;
  avg_stl?: number;
  avg_blk?: number;
  avg_tov?: number;
  avg_fg3m?: number | null;
  fg_pct?: number | null;
  ft_pct?: number | null;
} | null;

type RosterRowPayload = {
  player_id: string;
  full_name: string | null;
  team_abbreviation: string | null;
  chart_primary: string | null;
  current: RosterMetrics;
  prior: RosterMetrics;
};

const TOAST_MS = 2000;
const SEARCH_SEASON = TEAM_PRIOR_SEASON;

function parseView(raw: string | null): TeamView {
  if (raw === "matchup" || raw === "density" || raw === "compare" || raw === "roster")
    return raw;
  return "roster";
}

export function TeamBoard() {
  const searchParams = useSearchParams();
  const initialView = parseView(searchParams.get("view"));
  const initialWeek = Number.parseInt(searchParams.get("week") || "", 10);
  const focusPlayer = searchParams.get("player_id");

  const [view, setView] = useState<TeamView>(initialView);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [season, setSeason] = useState<SeasonId>(TEAM_DEFAULT_SEASON);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<RosterRowPayload[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [weekNum, setWeekNum] = useState(
    Number.isFinite(initialWeek) ? initialWeek : defaultWeekNumber()
  );
  const [ha, setHa] = useState<HaFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [days, setDays] = useState<DayStripCell[]>([]);
  const [density, setDensity] = useState<RosterDensity[]>([]);
  const [weekSoftEmpty, setWeekSoftEmpty] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const week: YahooWeek | null = getYahooWeek(weekNum);

  const showToast = useCallback(() => {
    setToast(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(false), TOAST_MS);
  }, []);

  const persist = useCallback(
    (next: RosterPlayer[]) => {
      const written = writeTeamRoster(next);
      setRoster(written);
      showToast();
    },
    [showToast]
  );

  useEffect(() => {
    setRoster(readTeamRoster());
    setHydrated(true);
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!searchRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const loadRows = useCallback(async (ids: string[], seasonId: string) => {
    if (ids.length === 0) {
      setRows([]);
      setRowsError(null);
      return;
    }
    setLoadingRows(true);
    setRowsError(null);
    try {
      const qs = new URLSearchParams({
        player_ids: ids.join(","),
        season: seasonId,
        prior_season: TEAM_PRIOR_SEASON,
        scope: TEAM_DEFAULT_SCOPE,
      });
      const res = await fetch(`/api/team-roster?${qs.toString()}`);
      if (!res.ok) throw new Error(`team-roster ${res.status}`);
      const data = (await res.json()) as { players: RosterRowPayload[] };
      setRows(data.players ?? []);
    } catch (e) {
      setRows([]);
      setRowsError(e instanceof Error ? e.message : "Failed to load roster");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void loadRows(
      roster.map((r) => r.player_id),
      season
    );
  }, [hydrated, roster, season, loadRows]);

  const rowById = useMemo(() => {
    const m = new Map<string, RosterRowPayload>();
    for (const r of rows) m.set(r.player_id, r);
    return m;
  }, [rows]);

  const rosterWithTeams = useMemo(() => {
    return roster.map((p) => {
      const api = rowById.get(p.player_id);
      return {
        ...p,
        team_abbreviation:
          api?.team_abbreviation ?? p.team_abbreviation ?? null,
      };
    });
  }, [roster, rowById]);

  const loadWeek = useCallback(async () => {
    if (!week) {
      setWeekSoftEmpty(true);
      setDays([]);
      setDensity([]);
      return;
    }
    setWeekLoading(true);
    setWeekError(null);
    try {
      const teams = [
        ...new Set(
          rosterWithTeams
            .map((p) => p.team_abbreviation)
            .filter((t): t is string => Boolean(t))
        ),
      ];
      const rosterParam = rosterWithTeams
        .map(
          (p) =>
            `${p.player_id}|${encodeURIComponent(p.full_name)}|${p.team_abbreviation ?? ""}`
        )
        .join(";");
      const qs = new URLSearchParams({
        week: String(week.week_number),
        homeAway: ha,
      });
      if (teams.length) qs.set("teams", teams.join(","));
      if (rosterParam) qs.set("roster", rosterParam);
      const res = await fetch(`/api/fantasy-week?${qs.toString()}`);
      if (!res.ok) throw new Error(`fantasy-week ${res.status}`);
      const data = await res.json();
      if (data.soft_empty) {
        setWeekSoftEmpty(true);
        setDays([]);
        setDensity([]);
      } else {
        setWeekSoftEmpty(false);
        setDays(data.days ?? []);
        setDensity(data.density ?? []);
      }
    } catch (e) {
      setWeekError(e instanceof Error ? e.message : "Week load failed");
      setDays([]);
      setDensity([]);
    } finally {
      setWeekLoading(false);
    }
  }, [week, rosterWithTeams, ha]);

  useEffect(() => {
    if (!hydrated) return;
    if (view === "matchup" || view === "density" || view === "roster") {
      void loadWeek();
    }
  }, [hydrated, view, loadWeek]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/player-search?q=${encodeURIComponent(trimmed)}&season=${SEARCH_SEASON}&scope=${TEAM_DEFAULT_SCOPE}`
      );
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as { players?: SearchHit[] };
      setHits(data.players ?? []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      void runSearch(query);
    }, 180);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query, runSearch]);

  const addPlayer = useCallback(
    (hit: SearchHit) => {
      if (rosterHasPlayer(roster, hit.player_id)) return;
      persist([
        ...roster,
        { player_id: hit.player_id, full_name: hit.full_name },
      ]);
      setQuery("");
      setHits([]);
      setSearchOpen(false);
    },
    [roster, persist]
  );

  const removePlayer = useCallback(
    (player_id: string) => {
      if (roster.length > 1 && pendingRemoveId !== player_id) {
        setPendingRemoveId(player_id);
        return;
      }
      persist(roster.filter((p) => p.player_id !== player_id));
      setPendingRemoveId(null);
    },
    [roster, pendingRemoveId, persist]
  );

  const clearRoster = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    persist([]);
    setConfirmClear(false);
    setPendingRemoveId(null);
  }, [confirmClear, persist]);

  const priorLabel = seasonShortLabel(TEAM_PRIOR_SEASON);
  const currentLabel = seasonShortLabel(season);
  const anyCurrent = rows.some((r) => r.current != null);
  const softEmptySeason =
    hydrated &&
    roster.length > 0 &&
    !loadingRows &&
    !anyCurrent &&
    season === TEAM_DEFAULT_SEASON;

  const weekChips = YAHOO_WEEKS_2026_27.filter(
    (w) =>
      Math.abs(w.week_number - weekNum) <= 2 ||
      w.is_double_week ||
      w.is_partial_week
  ).slice(0, 8);

  // Prefer nearby chips around selected
  const chipWindow = useMemo(() => {
    const start = Math.max(1, weekNum - 2);
    const end = Math.min(23, start + 5);
    return YAHOO_WEEKS_2026_27.filter(
      (w) => w.week_number >= start && w.week_number <= end
    );
  }, [weekNum]);

  void weekChips;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div className={styles.headRow}>
          <div>
            <p className={styles.kicker}>Workspace Team</p>
            <h1 className={styles.title}>
              Midnight Flash
              {hydrated && roster.length > 0 ? (
                <span className={styles.titleMeta}>
                  {" "}
                  · {roster.length} saved
                </span>
              ) : null}
            </h1>
          </div>
          {(view === "matchup" || view === "density") && (
            <FilterMenu
              ha={ha}
              onHa={setHa}
              open={filtersOpen}
              onToggle={() => setFiltersOpen((o) => !o)}
            />
          )}
        </div>
      </header>

      <TeamSubnav active={view} onChange={setView} />

      {view === "roster" ? (
        <section className={styles.panel} aria-label="Active roster">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Active roster</h2>
            <p className={styles.panelMeta}>
              {roster.length} / 15
              {week ? ` · W${week.week_number}` : ""}
            </p>
          </div>

          {!hydrated || loadingRows ? (
            <LoadingShell label="Loading roster…" />
          ) : rowsError ? (
            <ErrorShell
              message={rowsError}
              onRetry={() =>
                void loadRows(
                  roster.map((r) => r.player_id),
                  season
                )
              }
            />
          ) : roster.length === 0 ? (
            <EmptyShell
              title="No players saved yet"
              body="Add from Players or search below. Strip stays soft-empty until ≥1 player."
              ctaHref="/players"
              ctaLabel="Add from Players →"
            />
          ) : (
            <ul className={styles.rosterList}>
              {rosterWithTeams.map((p) => {
                const api = rowById.get(p.player_id);
                const abbr = p.team_abbreviation;
                const color =
                  api?.chart_primary ??
                  getTeamColors(abbr)?.chartPrimary ??
                  null;
                const dens = density.find((d) => d.player_id === p.player_id);
                const confirming = pendingRemoveId === p.player_id;
                const focused = focusPlayer === p.player_id;
                return (
                  <li
                    key={p.player_id}
                    className={
                      focused ? `${styles.rosterRow} ${styles.rosterFocus}` : styles.rosterRow
                    }
                  >
                    <Link
                      href={`/players?player_id=${encodeURIComponent(p.player_id)}`}
                      className={styles.rosterLink}
                      scroll={false}
                    >
                      <TeamMarkPip color={color} size={7} />
                      <span className={styles.rosterName}>
                        {formatShortName(p.full_name)}
                      </span>
                      {abbr ? (
                        <span className={styles.rosterAbbr}>
                          {abbr}
                          {dens ? ` ${dens.counting}g W${weekNum}` : ""}
                        </span>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      className={
                        confirming ? styles.removeConfirm : styles.removeBtn
                      }
                      aria-label={
                        confirming
                          ? `Confirm remove ${p.full_name}`
                          : `Remove ${p.full_name}`
                      }
                      onClick={() => removePlayer(p.player_id)}
                    >
                      {confirming ? "Remove?" : "×"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={styles.searchWrap} ref={searchRef}>
            <label>
              <span className={styles.srOnly}>Search players to add</span>
              <input
                type="search"
                placeholder="Search players..."
                value={query}
                autoComplete="off"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
              />
            </label>
            {searchOpen &&
            (hits.length > 0 || searching || query.trim().length >= 2) ? (
              <div className={styles.dropdown} role="listbox">
                {searching && hits.length === 0 ? (
                  <div className={styles.dropHint}>Searching…</div>
                ) : hits.length === 0 ? (
                  <div className={styles.dropHint}>No matches</div>
                ) : (
                  hits.map((h) => {
                    const onRoster = rosterHasPlayer(roster, h.player_id);
                    return (
                      <button
                        key={h.player_id}
                        type="button"
                        role="option"
                        aria-selected={onRoster}
                        className={
                          onRoster ? styles.hitOnRoster : styles.hitBtn
                        }
                        disabled={onRoster}
                        onClick={() => addPlayer(h)}
                      >
                        {formatShortName(h.full_name)}
                        {onRoster ? " · on roster ✓" : ""}
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          {roster.length > 0 ? (
            <div className={styles.rosterActions}>
              <button
                type="button"
                className={
                  confirmClear ? styles.clearConfirm : styles.clearBtn
                }
                onClick={clearRoster}
                onBlur={() => setConfirmClear(false)}
              >
                {confirmClear ? "Confirm clear roster" : "Clear roster"}
              </button>
              {pendingRemoveId ? (
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setPendingRemoveId(null)}
                >
                  Cancel remove
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "matchup" ? (
        <div className={styles.stack}>
          <div className={styles.weekRow}>
            <div className={styles.chips}>
              {chipWindow.map((w) => (
                <WeekChip
                  key={w.fantasy_week_id}
                  week={w}
                  selected={w.week_number === weekNum}
                  onSelect={setWeekNum}
                />
              ))}
            </div>
            <p className={styles.weekLegend}>
              * = 14-day · W1 short · Cup final doesn&apos;t count · Thanksgiving /
              Christmas not double
            </p>
          </div>
          {week?.is_double_week ? <DoubleWeekBanner week={week} /> : null}
          {week?.is_partial_week ? (
            <p className={styles.partialNote} role="status">
              Week 1 is short (Tue–Sun · 6 days) — empty Mon is OK, not a bye.
            </p>
          ) : null}
          {weekLoading ? (
            <LoadingShell label="Loading matchup week…" />
          ) : weekError ? (
            <ErrorShell message={weekError} onRetry={() => void loadWeek()} />
          ) : !week ? (
            <EmptyShell
              title="Week outside Yahoo table"
              body="Soft-empty — date not in 2026–27 Game Week lookup."
            />
          ) : (
            <ScheduleStrip
              week={week}
              days={days}
              softEmpty={weekSoftEmpty || roster.length === 0}
            />
          )}
        </div>
      ) : null}

      {view === "density" ? (
        <div className={styles.stack}>
          <div className={styles.weekRow}>
            <div className={styles.chips}>
              {chipWindow.map((w) => (
                <WeekChip
                  key={w.fantasy_week_id}
                  week={w}
                  selected={w.week_number === weekNum}
                  onSelect={setWeekNum}
                />
              ))}
            </div>
          </div>
          {weekLoading ? (
            <LoadingShell label="Loading density…" />
          ) : weekError ? (
            <ErrorShell message={weekError} onRetry={() => void loadWeek()} />
          ) : week ? (
            <DensityCard
              week={week}
              rows={density}
              softEmpty={roster.length === 0 || weekSoftEmpty}
            />
          ) : (
            <EmptyShell
              title="Week outside Yahoo table"
              body="Soft-empty — no density without a Game Week."
            />
          )}
        </div>
      ) : null}

      {view === "compare" ? (
        <section className={styles.panel} aria-label="Compare prior">
          <div className={styles.filterBar}>
            <SeasonSelect
              options={SEASON_OPTIONS}
              value={season}
              onChange={setSeason}
              label="Season"
            />
            <div className={styles.scopeGroup} role="group" aria-label="Scope">
              <button type="button" className={styles.scopeOn} aria-pressed="true">
                Regular
              </button>
              <button
                type="button"
                className={styles.scopeOff}
                disabled
                title="Playoffs OFF this bake"
              >
                Playoffs
              </button>
            </div>
            <span className={styles.filterLabel}>
              Prior locked {TEAM_PRIOR_SEASON} {TEAM_DEFAULT_SCOPE}
            </span>
          </div>

          {roster.length === 0 ? (
            <EmptyShell
              title="Add players to compare"
              body="Compare binds TEAM-COMPARE-RULES — 2026-27 vs 2025-26 reg_only."
              ctaHref="/players"
              ctaLabel="Add from Players →"
            />
          ) : loadingRows ? (
            <LoadingShell label="Loading compare…" />
          ) : rowsError ? (
            <ErrorShell
              message={rowsError}
              onRetry={() =>
                void loadRows(
                  roster.map((r) => r.player_id),
                  season
                )
              }
            />
          ) : (
            <>
              {softEmptySeason ? (
                <div className={styles.softEmpty} role="status">
                  <p className={styles.softTitle}>
                    {TEAM_DEFAULT_SEASON} boxes not in yet
                  </p>
                  <p className={styles.softCopy}>
                    Current cells stay — · prior {TEAM_PRIOR_SEASON} still
                    renders · no invented scores.
                  </p>
                </div>
              ) : null}
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">{priorLabel} PTS</th>
                      <th scope="col">{currentLabel} PTS</th>
                      <th scope="col">Δ</th>
                      <th scope="col">{priorLabel} REB</th>
                      <th scope="col">{currentLabel} REB</th>
                      <th scope="col">Δ</th>
                      <th scope="col">{priorLabel} AST</th>
                      <th scope="col">{currentLabel} AST</th>
                      <th scope="col">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((p) => {
                      const api = rowById.get(p.player_id);
                      const cur = api?.current ?? null;
                      const prior = api?.prior ?? null;
                      const abbr =
                        api?.team_abbreviation ?? p.team_abbreviation ?? null;
                      const color =
                        api?.chart_primary ??
                        getTeamColors(abbr)?.chartPrimary ??
                        null;
                      const dPts = deltaValue(cur?.avg_pts, prior?.avg_pts);
                      const dReb = deltaValue(cur?.avg_reb, prior?.avg_reb);
                      const dAst = deltaValue(cur?.avg_ast, prior?.avg_ast);
                      const clsDelta = (
                        d: number | null,
                        key: "avg_pts" | "avg_reb" | "avg_ast"
                      ) =>
                        d == null
                          ? styles.mutedNa
                          : deltaPolarity(key, d) === "improve"
                            ? styles.deltaImprove
                            : deltaPolarity(key, d) === "decline"
                              ? styles.deltaDecline
                              : undefined;
                      return (
                        <tr key={p.player_id}>
                          <td className={styles.stickyPlayer}>
                            <Link
                              href={`/players?player_id=${encodeURIComponent(p.player_id)}`}
                              className={styles.playerCell}
                              scroll={false}
                            >
                              <TeamMarkPip color={color} size={7} />
                              {formatShortName(p.full_name)}
                            </Link>
                          </td>
                          <td>{formatAvg(prior?.avg_pts)}</td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_pts)}
                          </td>
                          <td className={clsDelta(dPts, "avg_pts")}>
                            {formatDelta(dPts)}
                          </td>
                          <td>{formatAvg(prior?.avg_reb)}</td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_reb)}
                          </td>
                          <td className={clsDelta(dReb, "avg_reb")}>
                            {formatDelta(dReb)}
                          </td>
                          <td>{formatAvg(prior?.avg_ast)}</td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_ast)}
                          </td>
                          <td className={clsDelta(dAst, "avg_ast")}>
                            {formatDelta(dAst)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Compact current Δ vs PY affordance */}
              <div className={styles.scroll} style={{ marginTop: "1rem" }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">GP</th>
                      <th scope="col">PTS</th>
                      <th scope="col">Δ vs PY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((p) => {
                      const api = rowById.get(p.player_id);
                      const cur = api?.current ?? null;
                      const prior = api?.prior ?? null;
                      const dPtsLabel = formatDeltaVsPy(
                        cur?.avg_pts,
                        prior?.avg_pts
                      );
                      const dPts = deltaValue(cur?.avg_pts, prior?.avg_pts);
                      const pol = deltaPolarity("avg_pts", dPts);
                      return (
                        <tr key={`cur-${p.player_id}`}>
                          <td>{formatShortName(p.full_name)}</td>
                          <td className={cur ? undefined : styles.muted}>
                            {cur ? cur.gp : "—"}
                          </td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_pts)}
                          </td>
                          <td
                            className={
                              dPtsLabel === "see PY" || dPtsLabel === "n/a"
                                ? styles.mutedNa
                                : pol === "improve"
                                  ? styles.deltaImprove
                                  : pol === "decline"
                                    ? styles.deltaDecline
                                    : undefined
                            }
                          >
                            {dPtsLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className={styles.foot}>
                Current {season} · scope {TEAM_DEFAULT_SCOPE} · prior{" "}
                {TEAM_PRIOR_SEASON} · Δ = current − prior · avg_fg3m only ·
                TEAM-COMPARE-RULES.md
              </p>
            </>
          )}
        </section>
      ) : null}

      <AutosaveToast visible={toast} />
    </div>
  );
}
