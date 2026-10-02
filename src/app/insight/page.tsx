import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function InsightRedirect() {
  redirect("/insights?segment=briefs");
}
