import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const processedCallbacks = pgTable("processed_callbacks", {
  callbackId: text("callback_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const processedTransactions = pgTable("processed_transactions", {
  txHash: text("tx_hash").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});
