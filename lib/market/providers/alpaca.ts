import "server-only";

import {
  alpacaBarsResponseSchema,
  alpacaSnapshotsResponseSchema,
  type AlpacaBarsResponse,
  type AlpacaSnapshotsResponse,
} from "../contracts";
import { sanitizeErrorBody } from "./error-body";

const DEFAULT_BASE_URL = "https://data.alpaca.markets";
const DEFAULT_TIMEOUT_MS = 10_000;

type AlpacaEnvironment = Partial<Record<string, string | undefined>>;

type AlpacaProviderOptions = {
  env?: AlpacaEnvironment;
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export type AlpacaBarsOptions = {
  timeframe: string;
  start?: string;
  end?: string;
  limit?: number;
  pageToken?: string;
};

function required(environment: AlpacaEnvironment, name: string) {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function symbolsParam(symbols: string[]) {
  if (symbols.length === 0) {
    throw new Error("At least one symbol is required");
  }
  const normalized = symbols.map((symbol) => symbol.trim().toUpperCase());
  if (normalized.some((symbol) => symbol.length === 0)) {
    throw new Error("Symbols cannot be blank");
  }
  return normalized.join(",");
}

export function createAlpacaProvider(options: AlpacaProviderOptions = {}) {
  const environment = options.env ?? process.env;
  const keyId = required(environment, "ALPACA_API_KEY_ID");
  const secretKey = required(environment, "ALPACA_API_SECRET_KEY");
  const fetcher = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    path: string,
    params: URLSearchParams,
    parse: (value: unknown) => T,
  ): Promise<T> {
    params.set("feed", "iex");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetcher(`${baseUrl}${path}?${params}`, {
        headers: {
          "APCA-API-KEY-ID": keyId,
          "APCA-API-SECRET-KEY": secretKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        let detail = body;
        try {
          const parsed = JSON.parse(body) as { message?: unknown };
          if (typeof parsed.message === "string") detail = parsed.message;
        } catch {
          // Preserve a non-JSON response body for diagnostics.
        }
        throw new Error(
          `Alpaca request failed (${response.status}): ${sanitizeErrorBody(detail)}`,
        );
      }

      return parse(await response.json());
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Alpaca request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    getSnapshots(symbols: string[]): Promise<AlpacaSnapshotsResponse> {
      return request(
        "/v2/stocks/snapshots",
        new URLSearchParams({ symbols: symbolsParam(symbols) }),
        (value) => alpacaSnapshotsResponseSchema.parse(value),
      );
    },

    getBars(
      symbols: string[],
      barsOptions: AlpacaBarsOptions,
    ): Promise<AlpacaBarsResponse> {
      const params = new URLSearchParams({
        symbols: symbolsParam(symbols),
        timeframe: barsOptions.timeframe,
      });
      if (barsOptions.start) params.set("start", barsOptions.start);
      if (barsOptions.end) params.set("end", barsOptions.end);
      if (barsOptions.limit !== undefined) {
        params.set("limit", String(barsOptions.limit));
      }
      if (barsOptions.pageToken) params.set("page_token", barsOptions.pageToken);

      return request("/v2/stocks/bars", params, (value) =>
        alpacaBarsResponseSchema.parse(value),
      );
    },
  };
}
