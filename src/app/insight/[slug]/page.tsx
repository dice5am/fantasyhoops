import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function InsightSlugRedirect({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  redirect(`/insights/${slug}`);
}
