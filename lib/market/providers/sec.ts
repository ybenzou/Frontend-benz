import "server-only";

import {
  secCompanyFactsSchema,
  secSubmissionsSchema,
  secTickerMapResponseSchema,
  type SecCompanyFacts,
  type SecSubmissions,
} from "../contracts";
import { sanitizeErrorBody } from "./error-body";

const DEFAULT_TIMEOUT_MS = 10_000;

type SecEnvironment = Partial<Record<string, string | undefined>>;

type SecProviderOptions = {
  env?: SecEnvironment;
  fetch?: typeof fetch;
  timeoutMs?: number;
  dataBaseUrl?: string;
  websiteBaseUrl?: string;
};

export type SecTickerMapping = {
  cik: string;
  ticker: string;
  title: string;
};

export function normalizeCik(cik: string | number) {
  const digits = String(cik).replace(/^CIK/i, "");
  if (!/^\d+$/.test(digits)) {
    throw new Error(`Invalid SEC CIK: ${cik}`);
  }
  return digits.padStart(10, "0");
}

export function createSecProvider(options: SecProviderOptions = {}) {
  const environment = options.env ?? process.env;
  const userAgent = environment.SEC_USER_AGENT?.trim();
  if (!userAgent) {
    throw new Error("SEC_USER_AGENT is required");
  }
  const email = userAgent.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  )?.[0];
  const organization = email
    ? userAgent
        .replace(email, "")
        .replace(/[()[\]<>:;,.-]/g, " ")
        .trim()
    : "";
  if (!email || !/[A-Z0-9]/i.test(organization)) {
    throw new Error(
      "SEC_USER_AGENT must include organization text and a valid email",
    );
  }
  const identity = userAgent;

  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dataBaseUrl = options.dataBaseUrl ?? "https://data.sec.gov";
  const websiteBaseUrl = options.websiteBaseUrl ?? "https://www.sec.gov";

  async function request<T>(url: string, parse: (value: unknown) => T): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetcher(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": identity,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `SEC request failed (${response.status}): ${sanitizeErrorBody(body)}`,
        );
      }

      return parse(await response.json());
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`SEC request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async getTickerCikMap(): Promise<Record<string, SecTickerMapping>> {
      const data = await request(
        `${websiteBaseUrl}/files/company_tickers.json`,
        (value) => secTickerMapResponseSchema.parse(value),
      );

      return Object.fromEntries(
        Object.values(data).map((entry) => [
          entry.ticker.toUpperCase(),
          {
            cik: normalizeCik(entry.cik_str),
            ticker: entry.ticker.toUpperCase(),
            title: entry.title,
          },
        ]),
      );
    },

    getCompanyFacts(cik: string | number): Promise<SecCompanyFacts> {
      return request(
        `${dataBaseUrl}/api/xbrl/companyfacts/CIK${normalizeCik(cik)}.json`,
        (value) => secCompanyFactsSchema.parse(value),
      );
    },

    getSubmissions(cik: string | number): Promise<SecSubmissions> {
      return request(
        `${dataBaseUrl}/submissions/CIK${normalizeCik(cik)}.json`,
        (value) => secSubmissionsSchema.parse(value),
      );
    },
  };
}
