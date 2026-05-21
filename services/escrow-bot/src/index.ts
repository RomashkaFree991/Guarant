import "dotenv/config";
import { Bot } from "grammy";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { registerHandlers } from "./handlers.js";
import { startPaymentWatcher } from "./payment-watcher.js";
import { getWallet } from "./ton.js";

async function main() {
  const wallet = await getWallet();
  logger.info({ address: wallet.address }, "Escrow bot starting");

  const bot = new Bot(config.botToken);
  registerHandlers(bot);

  startPaymentWatcher(bot);

  bot.start({
    drop_pending_updates: true,
    onStart: (info) => logger.info({ username: info.username }, "Bot started"),
  });

  const shutdown = (sig: string) => {
    logger.info({ sig }, "Shutting down");
    bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((e) => {
  logger.error({ err: String(e), stack: e?.stack }, "Fatal");
  process.exit(1);
});
