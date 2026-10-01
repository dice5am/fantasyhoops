import { ScheduleBoard } from "@/components/ScheduleBoard";
import {
  DRAFT_PREP_SEASON,
  getSeasonSchedule,
  seasonScheduleAvailable,
} from "@/lib/loadSeasonSchedule";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  let payload = null;
  if (seasonScheduleAvailable()) {
    payload = await getSeasonSchedule({ season: DRAFT_PREP_SEASON });
  }
  return <ScheduleBoard payload={payload} />;
}
