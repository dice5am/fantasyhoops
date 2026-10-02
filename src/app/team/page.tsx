import { Suspense } from "react";
import { TeamBoard } from "@/components/TeamBoard";

export const dynamic = "force-dynamic";

export default function TeamPage() {
  return (
    <Suspense fallback={<main style={{ padding: "2rem" }}>Loading team…</main>}>
      <TeamBoard />
    </Suspense>
  );
}
