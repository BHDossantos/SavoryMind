/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importLocalDealsToApi } from "../import";
import { dealsRepo } from "@/lib/storage";
import { healthyRestaurant, highRentGym } from "@/lib/__fixtures__/deals";
import type { Deal } from "@/lib/types";

function asDeal(input: typeof healthyRestaurant, id: string): Deal {
  return {
    ...input,
    id,
    createdAt: "2026-06-01T00:00:00.000Z",
    status: "lead",
    priority: "medium",
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function seedLocalDeals(deals: Deal[]) {
  for (const d of deals) {
    // dealsRepo.create takes DealInput and generates its own id; we want the
    // exact provided id so we drop them in via writing the localStorage key
    // directly. The repo reads under its own key (dealflow.deals.v1).
  }
  window.localStorage.setItem("dealflow.deals.v1", JSON.stringify(deals));
}

describe("importLocalDealsToApi", () => {
  it("POSTs each local deal and removes it from localStorage on success", async () => {
    const local = [
      asDeal(healthyRestaurant, "local_1"),
      asDeal(highRentGym, "local_2"),
    ];
    seedLocalDeals(local);

    const fetchSpy = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      return new Response(
        JSON.stringify({
          deal: {
            ...body,
            id: `server_${input.toString()}_${Math.random()}`,
            createdAt: new Date().toISOString(),
            status: "lead",
            priority: "medium",
          },
        }),
        { status: 201 },
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await importLocalDealsToApi(dealsRepo.list());

    expect(result.imported).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    // Both local deals are removed from storage
    expect(dealsRepo.list()).toHaveLength(0);
  });

  it("keeps failed deals in localStorage and reports them", async () => {
    const local = [
      asDeal(healthyRestaurant, "local_ok"),
      asDeal(highRentGym, "local_fail"),
    ];
    seedLocalDeals(local);

    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
        call += 1;
        if (call === 1) {
          const body = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              deal: {
                ...body,
                id: "server_ok",
                createdAt: new Date().toISOString(),
                status: "lead",
                priority: "medium",
              },
            }),
            { status: 201 },
          );
        }
        return new Response(
          JSON.stringify({ error: "Boom" }),
          { status: 500 },
        );
      }),
    );

    const result = await importLocalDealsToApi(dealsRepo.list());

    expect(result.imported).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].error).toContain("Boom");
    // The failed deal stays in localStorage; the successful one is gone.
    // (Iteration order between equal-createdAt fixtures depends on JS sort
    //  stability; assert the invariant directly: whichever failed is the
    //  one that remains.)
    const remaining = dealsRepo.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(result.failed[0].localId);
  });

  it("returns empty result when no local deals are present", async () => {
    seedLocalDeals([]);
    const result = await importLocalDealsToApi([]);
    expect(result.imported).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  it("surfaces validation errors from the API with the original deal name", async () => {
    seedLocalDeals([asDeal(healthyRestaurant, "local_x")]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "Invalid deal payload",
            fields: { revenue: "must be >= 0" },
          }),
          { status: 400 },
        ),
      ),
    );

    const result = await importLocalDealsToApi(dealsRepo.list());
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].name).toBe(healthyRestaurant.name);
    expect(result.failed[0].error).toContain("Invalid deal payload");
    // Failed import stays in storage
    expect(dealsRepo.list()).toHaveLength(1);
  });
});
