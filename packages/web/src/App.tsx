import { useEffect, useMemo, useState } from "react";
import type { ScoredPlayer, TeamView, Position } from "./types";
import { addToRoster, fetchPlayers, fetchTeam, removeFromRoster } from "./api";
import { POSITIONS, positionLabel } from "./positions";
import { PlayerCard } from "./components/PlayerCard";
import { TeamPanel } from "./components/TeamPanel";

type Filter = Position | "ALL";

export function App(): JSX.Element {
  const [players, setPlayers] = useState<ScoredPlayer[]>([]);
  const [team, setTeam] = useState<TeamView | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [playerList, teamView] = await Promise.all([fetchPlayers(), fetchTeam()]);
        if (cancelled) return;
        setPlayers(playerList);
        setTeam(teamView);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rosterIds = useMemo(
    () => new Set(team?.roster.map((p) => p.id) ?? []),
    [team],
  );

  const rosterFull = team !== null && team.roster.length >= team.rosterLimit;

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return players.filter((p) => {
      const matchesFilter = filter === "ALL" || p.position === filter;
      const matchesSearch =
        query.length === 0 ||
        p.name.toLowerCase().includes(query) ||
        p.team.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [players, filter, search]);

  async function handleDraft(playerId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setTeam(await addToRoster(playerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft player");
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease(playerId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setTeam(await removeFromRoster(playerId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not release player");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo" aria-hidden>
            🏀
          </span>
          <div>
            <h1>FantasyHoops</h1>
            <p>Draft your dream lineup and chase the highest projected fantasy points.</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      <div className="layout">
        <main className="pool">
          <div className="toolbar">
            <input
              type="search"
              className="search"
              placeholder="Search by player or team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filters" role="group" aria-label="Filter by position">
              <button
                type="button"
                className={filter === "ALL" ? "chip chip-active" : "chip"}
                onClick={() => setFilter("ALL")}
              >
                All
              </button>
              {POSITIONS.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  className={filter === pos ? "chip chip-active" : "chip"}
                  onClick={() => setFilter(pos)}
                  title={positionLabel(pos)}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="loading">Loading players…</p>
          ) : visiblePlayers.length === 0 ? (
            <p className="loading">No players match your filters.</p>
          ) : (
            <div className="player-grid">
              {visiblePlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onDraft={(id) => void handleDraft(id)}
                  disabled={busy || rosterFull}
                  onRoster={rosterIds.has(player.id)}
                />
              ))}
            </div>
          )}
        </main>

        <TeamPanel team={team} onRelease={(id) => void handleRelease(id)} />
      </div>
    </div>
  );
}
