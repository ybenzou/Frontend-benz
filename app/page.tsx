import { OverviewLive } from "@/components/market/overview-live";
import { MarketDataUnavailableError } from "@/lib/market/cache.server";
import { getMarketServerRepository } from "@/lib/market/repository.server";
import { OpenSection } from "@/components/layout/terminal-surfaces";

export const dynamic = "force-dynamic";

export default async function Overview() {
  let overview;
  try {
    overview = await getMarketServerRepository().getOverview();
  } catch (error) {
    if (!(error instanceof MarketDataUnavailableError)) {
      console.error("Market overview failed", error);
    }
    return <div className="page-grid"><OpenSection className="p-6"><h1 className="text-lg font-semibold">Market data unavailable</h1><p className="muted mt-2 text-sm">The selected real-data provider could not supply a current or cached result. Mock data was not substituted.</p></OpenSection></div>;
  }
  return (
    <div className="page-grid pb-16 md:pb-0">
      <h1 className="sr-only">Market overview</h1>
      <OverviewLive
        mode={overview.mode}
        dataLabel={overview.dataLabel}
        indices={overview.indices}
        sectors={overview.sectors}
        watchlist={overview.watchlist}
        events={overview.events}
        initialLive={overview.liveQuotes}
      />
    </div>
  );
}
