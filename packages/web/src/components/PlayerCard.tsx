import type { ScoredPlayer } from "../types";
import { positionAccent, positionLabel } from "../positions";
import { StatBar } from "./StatBar";

interface PlayerCardProps {
  player: ScoredPlayer;
  onDraft: (playerId: string) => void;
  disabled: boolean;
  onRoster: boolean;
}

export function PlayerCard({ player, onDraft, disabled, onRoster }: PlayerCardProps): JSX.Element {
  const accent = positionAccent(player.position);
  return (
    <article className="player-card" style={{ borderTopColor: accent }}>
      <header className="player-card-head">
        <div>
          <h3>{player.name}</h3>
          <p className="player-meta">
            <span className="pos-badge" style={{ background: accent }}>
              {player.position}
            </span>
            <span>{positionLabel(player.position)}</span>
            <span className="team-tag">{player.team}</span>
          </p>
        </div>
        <div className="fp-badge">
          <span className="fp-value">{player.fantasyPoints.toFixed(1)}</span>
          <span className="fp-label">FPTS</span>
        </div>
      </header>
      <div className="stat-grid">
        <StatBar label="PTS" value={player.stats.ppg} />
        <StatBar label="REB" value={player.stats.rpg} />
        <StatBar label="AST" value={player.stats.apg} />
        <StatBar label="STL" value={player.stats.spg} />
        <StatBar label="BLK" value={player.stats.bpg} />
        <StatBar label="TO" value={player.stats.topg} />
      </div>
      <button
        type="button"
        className="draft-btn"
        onClick={() => onDraft(player.id)}
        disabled={disabled || onRoster}
      >
        {onRoster ? "On roster" : "Draft"}
      </button>
    </article>
  );
}
