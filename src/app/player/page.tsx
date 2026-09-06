import { Suspense } from "react";
import { PlayerExplorer } from "@/components/PlayerExplorer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "1.5rem", color: "#94a3b8" }}>
          Loading player explorer…
        </div>
      }
    >
      <PlayerExplorer />
    </Suspense>
  );
}
