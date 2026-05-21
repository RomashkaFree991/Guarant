import { InputFile, type Api } from "grammy";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANNER_PATH = path.resolve(__dirname, "../assets/banner.jpg");

// Telegram hard limit on a photo caption.
const CAPTION_MAX = 1024;

// Once the banner has been uploaded to Telegram for this bot, we can reuse
// the returned file_id everywhere — no more disk reads or uploads.
let cachedFileId: string | null = null;

export function clampCaption(s: string): string {
  if (s.length <= CAPTION_MAX) return s;
  return s.slice(0, CAPTION_MAX - 1) + "…";
}

export async function sendBanner(
  api: Api,
  chatId: number,
  caption: string,
  reply_markup?: any,
) {
  const photo = cachedFileId ?? new InputFile(BANNER_PATH);
  const msg = await api.sendPhoto(chatId, photo, {
    caption: clampCaption(caption),
    parse_mode: "Markdown",
    reply_markup,
  });
  if (!cachedFileId && msg.photo && msg.photo.length > 0) {
    cachedFileId = msg.photo[msg.photo.length - 1].file_id;
  }
  return msg;
}

export async function editBannerCaption(
  api: Api,
  chatId: number,
  messageId: number,
  caption: string,
  reply_markup?: any,
) {
  await api.editMessageCaption(chatId, messageId, {
    caption: clampCaption(caption),
    parse_mode: "Markdown",
    reply_markup,
  });
}
