import { pgTable, bigint, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const languageEnum = pgEnum("language", ["ru", "en"]);

export const users = pgTable("users", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  username: text("username"),
  language: languageEnum("language"),
  completedCount: integer("completed_count").notNull().default(0),
  cancelledCount: integer("cancelled_count").notNull().default(0),
  disputeCount: integer("dispute_count").notNull().default(0),
  payoutAddress: text("payout_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
