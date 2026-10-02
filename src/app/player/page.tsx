import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PlayerRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    qs.set(k, Array.isArray(v) ? v[0]! : v);
  }
  const q = qs.toString();
  redirect(q ? `/players?${q}` : "/players");
}
