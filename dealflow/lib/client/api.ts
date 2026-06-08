/**
 * Typed wrappers around /api/deals. Used by the action layer
 * (lib/client/actions.ts); pages do not call these directly.
 */
import type {
  AINarrative,
  Attachment,
  Deal,
  DealInput,
  PipelineStatus,
  Priority,
} from "@/lib/types";

export class DealApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "DealApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function parseError(res: Response): Promise<DealApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // body wasn't JSON
  }
  const obj = (body ?? {}) as { error?: string; fields?: Record<string, string> };
  return new DealApiError(
    obj.error ?? `Request failed (${res.status})`,
    res.status,
    obj.fields,
  );
}

export async function apiListDeals(): Promise<Deal[]> {
  const res = await fetch("/api/deals", { cache: "no-store" });
  if (!res.ok) throw await parseError(res);
  const json = (await res.json()) as { deals: Deal[] };
  return json.deals;
}

export async function apiGetDeal(id: string): Promise<Deal> {
  const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw await parseError(res);
  const json = (await res.json()) as { deal: Deal };
  return json.deal;
}

export async function apiCreateDeal(input: DealInput): Promise<Deal> {
  const res = await fetch("/api/deals", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  const json = (await res.json()) as { deal: Deal };
  return json.deal;
}

export interface DealUpdate
  extends Partial<DealInput> {
  status?: PipelineStatus;
  priority?: Priority;
  attachments?: Attachment[];
  aiNarrative?: AINarrative | null;
}

export async function apiUpdateDeal(
  id: string,
  patch: DealUpdate,
): Promise<Deal> {
  const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw await parseError(res);
  const json = (await res.json()) as { deal: Deal };
  return json.deal;
}

export async function apiDeleteDeal(id: string): Promise<void> {
  const res = await fetch(`/api/deals/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw await parseError(res);
}

/** SWR keys. Centralized so all callers refer to the same string and mutate() works. */
export const dealsKey = "/api/deals";
export const dealKey = (id: string) => `/api/deals/${id}`;
