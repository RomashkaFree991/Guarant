import type { DealStatus } from "@workspace/db";

export type Action =
  | "ACCEPT"
  | "REJECT"
  | "CANCEL_PRE_PAY"
  | "PAYMENT_DETECTED"
  | "CANCEL_AFTER_PAY"
  | "SELLER_FULFILLED"
  | "BUYER_CONFIRM"
  | "OPEN_DISPUTE"
  | "ADMIN_TO_BUYER"
  | "ADMIN_TO_SELLER"
  | "ADMIN_CANCEL_DISPUTE"
  | "PAYOUT_DONE";

const T: Record<DealStatus, Partial<Record<Action, DealStatus>>> = {
  WAITING_CONFIRMATION: {
    ACCEPT: "WAITING_PAYMENT",
    REJECT: "CANCELLED",
    CANCEL_PRE_PAY: "CANCELLED",
  },
  WAITING_PAYMENT: {
    PAYMENT_DETECTED: "PAID",
    CANCEL_PRE_PAY: "CANCELLED",
  },
  PAID: {
    SELLER_FULFILLED: "SELLER_FULFILLED",
    CANCEL_AFTER_PAY: "WAITING_PAYOUT_BUYER",
    OPEN_DISPUTE: "DISPUTE",
  },
  SELLER_FULFILLED: {
    BUYER_CONFIRM: "WAITING_PAYOUT_SELLER",
    OPEN_DISPUTE: "DISPUTE",
  },
  DISPUTE: {
    ADMIN_TO_BUYER: "WAITING_PAYOUT_BUYER",
    ADMIN_TO_SELLER: "WAITING_PAYOUT_SELLER",
    ADMIN_CANCEL_DISPUTE: "PAID",
  },
  WAITING_PAYOUT_BUYER: { PAYOUT_DONE: "REFUNDED" },
  WAITING_PAYOUT_SELLER: { PAYOUT_DONE: "COMPLETED" },
  CANCELLED: {},
  COMPLETED: {},
  REFUNDED: {},
};

export function canTransition(from: DealStatus, action: Action): DealStatus | null {
  return T[from]?.[action] ?? null;
}

export const ACTIVE_STATUSES: DealStatus[] = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PAID",
  "SELLER_FULFILLED",
  "DISPUTE",
  "WAITING_PAYOUT_BUYER",
  "WAITING_PAYOUT_SELLER",
];

export function isActive(s: DealStatus): boolean {
  return ACTIVE_STATUSES.includes(s);
}
