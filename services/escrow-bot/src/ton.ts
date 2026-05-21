import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV4, internal, Address, fromNano, toNano } from "@ton/ton";
import { config } from "./config.js";
import { logger } from "./logger.js";

let cached: {
  client: TonClient;
  wallet: WalletContractV4;
  keyPair: Awaited<ReturnType<typeof mnemonicToWalletKey>>;
  address: string;
} | null = null;

export async function getWallet() {
  if (cached) return cached;
  const keyPair = await mnemonicToWalletKey(config.tonMnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const endpoint =
    config.tonApiBase.replace(/\/$/, "") + "/jsonRPC";
  const client = new TonClient({ endpoint, apiKey: config.tonApiKey || undefined });
  cached = {
    client,
    wallet,
    keyPair,
    address: wallet.address.toString({ bounceable: false, urlSafe: true }),
  };
  logger.info({ address: cached.address }, "TON wallet initialized");
  return cached;
}

export function tonToNano(s: string): bigint {
  return toNano(s);
}

export function nanoToTon(n: bigint): string {
  return fromNano(n);
}

export function isValidTonAddress(s: string): boolean {
  try {
    Address.parse(s);
    return true;
  } catch {
    return false;
  }
}

export interface IncomingTx {
  hash: string;
  amountNano: bigint;
  comment: string;
  source: string | null;
  utime: number;
}

interface TxResponse {
  ok: boolean;
  result?: Array<{
    transaction_id: { hash: string; lt: string };
    utime: number;
    in_msg?: {
      value: string;
      source?: string;
      message?: string;
    };
  }>;
}

export async function fetchIncomingTransactions(limit = 30): Promise<IncomingTx[]> {
  const { address } = await getWallet();
  const url = new URL(config.tonApiBase.replace(/\/$/, "") + "/getTransactions");
  url.searchParams.set("address", address);
  url.searchParams.set("limit", String(limit));
  if (config.tonApiKey) url.searchParams.set("api_key", config.tonApiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`toncenter HTTP ${res.status}`);
  const data = (await res.json()) as TxResponse;
  if (!data.ok || !data.result) return [];

  const out: IncomingTx[] = [];
  for (const tx of data.result) {
    const m = tx.in_msg;
    if (!m || !m.source) continue;
    const value = BigInt(m.value || "0");
    if (value <= 0n) continue;
    out.push({
      hash: tx.transaction_id.hash,
      amountNano: value,
      comment: (m.message || "").trim(),
      source: m.source || null,
      utime: tx.utime,
    });
  }
  return out;
}

async function safeSeqno(contract: ReturnType<TonClient["open"]>): Promise<number> {
  try {
    return await (contract as unknown as { getSeqno: () => Promise<number> }).getSeqno();
  } catch (e) {
    // Wallet contract not yet deployed: seqno is 0 for the first message,
    // which will also deploy the wallet via init code+data.
    const msg = String(e);
    if (msg.includes("exit_code") || msg.includes("-13") || msg.includes("uninitialized") || msg.includes("not deployed")) {
      logger.warn("wallet uninitialized, using seqno=0 to deploy");
      return 0;
    }
    throw e;
  }
}

function is429(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e);
  return s.includes("429") || s.toLowerCase().includes("too many");
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 8): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!is429(e)) throw e;
      const delay = 2000 + i * 1500;
      logger.warn({ label, attempt: i + 1, delay }, "toncenter 429, retrying");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function getEscrowBalanceNano(): Promise<bigint> {
  const { client, wallet } = await getWallet();
  return await withRetry("getBalance", () => client.getBalance(wallet.address));
}

// Wallet contract needs a small reserve for gas + storage on top of `value`.
// 0.05 TON is a comfortable buffer for wallet v4 mainnet.
const PAYOUT_FEE_RESERVE_NANO = 50_000_000n;

export class InsufficientEscrowFundsError extends Error {
  constructor(
    public required: bigint,
    public available: bigint,
  ) {
    super(`Insufficient escrow funds: have ${available}, need ${required}`);
  }
}

export interface PayoutLeg {
  toAddress: string;
  amountNano: bigint;
}

// Send one or two internal messages from the escrow wallet in a single transfer.
// We use the multi-message form to ship the payee + owner-fee transfers atomically
// for the cost of a single wallet signature / external message.
export async function sendPayout(
  toAddress: string,
  amountNano: bigint,
  extra?: PayoutLeg,
): Promise<string> {
  const { client, wallet, keyPair } = await getWallet();
  const contract = client.open(wallet);

  const totalOut = amountNano + (extra?.amountNano ?? 0n);
  const balance = await withRetry("getBalance", () => client.getBalance(wallet.address));
  const required = totalOut + PAYOUT_FEE_RESERVE_NANO;
  if (balance < required) {
    throw new InsufficientEscrowFundsError(required, balance);
  }

  const seqno = await withRetry("getSeqno", () => safeSeqno(contract));

  const messages = [
    internal({
      to: Address.parse(toAddress),
      value: amountNano,
      bounce: false,
    }),
  ];
  if (extra) {
    messages.push(
      internal({
        to: Address.parse(extra.toAddress),
        value: extra.amountNano,
        bounce: false,
      }),
    );
  }

  await withRetry("sendTransfer", () =>
    (contract as unknown as {
      sendTransfer: (args: unknown) => Promise<void>;
    }).sendTransfer({
      secretKey: keyPair.secretKey,
      seqno,
      messages,
    }),
  );

  // Message is broadcast to the network. We don't wait for on-chain confirmation —
  // TON typically confirms in 5–15 seconds. The user can verify via the explorer link.
  return `broadcast:seqno=${seqno}`;
}
