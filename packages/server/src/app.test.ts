import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { Store } from "./store.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = createApp(new Store());
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("FantasyHoops API", () => {
  it("reports health", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; players: number };
    expect(body.status).toBe("ok");
    expect(body.players).toBeGreaterThan(0);
  });

  it("lists players sorted by fantasy points", async () => {
    const res = await fetch(`${baseUrl}/api/players`);
    const body = (await res.json()) as { players: { fantasyPoints: number }[] };
    expect(body.players.length).toBeGreaterThan(0);
    expect(body.players[0].fantasyPoints).toBeGreaterThanOrEqual(
      body.players[body.players.length - 1].fantasyPoints,
    );
  });

  it("supports the draft flow end to end", async () => {
    const add = await fetch(`${baseUrl}/api/team/roster`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "jokic" }),
    });
    expect(add.status).toBe(201);
    const team = (await add.json()) as { roster: { id: string }[]; projectedPoints: number };
    expect(team.roster.map((p) => p.id)).toContain("jokic");
    expect(team.projectedPoints).toBeGreaterThan(0);

    const remove = await fetch(`${baseUrl}/api/team/roster/jokic`, { method: "DELETE" });
    expect(remove.status).toBe(200);
    const afterRemove = (await remove.json()) as { roster: { id: string }[] };
    expect(afterRemove.roster.map((p) => p.id)).not.toContain("jokic");
  });

  it("rejects an unknown player with 404", async () => {
    const res = await fetch(`${baseUrl}/api/team/roster`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});
