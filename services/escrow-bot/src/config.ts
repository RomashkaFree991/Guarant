function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  adminChatId: Number(required("ADMIN_CHAT_ID")),
  tonMnemonic: required("TON_WALLET_MNEMONIC").trim().split(/\s+/),
  tonApiBase: process.env.TON_API_BASE || "https://toncenter.com/api/v2",
  tonApiKey: process.env.TONCENTER_API_KEY || "",
  paymentPollIntervalMs: 15_000,
  maxActiveDealsPerUser: 5,
  minDealAmountNano: 100_000_000n,
  // Owner fee: deal amount stored in DB is what the recipient gets ("net").
  // The buyer pays `net * (10000 + feeBps) / 10000`; the surcharge is sent
  // to feeRecipientAddress at payout time in a second internal message.
  feeBps: 300n, // 3%
  feeRecipientAddress:
    process.env.FEE_RECIPIENT_ADDRESS ||
    "UQAMmKXWnv0DFUCU7KPEDb9c9pnl4gV7B2zadjBNZSyU7074",
};

// Helpers shared by display + watcher + payout.
export function feeNano(netNano: bigint): bigint {
  return (netNano * config.feeBps) / 10_000n;
}
export function grossNano(netNano: bigint): bigint {
  return netNano + feeNano(netNano);
}
