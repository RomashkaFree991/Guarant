import { pgTable, uuid, bigint, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const dealEvents = pgTable(
  "deal_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id").notNull(),
    eventType: text("event_type").notNull(),
    actorId: bigint("actor_id", { mode: "number" }),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deal_events_deal_idx").on(t.dealId)],
);
