import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const walletsPath = path.join(__dirname, '..', 'wallets.json');

if (!fs.existsSync(walletsPath)) {
  throw new Error(
    `wallets.json tidak ditemukan di ${walletsPath}. Copy wallets.example.json -> wallets.json dan isi address kamu (address publik saja, JANGAN private key).`
  );
}

const wallets = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Env var ${name} wajib diisi di .env`);
  return v;
}

const alchemyApiKey = requireEnv('ALCHEMY_API_KEY');
if (alchemyApiKey.startsWith('http')) {
  throw new Error(
    'ALCHEMY_API_KEY di .env keliatannya URL lengkap, harusnya cuma key-nya aja (bagian setelah /v2/). Contoh: ALCHEMY_API_KEY=alch1An0UBOujpvaG9VM8Nm-a'
  );
}

export const config = {
  telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  // Optional but strongly recommended: restrict bot to your own Telegram user id
  // so a stranger who finds the bot can't read your portfolio.
  allowedUserId: process.env.TELEGRAM_ALLOWED_USER_ID || null,
  alchemyApiKey,
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  wallets,
};
