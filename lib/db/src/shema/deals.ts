import {
  pgTable,
  uuid,
  bigint,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const dealStatusEnum = pgEnum("deal_status", [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PAID",
  "SELLER_FULFILLED",
  "DISPUTE",
  "CANCELLED",
  "COMPLETED",
  "WAITING_PAYOUT_BUYER",
  "WAITING_PAYOUT_SELLER",
  "REFUNDED",
]);

export type DealStatus =
  | "WAITING_CONFIRMATION"
  | "WAITING_PAYMENT"
  | "PAID"
  | "SELLER_FULFILLED"
  | "DISPUTE"
  | "CANCELLED"
  | "COMPLETED"
  | "WAITING_PAYOUT_BUYER"
  | "WAITING_PAYOUT_SELLER"
  | "REFUNDED";

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    creatorId: bigint("creator_id", { mode: "number" }).notNull(),
    counterpartyId: bigint("counterparty_id", { mode: "number" }).notNull(),
    buyerId: bigint("buyer_id", { mode: "number" }).notNull(),
    sellerId: bigint("seller_id", { mode: "number" }).notNull(),
    amountNano: bigint("amount_nano", { mode: "bigint" }).notNull(),
    paymentMethod: text("payment_method").notNull().default("TON"),
    terms: text("terms").notNull(),
    status: dealStatusEnum("status").notNull(),
    previousStatus: dealStatusEnum("previous_status"),
    paymentTxHash: text("payment_tx_hash"),
    payoutTxHash: text("payout_tx_hash"),
    payoutAddress: text("payout_address"),
    payoutToUserId: bigint("payout_to_user_id", { mode: "number" }),
    disputeOpenedBy: bigint("dispute_opened_by", { mode: "number" }),
    version: integer("version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deals_buyer_idx").on(t.buyerId),
    index("deals_seller_idx").on(t.sellerId),
    index("deals_status_idx").on(t.status),
  ],
);

export type Deal = typeof deals.$inferSelect;
