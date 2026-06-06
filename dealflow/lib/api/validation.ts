import type { BusinessType, DealInput } from "@/lib/types";
import { BUSINESS_TYPE_LABELS } from "@/lib/multiples";

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[];

function numField(
  body: Record<string, unknown>,
  key: string,
  errors: Record<string, string>,
  opts: { min?: number; max?: number; required?: boolean } = {},
): number | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") {
    if (opts.required) errors[key] = `${key} is required`;
    return undefined;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    errors[key] = `${key} must be a number`;
    return undefined;
  }
  if (opts.min !== undefined && n < opts.min) {
    errors[key] = `${key} must be ≥ ${opts.min}`;
    return undefined;
  }
  if (opts.max !== undefined && n > opts.max) {
    errors[key] = `${key} must be ≤ ${opts.max}`;
    return undefined;
  }
  return n;
}

function strField(
  body: Record<string, unknown>,
  key: string,
  errors: Record<string, string>,
  opts: { required?: boolean; maxLen?: number } = {},
): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) {
    if (opts.required) errors[key] = `${key} is required`;
    return undefined;
  }
  if (typeof value !== "string") {
    errors[key] = `${key} must be a string`;
    return undefined;
  }
  const trimmed = value.trim();
  if (opts.required && trimmed.length === 0) {
    errors[key] = `${key} is required`;
    return undefined;
  }
  if (opts.maxLen && trimmed.length > opts.maxLen) {
    errors[key] = `${key} must be ${opts.maxLen} chars or fewer`;
    return undefined;
  }
  return trimmed;
}

export function validateDealInput(
  input: unknown,
  mode: "create" | "patch" = "create",
): Validation<Partial<DealInput>> {
  const errors: Record<string, string> = {};
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _: "Body must be a JSON object" } };
  }
  const body = input as Record<string, unknown>;
  const requireOnCreate = mode === "create";

  const value: Partial<DealInput> = {};

  const name = strField(body, "name", errors, {
    required: requireOnCreate,
    maxLen: 200,
  });
  if (name !== undefined) value.name = name;

  const businessTypeRaw = strField(body, "businessType", errors, {
    required: requireOnCreate,
  });
  if (businessTypeRaw !== undefined) {
    if (!BUSINESS_TYPES.includes(businessTypeRaw as BusinessType)) {
      errors.businessType = "businessType is not a recognized value";
    } else {
      value.businessType = businessTypeRaw as BusinessType;
    }
  }

  const location = strField(body, "location", errors, { maxLen: 200 });
  if (location !== undefined) value.location = location;

  const notes = strField(body, "notes", errors, { maxLen: 5000 });
  if (notes !== undefined) value.notes = notes;

  const NUMERIC_FIELDS: (keyof DealInput)[] = [
    "revenue",
    "rent",
    "laborCost",
    "cogs",
    "utilities",
    "otherExpenses",
    "ownerSalary",
    "askingPrice",
  ];
  for (const k of NUMERIC_FIELDS) {
    const n = numField(body, k, errors, { min: 0 });
    if (n !== undefined) (value as Record<string, unknown>)[k] = n;
  }

  const QUAL_FIELDS: (keyof DealInput)[] = [
    "locationQuality",
    "growthPotential",
    "ownerDependency",
    "seasonality",
  ];
  for (const k of QUAL_FIELDS) {
    const n = numField(body, k, errors, { min: 0, max: 10 });
    if (n !== undefined) (value as Record<string, unknown>)[k] = n;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}

const PIPELINE_STATUSES = [
  "lead",
  "evaluating",
  "negotiating",
  "under_contract",
  "closed",
  "passed",
] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export function validateStatusPatch(input: unknown): Validation<{
  status?: (typeof PIPELINE_STATUSES)[number];
  priority?: (typeof PRIORITIES)[number];
}> {
  const errors: Record<string, string> = {};
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _: "Body must be a JSON object" } };
  }
  const body = input as Record<string, unknown>;
  const value: {
    status?: (typeof PIPELINE_STATUSES)[number];
    priority?: (typeof PRIORITIES)[number];
  } = {};
  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !PIPELINE_STATUSES.includes(
        body.status as (typeof PIPELINE_STATUSES)[number],
      )
    ) {
      errors.status = "Invalid status";
    } else {
      value.status = body.status as (typeof PIPELINE_STATUSES)[number];
    }
  }
  if (body.priority !== undefined) {
    if (
      typeof body.priority !== "string" ||
      !PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])
    ) {
      errors.priority = "Invalid priority";
    } else {
      value.priority = body.priority as (typeof PRIORITIES)[number];
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value };
}
