import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { Store, RosterError } from "./store.js";

function rosterErrorStatus(code: RosterError["code"]): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "ROSTER_FULL":
      return 409;
    case "DUPLICATE":
      return 409;
    default: {
      const exhaustiveCheck: never = code;
      throw new Error(`Unhandled roster error code: ${String(exhaustiveCheck)}`);
    }
  }
}

export function createApp(store: Store = new Store()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", players: store.listPlayers().length });
  });

  app.get("/api/players", (_req: Request, res: Response) => {
    res.json({ players: store.listPlayers() });
  });

  app.get("/api/team", (_req: Request, res: Response) => {
    res.json(store.getTeam());
  });

  app.post("/api/team/roster", (req: Request, res: Response, next: NextFunction) => {
    try {
      const playerId = (req.body as { playerId?: unknown })?.playerId;
      if (typeof playerId !== "string") {
        res.status(400).json({ error: "playerId (string) is required" });
        return;
      }
      res.status(201).json(store.addToRoster(playerId));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/team/roster/:playerId", (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(store.removeFromRoster(req.params.playerId));
    } catch (err) {
      next(err);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof RosterError) {
      res.status(rosterErrorStatus(err.code)).json({ error: err.message, code: err.code });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
