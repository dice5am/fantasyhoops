import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Mix A+C: `/` → Team. Home Pulse lives under Insights. */
export default function RootPage() {
  redirect("/team");
}
