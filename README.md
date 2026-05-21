# Escrow Telegram Bot

Telegram-бот для escrow-сделок в TON между двумя пользователями.

## Быстрый старт

1. **Установите Node.js 20+** и **pnpm**:
   ```bash
   npm install -g pnpm
   ```

2. **Установите зависимости** из корня проекта:
   ```bash
   pnpm install
   ```

3. **Скопируйте `.env.example` в `.env`** и заполните своими значениями:
   ```bash
   cp .env.example .env
   # затем откройте .env в редакторе и подставьте свои данные
   ```

   Что заполнять, расписано комментариями прямо в `.env.example`.

4. **Создайте таблицы в БД** (один раз):
   ```bash
   pnpm --filter @workspace/db run push
   ```

5. **Запустите бота**:
   ```bash
   pnpm --filter @workspace/escrow-bot run start
   ```

   В логах увидите адрес escrow-кошелька — на него клиенты будут отправлять оплату.

## Что нужно подготовить

- **Telegram-бот** через @BotFather → токен → в `.env` как `BOT_TOKEN`.
- **Telegram-чат для логов** (личка или группа) → ID получить через @userinfobot → в `.env` как `ADMIN_CHAT_ID`. Бот должен быть добавлен в этот чат.
- **TON-кошелёк** (Tonkeeper / Tonhub / MyTonWallet, тип v4R2). 24 слова seed-фразы → в `.env` как `TON_WALLET_MNEMONIC`. Пополните его минимум на 0.5 TON для комиссий сети.
- **API-ключ toncenter** через @tonapibot в Telegram → Get API key → **Mainnet** → в `.env` как `TONCENTER_API_KEY`.
- **PostgreSQL база** (локальная или облачная: Neon, Supabase, Railway) → строка подключения в `.env` как `DATABASE_URL`.

## Команды

- `pnpm --filter @workspace/escrow-bot run start` — запуск бота
- `pnpm --filter @workspace/escrow-bot run dev` — запуск с автоперезагрузкой при изменении файлов
- `pnpm --filter @workspace/escrow-bot run typecheck` — проверка типов
- `pnpm --filter @workspace/db run push` — применить схему БД

## Структура

- `services/escrow-bot/` — код бота
- `lib/db/` — схема БД и подключение (Drizzle ORM)
- `.env` — ваши секреты (НЕ коммитьте этот файл в git!)
- `.env.example` — шаблон со списком переменных и пояснениями

## Безопасность

- **Никогда не публикуйте `.env`** и не показывайте 24 слова мнемоники никому.
- Сделайте отдельный TON-кошелёк под бота — не используйте свой личный.
- Постгрес-базу держите за паролем и не открывайте наружу.
