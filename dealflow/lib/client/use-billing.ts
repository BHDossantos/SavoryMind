"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  billingKey,
  fetchWorkspaceBilling,
  type WorkspaceBillingResponse,
} from "./billing";

const FREE_STATE: WorkspaceBillingResponse = {
  billing: {
    workspaceId: "",
    tier: "free",
    status: "active",
    seatCount: 1,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  },
  effectiveTier: "free",
  dealCount: 0,
  limits: { maxDeals: 3, aiAnalysis: false },
  stripeConfigured: false,
};

export interface BillingSource {
  data: WorkspaceBillingResponse;
  authed: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<unknown>;
}

export function useBillingSource(refreshIntervalMs?: number): BillingSource {
  const { status } = useSession();
  const authed = status === "authenticated";

  const swr = useSWR<WorkspaceBillingResponse, Error>(
    authed ? billingKey : null,
    fetchWorkspaceBilling,
    refreshIntervalMs ? { refreshInterval: refreshIntervalMs } : undefined,
  );

  if (!authed) {
    return {
      data: FREE_STATE,
      authed: false,
      isLoading: status === "loading",
      error: null,
      refresh: async () => {},
    };
  }

  return {
    data: swr.data ?? FREE_STATE,
    authed: true,
    isLoading: swr.isLoading,
    error: (swr.error as Error | undefined) ?? null,
    refresh: () => swr.mutate(),
  };
}
