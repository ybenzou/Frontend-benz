import { PortfolioWorkspace } from "@/components/market/portfolio-workspace";
import { getMarketServerRepository } from "@/lib/market/repository.server";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const portfolio = await getMarketServerRepository().getPortfolio();
  return <PortfolioWorkspace portfolio={portfolio} />;
}
