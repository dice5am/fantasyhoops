import type { TeamView } from "../types";
import { positionAccent } from "../positions";

interface TeamPanelProps {
  team: TeamView | null;
  onRelease: (playerId: string) => void;
}

export function TeamPanel({ team, onRelease }: TeamPanelProps): JSX.Element {
  const rosterCount = team?.roster.length ?? 0;
  const rosterLimit = team?.rosterLimit ?? 0;
  return (
    <aside className="team-panel">
      <div className="team-header">
        <h2>{team?.name ?? "My Team"}</h2>
        <div className="projected">
          <span className="projected-value">{(team?.projectedPoints ?? 0).toFixed(1)}</span>
          <span className="projected-label">projected FPTS / game</span>
        </div>
        <p className="roster-count">
          {rosterCount} / {rosterLimit} roster spots filled
        </p>
      </div>

      {rosterCount === 0 ? (
        <p className="empty-roster">Draft players from the pool to build your lineup.</p>
      ) : (
        <ul className="roster-list">
          {team?.roster.map((player) => (
            <li key={player.id} className="roster-item">
              <span
                className="pos-dot"
                style={{ background: positionAccent(player.position) }}
                aria-hidden
              />
              <span className="roster-name">{player.name}</span>
              <span className="roster-fp">{player.fantasyPoints.toFixed(1)}</span>
              <button
                type="button"
                className="release-btn"
                aria-label={`Release ${player.name}`}
                onClick={() => onRelease(player.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
