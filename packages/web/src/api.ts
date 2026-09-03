import type { ScoredPlayer, TeamView } from "./types";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function fetchPlayers(): Promise<ScoredPlayer[]> {
  const data = await parse<{ players: ScoredPlayer[] }>(await fetch("/api/players"));
  return data.players;
}

export async function fetchTeam(): Promise<TeamView> {
  return parse<TeamView>(await fetch("/api/team"));
}

export async function addToRoster(playerId: string): Promise<TeamView> {
  return parse<TeamView>(
    await fetch("/api/team/roster", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId }),
    }),
  );
}

export async function removeFromRoster(playerId: string): Promise<TeamView> {
  return parse<TeamView>(
    await fetch(`/api/team/roster/${playerId}`, { method: "DELETE" }),
  );
}
