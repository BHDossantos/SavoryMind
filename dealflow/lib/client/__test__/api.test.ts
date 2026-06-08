import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  apiCreateDeal,
  apiDeleteDeal,
  apiGetDeal,
  apiListDeals,
  apiUpdateDeal,
  DealApiError,
} from "../api";
import { healthyRestaurant } from "@/lib/__fixtures__/deals";
import type { Deal } from "@/lib/types";

const FAKE_DEAL: Deal = {
  ...healthyRestaurant,
  id: "deal_abc",
  createdAt: "2026-06-01T00:00:00.000Z",
  status: "lead",
  priority: "medium",
};

function mockFetch(impl: (input: RequestInfo, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(impl as never);
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiListDeals", () => {
  it("parses { deals: [...] } from the response", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ deals: [FAKE_DEAL] }), {
          status: 200,
        }),
    );
    const deals = await apiListDeals();
    expect(deals).toHaveLength(1);
    expect(deals[0].id).toBe(FAKE_DEAL.id);
  });

  it("throws DealApiError on non-2xx with the body's error message", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
        }),
    );
    await expect(apiListDeals()).rejects.toBeInstanceOf(DealApiError);
    await expect(apiListDeals()).rejects.toMatchObject({
      status: 401,
      message: "Not authenticated",
    });
  });
});

describe("apiGetDeal", () => {
  it("returns the deal under { deal }", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ deal: FAKE_DEAL }), { status: 200 }),
    );
    const deal = await apiGetDeal("deal_abc");
    expect(deal.id).toBe("deal_abc");
  });

  it("404 surfaces as DealApiError with status 404", async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ error: "Deal not found" }), {
          status: 404,
        }),
    );
    await expect(apiGetDeal("nope")).rejects.toMatchObject({ status: 404 });
  });
});

describe("apiCreateDeal", () => {
  it("POSTs to /api/deals with the deal input as JSON", async () => {
    const spy = mockFetch(
      () =>
        new Response(JSON.stringify({ deal: FAKE_DEAL }), { status: 201 }),
    );
    await apiCreateDeal(healthyRestaurant);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/deals");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).name).toBe(healthyRestaurant.name);
  });

  it("surfaces field-level errors in DealApiError.fields", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            error: "Invalid deal payload",
            fields: { revenue: "must be ≥ 0" },
          }),
          { status: 400 },
        ),
    );
    try {
      await apiCreateDeal(healthyRestaurant);
      expect.unreachable("create should have thrown");
    } catch (e) {
      const err = e as DealApiError;
      expect(err).toBeInstanceOf(DealApiError);
      expect(err.fields?.revenue).toBe("must be ≥ 0");
    }
  });
});

describe("apiUpdateDeal", () => {
  it("PUTs the patch to /api/deals/[id]", async () => {
    const spy = mockFetch(
      () =>
        new Response(JSON.stringify({ deal: FAKE_DEAL }), { status: 200 }),
    );
    await apiUpdateDeal("deal_abc", { status: "negotiating" });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/deals/deal_abc");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string).status).toBe("negotiating");
  });
});

describe("apiDeleteDeal", () => {
  it("DELETEs /api/deals/[id] and tolerates 204 No Content", async () => {
    const spy = mockFetch(
      () => new Response(null, { status: 204 }),
    );
    await apiDeleteDeal("deal_abc");
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/deals/deal_abc");
    expect(init.method).toBe("DELETE");
  });
});
