import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** No Schedule tab — slate lives under Team → Matchup week. */
export default function ScheduleRedirect() {
  redirect("/team?view=matchup");
}
