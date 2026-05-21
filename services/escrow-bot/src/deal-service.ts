import { db, deals, users, dealEvents, processedCallbacks, processedTransactions } from "@workspace/db";
import type { Deal, DealStatus, User } from "@workspace/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { canTransition, ACTIVE_STATUSES, type Action } from "./fsm.js";
import { config } from "./config.js";
import { randomBytes } from "node:crypto";

export async function getOrCreateUser(
  id: number,
  username: string | null,
): Promise<User> {
  const existing = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (existing.length > 0) {
    if (username && existing[0].username !== username) {
      await db.update(users).set({ username }).where(eq(users.id, id));
      return { ...existing[0], username };
    }
    return existing[0];
  }
  const [created] = await db
    .insert(users)
    .values({ id, username })
    .returning();
  return created;
}

export async function setLanguage(id: number, language: "ru" | "en") {
  await db.update(users).set({ language }).where(eq(users.id, id));
}

export async function setPayoutAddress(id: number, address: string) {
  await db.update(users).set({ payoutAddress: address }).where(eq(users.id, id));
}

export async function findUserByUsernameOrId(input: string): Promise<User | null> {
  const cleaned = input.trim().replace(/^@/, "");
  if (/^\d+$/.test(cleaned)) {
    const [u] = await db.select().from(users).where(eq(users.id, Number(cleaned))).limit(1);
    return u ?? null;
  }
  const [u] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${cleaned})`)
    .limit(1);
  return u ?? null;
}

export async function getActiveDealsForUser(userId: number): Promise<Deal[]> {
  return await db
    .select()
    .from(deals)
    .where(
      and(
        or(eq(deals.buyerId, userId), eq(deals.sellerId, userId)),
        inArray(deals.status, ACTIVE_STATUSES),
      ),
    )
    .orderBy(deals.createdAt);
}

export async function countActiveDealsForUser(userId: number): Promise<number> {
  const result = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(deals)
    .where(
      and(
        or(eq(deals.buyerId, userId), eq(deals.sellerId, userId)),
        inArray(deals.status, ACTIVE_STATUSES),
      ),
    );
  return result[0]?.c ?? 0;
}

export async function getDeal(id: string): Promise<Deal | null> {
  const [d] = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return d ?? null;
}

export async function getDealByCode(code: string): Promise<Deal | null> {
  const [d] = await db.select().from(deals).where(eq(deals.code, code)).limit(1);
  return d ?? null;
}

function makeCode(): string {
  return "D" + randomBytes(4).toString("hex").toUpperCase();
}

export async function createDeal(input: {
  creatorId: number;
  counterpartyId: number;
  creatorRole: "buyer" | "seller";
  amountNano: bigint;
  terms: string;
}): Promise<Deal> {
  const buyerId = input.creatorRole === "buyer" ? input.creatorId : input.counterpartyId;
  const sellerId = input.creatorRole === "seller" ? input.creatorId : input.counterpartyId;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [d] = await db
        .insert(deals)
        .values({
          code: makeCode(),
          creatorId: input.creatorId,
          counterpartyId: input.counterpartyId,
          buyerId,
          sellerId,
          amountNano: input.amountNano,
          terms: input.terms,
          status: "WAITING_CONFIRMATION",
        })
        .returning();
      await db.insert(dealEvents).values({
        dealId: d.id,
        eventType: "CREATED",
        actorId: input.creatorId,
      });
      return d;
    } catch (e) {
      if (attempt === 4) throw e;
    }
  }
  throw new Error("unreachable");
}

/**
 * Atomically transitions a deal: locks the row, verifies expected source status,
 * validates the action against the FSM, and persists the new status + event.
 * Returns the updated deal, or null if action is not allowed from current state.
 */
export async function transitionDeal(opts: {
  dealId: string;
  action: Action;
  actorId: number | null;
  expectedFrom?: DealStatus[];
  extra?: Partial<typeof deals.$inferInsert>;
  eventPayload?: Record<string, unknown>;
}): Promise<{ ok: true; deal: Deal; from: DealStatus } | { ok: false; reason: string; deal: Deal | null }> {
  return await db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(deals)
      .where(eq(deals.id, opts.dealId))
      .for("update")
      .limit(1);
    if (!d) return { ok: false as const, reason: "not_found", deal: null };

    if (opts.expectedFrom && !opts.expectedFrom.includes(d.status)) {
      return { ok: false as const, reason: "wrong_state", deal: d };
    }
    const next = canTransition(d.status, opts.action);
    if (!next) {
      return { ok: false as const, reason: "forbidden_transition", deal: d };
    }

    const updates: Partial<typeof deals.$inferInsert> = {
      status: next,
      updatedAt: new Date(),
      version: d.version + 1,
      ...(opts.extra || {}),
    };

    const [updated] = await tx
      .update(deals)
      .set(updates)
      .where(and(eq(deals.id, opts.dealId), eq(deals.version, d.version)))
      .returning();

    if (!updated) return { ok: false as const, reason: "version_conflict", deal: d };

    await tx.insert(dealEvents).values({
      dealId: opts.dealId,
      eventType: opts.action,
      actorId: opts.actorId,
      payload: { from: d.status, to: next, ...(opts.eventPayload || {}) },
    });

    return { ok: true as const, deal: updated, from: d.status };
  });
}

/**
 * Idempotency: returns true if the callback was NOT seen before (i.e. proceed).
 * Returns false if it was already processed (i.e. ignore duplicate).
 */
export async function claimCallback(callbackId: string): Promise<boolean> {
  try {
    await db.insert(processedCallbacks).values({ callbackId });
    return true;
  } catch {
    return false;
  }
}

export async function claimTransaction(txHash: string): Promise<boolean> {
  try {
    await db.insert(processedTransactions).values({ txHash });
    return true;
  } catch {
    return false;
  }
}

export async function getPendingPaymentDeals(): Promise<Deal[]> {
  return await db.select().from(deals).where(eq(deals.status, "WAITING_PAYMENT"));
}

export async function bumpUserStat(
  userId: number,
  field: "completedCount" | "cancelledCount" | "disputeCount",
) {
  await db
    .update(users)
    .set({ [field]: sql`${users[field]} + 1` })
    .where(eq(users.id, userId));
}

export const MAX_ACTIVE_DEALS = config.maxActiveDealsPerUser;
