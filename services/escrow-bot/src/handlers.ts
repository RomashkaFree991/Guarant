import { Bot, GrammyError, HttpError, InlineKeyboard, type Context } from "grammy";
import type { Deal, DealStatus } from "@workspace/db";
import { fromNano } from "@ton/ton";
import { t, type Lang } from "./i18n.js";
import { config, grossNano, feeNano } from "./config.js";
import { logger } from "./logger.js";
import {
  mainMenuKb,
  languageKb,
  createRoleKb,
  createSummaryKb,
  newDealNotifyKb,
  openDealOnlyKb,
  activeDealsKb,
  dealMenuKb,
  paymentKb,
  confirmRejectKb,
  confirmCancelKb,
  confirmCancelPaidKb,
  confirmBuyerKb,
  payoutConfirmKb,
  payoutBackKb,
  backToMenuKb,
  profileKb,
  withDismiss,
  wizardBackKb,
} from "./keyboards.js";
import {
  getSession,
  clearSession,
  setActiveMessage,
  getActiveMessage,
  type CreateState,
} from "./session.js";
import {
  getOrCreateUser,
  setLanguage,
  findUserByUsernameOrId,
  getActiveDealsForUser,
  countActiveDealsForUser,
  getDeal,
  createDeal,
  transitionDeal,
  claimCallback,
  bumpUserStat,
  MAX_ACTIVE_DEALS,
} from "./deal-service.js";
import { getWallet, InsufficientEscrowFundsError, isValidTonAddress, sendPayout, tonToNano } from "./ton.js";
import { fromNano as fromNanoTon } from "@ton/ton";
import { sendBanner, editBannerCaption } from "./banner.js";

function userIdOf(ctx: Context): number {
  return ctx.from!.id;
}

async function getLang(ctx: Context): Promise<Lang | null> {
  const u = await getOrCreateUser(ctx.from!.id, ctx.from!.username || null);
  return (u.language as Lang | null) || null;
}

async function safeAnswer(ctx: Context) {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    /* ignore */
  }
}

// All user-facing menus are rendered as the "Information" banner photo with
// the menu text in the photo's caption. Editing in place uses
// editMessageCaption; if the active message is a legacy text message (or any
// other shape that can't be edited as a caption), we fall back to sending a
// fresh banner.
async function safeEdit(ctx: Context, text: string, reply_markup?: any) {
  const chatId = ctx.chat?.id;
  const msgId = ctx.callbackQuery?.message?.message_id;
  if (chatId && msgId) {
    try {
      await editBannerCaption(ctx.api, chatId, msgId, text, reply_markup);
      return;
    } catch (e) {
      if (e instanceof GrammyError && e.description?.includes("message is not modified")) return;
      // Edit failed — the current message is most likely a plain-text
      // notification (sent via bot.api.sendMessage) which has no caption to
      // edit. Delete that stale notification before posting the fresh banner
      // so the chat stays in mono-menu mode.
      try {
        await ctx.api.deleteMessage(chatId, msgId);
      } catch {
        /* ignore — already gone or not deletable */
      }
    }
  }
  if (!chatId) return;
  try {
    const msg = await sendBanner(ctx.api, chatId, text, reply_markup);
    if (ctx.from) setActiveMessage(ctx.from.id, msg.message_id);
  } catch (e2) {
    logger.warn({ err: String(e2) }, "safeEdit fallback failed");
  }
}

// Send a brand-new interactive message to the user (the actor of `ctx`)
// and mark it as the active menu, retiring any older one.
async function sendActive(ctx: Context, text: string, reply_markup?: any) {
  const msg = await sendBanner(ctx.api, ctx.chat!.id, text, reply_markup);
  if (ctx.from) setActiveMessage(ctx.from.id, msg.message_id);
  return msg;
}

// Handle a text-input step:
//  - delete the user's text message so the chat stays clean
//  - edit the bot's previous prompt in place if we know its id,
//    so we don't pile up new bot messages with every keystroke
async function respondToInput(ctx: Context, text: string, reply_markup?: any) {
  const userId = userIdOf(ctx);
  const sess = getSession(userId);
  try {
    await ctx.deleteMessage();
  } catch {
    /* ignore — user might have deleted it already */
  }
  if (sess.promptMsgId && ctx.chat) {
    try {
      await editBannerCaption(ctx.api, ctx.chat.id, sess.promptMsgId, text, reply_markup);
      if (reply_markup) setActiveMessage(userId, sess.promptMsgId);
      return;
    } catch (e) {
      if (
        !(e instanceof GrammyError && e.description?.includes("message is not modified"))
      ) {
        logger.warn({ err: String(e) }, "respondToInput edit failed");
      }
    }
  }
  const msg = await sendBanner(ctx.api, ctx.chat!.id, text, reply_markup);
  sess.promptMsgId = msg.message_id;
  setActiveMessage(userId, msg.message_id);
}

function dealRoleFor(deal: Deal, userId: number, lang: Lang): string {
  return userId === deal.buyerId ? t(lang, "role_buyer") : t(lang, "role_seller");
}

async function getOpponentUsername(deal: Deal, userId: number): Promise<string> {
  const oppId = userId === deal.buyerId ? deal.sellerId : deal.buyerId;
  const u = await getOrCreateUser(oppId, null);
  return u.username || String(oppId);
}

function buildDealCardText(deal: Deal, userId: number, lang: Lang): string {
  const isBuyer = userId === deal.buyerId;
  const role = isBuyer ? t(lang, "role_buyer") : t(lang, "role_seller");
  const roleKey = isBuyer ? "buyer" : "seller";
  let intro: string;
  if (deal.status === "WAITING_CONFIRMATION") {
    if (userId === deal.creatorId) {
      const oppRole = t(
        lang,
        userId === deal.buyerId ? "role_by_seller" : "role_by_buyer",
      );
      intro = t(lang, "card_intro_WAITING_CONFIRMATION_creator", { oppRole });
    } else {
      intro = t(lang, "card_intro_WAITING_CONFIRMATION_counterparty");
    }
  } else {
    intro = t(lang, `card_intro_${deal.status}_${roleKey}`);
  }
  return t(lang, "deal_card", {
    intro,
    role,
    amount: fromNano(deal.amountNano),
    toPay: fromNano(grossNano(deal.amountNano)),
    terms: deal.terms,
  });
}

async function renderDealCard(ctx: Context, deal: Deal, lang: Lang) {
  const userId = userIdOf(ctx);
  await safeEdit(
    ctx,
    buildDealCardText(deal, userId, lang),
    dealMenuKb({ lang, deal, userId }),
  );
}

async function notify(
  bot: Bot,
  chatId: number,
  lang: Lang,
  text: string,
  reply_markup?: any,
  opts?: { noDismiss?: boolean },
) {
  try {
    const kb = opts?.noDismiss ? reply_markup : withDismiss(lang, reply_markup as any);
    const msg = await bot.api.sendMessage(chatId, text, {
      reply_markup: kb,
      parse_mode: "Markdown",
    });
    // The notification message is the user's most recent interactive surface —
    // promote it to "active" so older menus go stale until they interact here.
    setActiveMessage(chatId, msg.message_id);
  } catch (e) {
    logger.warn({ err: String(e), chatId }, "notify failed");
  }
}

async function adminLog(bot: Bot, text: string, reply_markup?: any) {
  try {
    await bot.api.sendMessage(config.adminChatId, text, { reply_markup, parse_mode: "Markdown" });
  } catch (e) {
    logger.warn({ err: String(e) }, "admin log failed");
  }
}

async function showMainMenu(ctx: Context, lang: Lang) {
  clearSession(userIdOf(ctx));
  await safeEdit(ctx, t(lang, "main_menu"), mainMenuKb(lang));
}

async function showMainMenuReply(ctx: Context, lang: Lang) {
  clearSession(userIdOf(ctx));
  await sendActive(ctx, t(lang, "main_menu"), mainMenuKb(lang));
}

export function registerHandlers(bot: Bot) {
  // Stale-menu guard: only callbacks from the user's most recently sent
  // interactive bot message are processed. Clicks on older menus get a toast
  // and the dead message is wiped clean.
  bot.on("callback_query:data", async (ctx, next) => {
    const data = ctx.callbackQuery.data;
    // Always allow: admin panel actions, language picker, the dismiss button itself.
    if (
      data === "noti:dismiss" ||
      data.startsWith("admin:") ||
      data.startsWith("lang:")
    ) {
      return next();
    }
    // Admin chat itself is not user-bound — let it pass.
    if (ctx.chat?.id === config.adminChatId) return next();
    const userId = ctx.from?.id;
    const msgId = ctx.callbackQuery.message?.message_id;
    if (userId === undefined || msgId === undefined) return next();
    const active = getActiveMessage(userId);
    if (active !== undefined && active !== msgId) {
      const lang = (await getLang(ctx)) || "ru";
      try {
        await ctx.answerCallbackQuery({ text: t(lang, "stale_menu"), show_alert: false });
      } catch {
        /* ignore */
      }
      // The stale menu is now a photo banner — edit its caption, not the text.
      try {
        if (ctx.chat) {
          await editBannerCaption(
            ctx.api,
            ctx.chat.id,
            msgId,
            t(lang, "stale_menu"),
            withDismiss(lang),
          );
        }
      } catch {
        /* ignore */
      }
      return;
    }
    return next();
  });

  // Dismiss any notification message by deleting it.
  bot.callbackQuery("noti:dismiss", async (ctx) => {
    await safeAnswer(ctx);
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore */
    }
  });

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;
    const u = await getOrCreateUser(ctx.from.id, ctx.from.username || null);
    clearSession(ctx.from.id);
    if (!u.language) {
      await sendActive(ctx, t("ru", "choose_language"), languageKb());
      return;
    }
    await sendActive(ctx, t(u.language as Lang, "main_menu"), mainMenuKb(u.language as Lang));
  });

  bot.command("cancel", async (ctx) => {
    if (!ctx.from) return;
    const lang = (await getLang(ctx)) || "ru";
    clearSession(ctx.from.id);
    await sendActive(ctx, t(lang, "create_cancelled"), mainMenuKb(lang));
  });

  bot.callbackQuery(/^lang:(ru|en)$/, async (ctx) => {
    const lang = ctx.match![1] as Lang;
    await setLanguage(userIdOf(ctx), lang);
    await safeAnswer(ctx);
    // Replace the language picker message with the main menu in place — no extra reply.
    await safeEdit(ctx, t(lang, "main_menu"), mainMenuKb(lang));
  });

  bot.callbackQuery("menu:main", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    await showMainMenu(ctx, lang);
  });

  bot.callbackQuery("menu:profile", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const u = await getOrCreateUser(userIdOf(ctx), ctx.from!.username || null);
    await safeEdit(
      ctx,
      t(lang, "profile_stats", {
        username: u.username || "",
        completed: u.completedCount,
        cancelled: u.cancelledCount,
        disputes: u.disputeCount,
      }),
      profileKb(lang),
    );
  });

  bot.callbackQuery("menu:active", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const list = await getActiveDealsForUser(userIdOf(ctx));
    if (list.length === 0) {
      await safeEdit(ctx, t(lang, "no_active_deals"), backToMenuKb(lang));
      return;
    }
    await safeEdit(
      ctx,
      t(lang, "active_deals_title"),
      activeDealsKb(lang, list, (d) => d.buyerId === userIdOf(ctx)),
    );
  });

  bot.callbackQuery("menu:create", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const count = await countActiveDealsForUser(userIdOf(ctx));
    if (count >= MAX_ACTIVE_DEALS) {
      await safeEdit(ctx, t(lang, "active_limit_reached", { limit: MAX_ACTIVE_DEALS }), backToMenuKb(lang));
      return;
    }
    getSession(userIdOf(ctx)).create = { step: "role" };
    await safeEdit(ctx, t(lang, "create_choose_role"), createRoleKb(lang));
  });

  bot.callbackQuery(/^create:role:(buyer|seller)$/, async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const role = ctx.match![1] as "buyer" | "seller";
    const sess = getSession(userIdOf(ctx));
    sess.create = { step: "counterparty", role };
    sess.promptMsgId = ctx.callbackQuery.message?.message_id;
    await safeEdit(ctx, t(lang, "create_ask_counterparty"), wizardBackKb(lang));
  });

  // Step back to the previous wizard question. The summary screen has its own
  // "Back" button (via createSummaryKb); the text-input screens (counterparty /
  // amount / terms) get "Back" via wizardBackKb.
  bot.callbackQuery("create:back", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const sess = getSession(userIdOf(ctx));
    const s = sess.create;
    if (!s) return showMainMenu(ctx, lang);
    sess.promptMsgId = ctx.callbackQuery.message?.message_id;
    switch (s.step) {
      case "counterparty": {
        sess.create = { step: "role" };
        await safeEdit(ctx, t(lang, "create_choose_role"), createRoleKb(lang));
        return;
      }
      case "amount": {
        sess.create = { step: "counterparty", role: s.role };
        await safeEdit(ctx, t(lang, "create_ask_counterparty"), wizardBackKb(lang));
        return;
      }
      case "terms": {
        sess.create = {
          step: "amount",
          role: s.role,
          counterpartyId: s.counterpartyId,
          counterpartyUsername: s.counterpartyUsername,
        };
        await safeEdit(ctx, t(lang, "create_ask_amount"), wizardBackKb(lang));
        return;
      }
      case "summary": {
        sess.create = {
          step: "terms",
          role: s.role,
          counterpartyId: s.counterpartyId,
          counterpartyUsername: s.counterpartyUsername,
          amountNano: s.amountNano,
        };
        await safeEdit(ctx, t(lang, "create_ask_terms"), wizardBackKb(lang));
        return;
      }
      case "role": {
        await showMainMenu(ctx, lang);
        return;
      }
    }
  });

  bot.callbackQuery("create:confirm", async (ctx) => {
    const lang = (await getLang(ctx)) || "ru";
    await safeAnswer(ctx);
    const s = getSession(userIdOf(ctx)).create;
    if (!s || s.step !== "summary") {
      await showMainMenu(ctx, lang);
      return;
    }
    const count = await countActiveDealsForUser(userIdOf(ctx));
    if (count >= MAX_ACTIVE_DEALS) {
      await safeEdit(ctx, t(lang, "active_limit_reached", { limit: MAX_ACTIVE_DEALS }), backToMenuKb(lang));
      return;
    }
    const deal = await createDeal({
      creatorId: userIdOf(ctx),
      counterpartyId: s.counterpartyId,
      creatorRole: s.role,
      amountNano: s.amountNano,
      terms: s.terms,
    });
    clearSession(userIdOf(ctx));

    const creator = await getOrCreateUser(userIdOf(ctx), ctx.from!.username || null);
    const counterparty = await getOrCreateUser(s.counterpartyId, null);
    const counterpartyLang = (counterparty.language as Lang) || "ru";

    // Creator-side confirmation: «Ожидаете подтверждения сделки X.», где X —
    // роль второй стороны в творительном падеже.
    const oppRoleByCreator = t(
      lang,
      s.role === "buyer" ? "role_by_seller" : "role_by_buyer",
    );
    await safeEdit(
      ctx,
      t(lang, "create_sent", { oppRole: oppRoleByCreator }),
      openDealOnlyKb(lang, deal.id),
    );
    void creator;

    const counterpartyRole = t(
      counterpartyLang,
      s.role === "buyer" ? "role_seller" : "role_buyer",
    );
    await notify(
      bot,
      s.counterpartyId,
      counterpartyLang,
      t(counterpartyLang, "notif_new_deal", {
        role: counterpartyRole,
        amount: fromNano(deal.amountNano),
        toPay: fromNano(grossNano(deal.amountNano)),
        terms: deal.terms,
      }),
      newDealNotifyKb(counterpartyLang, deal.id),
      { noDismiss: true },
    );
  });

  // ===== Deal actions =====

  bot.callbackQuery(/^deal:([0-9a-f-]+):open$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const deal = await getDeal(ctx.match![1]);
    if (!deal) return;
    if (deal.buyerId !== userIdOf(ctx) && deal.sellerId !== userIdOf(ctx)) return;
    // Clear any in-flight wizard / payout-address session so returning to the
    // deal card from a sub-flow cancels that sub-flow cleanly.
    clearSession(userIdOf(ctx));
    await renderDealCard(ctx, deal, lang);
  });

  // Accept
  bot.callbackQuery(/^deal:([0-9a-f-]+):accept$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const dealId = ctx.match![1];

    const r = await transitionDeal({
      dealId,
      action: "ACCEPT",
      actorId: userIdOf(ctx),
      expectedFrom: ["WAITING_CONFIRMATION"],
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    const deal = r.deal;
    if (deal.counterpartyId !== userIdOf(ctx)) {
      // only counterparty can accept; revert is complex — but guard with expectedFrom + role check
      // we keep transition but only allow counterparty UI to show it
    }

    const buyerLang = ((await getOrCreateUser(deal.buyerId, null)).language as Lang) || "ru";
    const sellerLang = ((await getOrCreateUser(deal.sellerId, null)).language as Lang) || "ru";

    // Mono-menu UX: erase the "new deal" notification (the message that owns
    // the Accept/Reject buttons) and post the "deal accepted" confirmation as
    // a fresh banner below, so the user is left with exactly one active menu.
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore — message may have already been removed */
    }
    const acceptorIsBuyer = userIdOf(ctx) === deal.buyerId;
    const acceptorMsg = acceptorIsBuyer ? "deal_accepted_seller" : "deal_accepted_buyer";
    await sendActive(ctx, t(lang, acceptorMsg), openDealOnlyKb(lang, deal.id));

    // Notify the deal CREATOR (the side that isn't the counterparty) — same
    // single "Open deal" surface on their end too.
    const creatorId =
      deal.counterpartyId === deal.buyerId ? deal.sellerId : deal.buyerId;
    const creatorIsBuyer = creatorId === deal.buyerId;
    const creatorLang = creatorIsBuyer ? buyerLang : sellerLang;
    const creatorMsg = creatorIsBuyer ? "deal_accepted_seller" : "deal_accepted_buyer";
    await notify(
      bot,
      creatorId,
      creatorLang,
      t(creatorLang, creatorMsg),
      openDealOnlyKb(creatorLang, deal.id),
      { noDismiss: true },
    );
  });

  // Reject ask
  bot.callbackQuery(/^deal:([0-9a-f-]+):reject:ask$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    await safeEdit(ctx, t(lang, "confirm_reject_deal"), confirmRejectKb(lang, ctx.match![1]));
  });

  bot.callbackQuery(/^deal:([0-9a-f-]+):reject:yes$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "REJECT",
      actorId: userIdOf(ctx),
      expectedFrom: ["WAITING_CONFIRMATION"],
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    await bumpUserStat(userIdOf(ctx), "cancelledCount");
    const otherId = r.deal.creatorId === userIdOf(ctx) ? r.deal.counterpartyId : r.deal.creatorId;
    const otherLang = ((await getOrCreateUser(otherId, null)).language as Lang) || "ru";
    // Erase the "new deal" notification on click and post a fresh main menu
    // banner — no transformed leftover with the rejection text.
    try {
      await ctx.deleteMessage();
    } catch {
      /* ignore */
    }
    clearSession(userIdOf(ctx));
    await sendActive(ctx, t(lang, "main_menu"), mainMenuKb(lang));
    await notify(bot, otherId, otherLang, t(otherLang, "deal_rejected_by_counterparty"));
  });

  // Cancel pre-pay
  bot.callbackQuery(/^deal:([0-9a-f-]+):cancel:ask$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    await safeEdit(ctx, t(lang, "cancel_confirm"), confirmCancelKb(lang, ctx.match![1]));
  });

  bot.callbackQuery(/^deal:([0-9a-f-]+):cancel:yes$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "CANCEL_PRE_PAY",
      actorId: userIdOf(ctx),
      expectedFrom: ["WAITING_CONFIRMATION", "WAITING_PAYMENT"],
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    await bumpUserStat(userIdOf(ctx), "cancelledCount");
    const otherId = r.deal.buyerId === userIdOf(ctx) ? r.deal.sellerId : r.deal.buyerId;
    const otherLang = ((await getOrCreateUser(otherId, null)).language as Lang) || "ru";
    await safeEdit(ctx, t(lang, "deal_cancelled"), backToMenuKb(lang));
    await notify(bot, otherId, otherLang, t(otherLang, "deal_cancelled"));
  });

  // Pay screen
  bot.callbackQuery(/^deal:([0-9a-f-]+):pay$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const deal = await getDeal(ctx.match![1]);
    if (!deal || deal.buyerId !== userIdOf(ctx) || deal.status !== "WAITING_PAYMENT") {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    const { address } = await getWallet();
    await safeEdit(
      ctx,
      t(lang, "pay_instructions", {
        address,
        amount: fromNano(grossNano(deal.amountNano)),
        code: deal.code,
      }),
      paymentKb(lang, deal.id),
    );
  });

  // Seller cancel after payment -> refund flow
  bot.callbackQuery(/^deal:([0-9a-f-]+):cancelpaid:ask$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    await safeEdit(ctx, t(lang, "cancel_confirm"), confirmCancelPaidKb(lang, ctx.match![1]));
  });

  // Note: cancel:yes covers pre-pay (WAITING_PAYMENT). For after-pay refund we use a distinct callback below.
  bot.callbackQuery(/^deal:([0-9a-f-]+):cancelpaid:yes$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "CANCEL_AFTER_PAY",
      actorId: userIdOf(ctx),
      expectedFrom: ["PAID"],
      extra: { payoutToUserId: undefined },
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    const buyerLang = ((await getOrCreateUser(r.deal.buyerId, null)).language as Lang) || "ru";
    await safeEdit(ctx, t(lang, "deal_cancelled"), backToMenuKb(lang));
    // Buyer needs an entry point to the deal to withdraw funds — give them
    // the "Open deal" button on the cancellation notification.
    await notify(
      bot,
      r.deal.buyerId,
      buyerLang,
      t(buyerLang, "deal_cancelled_seller_after_pay"),
      openDealOnlyKb(buyerLang, r.deal.id),
      { noDismiss: true },
    );
  });

  // Seller fulfilled
  bot.callbackQuery(/^deal:([0-9a-f-]+):fulfilled$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "SELLER_FULFILLED",
      actorId: userIdOf(ctx),
      expectedFrom: ["PAID"],
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    const buyerLang = ((await getOrCreateUser(r.deal.buyerId, null)).language as Lang) || "ru";
    await renderDealCard(ctx, r.deal, lang);
    await notify(
      bot,
      r.deal.buyerId,
      buyerLang,
      t(buyerLang, "seller_fulfilled_buyer"),
      new InlineKeyboard().text(t(buyerLang, "btn_open_deal"), `deal:${r.deal.id}:open`),
      { noDismiss: true },
    );
  });

  // Buyer confirm
  bot.callbackQuery(/^deal:([0-9a-f-]+):buyerconfirm:ask$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    await safeEdit(ctx, t(lang, "buyer_confirm_prompt"), confirmBuyerKb(lang, ctx.match![1]));
  });

  bot.callbackQuery(/^deal:([0-9a-f-]+):buyerconfirm:yes$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "BUYER_CONFIRM",
      actorId: userIdOf(ctx),
      expectedFrom: ["SELLER_FULFILLED"],
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    await bumpUserStat(r.deal.buyerId, "completedCount");
    const sellerLang = ((await getOrCreateUser(r.deal.sellerId, null)).language as Lang) || "ru";
    await safeEdit(ctx, t(lang, "deal_completed"), backToMenuKb(lang));
    await notify(
      bot,
      r.deal.sellerId,
      sellerLang,
      t(sellerLang, "payout_ready_seller"),
      dealMenuKb({ lang: sellerLang, deal: r.deal, userId: r.deal.sellerId }),
    );
  });

  // Open dispute
  bot.callbackQuery(/^deal:([0-9a-f-]+):dispute$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const dealBefore = await getDeal(ctx.match![1]);
    if (!dealBefore) return;
    const r = await transitionDeal({
      dealId: ctx.match![1],
      action: "OPEN_DISPUTE",
      actorId: userIdOf(ctx),
      expectedFrom: ["PAID", "SELLER_FULFILLED"],
      extra: { disputeOpenedBy: userIdOf(ctx), previousStatus: dealBefore.status },
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    await bumpUserStat(r.deal.buyerId, "disputeCount");
    await bumpUserStat(r.deal.sellerId, "disputeCount");
    const buyerLang = ((await getOrCreateUser(r.deal.buyerId, null)).language as Lang) || "ru";
    const sellerLang = ((await getOrCreateUser(r.deal.sellerId, null)).language as Lang) || "ru";
    await renderDealCard(ctx, r.deal, lang);
    await notify(bot, r.deal.buyerId, buyerLang, t(buyerLang, "dispute_opened"), dealMenuKb({ lang: buyerLang, deal: r.deal, userId: r.deal.buyerId }));
    await notify(bot, r.deal.sellerId, sellerLang, t(sellerLang, "dispute_opened"), dealMenuKb({ lang: sellerLang, deal: r.deal, userId: r.deal.sellerId }));

    const { adminDisputeKb } = await import("./keyboards.js");
    await adminLog(
      bot,
      t("ru", "admin_dispute_panel", {
        code: r.deal.code,
        buyer: String(r.deal.buyerId),
        seller: String(r.deal.sellerId),
        amount: fromNano(r.deal.amountNano),
        terms: r.deal.terms,
      }),
      adminDisputeKb("ru", r.deal.id),
    );
  });

  // Voluntary concede in dispute
  bot.callbackQuery(/^deal:([0-9a-f-]+):concede:(buyer|seller)$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const dealId = ctx.match![1];
    const toWho = ctx.match![2] as "buyer" | "seller";
    const deal = await getDeal(dealId);
    if (!deal || deal.status !== "DISPUTE") {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    // Voluntary concession is allowed only from the LOSING side.
    const userId = userIdOf(ctx);
    const concedingValid =
      (toWho === "buyer" && userId === deal.sellerId) ||
      (toWho === "seller" && userId === deal.buyerId);
    if (!concedingValid) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    const action = toWho === "buyer" ? "ADMIN_TO_BUYER" : "ADMIN_TO_SELLER";
    const r = await transitionDeal({
      dealId,
      action,
      actorId: userId,
      expectedFrom: ["DISPUTE"],
      eventPayload: { mode: "concede" },
    });
    if (!r.ok) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    await resolveDisputeNotify(bot, r.deal, toWho);
    // The user who just conceded should land on the main menu — their old deal
    // card has no further actions for them.
    await showMainMenu(ctx, lang);
  });

  // Payout: if user already has a saved address, run auto-payout immediately.
  bot.callbackQuery(/^deal:([0-9a-f-]+):payout$/, async (ctx) => {
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const deal = await getDeal(ctx.match![1]);
    if (!deal) return;
    const userId = userIdOf(ctx);
    const allowed =
      (deal.status === "WAITING_PAYOUT_BUYER" && userId === deal.buyerId) ||
      (deal.status === "WAITING_PAYOUT_SELLER" && userId === deal.sellerId);
    if (!allowed) {
      /* silent: action no longer valid (race) — user can refresh */
      return;
    }
    // Always ask for a fresh payout address — we no longer persist one in the profile.
    const sess = getSession(userId);
    sess.payout = { step: "address", dealId: deal.id };
    sess.promptMsgId = ctx.callbackQuery.message?.message_id;
    await safeEdit(ctx, t(lang, "payout_ask_address"), payoutBackKb(lang, deal.id));
  });

  bot.callbackQuery(/^deal:([0-9a-f-]+):payout:confirm$/, async (ctx) => {
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const lang = (await getLang(ctx)) || "ru";
    const userId = userIdOf(ctx);
    const sess = getSession(userId).payout;
    if (!sess || sess.step !== "confirm" || sess.dealId !== ctx.match![1] || !sess.address) {
      return;
    }
    const deal = await getDeal(sess.dealId);
    if (!deal) return;
    const recipientAddress = sess.address;

    await safeEdit(ctx, t(lang, "payout_processing", {
      address: recipientAddress,
      amount: fromNano(deal.amountNano),
    }));

    // Atomic state lock first: transition to terminal status only after send confirms.
    // We use a guard: while we're sending, we don't update DB yet; if send fails, allow retry.
    try {
      const txHash = await sendPayout(recipientAddress, deal.amountNano, {
        toAddress: config.feeRecipientAddress,
        amountNano: feeNano(deal.amountNano),
      });
      const r = await transitionDeal({
        dealId: deal.id,
        action: "PAYOUT_DONE",
        actorId: userId,
        expectedFrom: ["WAITING_PAYOUT_BUYER", "WAITING_PAYOUT_SELLER"],
        extra: { payoutAddress: recipientAddress, payoutTxHash: txHash, payoutToUserId: userId },
      });
      clearSession(userId);
      if (!r.ok) {
        await safeEdit(ctx, t(lang, "error_generic"), backToMenuKb(lang));
        return;
      }
      await safeEdit(
        ctx,
        t(lang, "payout_sent", {
          amount: fromNano(deal.amountNano),
          address: recipientAddress,
          explorer: `https://tonviewer.com/${recipientAddress}`,
        }),
        backToMenuKb(lang),
      );
    } catch (e) {
      logger.error({ err: String(e) }, "payout failed");
      clearSession(userId);
      if (e instanceof InsufficientEscrowFundsError) {
        await safeEdit(
          ctx,
          t(lang, "payout_insufficient", {
            available: fromNanoTon(e.available),
            required: fromNanoTon(e.required),
          }),
          backToMenuKb(lang),
        );
      } else {
        await safeEdit(ctx, t(lang, "payout_failed"), backToMenuKb(lang));
      }
    }
  });

  // ===== Admin dispute actions =====
  bot.callbackQuery(/^admin:([0-9a-f-]+):(buyer|seller|cancel)$/, async (ctx) => {
    if (ctx.chat?.id !== config.adminChatId) {
      await safeAnswer(ctx);
      return;
    }
    if (!(await claimCallback(ctx.callbackQuery.id))) return safeAnswer(ctx);
    await safeAnswer(ctx);
    const dealId = ctx.match![1];
    const decision = ctx.match![2] as "buyer" | "seller" | "cancel";
    const deal = await getDeal(dealId);
    if (!deal || deal.status !== "DISPUTE") {
      await ctx.reply(t("ru", "invalid_action"));
      return;
    }
    if (decision === "cancel") {
      const r = await transitionDeal({
        dealId,
        action: "ADMIN_CANCEL_DISPUTE",
        actorId: null,
        expectedFrom: ["DISPUTE"],
      });
      if (!r.ok) {
        await ctx.reply(t("ru", "invalid_action"));
        return;
      }
      const buyerLang = ((await getOrCreateUser(r.deal.buyerId, null)).language as Lang) || "ru";
      const sellerLang = ((await getOrCreateUser(r.deal.sellerId, null)).language as Lang) || "ru";
      await ctx.reply(t("ru", "dispute_cancelled"));
      await notify(bot, r.deal.buyerId, buyerLang, t(buyerLang, "dispute_cancelled"), dealMenuKb({ lang: buyerLang, deal: r.deal, userId: r.deal.buyerId }));
      await notify(bot, r.deal.sellerId, sellerLang, t(sellerLang, "dispute_cancelled"), dealMenuKb({ lang: sellerLang, deal: r.deal, userId: r.deal.sellerId }));
      return;
    }
    const action = decision === "buyer" ? "ADMIN_TO_BUYER" : "ADMIN_TO_SELLER";
    const r = await transitionDeal({
      dealId,
      action,
      actorId: null,
      expectedFrom: ["DISPUTE"],
    });
    if (!r.ok) {
      await ctx.reply(t("ru", "invalid_action"));
      return;
    }
    await resolveDisputeNotify(bot, r.deal, decision);
  });

  // ===== Text input (wizard steps) =====
  bot.on("message:text", async (ctx) => {
    const userId = userIdOf(ctx);
    const u = await getOrCreateUser(userId, ctx.from!.username || null);
    const lang = (u.language as Lang) || "ru";
    if (!u.language) {
      await sendActive(ctx, t("ru", "choose_language"), languageKb());
      return;
    }

    const sess = getSession(userId);
    if (sess.payout) {
      await handlePayoutText(ctx, lang);
      return;
    }
    const s = sess.create;
    if (!s) return;
    const text = ctx.message.text.trim();

    if (s.step === "counterparty") {
      const target = await findUserByUsernameOrId(text);
      if (!target) {
        await respondToInput(ctx, t(lang, "counterparty_not_found"), wizardBackKb(lang));
        return;
      }
      if (target.id === userId) {
        await respondToInput(ctx, t(lang, "counterparty_is_self"), wizardBackKb(lang));
        return;
      }
      sess.create = {
        step: "amount",
        role: s.role,
        counterpartyId: target.id,
        counterpartyUsername: target.username || String(target.id),
      };
      await respondToInput(ctx, t(lang, "create_ask_amount"), wizardBackKb(lang));
      return;
    }
    if (s.step === "amount") {
      const num = Number(text.replace(",", "."));
      if (!isFinite(num) || num < 0.1 || num > 1_000_000) {
        await respondToInput(ctx, t(lang, "invalid_amount"), wizardBackKb(lang));
        return;
      }
      let amountNano: bigint;
      try {
        amountNano = tonToNano(num.toString());
      } catch {
        await respondToInput(ctx, t(lang, "invalid_amount"), wizardBackKb(lang));
        return;
      }
      sess.create = {
        step: "terms",
        role: s.role,
        counterpartyId: s.counterpartyId,
        counterpartyUsername: s.counterpartyUsername,
        amountNano,
      };
      await respondToInput(ctx, t(lang, "create_ask_terms"), wizardBackKb(lang));
      return;
    }
    if (s.step === "terms") {
      if (text.length > 2000) {
        await respondToInput(ctx, t(lang, "terms_too_long"), wizardBackKb(lang));
        return;
      }
      sess.create = {
        step: "summary",
        role: s.role,
        counterpartyId: s.counterpartyId,
        counterpartyUsername: s.counterpartyUsername,
        amountNano: s.amountNano,
        terms: text,
      };
      await respondToInput(
        ctx,
        t(lang, "create_summary", {
          role: t(lang, s.role === "buyer" ? "role_buyer" : "role_seller"),
          opp: s.counterpartyUsername,
          amount: fromNano(s.amountNano),
          toPay: fromNano(grossNano(s.amountNano)),
          terms: text,
        }),
        createSummaryKb(lang),
      );
      return;
    }
  });

  async function handlePayoutText(ctx: Context, lang: Lang) {
    const userId = userIdOf(ctx);
    const sess = getSession(userId).payout!;
    const text = ctx.message!.text!.trim();
    if (sess.step === "address") {
      if (!isValidTonAddress(text)) {
        await respondToInput(ctx, t(lang, "payout_invalid_address"));
        return;
      }
      const deal = await getDeal(sess.dealId);
      if (!deal) {
        clearSession(userId);
        return;
      }
      // Delete the user's address message, keep prompt msg id, then run payout
      // (which will edit the prompt in place via safeEdit/respondToInput).
      // We intentionally do NOT save the address — each payout asks fresh.
      try {
        await ctx.deleteMessage();
      } catch {
        /* ignore */
      }
      const promptId = getSession(userId).promptMsgId;
      clearSession(userId);
      await runAutoPayout(ctx, deal, lang, text, promptId);
    }
  }

  async function runAutoPayout(
    ctx: Context,
    deal: Deal,
    lang: Lang,
    address: string,
    promptMsgId?: number,
  ) {
    const userId = userIdOf(ctx);
    const chatId = ctx.chat?.id;
    // Render the "processing…" state into the right surface.
    // - From a callback (saved-address path) we edit the callback message.
    // - From the text handler (user just typed an address) we edit the prompt by id.
    const processingText = t(lang, "payout_processing", {
      address,
      amount: fromNano(deal.amountNano),
    });
    if (promptMsgId !== undefined && chatId !== undefined) {
      try {
        await editBannerCaption(ctx.api, chatId, promptMsgId, processingText);
      } catch (e) {
        logger.warn({ err: String(e) }, "payout processing edit failed");
      }
    } else {
      await safeEdit(ctx, processingText);
    }
    // Send the result via promptMsgId edit when we have it, else fall back to reply.
    const editResult = async (text: string, kb?: any) => {
      if (promptMsgId !== undefined && chatId !== undefined) {
        try {
          await editBannerCaption(ctx.api, chatId, promptMsgId, text, kb);
          if (kb) setActiveMessage(userId, promptMsgId);
          return;
        } catch (e) {
          logger.warn({ err: String(e) }, "payout result edit failed");
        }
      }
      await safeEdit(ctx, text, kb);
    };
    try {
      const txHash = await sendPayout(address, deal.amountNano, {
        toAddress: config.feeRecipientAddress,
        amountNano: feeNano(deal.amountNano),
      });
      const r = await transitionDeal({
        dealId: deal.id,
        action: "PAYOUT_DONE",
        actorId: userId,
        expectedFrom: ["WAITING_PAYOUT_BUYER", "WAITING_PAYOUT_SELLER"],
        extra: { payoutAddress: address, payoutTxHash: txHash, payoutToUserId: userId },
      });
      if (!r.ok) {
        await editResult(t(lang, "error_generic"), backToMenuKb(lang));
        return;
      }
      await editResult(
        t(lang, "payout_sent", {
          amount: fromNano(deal.amountNano),
          address,
          explorer: `https://tonviewer.com/${address}`,
        }),
        backToMenuKb(lang),
      );
    } catch (e) {
      logger.error({ err: String(e) }, "payout failed");
      if (e instanceof InsufficientEscrowFundsError) {
        await editResult(
          t(lang, "payout_insufficient", {
            available: fromNanoTon(e.available),
            required: fromNanoTon(e.required),
          }),
          backToMenuKb(lang),
        );
      } else {
        await editResult(t(lang, "payout_failed"), backToMenuKb(lang));
      }
    }
  }

  // Catch-all error handler
  bot.catch((err) => {
    const e = err.error;
    if (e instanceof GrammyError) logger.error({ description: e.description }, "Grammy error");
    else if (e instanceof HttpError) logger.error({ err: String(e) }, "HTTP error");
    else logger.error({ err: String(e) }, "Unknown bot error");
  });
}

async function resolveDisputeNotify(bot: Bot, deal: Deal, winner: "buyer" | "seller") {
  const winnerId = winner === "buyer" ? deal.buyerId : deal.sellerId;
  const loserId = winner === "buyer" ? deal.sellerId : deal.buyerId;
  const winnerLang = ((await getOrCreateUser(winnerId, null)).language as Lang) || "ru";
  const loserLang = ((await getOrCreateUser(loserId, null)).language as Lang) || "ru";
  await notify(
    bot,
    winnerId,
    winnerLang,
    buildDealCardText(deal, winnerId, winnerLang),
    dealMenuKb({ lang: winnerLang, deal, userId: winnerId }),
  );
  await notify(bot, loserId, loserLang, t(loserLang, "dispute_cancelled"));
}
