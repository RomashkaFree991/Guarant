import type { Bot } from "grammy";
import { fromNano } from "@ton/ton";
import { logger } from "./logger.js";
import { config, grossNano } from "./config.js";
import { fetchIncomingTransactions } from "./ton.js";
import {
  getPendingPaymentDeals,
  transitionDeal,
  claimTransaction,
  getOrCreateUser,
} from "./deal-service.js";
import { openDealOnlyKb } from "./keyboards.js";
import { setActiveMessage } from "./session.js";
import { t, type Lang } from "./i18n.js";

export function startPaymentWatcher(bot: Bot) {
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await pollOnce(bot);
    } catch (e) {
      logger.warn({ err: String(e) }, "payment watcher tick failed");
    } finally {
      running = false;
    }
  }, config.paymentPollIntervalMs);
}

async function pollOnce(bot: Bot) {
  const pending = await getPendingPaymentDeals();
  if (pending.length === 0) return;
  const byCode = new Map(pending.map((d) => [d.code, d]));
  const txs = await fetchIncomingTransactions(30);

  for (const tx of txs) {
    const code = tx.comment;
    if (!code) continue;
    const deal = byCode.get(code);
    if (!deal) continue;
    // Buyer must pay the gross amount = net (= deal.amountNano stored in DB) + owner fee.
    const expected = grossNano(deal.amountNano);
    if (tx.amountNano < expected) {
      logger.warn(
        { code, expected: expected.toString(), got: tx.amountNano.toString() },
        "payment amount too low",
      );
      continue;
    }
    if (!(await claimTransaction(tx.hash))) continue;

    const r = await transitionDeal({
      dealId: deal.id,
      action: "PAYMENT_DETECTED",
      actorId: null,
      expectedFrom: ["WAITING_PAYMENT"],
      extra: { paymentTxHash: tx.hash },
      eventPayload: { amount_nano: tx.amountNano.toString(), source: tx.source },
    });
    if (!r.ok) continue;

    // Notify both parties that the payment landed. Each gets a single "Open
    // deal" button so the chat stays in mono-menu mode. We send these as
    // user-facing notifications (text + setActiveMessage) so that any older
    // menus they were sitting on — like the pay-instructions screen — are
    // marked stale on the next click.
    const buyerUser = await getOrCreateUser(r.deal.buyerId, null);
    const sellerUser = await getOrCreateUser(r.deal.sellerId, null);
    const buyerLang = (buyerUser.language as Lang) || "ru";
    const sellerLang = (sellerUser.language as Lang) || "ru";
    try {
      const buyerMsg = await bot.api.sendMessage(
        r.deal.buyerId,
        t(buyerLang, "payment_received_buyer"),
        { reply_markup: openDealOnlyKb(buyerLang, r.deal.id), parse_mode: "Markdown" },
      );
      setActiveMessage(r.deal.buyerId, buyerMsg.message_id);
      const sellerMsg = await bot.api.sendMessage(
        r.deal.sellerId,
        t(sellerLang, "payment_received_seller"),
        { reply_markup: openDealOnlyKb(sellerLang, r.deal.id), parse_mode: "Markdown" },
      );
      setActiveMessage(r.deal.sellerId, sellerMsg.message_id);
      // Единственный admin-лог о ходе сделки — оплата. Имена сторон берём из
      // профилей (@username, если есть, иначе цифровой ID).
      const sellerLabel = sellerUser.username
        ? "@" + sellerUser.username
        : String(r.deal.sellerId);
      const buyerLabel = buyerUser.username
        ? "@" + buyerUser.username
        : String(r.deal.buyerId);
      await bot.api.sendMessage(
        config.adminChatId,
        t("ru", "admin_log_paid", {
          code: r.deal.code,
          amount: fromNano(r.deal.amountNano),
          seller: sellerLabel,
          buyer: buyerLabel,
          terms: r.deal.terms,
        }),
      );
    } catch (e) {
      logger.warn({ err: String(e) }, "payment notify failed");
    }
  }
}
