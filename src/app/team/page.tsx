import { DraftTeamScreen } from "@/components/DraftTeamScreen";

export const dynamic = "force-dynamic";

/** Draft + Team merged screen (same component on /draft and /team). */
export default function Page() {
  return <DraftTeamScreen />;
}
