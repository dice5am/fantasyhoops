"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
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
import type { LeagueContextPayload, LeaderEntry } from "@/lib/leagueAggregates";
import {
  RADAR_NORM_NOTE,
  RADAR_SPOKE_ORDER,
  STAT_LABEL,
  STAT_OPTIONS,
  TRIPTYCH,
  normalizeRadarValue,
  type RadarStatKey,
} from "@/lib/radar";
import type { SeasonTypeScope } from "@/types/season_player_averages";
import { SCOPE_OPTIONS, SEASON_OPTIONS } from "@/types/season_player_averages";
import { UNIVERSE_OPTIONS, type UniverseId } from "@/lib/universe";
import styles from "./HomeDashboard.module.css";

type Props = {
  context: LeagueContextPayload;
  season: string;
  scope: SeasonTypeScope;
  universe: UniverseId;
};

function fmtStat(key: RadarStatKey, v: number | null | undefined): string {
  if (v == null || Number.isNaN(Number(v))) return "—";
  if (key === "fg_pct" || key === "ft_pct") return formatPct(v);
  return formatAvg(v);
}

function LeaderList({
  leaders,
  stat,
}: {
  leaders: LeaderEntry[];
  stat: RadarStatKey;
}) {
  if (!leaders.length) {
    return <p className={styles.emptyLeaders}>No leaders yet</p>;
  }
  return (
    <ol className={styles.leaderList}>
      {leaders.map((L, i) => (
        <li key={L.player_id}>
          <Link
            href={`/player?player_id=${encodeURIComponent(L.player_id)}&name=${encodeURIComponent(L.full_name)}`}
            className={styles.leaderLink}
            style={{ ["--leader-color" as string]: L.chart_color }}
          >
            <span className={styles.leaderRank}>{i + 1}</span>
            <span
              className={styles.leaderDot}
              style={{ background: L.chart_color }}
              aria-hidden
            />
            <span className={styles.leaderName}>{L.full_name}</span>
            <span className={styles.leaderVal}>{fmtStat(stat, L.value)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function TriptychPanel({
  title,
  keys,
  leagueAvgs,
  leaders,
}: {
  title: string;
  keys: readonly RadarStatKey[];
  leagueAvgs: LeagueContextPayload["league_avgs"];
  leaders: LeagueContextPayload["leaders"];
}) {
  return (
    <section className={styles.triPanel} aria-label={title}>
      <h2 className={styles.triTitle}>{title}</h2>
      <div className={styles.chipRow}>
        {keys.map((k) => (
          <div key={k} className={styles.chip}>
            <span className={styles.chipLabel}>{STAT_LABEL[k]}</span>
            <span className={styles.chipVal}>{fmtStat(k, leagueAvgs[k])}</span>
          </div>
        ))}
      </div>
      {keys.map((k) => (
        <div key={k} className={styles.leaderBlock}>
          <h3 className={styles.leaderHeading}>
            Top {STAT_LABEL[k]}
            {k === "tov" ? " (low)" : ""}
          </h3>
          <LeaderList leaders={leaders[k] ?? []} stat={k} />
        </div>
      ))}
    </section>
  );
}

export function HomeDashboard({ context, season, scope, universe }: Props) {
  const router = useRouter();

  const radarData = useMemo(() => {
    return RADAR_SPOKE_ORDER.map((key) => {
      const raw = context.league_avgs[key];
      const opt = STAT_OPTIONS.find((s) => s.key === key);
      return {
        stat: opt?.label ?? key,
        key,
        league: normalizeRadarValue(key, raw),
        raw,
      };
    });
  }, [context.league_avgs]);

  function navigate(
    nextSeason: string,
    nextScope: SeasonTypeScope,
    nextUniverse: UniverseId = universe
  ) {
    const params = new URLSearchParams();
    params.set("season", nextSeason);
    // Never write reg_plus_playoffs
    const s = nextScope === "reg_plus_playoffs" ? "reg_only" : nextScope;
    params.set("scope", s);
    params.set("universe", nextUniverse);
    router.push(`/?${params.toString()}`);
  }

  const uiScope: "reg_only" | "playoff_only" =
    scope === "playoff_only" ? "playoff_only" : "reg_only";

  return (
    <div className={styles.wrap}>
      <div className={styles.glowA} aria-hidden />
      <div className={styles.glowB} aria-hidden />

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>FantasyHoops</h1>
          <p className={styles.subtitle}>
            League pulse · Hybrid A1+A3 · accurate mart aggregates
          </p>
        </div>
        <div className={styles.controls}>
          <div className={styles.seg} role="group" aria-label="Season">
            {SEASON_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={season === s ? styles.active : undefined}
                onClick={() => navigate(s, uiScope)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.seg} role="group" aria-label="Season type scope">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={uiScope === opt.value ? styles.active : undefined}
                onClick={() => navigate(season, opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div
            className={`${styles.seg} ${styles.universeSeg}`}
            role="group"
            aria-label="Player universe"
          >
            {UNIVERSE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.hint}
                className={universe === opt.value ? styles.active : undefined}
                onClick={() => navigate(season, uiScope, opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <p className={styles.meta}>
        {context.player_count} players · season <code>{season}</code> · scope{" "}
        <code>{uiScope}</code> · universe <code>{universe}</code>
        {" · "}
        <Link href="/player" className={styles.metaLink}>
          Browse players →
        </Link>
      </p>

      {/* Hero: league-avg 9-cat radar */}
      <section className={styles.hero} aria-label="League average 9-cat radar">
        <div className={styles.heroCopy}>
          <h2 className={styles.panelTitle}>League average · 9-cat</h2>
          <p className={styles.panelSub}>
            Same RADAR_RANGES / spoke order / normalizeRadarValue as Player.
            Counting stats GP-weighted; FG%/FT% = Σ made / Σ att; 3PM = GP-weighted{" "}
            <code>avg_fg3m</code> only.
          </p>
          <div className={styles.avgGrid}>
            {RADAR_SPOKE_ORDER.map((k) => (
              <div key={k} className={styles.avgCell}>
                <span className={styles.avgLabel}>{STAT_LABEL[k]}</span>
                <span className={styles.avgVal}>
                  {fmtStat(k, context.league_avgs[k])}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.radarBox}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
              <PolarGrid stroke="rgba(212, 184, 150, 0.18)" />
              <PolarAngleAxis
                dataKey="stat"
                tick={{ fill: "#c9b8a0", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="League"
                dataKey="league"
                stroke="rgba(212, 184, 150, 0.95)"
                fill="rgba(212, 184, 150, 0.28)"
                fillOpacity={0.55}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(22, 22, 24, 0.92)",
                  border: "1px solid rgba(212, 184, 150, 0.35)",
                  borderRadius: 8,
                  color: "#f2ebe3",
                }}
                formatter={(value: number | string, _n, item) => {
                  const key = (item?.payload as { key?: RadarStatKey })?.key;
                  const raw = (item?.payload as { raw?: number | null })?.raw;
                  if (key) return [fmtStat(key, raw ?? null), STAT_LABEL[key]];
                  return [value, "League"];
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <p className={styles.normNote}>{RADAR_NORM_NOTE}</p>
      </section>

      {/* Triptych OFF / DEF / EFF */}
      <div className={styles.triptych}>
        <TriptychPanel
          title="OFF"
          keys={TRIPTYCH.OFF}
          leagueAvgs={context.league_avgs}
          leaders={context.leaders}
        />
        <TriptychPanel
          title="DEF"
          keys={TRIPTYCH.DEF}
          leagueAvgs={context.league_avgs}
          leaders={context.leaders}
        />
        <TriptychPanel
          title="EFF"
          keys={TRIPTYCH.EFF}
          leagueAvgs={context.league_avgs}
          leaders={context.leaders}
        />
      </div>

      {/* Footer: FG% hist + stocks */}
      <section className={styles.footer} aria-label="FG% histogram and stocks leaders">
        <div className={styles.footerPanel}>
          <h2 className={styles.panelTitle}>FG% distribution</h2>
          <p className={styles.panelSub}>
            Players with GP ≥ 10 · bins 30–70% · not strength of schedule
          </p>
          <div className={styles.histBox}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={context.fg_pct_hist}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a89880", fontSize: 10 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={48}
                />
                <YAxis tick={{ fill: "#a89880", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(22, 22, 24, 0.92)",
                    border: "1px solid rgba(212, 184, 150, 0.35)",
                    borderRadius: 8,
                    color: "#f2ebe3",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Players"
                  fill="rgba(212, 184, 150, 0.75)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={styles.footerPanel}>
          <h2 className={styles.panelTitle}>Stocks leaders</h2>
          <p className={styles.panelSub}>
            STL + BLK (per-game) · GP ≥ 10 · team chart colors
          </p>
          <ol className={styles.leaderList}>
            {context.stocks_leaders.map((L, i) => (
              <li key={L.player_id}>
                <Link
                  href={`/player?player_id=${encodeURIComponent(L.player_id)}&name=${encodeURIComponent(L.full_name)}`}
                  className={styles.leaderLink}
                  style={{ ["--leader-color" as string]: L.chart_color }}
                >
                  <span className={styles.leaderRank}>{i + 1}</span>
                  <span
                    className={styles.leaderDot}
                    style={{ background: L.chart_color }}
                    aria-hidden
                  />
                  <span className={styles.leaderName}>{L.full_name}</span>
                  <span className={styles.leaderVal}>{formatAvg(L.value)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
