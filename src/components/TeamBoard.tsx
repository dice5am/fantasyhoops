"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  type CompareMode,
} from "@/lib/teamCompare";
import {
  SEASON_OPTIONS,
  type SeasonId,
} from "@/types/season_player_averages";
import { getTeamColors } from "@/lib/teamColors";
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
/** Search against data season — 2026-27 Top-250 is empty until boxes. */
const SEARCH_SEASON = TEAM_PRIOR_SEASON;

export function TeamBoard() {
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [season, setSeason] = useState<SeasonId>(TEAM_DEFAULT_SEASON);
  const [mode, setMode] = useState<CompareMode>("current");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<RosterRowPayload[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [toast, setToast] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(
    null
  );
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const searchTimer = useRef<number | null>(null);

  const showToast = useCallback(() => {
    setToast(true);
    setSavedHint("just now");
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
      return;
    }
    setLoadingRows(true);
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
    } catch {
      setRows([]);
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
      const next = [
        ...roster,
        { player_id: hit.player_id, full_name: hit.full_name },
      ];
      persist(next);
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

  const rowById = useMemo(() => {
    const m = new Map<string, RosterRowPayload>();
    for (const r of rows) m.set(r.player_id, r);
    return m;
  }, [rows]);

  const priorLabel = seasonShortLabel(TEAM_PRIOR_SEASON);
  const currentLabel = seasonShortLabel(season);
  const anyCurrent =
    rows.some((r) => r.current != null) || false;
  const softEmptySeason =
    hydrated &&
    roster.length > 0 &&
    !loadingRows &&
    !anyCurrent &&
    season === TEAM_DEFAULT_SEASON;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>
          Team
          {hydrated && roster.length > 0 ? (
            <span className={styles.titleMeta}> · {roster.length} saved</span>
          ) : null}
        </h1>
        <p className={styles.sub}>
          Roster save · {TEAM_DEFAULT_SEASON} reg_only default · prior compare{" "}
          {TEAM_PRIOR_SEASON}
        </p>
      </header>

      <div className={styles.stack}>
        {/* Zone A — Roster rail */}
        <section className={styles.panel} aria-label="Roster rail">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>
              {roster.length === 0
                ? "Empty roster"
                : `Saved roster · ${roster.length} player${
                    roster.length === 1 ? "" : "s"
                  }`}
            </h2>
            {roster.length > 0 ? (
              <p className={styles.panelMeta}>
                Saved locally
                {savedHint ? ` · ${savedHint}` : ""}
              </p>
            ) : null}
          </div>

          {roster.length === 0 ? (
            <div className={styles.emptyRoster}>
              <p className={styles.emptyCopy}>No players saved yet</p>
              <Link href="/player" className={styles.ctaPrimary}>
                Add from Player →
              </Link>
              <p className={styles.orSearch}>Or search here to add</p>
            </div>
          ) : (
            <ul className={styles.rosterList}>
              {roster.map((p) => {
                const api = rowById.get(p.player_id);
                const abbr =
                  api?.team_abbreviation ?? p.team_abbreviation ?? null;
                const color =
                  api?.chart_primary ??
                  getTeamColors(abbr)?.chartPrimary ??
                  null;
                const confirming = pendingRemoveId === p.player_id;
                return (
                  <li key={p.player_id} className={styles.rosterRow}>
                    <Link
                      href={`/player?player_id=${encodeURIComponent(p.player_id)}`}
                      className={styles.rosterLink}
                      scroll={false}
                    >
                      <TeamMarkPip color={color} size={7} />
                      <span className={styles.rosterName}>
                        {formatShortName(p.full_name)}
                      </span>
                      {abbr ? (
                        <span className={styles.rosterAbbr}>{abbr}</span>
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
            {searchOpen && (hits.length > 0 || searching || query.trim().length >= 2) ? (
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

        {/* Zone B — Season analyze + mode */}
        <section className={styles.panel} aria-label="Season analyze">
          <div className={styles.filterBar}>
            <SeasonSelect
              options={SEASON_OPTIONS}
              value={season}
              onChange={(next) => {
                setSeason(next);
                // no scroll-jump — state only
              }}
              label="Season"
            />
            <div className={styles.scopeGroup} role="group" aria-label="Scope">
              <button
                type="button"
                className={styles.scopeOn}
                aria-pressed="true"
              >
                Regular
              </button>
              <button
                type="button"
                className={styles.scopeOff}
                disabled
                title="Playoffs OFF this bake"
                aria-disabled="true"
              >
                Playoffs
              </button>
            </div>
            <span className={styles.filterLabel}>
              Roster averages · {mode === "compare" ? "compare" : "current"}
            </span>
          </div>

          <div className={styles.modeBar} role="group" aria-label="Compare mode">
            <span className={styles.modeLabel}>Mode:</span>
            <button
              type="button"
              className={
                mode === "current" ? styles.modeOn : styles.modeBtn
              }
              aria-pressed={mode === "current"}
              onClick={() => setMode("current")}
            >
              Current only
            </button>
            <button
              type="button"
              className={
                mode === "compare" ? styles.modeOn : styles.modeBtn
              }
              aria-pressed={mode === "compare"}
              onClick={() => setMode("compare")}
            >
              Compare prior
            </button>
            <span className={styles.modeHint}>
              Prior locked {TEAM_PRIOR_SEASON} {TEAM_DEFAULT_SCOPE}
            </span>
          </div>

          {roster.length === 0 ? (
            <div className={styles.softEmpty} role="status">
              Add players to the roster to see averages.
              <div>
                <Link href="/player" className={styles.ctaLink}>
                  Add from Player →
                </Link>
              </div>
            </div>
          ) : softEmptySeason && mode === "current" ? (
            <div className={styles.softEmpty} role="status">
              <p className={styles.softTitle}>
                {TEAM_DEFAULT_SEASON} boxes not in yet
              </p>
              <p className={styles.softCopy}>
                Schedule can show · game logs stay empty. Do not invent scores ·
                cells stay —.
              </p>
              <button
                type="button"
                className={styles.ctaSecondary}
                onClick={() => setMode("compare")}
              >
                Compare prior year {TEAM_PRIOR_SEASON} →
              </button>
            </div>
          ) : null}

          {roster.length > 0 ? (
            <div className={styles.scroll}>
              {mode === "current" ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Player</th>
                      <th scope="col">GP</th>
                      <th scope="col">PTS</th>
                      <th scope="col">REB</th>
                      <th scope="col">AST</th>
                      <th scope="col">Δ vs PY</th>
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
                      const dPtsLabel = formatDeltaVsPy(
                        cur?.avg_pts,
                        prior?.avg_pts
                      );
                      const dPts = deltaValue(cur?.avg_pts, prior?.avg_pts);
                      const pol = deltaPolarity("avg_pts", dPts);
                      return (
                        <tr key={p.player_id}>
                          <td>
                            <Link
                              href={`/player?player_id=${encodeURIComponent(p.player_id)}`}
                              className={styles.playerCell}
                              scroll={false}
                            >
                              <TeamMarkPip color={color} size={7} />
                              {formatShortName(p.full_name)}
                            </Link>
                          </td>
                          <td className={cur ? undefined : styles.muted}>
                            {cur ? cur.gp : "—"}
                          </td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_pts)}
                          </td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_reb)}
                          </td>
                          <td className={cur ? undefined : styles.muted}>
                            {formatAvg(cur?.avg_ast)}
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
                            {dPtsLabel === "see PY" ? (
                              <button
                                type="button"
                                className={styles.seePy}
                                onClick={() => setMode("compare")}
                              >
                                see PY
                              </button>
                            ) : (
                              dPtsLabel
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
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
                              href={`/player?player_id=${encodeURIComponent(p.player_id)}`}
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
              )}
            </div>
          ) : null}

          {loadingRows && roster.length > 0 ? (
            <p className={styles.loading}>Loading averages…</p>
          ) : null}

          <p className={styles.foot}>
            Current {season} · scope {TEAM_DEFAULT_SCOPE} · prior{" "}
            {TEAM_PRIOR_SEASON} · Δ = current − prior when both exist · mart
            avg only · rules: TEAM-COMPARE-RULES.md
          </p>
        </section>
      </div>

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          Roster saved on this device
        </div>
      ) : null}
    </div>
  );
}
