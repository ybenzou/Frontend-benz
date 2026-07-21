import { WatchlistWorkspace } from "@/components/market/watchlist-workspace";
import { getMarketServerRepository } from "@/lib/market/repository.server";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const repository = getMarketServerRepository();
  const initial = await repository.getQuotes();
  return <WatchlistWorkspace initial={initial} mode={repository.mode} />;
}
