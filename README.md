# wallet-pnl-bot (Tahap 1: spot only)

Bot Telegram read-only buat tracking value wallet ETH + SOL, PnL sejak save
terakhir + lifetime. **Tidak pernah butuh private key** — cuma address publik.

## Setup di VPS

```bash
npm install
cp .env.example .env
cp wallets.example.json wallets.json
```

Isi `.env`:
- `TELEGRAM_BOT_TOKEN` — dari @BotFather
- `TELEGRAM_ALLOWED_USER_ID` — user id Telegram kamu (dari @userinfobot), biar
  bot cuma respon ke kamu, bukan siapa aja yang nemu bot-nya
- `ALCHEMY_API_KEY` — free tier di alchemy.com, buat baca balance ETH
- `SOLANA_RPC_URL` — default public RPC udah cukup buat personal use

Isi `wallets.json` dengan address publik ETH & SOL kamu (label bebas, contoh
"W1", "W2").

Jalanin:
```bash
npm start
```

## Cara pakai
- `/start` di chat bot → muncul 3 tombol: Refresh, Save, PnL
- **Refresh**: fetch value sekarang (spot token ETH + SOL, breakdown per wallet)
- **Save**: simpan angka yang barusan di-Refresh sebagai baseline baru
- **PnL**: bandingin value sekarang vs save terakhir, dan vs save pertama
  (lifetime). Kalau belum pernah save, bot bilang jelas — ga nampilin 0%
  palsu.

## Yang belum ada (Tahap 2)
- Valuasi posisi LP (Uniswap V3/V4 di ETH, Meteora DLMM di SOL)
- Fallback harga token dari rasio pool (buat token yang ga ada di CoinGecko)

## Catatan jujur soal testing
Kode ini udah di-syntax-check dan logic inti (format output, SQLite
read/write) udah ditest pake data mock. **Belum pernah dites end-to-end**
lawan Alchemy/Solana RPC/Telegram API asli — itu baru bisa kejadian pas
kamu jalanin di VPS dengan kredensial asli. Kalau ada error pas run
pertama, kemungkinan besar di area RPC response shape (misal Alchemy
balik format field yang beda dari yang gue asumsikan) — kirim error
message-nya, gue bantu fix.
