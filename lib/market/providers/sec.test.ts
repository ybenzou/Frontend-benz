import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.useRealTimers();
});

describe("SEC REST provider", () => {
  it("loads ticker-CIK mappings with the required identity header", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
        }),
      ),
    );
    const { createSecProvider } = await import("./sec");
    const provider = createSecProvider({
      env: { SEC_USER_AGENT: "MarketDesk contact@example.com" },
      fetch: fetcher,
    });

    const mapping = await provider.getTickerCikMap();

    expect(mapping.AAPL).toEqual({
      cik: "0000320193",
      ticker: "AAPL",
      title: "Apple Inc.",
    });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      "User-Agent": "MarketDesk contact@example.com",
    });
  });

  it("loads CompanyFacts and Submissions using a normalized CIK", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cik: 320193, entityName: "Apple Inc.", facts: {} })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          cik: "0000320193",
          name: "Apple Inc.",
          filings: {
            recent: {
              accessionNumber: [],
              filingDate: [],
              reportDate: [],
              form: [],
              primaryDocument: [],
            },
            files: [],
          },
        })),
      );
    const { createSecProvider } = await import("./sec");
    const provider = createSecProvider({
      env: { SEC_USER_AGENT: "MarketDesk contact@example.com" },
      fetch: fetcher,
    });

    await provider.getCompanyFacts(320193);
    await provider.getSubmissions("320193");

    expect(String(fetcher.mock.calls[0][0])).toContain(
      "/api/xbrl/companyfacts/CIK0000320193.json",
    );
    expect(String(fetcher.mock.calls[1][0])).toContain(
      "/submissions/CIK0000320193.json",
    );
  });

  it("reports SEC error responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("rate limit", { status: 429 }),
    );
    const { createSecProvider } = await import("./sec");
    const provider = createSecProvider({
      env: { SEC_USER_AGENT: "MarketDesk contact@example.com" },
      fetch: fetcher,
    });

    await expect(provider.getCompanyFacts(320193)).rejects.toThrow(
      "SEC request failed (429): rate limit",
    );
  });

  it("sanitizes and truncates SEC error bodies", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(`rate\r\n\u0000limit ${"x".repeat(2_000)}`, { status: 503 }),
    );
    const { createSecProvider } = await import("./sec");
    const provider = createSecProvider({
      env: { SEC_USER_AGENT: "MarketDesk contact@example.com" },
      fetch: fetcher,
    });

    const error = await provider.getCompanyFacts(320193).catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("rate limit");
    expect(error.message).not.toMatch(/[\r\n\u0000]/);
    expect(error.message.length).toBeLessThan(400);
  });

  it("aborts SEC requests after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new TypeError("fetch failed after abort")),
        );
      }),
    );
    const { createSecProvider } = await import("./sec");
    const provider = createSecProvider({
      env: { SEC_USER_AGENT: "MarketDesk contact@example.com" },
      fetch: fetcher,
      timeoutMs: 25,
    });

    const request = provider.getCompanyFacts(320193);
    const assertion = expect(request).rejects.toThrow(
      "SEC request timed out after 25ms",
    );
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
  });

  it("requires SEC_USER_AGENT", async () => {
    const { createSecProvider } = await import("./sec");

    expect(() => createSecProvider({ env: {}, fetch: vi.fn<typeof fetch>() })).toThrow(
      "SEC_USER_AGENT",
    );
  });

  it.each([
    { userAgent: "contact@example.com", missing: "organization" },
    { userAgent: "MarketDesk Research", missing: "email" },
  ])("rejects a User-Agent without $missing", async ({ userAgent }) => {
    const { createSecProvider } = await import("./sec");

    expect(() =>
      createSecProvider({
        env: { SEC_USER_AGENT: userAgent },
        fetch: vi.fn<typeof fetch>(),
      }),
    ).toThrow("SEC_USER_AGENT must include organization text and a valid email");
  });
});
