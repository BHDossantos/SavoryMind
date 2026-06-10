import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  doublePrecision,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type {
  AINarrative,
  Attachment,
  BusinessType,
  PipelineStatus,
  Priority,
} from "@/lib/types";

// ---------- NextAuth standard tables ----------
// Names and shapes follow the @auth/drizzle-adapter schema.

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    hashedPassword: text("hashedPassword"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_unique").on(t.email),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ---------- DealFlow tables ----------

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),

    // Billing (Phase 8). Default to free / active so existing rows behave correctly.
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    planTier: text("plan_tier", { enum: ["free", "pro", "team"] })
      .notNull()
      .default("free"),
    planStatus: text("plan_status", {
      enum: ["active", "past_due", "canceled", "trialing", "incomplete"],
    })
      .notNull()
      .default("active"),
    seatCount: integer("seat_count").notNull().default(1),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  },
  (t) => ({
    stripeCustomerIdx: index("workspaces_stripe_customer_idx").on(
      t.stripeCustomerId,
    ),
  }),
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.userId] }),
    userIdx: index("workspace_members_user_idx").on(t.userId),
  }),
);

export const deals = pgTable(
  "deals",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // DealInput — business meta
    name: text("name").notNull(),
    businessType: text("business_type").$type<BusinessType>().notNull(),
    location: text("location").notNull().default(""),
    notes: text("notes"),

    // Financials (stored as double precision — euro values can exceed int range)
    revenue: doublePrecision("revenue").notNull().default(0),
    rent: doublePrecision("rent").notNull().default(0),
    laborCost: doublePrecision("labor_cost").notNull().default(0),
    cogs: doublePrecision("cogs").notNull().default(0),
    utilities: doublePrecision("utilities").notNull().default(0),
    otherExpenses: doublePrecision("other_expenses").notNull().default(0),
    ownerSalary: doublePrecision("owner_salary").notNull().default(0),
    askingPrice: doublePrecision("asking_price").notNull().default(0),

    // Qualitative (0-10)
    locationQuality: integer("location_quality"),
    growthPotential: integer("growth_potential"),
    ownerDependency: integer("owner_dependency"),
    seasonality: integer("seasonality"),

    // Pipeline
    status: text("status").$type<PipelineStatus>().notNull().default("lead"),
    priority: text("priority").$type<Priority>().notNull().default("medium"),

    // Blobs
    attachments: jsonb("attachments").$type<Attachment[]>(),
    aiNarrative: jsonb("ai_narrative").$type<AINarrative>(),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index("deals_workspace_idx").on(t.workspaceId, t.createdAt),
  }),
);

export type DbUser = typeof users.$inferSelect;
export type DbWorkspace = typeof workspaces.$inferSelect;
export type DbDeal = typeof deals.$inferSelect;
export type DbDealInsert = typeof deals.$inferInsert;
