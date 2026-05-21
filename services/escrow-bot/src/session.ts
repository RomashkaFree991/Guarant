export type CreateState =
  | { step: "role" }
  | { step: "counterparty"; role: "buyer" | "seller" }
  | { step: "amount"; role: "buyer" | "seller"; counterpartyId: number; counterpartyUsername: string }
  | {
      step: "terms";
      role: "buyer" | "seller";
      counterpartyId: number;
      counterpartyUsername: string;
      amountNano: bigint;
    }
  | {
      step: "summary";
      role: "buyer" | "seller";
      counterpartyId: number;
      counterpartyUsername: string;
      amountNano: bigint;
      terms: string;
    };

export type PayoutState = {
  step: "address" | "confirm";
  dealId: string;
  address?: string;
};

export interface Session {
  create?: CreateState;
  payout?: PayoutState;
  // message_id of the bot's current prompt awaiting user text input.
  // When set, the text handler edits this message in-place instead of sending a new one.
  promptMsgId?: number;
}

const sessions = new Map<number, Session>();

export function getSession(userId: number): Session {
  let s = sessions.get(userId);
  if (!s) {
    s = {};
    sessions.set(userId, s);
  }
  return s;
}

export function clearSession(userId: number) {
  sessions.delete(userId);
}

// Per-user "active interactive message". Only callbacks coming from this message_id
// are considered live; clicks on older messages (the user has scrolled up to a previous
// menu or a stale notification) are rejected with a "stale menu" toast.
const activeMessage = new Map<number, number>();

export function setActiveMessage(userId: number, msgId: number) {
  activeMessage.set(userId, msgId);
}

export function getActiveMessage(userId: number): number | undefined {
  return activeMessage.get(userId);
}

export function clearActiveMessage(userId: number) {
  activeMessage.delete(userId);
}
