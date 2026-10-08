"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TeamMarkPip } from "@/components/TeamMarkPip";
import { formatShortName } from "@/lib/formatName";
import { getTeamColors } from "@/lib/teamColors";
import type { DraftBoardPayload, DraftBoardPlayer } from "@/lib/loadDraftBoard";
import {
  DEFAULT_ROUNDS,
  SIMILARITY_K,
  SORT_CHIPS,
  categoryGaps,
  finite,
  rankSuggestions,
  validateSetup,
  weightCaption,
  yourPicks,
  type CatGap,
  type DraftFormat,
  type DraftSetup,
  type ScoreVector,
  type SortKey,
  type SuggestMode,
} from "@/lib/draftMath";
import {
  clearTeamRoster,
  readTeamRoster,
  removeTeamRosterPlayer,
  rosterHasPlayer,
  upsertTeamRosterPlayer,
  type RosterPlayer,
  TEAM_ROSTER_EVENT,
  TEAM_ROSTER_MAX,
} from "@/lib/teamRoster";
import { fmtHotPct } from "@/lib/teamRollup";
import { useHotCold } from "@/lib/useHotCold";
import styles from "./DraftAssistant.module.css";

const SETUP_KEY = "fantasyhoops.draftSetup";
export const DRAFT_SETUP_KEY = SETUP_KEY;
/** Same-tab signal so the merged Draft/Team screen can re-read setup. */
export const DRAFT_SETUP_EVENT = "fantasyhoops:draftSetup";

type Phase = "empty" | "setup" | "board";
type ScoreWindow = "last" | "three_yr";

function parseIntStrict(raw: string): number | null {
  const t = raw.trim();
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : null;
}

function readSetup(): DraftSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSetup;
    if (validateSetup(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSetup(setup: DraftSetup) {
  window.localStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  window.dispatchEvent(new Event(DRAFT_SETUP_EVENT));
}

function fmtScore(v: number | null | undefined): string {
  if (!finite(v)) return "n/a";
  return String(Math.round(v));
}

function fmtGap(v: number): string {
  const rounded = Math.round(v * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(1)}`;
}

function vectorOf(player: DraftBoardPlayer, window: ScoreWindow): ScoreVector {
  if (window === "three_yr") {
    return (
      player.three_yr?.scores ?? {
        pts: null,
        ast: null,
        fg3m: null,
        reb: null,
        stl: null,
        blk: null,
        tov: null,
        fg_f1: null,
        ft_f1: null,
        off: null,
        def: null,
        eff: null,
        o1: null,
      }
    );
  }
  return player.scores;
}

function gpOf(player: DraftBoardPlayer, window: ScoreWindow): number | null {
  if (window === "three_yr") return player.three_yr?.gp_3yr ?? null;
  return finite(player.gp) ? player.gp : null;
}

export function DraftAssistant() {
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("empty");
  const [setup, setSetup] = useState<DraftSetup | null>(null);
  const [nRaw, setNRaw] = useState("10");
  const [sRaw, setSRaw] = useState("3");
  const [rRaw, setRRaw] = useState(String(DEFAULT_ROUNDS));
  const [format, setFormat] = useState<DraftFormat>("snake");
  const [setupError, setSetupError] = useState<string | null>(null);

  const [windowMode, setWindowMode] = useState<ScoreWindow>("last");
  const [sortKey, setSortKey] = useState<SortKey>("o1");
  const [suggestMode, setSuggestMode] = useState<SuggestMode>("cover");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const [board, setBoard] = useState<DraftBoardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const saved = readSetup();
    const storedRoster = readTeamRoster();
    setRoster(storedRoster);
    if (saved) {
      setSetup(saved);
      setNRaw(String(saved.n));
      setSRaw(String(saved.s));
      setRRaw(String(saved.r));
      setFormat(saved.format);
      setPhase("board");
    } else {
      setPhase("empty");
    }
    setHydrated(true);
    // Team (same screen) can remove/add — re-read the shared roster key.
    const onRoster = () => setRoster(readTeamRoster());
    window.addEventListener(TEAM_ROSTER_EVENT, onRoster);
    return () => window.removeEventListener(TEAM_ROSTER_EVENT, onRoster);
  }, []);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/draft-board", { cache: "no-store" });
      const body = (await res.json()) as DraftBoardPayload & { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Couldn't load draft board");
      }
      if (!body.players || body.last_season !== "2025-26") {
        throw new Error("Draft board did not return the 2025-26 Last baseline");
      }
      setBoard(body);
    } catch (err) {
      setBoard(null);
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || phase !== "board") return;
    void loadBoard();
  }, [hydrated, phase, loadBoard, reloadKey]);

  useEffect(() => {
    if (!toast && !toastError) return;
    const t = window.setTimeout(() => {
      setToast(null);
      setToastError(null);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [toast, toastError]);

  const draftSetupPreview = useMemo(() => {
    const n = parseIntStrict(nRaw);
    const s = parseIntStrict(sRaw);
    const r = parseIntStrict(rRaw);
    if (n == null || s == null || r == null) return { error: null as string | null, picks: null };
    const error = validateSetup({ n, s, format, r });
    if (error) return { error, picks: null };
    return { error: null, picks: yourPicks({ n, s, format, r }) };
  }, [nRaw, sRaw, rRaw, format]);

  function continueToBoard() {
    const n = parseIntStrict(nRaw);
    const s = parseIntStrict(sRaw);
    const r = parseIntStrict(rRaw);
    if (n == null || s == null || r == null) {
      setSetupError("N, S, and R must be whole numbers. Slot is not clamped.");
      return;
    }
    const error = validateSetup({ n, s, format, r });
    if (error) {
      setSetupError(error);
      return;
    }
    const next = { n, s, format, r };
    writeSetup(next);
    setSetup(next);
    setSetupError(null);
    setPhase("board");
  }

  function onPick(player: DraftBoardPlayer) {
    const result = upsertTeamRosterPlayer({
      player_id: player.player_id,
      full_name: player.full_name,
      team_abbreviation: player.team_abbreviation,
    });
    setRoster(result.roster);
    if (!result.ok) {
      setToast(null);
      setToastError(
        `Roster is full (${TEAM_ROSTER_MAX}). Remove someone before adding — nothing was dropped.`
      );
      return;
    }
    setToastError(null);
    setToast(
      result.added
        ? "Saved to Team roster"
        : "Already on Team roster"
    );
  }

  function onRemove(player_id: string) {
    setRoster(removeTeamRosterPlayer(player_id));
    setToast("Removed from Team roster");
    setToastError(null);
  }

  function onClear() {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Clear the Team roster on this device?");
      if (!ok) return;
    }
    setRoster(clearTeamRoster());
    setToast("Team roster cleared");
    setToastError(null);
  }

  if (!hydrated) {
    return (
      <main className={styles.page}>
        <LoadingBlock />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      {phase === "empty" ? (
        <EmptyBlock onOpen={() => setPhase("setup")} />
      ) : null}

      {phase === "setup" ? (
        <SetupBlock
          nRaw={nRaw}
          sRaw={sRaw}
          rRaw={rRaw}
          format={format}
          error={setupError ?? draftSetupPreview.error}
          picks={draftSetupPreview.picks}
          onN={setNRaw}
          onS={setSRaw}
          onR={setRRaw}
          onFormat={setFormat}
          onContinue={continueToBoard}
        />
      ) : null}

      {phase === "board" && setup ? (
        <BoardBlock
          setup={setup}
          windowMode={windowMode}
          sortKey={sortKey}
          suggestMode={suggestMode}
          roster={roster}
          board={board}
          loading={loading}
          loadError={loadError}
          onWindow={setWindowMode}
          onSort={setSortKey}
          onMode={setSuggestMode}
          onPick={onPick}
          onRemove={onRemove}
          onClear={onClear}
          onRetry={() => setReloadKey((k) => k + 1)}
          onEditSetup={() => setPhase("setup")}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
      {toastError ? (
        <div className={styles.toastError} role="alert">
          {toastError}
        </div>
      ) : null}
    </main>
  );
}

function EmptyBlock({ onOpen }: { onOpen: () => void }) {
  return (
    <section className={styles.empty} aria-labelledby="draft-empty-title">
      <p className={styles.kicker}>Draft assistant</p>
      <h1 className={styles.h1} id="draft-empty-title">
        Draft
      </h1>
      <div className={styles.emptyCard}>
        <span className={styles.emptyIcon} aria-hidden>
          ▭
        </span>
        <p className={styles.emptyTitle}>Set up your draft first</p>
        <p className={styles.emptyBody}>
          Choose N teams, your slot S, and straight or snake before the board
          opens.
        </p>
        <button type="button" className={styles.primary} onClick={onOpen}>
          Open setup
        </button>
      </div>
    </section>
  );
}

function SetupBlock(props: {
  nRaw: string;
  sRaw: string;
  rRaw: string;
  format: DraftFormat;
  error: string | null;
  picks: ReturnType<typeof yourPicks> | null;
  onN: (v: string) => void;
  onS: (v: string) => void;
  onR: (v: string) => void;
  onFormat: (v: DraftFormat) => void;
  onContinue: () => void;
}) {
  return (
    <section aria-labelledby="draft-setup-title">
      <p className={styles.kicker}>Draft assistant</p>
      <h1 className={styles.h1} id="draft-setup-title">
        Setup your draft
      </h1>
      <div className={styles.setupGrid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>League settings</h2>
          <p className={styles.cardHint}>
            N teams · slot S · straight or snake · rounds default {DEFAULT_ROUNDS}
          </p>
          <label className={styles.field}>
            <span>Number of teams (N)</span>
            <input
              inputMode="numeric"
              value={props.nRaw}
              onChange={(e) => props.onN(e.target.value)}
              aria-label="Number of teams"
            />
          </label>
          <label className={styles.field}>
            <span>Your draft slot (S)</span>
            <input
              inputMode="numeric"
              value={props.sRaw}
              onChange={(e) => props.onS(e.target.value)}
              aria-label="Your draft slot"
            />
          </label>
          <label className={styles.field}>
            <span>Rounds (R)</span>
            <input
              inputMode="numeric"
              value={props.rRaw}
              onChange={(e) => props.onR(e.target.value)}
              aria-label="Rounds"
            />
          </label>
          <div className={styles.field}>
            <span>Format</span>
            <div className={styles.seg} role="group" aria-label="Draft format">
              <button
                type="button"
                className={props.format === "straight" ? styles.segOn : styles.segOff}
                aria-pressed={props.format === "straight"}
                onClick={() => props.onFormat("straight")}
              >
                Straight
              </button>
              <button
                type="button"
                className={props.format === "snake" ? styles.segOn : styles.segOff}
                aria-pressed={props.format === "snake"}
                onClick={() => props.onFormat("snake")}
              >
                Snake
              </button>
            </div>
          </div>
          {props.error ? (
            <p className={styles.formError} role="alert">
              {props.error}
            </p>
          ) : null}
        </div>
        <aside className={styles.card} aria-label="Draft order">
          <h2 className={styles.cardTitle}>Your pick preview</h2>
          <p className={styles.cardHint}>
            {props.picks
              ? `${props.format === "snake" ? "Snake" : "Straight"} · N=${props.nRaw} · S=${props.sRaw} · ${props.picks.length} rounds`
              : "Enter a valid N, S, and R. Slot outside 1…N is rejected."}
          </p>
          <ol className={styles.order}>
            {(props.picks ?? []).map((pick) => (
              <li key={pick.round}>
                <span className={styles.round}>R{pick.round}</span>
                <span className={styles.overall}>#{pick.overall}</span>
                <span className={styles.you}>you</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <div className={styles.setupActions}>
        <button type="button" className={styles.primary} onClick={props.onContinue}>
          Continue to board
        </button>
      </div>
    </section>
  );
}

function LoadingBlock() {
  return (
    <section aria-busy="true" aria-label="Loading draft board">
      <p className={styles.kicker}>Draft board</p>
      <h1 className={styles.h1}>Player scores</h1>
      <div className={styles.skelChips}>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className={styles.skelTable}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.skelRow} />
        ))}
      </div>
    </section>
  );
}

function BoardBlock(props: {
  setup: DraftSetup;
  windowMode: ScoreWindow;
  sortKey: SortKey;
  suggestMode: SuggestMode;
  roster: RosterPlayer[];
  board: DraftBoardPayload | null;
  loading: boolean;
  loadError: string | null;
  onWindow: (w: ScoreWindow) => void;
  onSort: (k: SortKey) => void;
  onMode: (m: SuggestMode) => void;
  onPick: (p: DraftBoardPlayer) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onEditSetup: () => void;
}) {
  const players = useMemo(() => props.board?.players ?? [], [props.board]);
  const drafted = useMemo(
    () => new Set(props.roster.map((p) => p.player_id)),
    [props.roster]
  );

  const poolVectors = useMemo(
    () => players.map((p) => vectorOf(p, props.windowMode)),
    [players, props.windowMode]
  );

  const rosterVectors = useMemo(() => {
    const byId = new Map(players.map((p) => [p.player_id, p]));
    return props.roster
      .map((r) => byId.get(r.player_id))
      .filter((p): p is DraftBoardPlayer => Boolean(p))
      .map((p) => vectorOf(p, props.windowMode));
  }, [players, props.roster, props.windowMode]);

  const gaps = useMemo(
    () => categoryGaps(rosterVectors, poolVectors),
    [rosterVectors, poolVectors]
  );

  const sorted = useMemo(() => {
    const rows = players.map((p) => ({
      player: p,
      score: vectorOf(p, props.windowMode)[props.sortKey],
      gp: gpOf(p, props.windowMode),
    }));
    rows.sort((a, b) => {
      const af = finite(a.score);
      const bf = finite(b.score);
      if (af !== bf) return af ? -1 : 1;
      if (af && bf && a.score !== b.score) return (b.score as number) - (a.score as number);
      const ag = finite(a.gp);
      const bg = finite(b.gp);
      if (ag !== bg) return ag ? -1 : 1;
      if (ag && bg && a.gp !== b.gp) return (b.gp as number) - (a.gp as number);
      return a.player.player_id.localeCompare(b.player.player_id, "en", {
        numeric: true,
      });
    });
    return rows;
  }, [players, props.sortKey, props.windowMode]);

  const suggestions = useMemo(() => {
    const candidates = players
      .filter((p) => !drafted.has(p.player_id))
      .map((p) => ({
        player: p,
        player_id: p.player_id,
        scores: vectorOf(p, props.windowMode),
      }));
    return rankSuggestions(candidates, props.suggestMode, gaps);
  }, [players, drafted, props.windowMode, props.suggestMode, gaps]);

  const top = suggestions[0];
  const neighbors = useMemo(() => {
    if (!props.board || !top) return [];
    const bucket =
      props.windowMode === "three_yr"
        ? props.board.similarity.three_yr
        : props.board.similarity.last;
    const list = bucket[top.player.player_id] ?? [];
    const names = new Map(players.map((p) => [p.player_id, p.full_name]));
    return list
      .filter((n) => n.rank >= 1 && n.rank <= SIMILARITY_K)
      .filter((n) => !drafted.has(n.player_id))
      .slice(0, SIMILARITY_K)
      .map((n) => ({
        ...n,
        name: names.get(n.player_id) ?? n.player_id,
      }));
  }, [props.board, props.windowMode, top, players, drafted]);

  const weightsNote = weightCaption(props.suggestMode, gaps);
  const windowLabel =
    props.windowMode === "last"
      ? `Last (${props.board?.last_season ?? "2025-26"})`
      : "3yr";

  return (
    <section>
      <div className={styles.boardHead}>
        <div>
          <p className={styles.kicker}>Draft board</p>
          <h1 className={styles.h1}>Player scores</h1>
          <p className={styles.cardHint}>
            {props.setup.format === "snake" ? "Snake" : "Straight"} · slot{" "}
            {props.setup.s} of {props.setup.n} · {props.setup.r} rounds · playoffs
            off ·{" "}
            <button type="button" className={styles.linkBtn} onClick={props.onEditSetup}>
              Edit setup
            </button>
          </p>
        </div>
        <div className={styles.headToggles}>
          <div
            className={styles.seg}
            role="group"
            aria-label="Score window"
          >
            <button
              type="button"
              className={props.windowMode === "last" ? styles.segOn : styles.segOff}
              aria-pressed={props.windowMode === "last"}
              onClick={() => props.onWindow("last")}
            >
              Last (2025-26)
            </button>
            <button
              type="button"
              className={props.windowMode === "three_yr" ? styles.segOn : styles.segOff}
              aria-pressed={props.windowMode === "three_yr"}
              onClick={() => props.onWindow("three_yr")}
            >
              3-year
            </button>
          </div>
          <div className={styles.seg} role="group" aria-label="Suggest mode">
            <button
              type="button"
              className={props.suggestMode === "cover" ? styles.segOn : styles.segOff}
              aria-pressed={props.suggestMode === "cover"}
              onClick={() => props.onMode("cover")}
            >
              Cover
            </button>
            <button
              type="button"
              className={props.suggestMode === "stack" ? styles.segOn : styles.segOff}
              aria-pressed={props.suggestMode === "stack"}
              onClick={() => props.onMode("stack")}
            >
              Stack
            </button>
          </div>
        </div>
      </div>

      {props.loading && !props.board ? <LoadingBlock /> : null}

      {props.loadError && !props.board ? (
        <div className={styles.errorCard} role="alert">
          <p className={styles.emptyTitle}>Couldn&apos;t load draft board</p>
          <p className={styles.emptyBody}>
            {props.loadError}. Setup and live picks on this device are unchanged.
          </p>
          <button type="button" className={styles.primary} onClick={props.onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {props.board ? (
        <>
          {props.windowMode === "three_yr" ? (
            <div className={styles.honestyRow}>
              <span className={styles.partialBadge}>
                {props.board.partial_count > 0 ? "Partial pool" : "Complete pool"} ·{" "}
                {props.board.board_size}
              </span>
              <p>
                3yr GP-weighted · missing seasons = n/a · coverage chip per row ·
                toggle always on · complete {props.board.complete_count} · partial{" "}
                {props.board.partial_count}
              </p>
            </div>
          ) : null}

          <div className={styles.chips} role="toolbar" aria-label="Sort categories">
            {SORT_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={props.sortKey === chip.key ? styles.chipOn : styles.chip}
                aria-pressed={props.sortKey === chip.key}
                onClick={() => props.onSort(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className={styles.layout}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.srOnly}>
                  Published {windowLabel} fantasy scores. Nulls show as n/a.
                </caption>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    {props.windowMode === "three_yr" ? <th>N/3</th> : null}
                    {SORT_CHIPS.map((chip) => (
                      <th
                        key={chip.key}
                        className={
                          chip.key === props.sortKey ? styles.colActive : styles.col
                        }
                        data-active={chip.key === props.sortKey ? "1" : "0"}
                      >
                        {chip.label}
                      </th>
                    ))}
                    <th className={styles.pickCol}> </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, index) => {
                    const scores = vectorOf(row.player, props.windowMode);
                    const onRoster = rosterHasPlayer(props.roster, row.player.player_id);
                    const n = row.player.three_yr?.n_seasons_used;
                    const muted =
                      props.windowMode === "three_yr" && !finite(scores[props.sortKey]);
                    const color = getTeamColors(row.player.team_abbreviation)?.chartPrimary;
                    return (
                      <tr key={row.player.player_id} className={muted ? styles.muted : undefined}>
                        <td>{finite(scores[props.sortKey]) ? index + 1 : "—"}</td>
                        <td>
                          <span className={styles.nameCell}>
                            <TeamMarkPip color={color} size={7} />
                            <span>{formatShortName(row.player.full_name)}</span>
                            {row.player.team_abbreviation ? (
                              <span className={styles.abbr}>
                                {row.player.team_abbreviation}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {props.windowMode === "three_yr" ? (
                          <td>
                            <span
                              className={
                                n === 3
                                  ? styles.cov3
                                  : n === 2
                                    ? styles.cov2
                                    : styles.cov1
                              }
                            >
                              {n == null ? "n/a" : `${n}/3`}
                            </span>
                          </td>
                        ) : null}
                        {SORT_CHIPS.map((chip) => (
                          <td
                            key={chip.key}
                            className={
                              chip.key === props.sortKey ? styles.colActive : styles.col
                            }
                            data-active={chip.key === props.sortKey ? "1" : "0"}
                          >
                            {fmtScore(scores[chip.key])}
                          </td>
                        ))}
                        <td className={styles.pickCol}>
                          <button
                            type="button"
                            className={onRoster ? styles.pickOn : styles.pick}
                            onClick={() => props.onPick(row.player)}
                          >
                            {onRoster ? "On team" : "Draft"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <aside className={styles.rail}>
              <LivePanel
                roster={props.roster}
                players={players}
                windowMode={props.windowMode}
                gaps={gaps}
                onRemove={props.onRemove}
                onClear={props.onClear}
              />
              <SuggestPanel
                mode={props.suggestMode}
                weightsNote={weightsNote}
                suggestions={suggestions.slice(0, 8)}
                neighbors={neighbors}
                windowMode={props.windowMode}
                onPick={props.onPick}
                roster={props.roster}
              />
            </aside>
          </div>

          <section id="live-team" className={styles.profile} aria-label="Team category profile">
            <div className={styles.profileHead}>
              <div>
                <p className={styles.kicker}>Live roster</p>
                <h2 className={styles.h2}>Team category profile</h2>
                <p className={styles.cardHint}>
                  {props.roster.length} picks · gaps vs board pool mean · {windowLabel}
                </p>
              </div>
              <span className={styles.windowPill}>{windowLabel}</span>
            </div>
            <GapList gaps={gaps} empty={props.roster.length === 0} />
          </section>
        </>
      ) : null}
    </section>
  );
}

function LivePanel(props: {
  roster: RosterPlayer[];
  players: DraftBoardPlayer[];
  windowMode: ScoreWindow;
  gaps: CatGap[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const byId = new Map(props.players.map((p) => [p.player_id, p]));
  const shown = props.gaps.filter((g) => g.gap != null).slice(0, 3);
  const { data: hotCold } = useHotCold();
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          Live team
          {props.windowMode === "three_yr" ? " · 3yr" : ""}
        </h2>
        <span className={styles.count}>
          {props.roster.length}/{TEAM_ROSTER_MAX}
        </span>
      </div>
      {props.roster.length === 0 ? (
        <p className={styles.soft}>
          No picks yet. Draft from the board — strengths and weaknesses show up
          against the pool. Nothing is invented.
        </p>
      ) : (
        <ul className={styles.liveList}>
          {props.roster.map((r) => {
            const player = byId.get(r.player_id);
            // Pick card: OFF/DEF/EFF + last season's overall (score_o1, 2025-26 Last).
            const last = player ? player.scores : null;
            const hot = hotCold?.hot_cold.players[r.player_id];
            return (
              <li key={r.player_id} className={styles.pickCard}>
                <span className={styles.pickMain}>
                  <span>{formatShortName(r.full_name)}</span>
                  <span className={styles.pickScores}>
                    <span>OFF {fmtScore(last?.off)}</span>
                    <span>DEF {fmtScore(last?.def)}</span>
                    <span>EFF {fmtScore(last?.eff)}</span>
                    <span>O1 {fmtScore(last?.o1)}</span>
                  </span>
                  <span
                    className={styles.pickHot}
                    title="Hot/cold: 2025-26 vs own 2023-24–2025-26 average, 9 stats, TOV down = hot. Blank under 20 GP / 200 min or fewer than 6 of 9."
                  >
                    hot/cold {hotCold ? fmtHotPct(hot?.hot_read) : "…"}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => props.onRemove(r.player_id)}
                  aria-label={`Remove ${r.full_name}`}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 0 ? (
        <ul className={styles.miniGaps} aria-label="Sample category gaps">
          {shown.map((g) => (
            <li key={g.key}>
              <span>{g.label}</span>
              <span className={styles.barTrack}>
                <span
                  className={
                    g.labelSw === "S"
                      ? styles.barS
                      : g.labelSw === "W"
                        ? styles.barW
                        : styles.barN
                  }
                  style={{ width: barWidth(g.gap) }}
                />
              </span>
              <span className={styles.sw}>{g.labelSw}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {props.roster.length > 0 ? (
        <button type="button" className={styles.textBtn} onClick={props.onClear}>
          Clear roster
        </button>
      ) : null}
    </div>
  );
}

function SuggestPanel(props: {
  mode: SuggestMode;
  weightsNote: string;
  suggestions: ReturnType<typeof rankSuggestions<{ player: DraftBoardPlayer; player_id: string; scores: ScoreVector }>>;
  neighbors: { player_id: string; name: string; similarity: number; rank: number }[];
  windowMode: ScoreWindow;
  onPick: (p: DraftBoardPlayer) => void;
  roster: RosterPlayer[];
}) {
  const plus = props.mode === "stack" ? "++" : "+";
  const verb = props.mode === "stack" ? "stacks" : "covers";
  return (
    <div className={styles.card} id="suggest">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          {props.mode === "cover" ? "Suggest · Cover" : "Suggest · Stack"}
        </h2>
        <span className={styles.cardHint}>
          {props.mode === "cover" ? "lift weak cats" : "extend strong cats"}
        </span>
      </div>
      <p className={styles.cardHint}>weights on {props.weightsNote}</p>
      {props.suggestions.length === 0 ? (
        <p className={styles.soft}>No eligible players with a full 9-cat vector.</p>
      ) : (
        <ol className={styles.suggestList}>
          {props.suggestions.map((row, i) => {
            const onRoster = rosterHasPlayer(props.roster, row.player.player_id);
            return (
              <li key={row.player.player_id}>
                <button
                  type="button"
                  className={styles.suggestBtn}
                  onClick={() => props.onPick(row.player)}
                  disabled={onRoster}
                >
                  <span className={styles.suggestRank}>{i + 1}</span>
                  <span className={styles.suggestMain}>
                    <span>{formatShortName(row.player.full_name)}</span>
                    <span className={styles.suggestSub}>
                      {verb} {row.focusLabel ?? "—"} · O1 {fmtScore(row.o1)}
                    </span>
                  </span>
                  <span className={props.mode === "stack" ? styles.stackTag : styles.coverTag}>
                    {row.focusLabel ?? "—"}
                    {plus}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className={styles.simBlock}>
        <p className={styles.cardHint}>
          Similar players · secondary · cosine on 9-cat{" "}
          {props.windowMode === "three_yr" ? "3yr" : "Last"} · K={SIMILARITY_K}
        </p>
        <div className={styles.simChips}>
          {props.neighbors.length === 0 ? (
            <span className={styles.soft}>No neighbor chips</span>
          ) : (
            props.neighbors.map((n) => (
              <span key={n.player_id} className={styles.simChip} title={n.similarity.toFixed(3)}>
                ~ {formatShortName(n.name)}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function GapList({ gaps, empty }: { gaps: CatGap[]; empty: boolean }) {
  if (empty) {
    return (
      <p className={styles.soft}>
        Live team is empty. Category gaps stay blank until you draft — no zero-filled
        profile.
      </p>
    );
  }
  return (
    <ul className={styles.gapList}>
      {gaps.map((g) => (
        <li key={g.key}>
          <span className={styles.gapLabel}>{g.label}</span>
          <span className={styles.barTrackWide}>
            {g.gap == null ? null : (
              <span
                className={
                  g.labelSw === "S"
                    ? styles.barS
                    : g.labelSw === "W"
                      ? styles.barW
                      : styles.barN
                }
                style={{ width: barWidth(g.gap) }}
              />
            )}
          </span>
          <span className={styles.sw}>{g.labelSw ?? "—"}</span>
          <span className={styles.gapNum}>{g.gap == null ? "n/a" : fmtGap(g.gap)}</span>
        </li>
      ))}
    </ul>
  );
}

function barWidth(gap: number | null): string {
  if (!finite(gap)) return "0%";
  const mag = Math.min(100, Math.abs(gap) * 4);
  return `${Math.max(8, mag)}%`;
}
