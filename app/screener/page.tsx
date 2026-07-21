import { ScreenerWorkspace } from "@/components/market/screener-workspace";
import { getMarketServerRepository } from "@/lib/market/repository.server";

export const dynamic = "force-dynamic";

export default async function ScreenerPage() {
  const repository = getMarketServerRepository();
  const initial = await repository.getQuotes();
  return <ScreenerWorkspace initial={initial} mode={repository.mode} />;
}
