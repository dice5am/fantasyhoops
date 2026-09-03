import type { Position } from "./types";

export const POSITIONS: readonly Position[] = ["PG", "SG", "SF", "PF", "C"];

export function positionLabel(position: Position): string {
  switch (position) {
    case "PG":
      return "Point Guard";
    case "SG":
      return "Shooting Guard";
    case "SF":
      return "Small Forward";
    case "PF":
      return "Power Forward";
    case "C":
      return "Center";
    default: {
      const exhaustiveCheck: never = position;
      throw new Error(`Unhandled position: ${String(exhaustiveCheck)}`);
    }
  }
}

export function positionAccent(position: Position): string {
  switch (position) {
    case "PG":
      return "#38bdf8";
    case "SG":
      return "#818cf8";
    case "SF":
      return "#c084fc";
    case "PF":
      return "#fb7185";
    case "C":
      return "#fbbf24";
    default: {
      const exhaustiveCheck: never = position;
      throw new Error(`Unhandled position: ${String(exhaustiveCheck)}`);
    }
  }
}
