export type Lang = "ru" | "en";

type Dict = Record<string, string | ((p: Record<string, string | number>) => string)>;

const RU: Dict = {
  choose_language: "Выберите язык / Choose your language",
  language_set: "Язык установлен: Русский",
  // Главное меню — только баннер, без текста в подписи. Telegram требует не
  // пустую подпись для editMessageCaption, поэтому используем неразрывный
  // пробел.
  main_menu: "\u00A0",
  btn_profile: "👤 Профиль",
  btn_create_deal: "➕ Создать сделку",
  btn_active_deals: "📂 Активные сделки",
  btn_main_menu: "🏠 Главное меню",
  btn_back: "⬅️ Вернуться назад",
  btn_confirm: "✅ Подтвердить",
  btn_cancel: "❌ Отменить",
  btn_yes: "Да",
  btn_no: "Нет",

  profile_title: "👤 Профиль",
  profile_stats: ({ username, completed, cancelled, disputes }) =>
    `ℹ️ *Личный кабинет @${username || "—"}.*\n\nОтмен: ${cancelled}\nСпоров: ${disputes}\nСделок: ${completed}`,
  btn_set_wallet: "💼 Указать/изменить кошелёк",
  wallet_not_set: "не задан",
  btn_dismiss: "🗑 Скрыть уведомление",
  stale_menu: "⌛ Это сообщение устарело. Откройте актуальное меню (/start).",

  active_deals_title: "ℹ️ *Твои активные сделки:*",
  no_active_deals: "ℹ️ *У тебя нет активных сделок.*",
  active_limit_reached: ({ limit }) =>
    `Достигнут лимит активных сделок (${limit}). Завершите текущие, чтобы создать новую.`,

  create_choose_role: "ℹ️ *Ваша роль в сделке?*",
  btn_role_buyer: "🛒 Покупатель",
  btn_role_seller: "💼 Продавец",
  create_ask_counterparty:
    "ℹ️ *Укажите Username или Telegram ID второй стороны сделки:*",
  counterparty_not_found:
    "ℹ️ *Не удалось найти пользователя.*\n\nОтветчик должен запустить бота. Зарегистрируйтесь и попробуйте ещё раз.",
  counterparty_is_self: "Нельзя создать сделку с самим собой.",
  create_ask_amount:
    "ℹ️ *Укажите сумму сделки в TON.*\n\nКомиссия 3% будет добавлена к сумме сделки.",
  invalid_amount:
    "ℹ️ *Сумма указана некорректно.*\n\nУкажите сумму на подобии примеров: 10 | 15.2 | 0.9.",
  create_ask_terms:
    "ℹ️ *Подробно распишите условия сделки.*\n\nУкажите что передает продавец, в какие сроки он должен уложиться, укажите качества, детали, ID / Номер / # продукта.",
  terms_too_long: "Слишком длинное описание. Максимум 2000 символов.",
  create_summary: ({ role, amount, toPay, terms }) =>
    `ℹ️ *Тщательно проверьте условия сделки:*\n\n*Ваша роль:* ${role}\n*Сумма сделки:* ${amount} TON\n*Сумма с комиссией:* ${toPay} TON\n\n*Условия сделки:*\n${terms}`,
  create_sent: ({ oppRole }) =>
    `ℹ️ *Ожидаете подтверждения сделки ${oppRole}.*`,
  create_cancelled: "Создание сделки отменено.",

  // "ким" — творительный падеж: покупателем / продавцом.
  role_by_buyer: "покупателем",
  role_by_seller: "продавцом",

  notif_new_deal: ({ role, amount, toPay, terms }) =>
    `ℹ️ *У вас новое предложение о сделке:*\n\n*Ваша роль:* ${role}\n*Сумма сделки:* ${amount} TON\n*Сумма с комиссией:* ${toPay} TON\n\n*Условия сделки:*\n${terms}`,
  btn_accept_deal: "Принять",
  btn_reject_deal: "Отклонить",
  confirm_reject_deal: "Вы уверены, что хотите отклонить сделку?",
  deal_rejected_by_counterparty:
    "Вторая сторона отклонила сделку. Сделка отменена.",
  deal_rejected: "Сделка отклонена.",
  deal_accepted_buyer: "ℹ️ *Сделка принята второй стороной.*",
  deal_accepted_seller: "ℹ️ *Сделка принята второй стороной.*",

  // Универсальный шаблон карточки сделки: статусная преамбула + роль + суммы
  // + условия. Преамбула приходит уже подготовленной (см. card_intro_*).
  deal_card: ({ intro, role, amount, toPay, terms }) =>
    `${intro}\n\n*Ваша роль:* ${role}\n*Сумма сделки:* ${amount} TON\n*Сумма с комиссией:* ${toPay} TON\n\n*Условия сделки:*\n${terms}`,

  card_intro_WAITING_CONFIRMATION_creator: ({ oppRole }) =>
    `ℹ️ *Ожидаете подтверждения сделки ${oppRole}.*`,
  card_intro_WAITING_CONFIRMATION_counterparty:
    "ℹ️ *У вас новое предложение о сделке. Примите или отклоните его.*",
  card_intro_WAITING_PAYMENT_buyer: "ℹ️ *Оплатите сделку с помощью кнопки ниже.*",
  card_intro_WAITING_PAYMENT_seller: "ℹ️ *Ожидайте оплаты сделки покупателем.*",
  card_intro_PAID_buyer:
    "ℹ️ *Ожидайте выполнения условий сделки продавцом.*",
  card_intro_PAID_seller:
    "ℹ️ *Покупатель оплатил сделку. Приступайте к выполнению условий.*",
  card_intro_SELLER_FULFILLED_buyer:
    "ℹ️ *Продавец сообщил, что выполнил условия сделки. Тщательно проверьте выполнение.*",
  card_intro_SELLER_FULFILLED_seller:
    "ℹ️ *Ожидайте проверки выполнения условий покупателем.*",
  card_intro_DISPUTE_buyer: "ℹ️ *Открыт спор. Ожидайте решения администратора.*",
  card_intro_DISPUTE_seller: "ℹ️ *Открыт спор. Ожидайте решения администратора.*",
  card_intro_WAITING_PAYOUT_BUYER_buyer:
    "ℹ️ *Заберите свои средства — нажмите «Получить средства».*",
  card_intro_WAITING_PAYOUT_BUYER_seller: "ℹ️ *Возврат средств покупателю.*",
  card_intro_WAITING_PAYOUT_SELLER_buyer: "ℹ️ *Выплата продавцу.*",
  card_intro_WAITING_PAYOUT_SELLER_seller:
    "ℹ️ *Сделка завершена. Заберите свои средства.*",
  card_intro_COMPLETED_buyer: "ℹ️ *Сделка успешно завершена.*",
  card_intro_COMPLETED_seller: "ℹ️ *Сделка успешно завершена.*",
  card_intro_CANCELLED_buyer: "ℹ️ *Сделка отменена.*",
  card_intro_CANCELLED_seller: "ℹ️ *Сделка отменена.*",
  card_intro_REFUNDED_buyer: "ℹ️ *Средства возвращены.*",
  card_intro_REFUNDED_seller: "ℹ️ *Средства возвращены.*",

  btn_pay: "💸 Оплатить сделку",
  btn_check_payment: "🔄 Проверить оплату",
  btn_cancel_deal: "❌ Отменить сделку",
  btn_open_dispute: "⚖️ Открыть спор",
  btn_open_deal: "📂 Открыть сделку",
  btn_seller_fulfilled: "✔️ Я выполнил условия",
  btn_buyer_confirm: "✅ Подтвердить выполнение",
  btn_get_funds: "💰 Получить средства",

  pay_instructions: ({ address, amount, code }) =>
    `ℹ️ *Оплатите сделку строго по реквизитам ниже:*\n\nАдрес TON: \`${address}\`\nТочная сумма: ${amount} TON\nКомментарий: \`${code}\``,
  payment_not_found:
    "Оплата не найдена, попробуйте ещё раз через несколько минут.",
  payment_received_buyer:
    "ℹ️ *Вы оплатили сделку. Продавец может приступать к выполнению условий.*",
  payment_received_seller:
    "ℹ️ *Покупатель оплатил сделку. Можете приступать к выполнению условий.*",

  cancel_confirm: "Вы уверены, что хотите отменить сделку?",
  deal_cancelled: "Сделка отменена.",
  deal_cancelled_seller_after_pay:
    "Продавец отменил сделку после оплаты. Заберите свои средства.",

  seller_fulfilled_buyer:
    "Продавец сообщил, что выполнил условия. Подтвердите выполнение, если всё ок.",
  buyer_confirm_prompt:
    "Вы уверены, что условия выполнены? Это завершит сделку.",
  deal_completed: "🎉 Сделка успешно завершена.",

  dispute_opened: "⚖️ Спор открыт. Ожидайте решения администратора.",
  dispute_buttons_title:
    "Если хотите признать неправоту — выберите, кому отдать средства:",
  btn_give_to_buyer: "Отдать деньги покупателю",
  btn_give_to_seller: "Отдать деньги продавцу",
  btn_concede: "🙏 Уступить оппоненту",

  payout_ask_address: "Введите ваш TON-адрес для получения средств:",
  payout_ready_seller: "🎉 Сделка завершена! Покупатель подтвердил получение. Нажмите кнопку «Получить средства», чтобы указать TON-адрес для выплаты.",
  payout_ready_buyer: "🎉 Спор решён в вашу пользу. Нажмите «Получить средства», чтобы указать TON-адрес для возврата.",
  payout_processing: ({ address, amount }) =>
    `⏳ Отправляю ${amount} TON на адрес:\n\`${address}\`\n\nЭто займёт до 30 секунд...`,
  wallet_ask_address: "Введите TON-адрес для получения выплат. Он будет сохранён в профиле и использован автоматически в будущих сделках.",
  wallet_saved: ({ address }) => `✅ Кошелёк сохранён:\n\`${address}\`\n\nТеперь выплаты будут приходить на него автоматически.`,
  payout_invalid_address: "Некорректный TON-адрес. Попробуйте ещё раз.",
  payout_confirm: ({ address, amount }) =>
    `Подтвердите отправку ${amount} TON на адрес:\n\`${address}\`\n\nПосле подтверждения отмена невозможна.`,
  payout_sent: ({ amount, address, explorer }) =>
    `✅ Средства отправлены\n\n💰 Сумма: *${amount} TON*\n📍 На адрес: \`${address}\`\n\n🔎 [Посмотреть транзакцию](${explorer})`,
  payout_failed:
    "Не удалось отправить средства. Свяжитесь с администратором.",
  payout_insufficient: ({ available, required }) =>
    `⚠️ Недостаточно средств на escrow-кошельке.\n\nДоступно: *${available} TON*\nТребуется: *${required} TON*\n\nАдминистратор уведомлён. Как только баланс пополнят, нажмите «Получить средства» ещё раз — деньги уйдут автоматически.`,
  admin_log_insufficient: ({ code, required, available }) =>
    `⚠️ Не хватает TON на escrow для выплаты\nСделка: \`${code}\`\nТребуется: ${required} TON\nДоступно: ${available} TON\n\nПополните кошелёк бота, пользователь сможет повторить выплату.`,

  invalid_action: "Это действие сейчас недоступно.",
  error_generic: "Произошла ошибка. Попробуйте ещё раз.",
  not_registered: "Пожалуйста, нажмите /start для регистрации.",

  status_WAITING_CONFIRMATION: "Ожидание подтверждения",
  status_WAITING_PAYMENT: "Ожидание оплаты",
  status_PAID: "Оплачено",
  status_SELLER_FULFILLED: "Условия выполнены продавцом",
  status_DISPUTE: "Спор",
  status_CANCELLED: "Отменено",
  status_COMPLETED: "Завершено",
  status_WAITING_PAYOUT_BUYER: "Возврат покупателю",
  status_WAITING_PAYOUT_SELLER: "Выплата продавцу",
  status_REFUNDED: "Возвращено",

  role_buyer: "Покупатель",
  role_seller: "Продавец",

  // Единственный admin-лог о ходе сделки: оплата. Формат соответствует ТЗ
  // пользователя — без TX-хэшей, только бизнес-данные.
  admin_log_paid: ({ code, amount, seller, buyer, terms }) =>
    `💰 Оплачена сделка #${code}\n\nСумма: ${amount} TON\nПродавец: ${seller}\nПокупатель: ${buyer}\n\nУсловия:\n${terms}`,
  admin_dispute_panel: ({ code, buyer, seller, amount, terms }) =>
    `⚖️ Спор #${code}\nПокупатель: ${buyer}\nПродавец: ${seller}\nСумма: ${amount} TON\n\nУсловия:\n${terms}`,
  btn_admin_to_buyer: "Победил покупатель",
  btn_admin_to_seller: "Победил продавец",
  btn_admin_cancel_dispute: "Отменить спор",
  dispute_cancelled: "Спор отменён. Сделка возвращена к предыдущему этапу.",
};

const EN: Dict = {
  choose_language: "Выберите язык / Choose your language",
  language_set: "Language set: English",
  main_menu: "\u00A0",
  btn_profile: "👤 Profile",
  btn_create_deal: "➕ Create deal",
  btn_active_deals: "📂 Active deals",
  btn_main_menu: "🏠 Main menu",
  btn_back: "⬅️ Back",
  btn_confirm: "✅ Confirm",
  btn_cancel: "❌ Cancel",
  btn_yes: "Yes",
  btn_no: "No",

  profile_title: "👤 Profile",
  profile_stats: ({ username, completed, cancelled, disputes }) =>
    `ℹ️ *Profile @${username || "—"}.*\n\nCancelled: ${cancelled}\nDisputes: ${disputes}\nCompleted: ${completed}`,
  btn_set_wallet: "💼 Set/change wallet",
  wallet_not_set: "not set",
  btn_dismiss: "🗑 Dismiss notification",
  stale_menu: "⌛ This message is stale. Open the current menu via /start.",

  active_deals_title: "ℹ️ *Your active deals:*",
  no_active_deals: "ℹ️ *You have no active deals.*",
  active_limit_reached: ({ limit }) =>
    `Active deals limit reached (${limit}). Complete current ones to create a new one.`,

  create_choose_role: "ℹ️ *Your role in the deal?*",
  btn_role_buyer: "🛒 Buyer",
  btn_role_seller: "💼 Seller",
  create_ask_counterparty:
    "ℹ️ *Specify the username or Telegram ID of the counterparty:*",
  counterparty_not_found:
    "ℹ️ *User not found.*\n\nThe counterparty must start the bot first. Register and try again.",
  counterparty_is_self: "You can't create a deal with yourself.",
  create_ask_amount:
    "ℹ️ *Enter the deal amount in TON.*\n\nA 3% fee will be added on top of the deal amount.",
  invalid_amount:
    "ℹ️ *Invalid amount.*\n\nEnter a number like the examples: 10 | 15.2 | 0.9.",
  create_ask_terms:
    "ℹ️ *Describe the deal terms in detail.*\n\nWhat the seller delivers, deadlines, quality, details, product ID / number / #.",
  terms_too_long: "Description too long. Maximum 2000 chars.",
  create_summary: ({ role, amount, toPay, terms }) =>
    `ℹ️ *Carefully review the deal terms:*\n\n*Your role:* ${role}\n*Deal amount:* ${amount} TON\n*Amount with fee:* ${toPay} TON\n\n*Terms:*\n${terms}`,
  create_sent: ({ oppRole }) =>
    `ℹ️ *Waiting for the ${oppRole} to confirm the deal.*`,
  create_cancelled: "Deal creation cancelled.",

  role_by_buyer: "buyer",
  role_by_seller: "seller",

  notif_new_deal: ({ role, amount, toPay, terms }) =>
    `ℹ️ *You have a new deal offer:*\n\n*Your role:* ${role}\n*Deal amount:* ${amount} TON\n*Amount with fee:* ${toPay} TON\n\n*Terms:*\n${terms}`,
  btn_accept_deal: "Accept",
  btn_reject_deal: "Reject",
  confirm_reject_deal: "Are you sure you want to reject this deal?",
  deal_rejected_by_counterparty:
    "The counterparty rejected the deal. The deal is cancelled.",
  deal_rejected: "Deal rejected.",
  deal_accepted_buyer: "ℹ️ *The deal was accepted by the counterparty.*",
  deal_accepted_seller: "ℹ️ *The deal was accepted by the counterparty.*",

  deal_card: ({ intro, role, amount, toPay, terms }) =>
    `${intro}\n\n*Your role:* ${role}\n*Deal amount:* ${amount} TON\n*Amount with fee:* ${toPay} TON\n\n*Terms:*\n${terms}`,

  card_intro_WAITING_CONFIRMATION_creator: ({ oppRole }) =>
    `ℹ️ *Waiting for the ${oppRole} to confirm the deal.*`,
  card_intro_WAITING_CONFIRMATION_counterparty:
    "ℹ️ *You have a new deal offer. Accept or reject it.*",
  card_intro_WAITING_PAYMENT_buyer: "ℹ️ *Pay the deal using the button below.*",
  card_intro_WAITING_PAYMENT_seller:
    "ℹ️ *Waiting for the buyer to pay.*",
  card_intro_PAID_buyer:
    "ℹ️ *Wait for the seller to fulfill the deal terms.*",
  card_intro_PAID_seller:
    "ℹ️ *The buyer paid for the deal. Start fulfilling the terms.*",
  card_intro_SELLER_FULFILLED_buyer:
    "ℹ️ *The seller reported the terms are fulfilled. Verify carefully.*",
  card_intro_SELLER_FULFILLED_seller:
    "ℹ️ *Wait for the buyer to verify your fulfillment.*",
  card_intro_DISPUTE_buyer: "ℹ️ *Dispute opened. Wait for the admin decision.*",
  card_intro_DISPUTE_seller: "ℹ️ *Dispute opened. Wait for the admin decision.*",
  card_intro_WAITING_PAYOUT_BUYER_buyer:
    "ℹ️ *Withdraw your funds — tap \"Receive funds\".*",
  card_intro_WAITING_PAYOUT_BUYER_seller: "ℹ️ *Refund to buyer.*",
  card_intro_WAITING_PAYOUT_SELLER_buyer: "ℹ️ *Payout to seller.*",
  card_intro_WAITING_PAYOUT_SELLER_seller:
    "ℹ️ *Deal completed. Withdraw your funds.*",
  card_intro_COMPLETED_buyer: "ℹ️ *Deal completed successfully.*",
  card_intro_COMPLETED_seller: "ℹ️ *Deal completed successfully.*",
  card_intro_CANCELLED_buyer: "ℹ️ *Deal cancelled.*",
  card_intro_CANCELLED_seller: "ℹ️ *Deal cancelled.*",
  card_intro_REFUNDED_buyer: "ℹ️ *Funds refunded.*",
  card_intro_REFUNDED_seller: "ℹ️ *Funds refunded.*",

  btn_pay: "💸 Pay deal",
  btn_check_payment: "🔄 Check payment",
  btn_cancel_deal: "❌ Cancel deal",
  btn_open_dispute: "⚖️ Open dispute",
  btn_open_deal: "📂 Open deal",
  btn_seller_fulfilled: "✔️ I fulfilled the terms",
  btn_buyer_confirm: "✅ Confirm fulfillment",
  btn_get_funds: "💰 Receive funds",

  pay_instructions: ({ address, amount, code }) =>
    `ℹ️ *Pay the deal strictly using the details below:*\n\nTON address: \`${address}\`\nExact amount: ${amount} TON\nComment: \`${code}\``,
  payment_not_found: "Payment not found, try again in a few minutes.",
  payment_received_buyer:
    "ℹ️ *You paid the deal. The seller can start fulfilling the terms.*",
  payment_received_seller:
    "ℹ️ *The buyer paid the deal. You can start fulfilling the terms.*",

  cancel_confirm: "Are you sure you want to cancel this deal?",
  deal_cancelled: "Deal cancelled.",
  deal_cancelled_seller_after_pay:
    "Seller cancelled the deal after payment. Withdraw your funds.",

  seller_fulfilled_buyer:
    "The seller has reported the terms are fulfilled. Confirm if everything is OK.",
  buyer_confirm_prompt:
    "Are you sure the terms are fulfilled? This will complete the deal.",
  deal_completed: "🎉 Deal completed successfully.",

  dispute_opened: "⚖️ Dispute opened. Wait for the admin decision.",
  dispute_buttons_title:
    "If you want to admit fault, choose who gets the funds:",
  btn_give_to_buyer: "Give to buyer",
  btn_give_to_seller: "Give to seller",
  btn_concede: "🙏 Concede to opponent",

  payout_ask_address: "Enter your TON address to receive the funds:",
  payout_ready_seller: "🎉 Deal completed! The buyer confirmed receipt. Tap \"Receive funds\" and enter your TON address to get paid.",
  payout_ready_buyer: "🎉 Dispute resolved in your favor. Tap \"Receive funds\" to enter your TON address for the refund.",
  payout_processing: ({ address, amount }) =>
    `⏳ Sending ${amount} TON to:\n\`${address}\`\n\nThis may take up to 30 seconds...`,
  wallet_ask_address: "Enter your TON address for receiving payouts. It will be saved to your profile and reused automatically for future deals.",
  wallet_saved: ({ address }) => `✅ Wallet saved:\n\`${address}\`\n\nFuture payouts will arrive there automatically.`,
  payout_invalid_address: "Invalid TON address. Try again.",
  payout_confirm: ({ address, amount }) =>
    `Confirm sending ${amount} TON to:\n\`${address}\`\n\nAfter confirmation it cannot be undone.`,
  payout_sent: ({ amount, address, explorer }) =>
    `✅ Funds sent\n\n💰 Amount: *${amount} TON*\n📍 To: \`${address}\`\n\n🔎 [View transaction](${explorer})`,
  payout_failed: "Failed to send funds. Contact the administrator.",
  payout_insufficient: ({ available, required }) =>
    `⚠️ Not enough funds on the escrow wallet.\n\nAvailable: *${available} TON*\nRequired: *${required} TON*\n\nThe admin has been notified. Once the wallet is topped up, tap "Receive funds" again — the payout will go through automatically.`,
  admin_log_insufficient: ({ code, required, available }) =>
    `⚠️ Escrow wallet underfunded for payout\nDeal: \`${code}\`\nRequired: ${required} TON\nAvailable: ${available} TON\n\nTop up the bot wallet so the user can retry.`,

  invalid_action: "This action is not available right now.",
  error_generic: "Something went wrong. Try again.",
  not_registered: "Please tap /start to register.",

  status_WAITING_CONFIRMATION: "Waiting for confirmation",
  status_WAITING_PAYMENT: "Waiting for payment",
  status_PAID: "Paid",
  status_SELLER_FULFILLED: "Seller fulfilled",
  status_DISPUTE: "Dispute",
  status_CANCELLED: "Cancelled",
  status_COMPLETED: "Completed",
  status_WAITING_PAYOUT_BUYER: "Refund to buyer",
  status_WAITING_PAYOUT_SELLER: "Payout to seller",
  status_REFUNDED: "Refunded",

  role_buyer: "Buyer",
  role_seller: "Seller",

  admin_log_paid: ({ code, amount, seller, buyer, terms }) =>
    `💰 Deal #${code} paid\n\nAmount: ${amount} TON\nSeller: ${seller}\nBuyer: ${buyer}\n\nTerms:\n${terms}`,
  admin_dispute_panel: ({ code, buyer, seller, amount, terms }) =>
    `⚖️ Dispute #${code}\nBuyer: ${buyer}\nSeller: ${seller}\nAmount: ${amount} TON\n\nTerms:\n${terms}`,
  btn_admin_to_buyer: "Buyer wins",
  btn_admin_to_seller: "Seller wins",
  btn_admin_cancel_dispute: "Cancel dispute",
  dispute_cancelled: "Dispute cancelled. Deal returned to previous stage.",
};

const DICTS: Record<Lang, Dict> = { ru: RU, en: EN };

export function t(
  lang: Lang | null | undefined,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = DICTS[lang || "ru"];
  const v = dict[key] ?? RU[key] ?? key;
  return typeof v === "function" ? v(params || {}) : v;
}
