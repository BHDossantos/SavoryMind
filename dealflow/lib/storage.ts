"use client";

import type {
  AINarrative,
  Attachment,
  Deal,
  DealInput,
  PipelineStatus,
  Priority,
} from "./types";

const KEY = "dealflow.deals.v1";

function read(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Deal[]) : [];
  } catch {
    return [];
  }
}

function write(deals: Deal[]) {
  window.localStorage.setItem(KEY, JSON.stringify(deals));
  window.dispatchEvent(new CustomEvent("dealflow:change"));
}

export const dealsRepo = {
  list(): Deal[] {
    return read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  get(id: string): Deal | undefined {
    return read().find((d) => d.id === id);
  },
  create(input: DealInput): Deal {
    const deal: Deal = {
      ...input,
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
      status: "lead",
      priority: "medium",
    };
    write([deal, ...read()]);
    return deal;
  },
  update(id: string, patch: Partial<Deal>): Deal | undefined {
    const all = read();
    const idx = all.findIndex((d) => d.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch };
    write(all);
    return all[idx];
  },
  setStatus(id: string, status: PipelineStatus) {
    return dealsRepo.update(id, { status });
  },
  setPriority(id: string, priority: Priority) {
    return dealsRepo.update(id, { priority });
  },
  remove(id: string) {
    write(read().filter((d) => d.id !== id));
  },
  addAttachment(id: string, attachment: Attachment) {
    const deal = dealsRepo.get(id);
    if (!deal) return;
    const attachments = [...(deal.attachments ?? []), attachment];
    dealsRepo.update(id, { attachments });
  },
  setNarrative(id: string, narrative: AINarrative) {
    return dealsRepo.update(id, { aiNarrative: narrative });
  },
  clearNarrative(id: string) {
    const deal = dealsRepo.get(id);
    if (!deal) return;
    const { aiNarrative, ...rest } = deal;
    void aiNarrative;
    const all = read().map((d) => (d.id === id ? (rest as Deal) : d));
    write(all);
  },
  removeAttachment(id: string, attachmentId: string) {
    const deal = dealsRepo.get(id);
    if (!deal) return;
    const attachments = (deal.attachments ?? []).filter(
      (a) => a.id !== attachmentId,
    );
    dealsRepo.update(id, { attachments });
  },
  seedDemoIfEmpty() {
    if (read().length > 0) return;
    const demo: DealInput[] = [
      {
        name: "Lina's Trattoria",
        businessType: "restaurant",
        location: "Lisbon, PT",
        revenue: 480000,
        rent: 38000,
        laborCost: 142000,
        cogs: 155000,
        utilities: 18000,
        otherExpenses: 22000,
        ownerSalary: 45000,
        askingPrice: 320000,
        locationQuality: 8,
        growthPotential: 6,
        ownerDependency: 7,
        seasonality: 4,
        notes: "Strong reviews, lease renews in 3 years.",
      },
      {
        name: "FitCore Gym",
        businessType: "gym",
        location: "Porto, PT",
        revenue: 240000,
        rent: 36000,
        laborCost: 78000,
        cogs: 9000,
        utilities: 14000,
        otherExpenses: 18000,
        ownerSalary: 30000,
        askingPrice: 210000,
        locationQuality: 7,
        growthPotential: 8,
        ownerDependency: 5,
        seasonality: 3,
        notes: "1,100 active members, equipment partially owned.",
      },
    ];
    demo.forEach((d) => dealsRepo.create(d));
  },
};

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
