import { InlineKeyboard } from "grammy";
import type { Deal, DealStatus } from "@workspace/db";
import { t, type Lang } from "./i18n.js";

export function mainMenuKb(lang: Lang) {
  return new InlineKeyboard()
    .text(t(lang, "btn_profile"), "menu:profile")
    .row()
    .text(t(lang, "btn_create_deal"), "menu:create")
    .row()
    .text(t(lang, "btn_active_deals"), "menu:active");
}

export function backToMenuKb(lang: Lang) {
  return new InlineKeyboard().text(t(lang, "btn_back"), "menu:main");
}

// Append a "🗑 Dismiss" row to an existing inline keyboard (or build a fresh one).
// Used for notifications sent to the OTHER party in a deal so they can clear it
// from chat once they've seen / acted on it.
export function withDismiss(lang: Lang, kb?: InlineKeyboard): InlineKeyboard {
  const out = new InlineKeyboard();
  if (kb) {
    for (const row of kb.inline_keyboard) {
      out.inline_keyboard.push([...row]);
    }
  }
  out.row().text(t(lang, "btn_dismiss"), "noti:dismiss");
  return out;
}

export function profileKb(lang: Lang) {
  return new InlineKeyboard().text(t(lang, "btn_back"), "menu:main");
}

// Single-button "back" used on every wizard text-input prompt (counterparty,
// amount, terms). Steps one question back via the create:back router.
export function wizardBackKb(lang: Lang) {
  return new InlineKeyboard().text(t(lang, "btn_back"), "create:back");
}

// Back button on the payout-address input step — returns to the deal card
// and cancels the in-flight payout session.
export function payoutBackKb(lang: Lang, dealId: string) {
  return new InlineKeyboard().text(t(lang, "btn_back"), `deal:${dealId}:open`);
}

export function languageKb() {
  return new InlineKeyboard().text("🇷🇺 Русский", "lang:ru").text("🇬🇧 English", "lang:en");
}

export function createRoleKb(lang: Lang) {
  return new InlineKeyboard()
    .text(t(lang, "btn_role_buyer"), "create:role:buyer")
    .text(t(lang, "btn_role_seller"), "create:role:seller")
    .row()
    .text(t(lang, "btn_back"), "menu:main");
}

// One-button keyboard that jumps into the deal card — used for notifications
// where we don't want to duplicate every action button, just give a way in.
export function openDealOnlyKb(lang: Lang, dealId: string) {
  return new InlineKeyboard().text(t(lang, "btn_open_deal"), `deal:${dealId}:open`);
}

// Notification sent to the counterparty when a deal is created.
// Two buttons in a SINGLE row: Принять | Отклонить (no emojis).
export function newDealNotifyKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_accept_deal"), `deal:${dealId}:accept`)
    .text(t(lang, "btn_reject_deal"), `deal:${dealId}:reject:yes`);
}

export function createSummaryKb(lang: Lang) {
  return new InlineKeyboard()
    .text(t(lang, "btn_confirm"), "create:confirm")
    .row()
    .text(t(lang, "btn_back"), "create:back");
}

export function acceptDealKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_accept_deal"), `deal:${dealId}:accept`)
    .row()
    .text(t(lang, "btn_reject_deal"), `deal:${dealId}:reject:ask`)
    .row()
    .text(t(lang, "btn_main_menu"), "menu:main");
}

export function confirmRejectKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_yes"), `deal:${dealId}:reject:yes`)
    .text(t(lang, "btn_no"), `deal:${dealId}:open`);
}

export function confirmCancelKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_yes"), `deal:${dealId}:cancel:yes`)
    .text(t(lang, "btn_no"), `deal:${dealId}:open`);
}

export function confirmCancelPaidKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_yes"), `deal:${dealId}:cancelpaid:yes`)
    .text(t(lang, "btn_no"), `deal:${dealId}:open`);
}

export function confirmBuyerKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_yes"), `deal:${dealId}:buyerconfirm:yes`)
    .text(t(lang, "btn_no"), `deal:${dealId}:open`);
}

export function activeDealsKb(lang: Lang, list: Deal[], isBuyer: (d: Deal) => boolean) {
  const kb = new InlineKeyboard();
  for (const d of list) {
    const role = isBuyer(d) ? t(lang, "role_buyer") : t(lang, "role_seller");
    kb.text(`#${d.code} · ${role} · ${t(lang, "status_" + d.status)}`, `deal:${d.id}:open`).row();
  }
  kb.text(t(lang, "btn_back"), "menu:main");
  return kb;
}

export function dealMenuKb(opts: {
  lang: Lang;
  deal: Deal;
  userId: number;
}) {
  const { lang, deal, userId } = opts;
  const kb = new InlineKeyboard();
  const isBuyer = userId === deal.buyerId;
  const isSeller = userId === deal.sellerId;

  switch (deal.status as DealStatus) {
    case "WAITING_CONFIRMATION": {
      if (userId === deal.counterpartyId) {
        kb.text(t(lang, "btn_accept_deal"), `deal:${deal.id}:accept`).row();
        // Direct reject (no extra "are you sure" step) — matches the new-deal
        // notification keyboard so both surfaces behave the same.
        kb.text(t(lang, "btn_reject_deal"), `deal:${deal.id}:reject:yes`).row();
      } else {
        kb.text(t(lang, "btn_cancel_deal"), `deal:${deal.id}:cancel:ask`).row();
      }
      break;
    }
    case "WAITING_PAYMENT": {
      if (isBuyer) {
        kb.text(t(lang, "btn_pay"), `deal:${deal.id}:pay`).row();
        kb.text(t(lang, "btn_cancel_deal"), `deal:${deal.id}:cancel:ask`).row();
      }
      // Seller waits for payment — no cancel button on their side while buyer
      // might already be paying. The seller can still open a dispute later if
      // something is off after PAID.
      break;
    }
    case "PAID": {
      if (isSeller) {
        kb.text(t(lang, "btn_seller_fulfilled"), `deal:${deal.id}:fulfilled`).row();
        kb.text(t(lang, "btn_cancel_deal"), `deal:${deal.id}:cancelpaid:ask`).row();
      }
      if (isBuyer) {
        kb.text(t(lang, "btn_open_dispute"), `deal:${deal.id}:dispute`).row();
      }
      break;
    }
    case "SELLER_FULFILLED": {
      if (isBuyer) {
        kb.text(t(lang, "btn_buyer_confirm"), `deal:${deal.id}:buyerconfirm:ask`).row();
      }
      kb.text(t(lang, "btn_open_dispute"), `deal:${deal.id}:dispute`).row();
      break;
    }
    case "DISPUTE": {
      // Each party only sees ONE button: "concede to opponent".
      // Admin gets a separate dispute panel via adminDisputeKb in the admin chat.
      if (isBuyer) {
        kb.text(t(lang, "btn_concede"), `deal:${deal.id}:concede:seller`).row();
      } else if (isSeller) {
        kb.text(t(lang, "btn_concede"), `deal:${deal.id}:concede:buyer`).row();
      }
      break;
    }
    case "WAITING_PAYOUT_BUYER": {
      if (isBuyer) kb.text(t(lang, "btn_get_funds"), `deal:${deal.id}:payout`).row();
      break;
    }
    case "WAITING_PAYOUT_SELLER": {
      if (isSeller) kb.text(t(lang, "btn_get_funds"), `deal:${deal.id}:payout`).row();
      break;
    }
  }

  kb.text(t(lang, "btn_back"), "menu:main");
  return kb;
}

export function paymentKb(lang: Lang, dealId: string) {
  // No "check payment" button — incoming transactions are polled automatically
  // every 15s by the watcher and the deal card updates on its own.
  return new InlineKeyboard().text(t(lang, "btn_back"), `deal:${dealId}:open`);
}

export function adminDisputeKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_admin_to_buyer"), `admin:${dealId}:buyer`)
    .row()
    .text(t(lang, "btn_admin_to_seller"), `admin:${dealId}:seller`)
    .row()
    .text(t(lang, "btn_admin_cancel_dispute"), `admin:${dealId}:cancel`);
}

export function payoutConfirmKb(lang: Lang, dealId: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_confirm"), `deal:${dealId}:payout:confirm`)
    .row()
    .text(t(lang, "btn_cancel"), `deal:${dealId}:open`);
}
