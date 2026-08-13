# Plan: Manual IDR "Full Porto" Button

## Goal
User input nominal IDR manual lewat chat (text message), bot simpen ke DB, tampilin terpisah dari LP wallets (ETH+SOL). Bukan auto-track, bukan gabung total.

## Changes

### 1. storage.js — add `manual_porto` table
```sql
CREATE TABLE IF NOT EXISTS manual_porto (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  idr REAL NOT NULL,
  ts INTEGER NOT NULL
);
```
Single-row table (id=1). Upsert pattern: `INSERT OR REPLACE`.

Functions:
- `saveManualPorto(idrAmount)` → upsert id=1
- `getManualPorto()` → return `{ idr, ts }` or null

### 2. bot.js — add button + text handler
- Keyboard: add row `[Markup.button.callback('📝 Full Porto', 'manual_porto')]`
- Action `manual_porto`: reply current value + instruction "Ketik nominal IDR buat update, contoh: 500000000"
- Text handler: if chat state = "awaiting manual input" + message is numeric → `saveManualPorto(parsedIdr)` → reply konfirmasi
- State: `const awaitingManualInput = new Set()` per chatId

Flow:
1. User tap "Full Porto" → bot show current value + "Ketik nominal IDR baru"
2. User type `500000000` → bot save → reply "Tersimpan: Rp 500.000.000"
3. Timeout: if user type non-numeric or 60s pass → cancel, clear state

### 3. format.js — show manual porto in Refresh & PnL
- `formatPortfolio()`: add section after LP wallets:
  ```
  Full Porto (Manual)
  └ Rp 500.000.000
  ```
  Separate from `*Full Porto $XX.XX*` (that's LP total). Rename LP total to `*LP Wallets $XX.XX*` to avoid confusion.

- `formatPnl()`: manual porto is static (no PnL tracking), just show current value as info line.

### 4. No changes to portfolio.js
Manual porto is not part of `fetchPortfolio()`. It's read from DB at display time in bot.js, passed to format functions.

## Display layout after change
```
*LP Wallets $34.59* ⚠️
Eth
└ W1 $4.71 ⚠️
Sol
└ W2 $29.87 ⚠️

Full Porto (Manual)
└ Rp 500.000.000

⚠️ Belum lengkap...
```

## Edge cases
- Non-numeric input → bot reply "Format salah, ketik angka saja. Dibatalkan."
- Negative → reject
- Decimal → accept (e.g. 500000000.50)
- No manual porto saved yet → "Belum di-set" instead of showing 0
