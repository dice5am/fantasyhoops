"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DraftBoardPayload } from "@/lib/loadDraftBoard";
import type { DraftSetup } from "@/lib/draftMath";
import type { RosterPlayer } from "@/lib/teamRoster";
import {
  baselinesFor,
  computeTeamRollup,
  fmtHotPct,
  type MeanCell,
  type TeamScoreSource,
} from "@/lib/teamRollup";
import { useHotCold } from "@/lib/useHotCold";
import { SCORE_TO_HOT, type NineScoreKey } from "@/types/hot_cold";
import explorer from "@/components/PlayerExplorer.module.css";
import styles from "./TeamRollupPanel.module.css";

/**
 * Team rollup — OFF/DEF/EFF + nine category scores + team hot/cold, recomputed
 * from fantasyhoops.teamRoster on every pick (HOT-COLD.md "Team view").
 * Chart = the Players 9-cat radar (same Recharts config + radarBox styling,
 * spoke order PTS·AST·3PM·REB·STL·BLK·FG·FT·TOV), here on published 0–100
 * category scores with three lines: your roster, average team (N), your slot (N, S).
 * Baselines are the published baseline_teams mart. Nulls stay blank.
 */

/** Spoke order matches the Players radar (STAT_OPTIONS). */
const SPOKES: { key: NineScoreKey; label: string }[] = [
  { key: "pts", label: "PTS" },
  { key: "ast", label: "AST" },
  { key: "fg3m", label: "3PM" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "fg_f1", label: "FG" },
  { key: "ft_f1", label: "FT" },
  { key: "tov", label: "TOV" },
];

let boardInflight: Promise<DraftBoardPayload> | null = null;
function fetchBoard(): Promise<DraftBoardPayload> {
  if (!boardInflight) {
    boardInflight = fetch("/api/draft-board", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json()) as DraftBoardPayload & { error?: string };
        if (!res.ok) throw new Error(body.error || `draft-board ${res.status}`);
        return body;
      })
      .catch((e) => {
        boardInflight = null;
        throw e;
      });
  }
  return boardInflight;
}

function fmtScore(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "n/a";
}

export function TeamRollupPanel(props: {
  roster: RosterPlayer[];
  setup: DraftSetup | null;
}) {
  const [board, setBoard] = useState<DraftBoardPayload | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const { data: hotCold, error: hotError } = useHotCold();

  useEffect(() => {
    let alive = true;
    fetchBoard()
      .then((b) => alive && setBoard(b))
      .catch((e) => alive && setBoardError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const lastScores = useMemo(() => {
    const m = new Map<string, TeamScoreSource>();
    for (const p of board?.players ?? []) {
      m.set(p.player_id, {
        off: p.scores.off,
        def: p.scores.def,
        eff: p.scores.eff,
        pts: p.scores.pts,
        ast: p.scores.ast,
        fg3m: p.scores.fg3m,
        reb: p.scores.reb,
        stl: p.scores.stl,
        blk: p.scores.blk,
        tov: p.scores.tov,
        fg_f1: p.scores.fg_f1,
        ft_f1: p.scores.ft_f1,
      });
    }
    return m;
  }, [board]);

  const rollup = useMemo(
    () =>
      computeTeamRollup(
        props.roster.map((r) => r.player_id),
        lastScores,
        hotCold?.hot_cold.players
      ),
    [props.roster, lastScores, hotCold]
  );

  const base = useMemo(
    () => baselinesFor(hotCold?.baselines.teams, props.setup?.n, props.setup?.s),
    [hotCold, props.setup]
  );

  const empty = props.roster.length === 0;
  const radarData = SPOKES.map((s) => ({
    cat: s.label,
    you: empty ? null : rollup.nine[s.key].mean,
    avg: base.league?.scores[s.key] ?? null,
    slot: base.slot?.scores[s.key] ?? null,
  }));

  const n = props.setup?.n;
  const s = props.setup?.s;
  const avgName = n ? `Avg team · ${n} teams` : "Avg team";
  const slotName = n && s ? `Slot #${s} avg` : "Slot avg";

  return (
    <section className={styles.panel} aria-label="Team categories">
      <div className={styles.head}>
        <div>
          <h2 className={styles.h2}>Your team</h2>
        </div>
        <span className={styles.meta}>
          {props.roster.length}/15
        </span>
      </div>

      <div className={styles.aggRow}>
        {(
          [
            ["OFF", rollup.off],
            ["DEF", rollup.def],
            ["EFF", rollup.eff],
          ] as [string, MeanCell][]
        ).map(([label, cell]) => (
          <div key={label} className={styles.agg}>
            <span className={styles.aggLabel}>{label}</span>
            <span className={styles.aggVal}>{empty ? "—" : fmtScore(cell.mean)}</span>
          </div>
        ))}
      </div>
      <p className={styles.hotQuiet}>
        hot/cold {empty ? "—" : fmtHotPct(rollup.hot_read.mean)}
      </p>

      {boardError || hotError ? (
        <p className={styles.error} role="alert">
          {boardError ?? hotError}
        </p>
      ) : null}

      <div className={explorer.radarBox}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis dataKey="cat" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={avgName}
              dataKey="avg"
              stroke="rgba(247, 231, 206, 0.55)"
              fill="rgba(247, 231, 206, 0.22)"
              fillOpacity={0.45}
              strokeOpacity={0.55}
              strokeWidth={1.25}
              isAnimationActive={false}
            />
            <Radar
              name={slotName}
              dataKey="slot"
              stroke="#B8956A"
              fill="#B8956A"
              fillOpacity={0.08}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              isAnimationActive={false}
            />
            {!empty ? (
              <Radar
                name="Your roster"
                dataKey="you"
                stroke="#FFFCF5"
                fill="#F7E7CE"
                fillOpacity={0.18}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ) : null}
            <Legend wrapperStyle={{ fontSize: 12, maxWidth: "100%" }} />
            <Tooltip
              wrapperStyle={{ maxWidth: 280, zIndex: 20 }}
              contentStyle={{
                background: "rgba(12,14,22,0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                color: "#f1f5f9",
              }}
              formatter={(value: number | string, name: string) => {
                if (value == null || value === "") return ["n/a", name];
                return [`${Number(value).toFixed(0)} / 100`, name];
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <table className={styles.nine}>
        <thead>
          <tr>
            <th scope="col">Cat</th>
            <th scope="col">You</th>
            <th scope="col">Avg</th>
            <th scope="col">Slot</th>
            <th scope="col" className={styles.hotHead}>
              hot
            </th>
          </tr>
        </thead>
        <tbody>
          {SPOKES.map((sp) => {
            const hk = SCORE_TO_HOT[sp.key];
            const hot = rollup.hot[hk];
            return (
              <tr key={sp.key}>
                <th scope="row">{sp.label}</th>
                <td>{empty ? "—" : fmtScore(rollup.nine[sp.key].mean)}</td>
                <td>{fmtScore(base.league?.scores[sp.key])}</td>
                <td>{fmtScore(base.slot?.scores[sp.key])}</td>
                <td className={styles.hotCell}>
                  {empty ? "—" : fmtHotPct(hot.mean)}
                  {!empty && hot.n > 0 ? <span className={styles.hotN}> ·{hot.n}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.foot}>
        Your team is the average of your picks&apos; 2025-26 scores. Average team and slot
        average come from simulated snake drafts, 2021-22 to 2025-26. Hot/cold is the percent
        versus each player&apos;s own 3-year average, and fewer turnovers count as hot.
      </p>
    </section>
  );
}
