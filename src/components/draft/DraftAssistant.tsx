"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StatLine } from "@/components/StatLine";
import { reasonLine, teamMeans, weakCats } from "@/lib/draftReasons";
import { baselinesFor } from "@/lib/teamRollup";
import { TeamMarkPip } from "@/components/TeamMarkPip";
import { formatShortName } from "@/lib/formatName";
import { nameMatches } from "@/lib/normalize";
import { getTeamColors } from "@/lib/teamColors";
import type { DraftBoardPayload, DraftBoardPlayer } from "@/lib/loadDraftBoard";
import {
  DEFAULT_ROUNDS,
  SORT_CHIPS,
  categoryGaps,
  finite,
  rankSuggestions,
  validateSetup,
  yourPicks,
  type DraftFormat,
  type DraftSetup,
  type ScoreVector,
  type SortKey,
  type SuggestMode,
} from "@/lib/draftMath";
import {
  readHistory,
  readPrefs,
  readTaken,
  writeHistory,
  writePrefs,
  writeTaken,
  type DraftAction,
  type TakenPlayer,
} from "@/lib/draftPicks";
import {
  clearTeamRoster,
  readTeamRoster,
  removeTeamRosterPlayer,
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

const PAGE_ROWS = 30;

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

const EMPTY_VECTOR: ScoreVector = {
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
};

function vectorOf(player: DraftBoardPlayer, window: ScoreWindow): ScoreVector {
  if (window === "three_yr") return player.three_yr?.scores ?? EMPTY_VECTOR;
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
  const [suggestMode, setSuggestMode] = useState<SuggestMode>("stack");
  const [sortKey, setSortKey] = useState<SortKey>("o1");
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [taken, setTaken] = useState<TakenPlayer[]>([]);
  const [history, setHistory] = useState<DraftAction[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const [board, setBoard] = useState<DraftBoardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const saved = readSetup();
    setRoster(readTeamRoster());
    setTaken(readTaken());
    setHistory(readHistory());
    const prefs = readPrefs();
    setWindowMode(prefs.windowMode);
    setSuggestMode(prefs.suggestMode);
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
      if (!res.ok) throw new Error(body.error || "Couldn't load draft board");
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
    }, 2400);
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

  function changeWindow(w: ScoreWindow) {
    setWindowMode(w);
    writePrefs({ windowMode: w, suggestMode });
  }

  function changeMode(m: SuggestMode) {
    setSuggestMode(m);
    writePrefs({ windowMode, suggestMode: m });
  }

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

  function pushHistory(a: DraftAction) {
    setHistory(writeHistory([...readHistory(), a]));
  }

  function onMine(player: DraftBoardPlayer) {
    const result = upsertTeamRosterPlayer({
      player_id: player.player_id,
      full_name: player.full_name,
      team_abbreviation: player.team_abbreviation,
    });
    setRoster(result.roster);
    if (!result.ok) {
      setToast(null);
      setToastError(`Roster is full (${TEAM_ROSTER_MAX}). Remove someone first. Nothing was dropped.`);
      return;
    }
    if (result.added) pushHistory({ t: "mine", player_id: player.player_id });
    setToastError(null);
    setToast(`${formatShortName(player.full_name)} · mine`);
  }

  function onTaken(player: DraftBoardPlayer) {
    const current = readTaken();
    if (!current.some((p) => p.player_id === player.player_id)) {
      setTaken(writeTaken([...current, { player_id: player.player_id, full_name: player.full_name }]));
      pushHistory({ t: "taken", player_id: player.player_id });
    }
    setToastError(null);
    setToast(`${formatShortName(player.full_name)} · taken`);
  }

  function onUndo() {
    const hist = readHistory();
    while (hist.length > 0) {
      const last = hist.pop()!;
      if (last.t === "mine") {
        const r = readTeamRoster();
        if (!r.some((p) => p.player_id === last.player_id)) continue;
        setRoster(removeTeamRosterPlayer(last.player_id));
        const name = r.find((p) => p.player_id === last.player_id)?.full_name ?? "";
        setToast(`Undid mine · ${formatShortName(name)}`);
      } else {
        const t = readTaken();
        const hit = t.find((p) => p.player_id === last.player_id);
        if (!hit) continue;
        setTaken(writeTaken(t.filter((p) => p.player_id !== last.player_id)));
        setToast(`Undid taken · ${formatShortName(hit.full_name)}`);
      }
      setHistory(writeHistory(hist));
      setToastError(null);
      return;
    }
    setHistory(writeHistory([]));
    setToast("Nothing to undo");
  }

  function onRemove(player_id: string) {
    setRoster(removeTeamRosterPlayer(player_id));
    setToast("Removed");
    setToastError(null);
  }

  function onResetDraft() {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Reset the draft? This clears your roster and taken picks on this device.");
      if (!ok) return;
    }
    setRoster(clearTeamRoster());
    setTaken(writeTaken([]));
    setHistory(writeHistory([]));
    setToast("Draft reset");
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
      {phase === "empty" ? <EmptyBlock onOpen={() => setPhase("setup")} /> : null}

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
          windowMode={windowMode}
          suggestMode={suggestMode}
          onWindow={changeWindow}
          onMode={changeMode}
          board={board}
          onReset={onResetDraft}
          hasPicks={roster.length + taken.length > 0}
        />
      ) : null}

      {phase === "board" && setup ? (
        <BoardBlock
          setup={setup}
          windowMode={windowMode}
          sortKey={sortKey}
          suggestMode={suggestMode}
          roster={roster}
          taken={taken}
          canUndo={history.length > 0}
          board={board}
          loading={loading}
          loadError={loadError}
          onSort={setSortKey}
          onMine={onMine}
          onTaken={onTaken}
          onUndo={onUndo}
          onRemove={onRemove}
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
  windowMode: ScoreWindow;
  suggestMode: SuggestMode;
  onWindow: (w: ScoreWindow) => void;
  onMode: (m: SuggestMode) => void;
  board: DraftBoardPayload | null;
  onReset: () => void;
  hasPicks: boolean;
}) {
  return (
    <section aria-labelledby="draft-setup-title">
      <h1 className={styles.h1} id="draft-setup-title">
        Draft setup
      </h1>
      <div className={styles.setupGrid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>League</h2>
          <label className={styles.field}>
            <span>Teams</span>
            <input
              inputMode="numeric"
              value={props.nRaw}
              onChange={(e) => props.onN(e.target.value)}
              aria-label="Number of teams"
            />
          </label>
          <label className={styles.field}>
            <span>Your slot</span>
            <input
              inputMode="numeric"
              value={props.sRaw}
              onChange={(e) => props.onS(e.target.value)}
              aria-label="Your draft slot"
            />
          </label>
          <label className={styles.field}>
            <span>Rounds</span>
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
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Board</h2>
          <div className={styles.field}>
            <span>Scores</span>
            <div className={styles.seg} role="group" aria-label="Score window">
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
          </div>
          {props.windowMode === "three_yr" ? (
            <p className={styles.cardHint}>
              3-year is GP-weighted. Each row shows seasons used as a small N/3; missing seasons
              are n/a
              {props.board
                ? ` (${props.board.complete_count} complete, ${props.board.partial_count} partial).`
                : "."}
            </p>
          ) : null}
          <div className={styles.field}>
            <span>Suggestions</span>
            <div className={styles.seg} role="group" aria-label="Suggest mode">
              <button
                type="button"
                className={props.suggestMode === "cover" ? styles.segOn : styles.segOff}
                aria-pressed={props.suggestMode === "cover"}
                onClick={() => props.onMode("cover")}
              >
                Cover weak cats
              </button>
              <button
                type="button"
                className={props.suggestMode === "stack" ? styles.segOn : styles.segOff}
                aria-pressed={props.suggestMode === "stack"}
                onClick={() => props.onMode("stack")}
              >
                Stack strong cats
              </button>
            </div>
          </div>
          {props.picks ? (
            <p className={styles.cardHint}>
              Your picks: {props.picks.map((p) => `#${p.overall}`).join(" · ")}
            </p>
          ) : null}
          {props.hasPicks ? (
            <button type="button" className={styles.textBtn} onClick={props.onReset}>
              Reset draft
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.setupActions}>
        <button type="button" className={styles.primary} onClick={props.onContinue}>
          Save and open board
        </button>
      </div>
    </section>
  );
}

function LoadingBlock() {
  return (
    <section aria-busy="true" aria-label="Loading draft board">
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
  taken: TakenPlayer[];
  canUndo: boolean;
  board: DraftBoardPayload | null;
  loading: boolean;
  loadError: string | null;
  onSort: (k: SortKey) => void;
  onMine: (p: DraftBoardPlayer) => void;
  onTaken: (p: DraftBoardPlayer) => void;
  onUndo: () => void;
  onRemove: (id: string) => void;
  onRetry: () => void;
  onEditSetup: () => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_ROWS);
  const players = useMemo(() => props.board?.players ?? [], [props.board]);
  const gone = useMemo(
    () =>
      new Set([
        ...props.roster.map((p) => p.player_id),
        ...props.taken.map((p) => p.player_id),
      ]),
    [props.roster, props.taken]
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
  const gaps = useMemo(() => categoryGaps(rosterVectors, poolVectors), [rosterVectors, poolVectors]);

  const available = useMemo(() => {
    const rows = players
      .filter((p) => !gone.has(p.player_id))
      .map((p) => ({
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
      return a.player.player_id.localeCompare(b.player.player_id, "en", { numeric: true });
    });
    return rows;
  }, [players, gone, props.sortKey, props.windowMode]);

  const q = query.trim();
  const shown = useMemo(
    () => (q ? available.filter((r) => nameMatches(r.player.full_name, q)) : available),
    [available, q]
  );

  const suggestions = useMemo(() => {
    const candidates = players
      .filter((p) => !gone.has(p.player_id))
      .map((p) => ({ player: p, player_id: p.player_id, scores: vectorOf(p, props.windowMode) }));
    return rankSuggestions(candidates, props.suggestMode, gaps);
  }, [players, gone, props.windowMode, props.suggestMode, gaps]);

  // Draft v3: one-line reason per suggestion from You vs Avg (Last scores, same as the team strip).
  const { data: hotColdBase } = useHotCold();
  const weak = useMemo(() => {
    const byId = new Map(players.map((p) => [p.player_id, p]));
    const rosterLast = props.roster
      .map((r) => byId.get(r.player_id)?.scores)
      .filter((v): v is DraftBoardPlayer["scores"] => Boolean(v));
    const avg = baselinesFor(hotColdBase?.baselines.teams, props.setup.n, props.setup.s).league?.scores;
    return weakCats(teamMeans(rosterLast), avg ?? null);
  }, [players, props.roster, hotColdBase, props.setup]);
  const reasons = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const row of suggestions.slice(0, 6)) {
      m.set(row.player.player_id, reasonLine(row.player.scores, weak, props.roster.length > 0));
    }
    return m;
  }, [suggestions, weak, props.roster.length]);

  // Pick clock: overall pick now, and how many picks until yours (DRAFT-RULES §1).
  const picksMade = props.roster.length + props.taken.length;
  const current = picksMade + 1;
  const yours = useMemo(() => yourPicks(props.setup).map((p) => p.overall), [props.setup]);
  const nextYours = yours[props.roster.length] ?? null;
  const until = nextYours == null ? null : nextYours - current;
  const sortLabel = SORT_CHIPS.find((c) => c.key === props.sortKey)?.label ?? "O1";

  function act(fn: (p: DraftBoardPlayer) => void, p: DraftBoardPlayer) {
    fn(p);
    setQuery("");
  }

  return (
    <section>
      <div className={styles.bar} role="region" aria-label="Pick clock and search">
        <div className={styles.barRow}>
          <div className={styles.clock}>
            <span className={styles.clockNum}>Pick {current}</span>
            <span className={until != null && until <= 0 ? styles.clockYou : styles.clockSub}>
              {nextYours == null
                ? "Your picks are done"
                : until != null && until <= 0
                  ? "You're up"
                  : `${until} until you (#${nextYours})`}
            </span>
          </div>
          <div className={styles.barActions}>
            <button
              type="button"
              className={styles.barBtn}
              onClick={props.onUndo}
              disabled={!props.canUndo}
            >
              Undo
            </button>
            <button type="button" className={styles.barBtn} onClick={props.onEditSetup}>
              Setup
            </button>
          </div>
        </div>
        <input
          className={styles.search}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search players"
          aria-label="Search players"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_ROWS);
          }}
        />
      </div>

      {props.loading && !props.board ? <LoadingBlock /> : null}

      {props.loadError && !props.board ? (
        <div className={styles.errorCard} role="alert">
          <p className={styles.emptyTitle}>Couldn&apos;t load draft board</p>
          <p className={styles.emptyBody}>
            {props.loadError}. Setup and picks on this device are unchanged.
          </p>
          <button type="button" className={styles.primary} onClick={props.onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {props.board ? (
        <div className={styles.layout}>
          <div className={styles.boardCol}>
            <div className={styles.chips} role="toolbar" aria-label="Sort by">
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
            <div className={styles.boardWrap}>
              <table className={styles.board}>
                <caption className={styles.srOnly}>
                  Available players, sorted by {sortLabel}. Nulls show as n/a.
                </caption>
                <thead>
                  <tr>
                    <th className={styles.thName}>Player</th>
                    <th className={styles.thScore}>{sortLabel}</th>
                    <th className={styles.thAct}>
                      <span className={styles.srOnly}>Mine or taken</span>
                    </th>
                    {SORT_CHIPS.filter((c) => c.key !== props.sortKey).map((chip) => (
                      <th key={chip.key} className={styles.thMore}>
                        {chip.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.slice(0, limit).map((row) => {
                    const scores = vectorOf(row.player, props.windowMode);
                    const n = row.player.three_yr?.n_seasons_used;
                    const color = getTeamColors(row.player.team_abbreviation)?.chartPrimary;
                    return (
                      <tr key={row.player.player_id}>
                        <td className={styles.tdName}>
                          <span className={styles.nameCell}>
                            <TeamMarkPip color={color} size={7} />
                            <span className={styles.nameText}>
                              {formatShortName(row.player.full_name)}
                            </span>
                            {props.windowMode === "three_yr" ? (
                              <span className={styles.cov}>{n == null ? "n/a" : `${n}/3`}</span>
                            ) : null}
                          </span>
                        </td>
                        <td className={styles.tdScore}>{fmtScore(scores[props.sortKey])}</td>
                        <td className={styles.tdAct}>
                          <span className={styles.actPair}>
                            <button
                              type="button"
                              className={styles.mineBtn}
                              onClick={() => act(props.onMine, row.player)}
                              aria-label={`Mine: ${row.player.full_name}`}
                            >
                              Mine
                            </button>
                            <button
                              type="button"
                              className={styles.takenBtn}
                              onClick={() => act(props.onTaken, row.player)}
                              aria-label={`Taken: ${row.player.full_name}`}
                            >
                              Taken
                            </button>
                          </span>
                        </td>
                        {SORT_CHIPS.filter((c) => c.key !== props.sortKey).map((chip) => (
                          <td key={chip.key} className={styles.tdMore}>
                            {fmtScore(scores[chip.key])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shown.length === 0 ? (
                <p className={styles.soft}>No available player matches “{q}”.</p>
              ) : null}
            </div>
            {shown.length > limit ? (
              <button
                type="button"
                className={styles.moreBtn}
                onClick={() => setLimit((l) => l + PAGE_ROWS)}
              >
                Show more ({shown.length - limit})
              </button>
            ) : null}
          </div>

          <aside className={styles.rail}>
            <LivePanel roster={props.roster} players={players} onRemove={props.onRemove} />
            <SuggestPanel
              mode={props.suggestMode}
              suggestions={suggestions.slice(0, 6)}
              reasons={reasons}
              onMine={props.onMine}
            />
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function LivePanel(props: {
  roster: RosterPlayer[];
  players: DraftBoardPlayer[];
  onRemove: (id: string) => void;
}) {
  const byId = new Map(props.players.map((p) => [p.player_id, p]));
  const { data: hotCold } = useHotCold();
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Your team</h2>
        <span className={styles.count}>
          {props.roster.length}/{TEAM_ROSTER_MAX}
        </span>
      </div>
      {props.roster.length === 0 ? (
        <p className={styles.soft}>Tap Mine on the board to add your picks.</p>
      ) : (
        <ul className={styles.pickList}>
          {props.roster.map((r) => {
            const player = byId.get(r.player_id);
            // Pick card: OFF/DEF/EFF + last season's overall (score_o1, 2025-26 Last).
            const last = player ? player.scores : null;
            const hot = hotCold?.hot_cold.players[r.player_id];
            return (
              <li key={r.player_id} className={styles.pickCard}>
                <div className={styles.pickTop}>
                  <span className={styles.pickName}>{formatShortName(r.full_name)}</span>
                  <button
                    type="button"
                    className={styles.quietRemove}
                    onClick={() => props.onRemove(r.player_id)}
                    aria-label={`Remove ${r.full_name}`}
                  >
                    ×
                  </button>
                </div>
                <dl className={styles.pickScores}>
                  {(
                    [
                      ["OFF", last?.off],
                      ["DEF", last?.def],
                      ["EFF", last?.eff],
                      ["O1", last?.o1],
                    ] as [string, number | null | undefined][]
                  ).map(([label, v]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{fmtScore(v)}</dd>
                    </div>
                  ))}
                </dl>
                <StatLine values={player?.avgs ?? null} />
                <p
                  className={styles.pickHot}
                  title="2025-26 vs his own 3-year average, 9 stats, fewer turnovers = hot. Blank under 20 GP / 200 min or fewer than 6 of 9."
                >
                  hot/cold {hotCold ? fmtHotPct(hot?.hot_read) : "…"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SuggestPanel(props: {
  mode: SuggestMode;
  suggestions: ReturnType<typeof rankSuggestions<{ player: DraftBoardPlayer; player_id: string; scores: ScoreVector }>>;
  reasons?: Map<string, string | null>;
  onMine: (p: DraftBoardPlayer) => void;
}) {
  return (
    <div className={styles.card} id="suggest">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Suggested</h2>
        <span className={styles.count}>{props.mode === "cover" ? "cover" : "stack"}</span>
      </div>
      {props.suggestions.length === 0 ? (
        <p className={styles.soft}>No eligible players with a full 9-cat vector.</p>
      ) : (
        <ol className={styles.suggestList}>
          {props.suggestions.map((row) => (
            <li key={row.player.player_id}>
              <span className={styles.suggestMain}>
                <span className={styles.pickName}>{formatShortName(row.player.full_name)}</span>
                <span className={styles.suggestSub}>
                  {row.focusLabel ?? "—"} · O1 {fmtScore(row.o1)}
                </span>
                {props.reasons?.get(row.player.player_id) ? (
                  <span className={styles.suggestReason}>{props.reasons.get(row.player.player_id)}</span>
                ) : null}
              </span>
              <button
                type="button"
                className={styles.mineBtn}
                onClick={() => props.onMine(row.player)}
                aria-label={`Mine: ${row.player.full_name}`}
              >
                Mine
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
