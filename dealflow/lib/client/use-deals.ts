"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  apiGetDeal,
  apiListDeals,
  dealKey,
  dealsKey,
  DealApiError,
} from "./api";
import { dealsRepo } from "@/lib/storage";
import type { Deal } from "@/lib/types";

export interface DealsSource {
  deals: Deal[];
  isLoading: boolean;
  error: Error | null;
  authed: boolean;
  refresh: () => Promise<unknown>;
}

export function useDealsSource(): DealsSource {
  const { status } = useSession();
  const authed = status === "authenticated";
  const loadingSession = status === "loading";

  const swr = useSWR<Deal[], DealApiError>(
    authed ? dealsKey : null,
    apiListDeals,
  );

  const [localDeals, setLocalDeals] = useState<Deal[]>([]);

  useEffect(() => {
    if (authed) return;
    if (loadingSession) return;
    // Seed demo data only for unauthenticated visitors.
    dealsRepo.seedDemoIfEmpty();
    const refresh = () => setLocalDeals(dealsRepo.list());
    refresh();
    window.addEventListener("dealflow:change", refresh);
    return () => window.removeEventListener("dealflow:change", refresh);
  }, [authed, loadingSession]);

  if (authed) {
    return {
      deals: swr.data ?? [],
      isLoading: swr.isLoading,
      error: (swr.error as Error | undefined) ?? null,
      authed: true,
      refresh: () => swr.mutate(),
    };
  }

  return {
    deals: localDeals,
    isLoading: loadingSession,
    error: null,
    authed: false,
    refresh: async () => {
      setLocalDeals(dealsRepo.list());
    },
  };
}

export interface DealSource {
  deal: Deal | undefined;
  isLoading: boolean;
  error: Error | null;
  authed: boolean;
  refresh: () => Promise<unknown>;
}

export function useDealSource(id: string): DealSource {
  const { status } = useSession();
  const authed = status === "authenticated";
  const loadingSession = status === "loading";

  const swr = useSWR<Deal, DealApiError>(
    authed ? dealKey(id) : null,
    () => apiGetDeal(id),
  );

  const [localDeal, setLocalDeal] = useState<Deal | undefined>();

  useEffect(() => {
    if (authed) return;
    if (loadingSession) return;
    const refresh = () => setLocalDeal(dealsRepo.get(id));
    refresh();
    window.addEventListener("dealflow:change", refresh);
    return () => window.removeEventListener("dealflow:change", refresh);
  }, [authed, loadingSession, id]);

  if (authed) {
    return {
      deal: swr.data,
      isLoading: swr.isLoading,
      error: (swr.error as Error | undefined) ?? null,
      authed: true,
      refresh: () => swr.mutate(),
    };
  }

  return {
    deal: localDeal,
    isLoading: loadingSession,
    error: null,
    authed: false,
    refresh: async () => {
      setLocalDeal(dealsRepo.get(id));
    },
  };
}
