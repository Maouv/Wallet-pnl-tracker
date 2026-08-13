import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import { fetchPortfolio } from './portfolio.js';
import { saveSnapshot, getLatestSnapshot, getFirstSnapshot, countSnapshots } from './storage.js';
import { formatPortfolio, formatPnl } from './format.js';

const bot = new Telegraf(config.telegramBotToken);

// Simple access control: only respond to your own Telegram user id, if set.
bot.use((ctx, next) => {
  if (config.allowedUserId && String(ctx.from?.id) !== String(config.allowedUserId)) {
    return; // silently ignore strangers
  }
  return next();
});

function keyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Refresh', 'refresh'), Markup.button.callback('💾 Save', 'save')],
    [Markup.button.callback('📊 PnL', 'pnl')],
  ]);
}

// Cache the last live fetch in-memory per chat so "Save" doesn't need to
// re-fetch (avoids double RPC cost and keeps Save fast/idempotent on the
// exact numbers the user just saw).
const lastFetchByChat = new Map();

bot.start((ctx) => ctx.reply('Wallet PnL tracker siap. Tekan Refresh buat cek value sekarang.', keyboard()));

bot.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Fetching...');
  const msg = await ctx.reply('⏳ Mengambil data terbaru...');
  try {
    const portfolio = await fetchPortfolio(config.wallets);
    lastFetchByChat.set(ctx.chat.id, portfolio);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      undefined,
      formatPortfolio(portfolio),
      { parse_mode: 'Markdown', ...keyboard() }
    );
  } catch (err) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      undefined,
      `❌ Refresh gagal total: ${err.message}`
    );
  }
});

bot.action('save', async (ctx) => {
  await ctx.answerCbQuery();
  const cached = lastFetchByChat.get(ctx.chat.id);
  if (!cached) {
    return ctx.reply('Belum ada data buat disimpan — tekan Refresh dulu.');
  }
  saveSnapshot(cached.totalUsd, cached.chains, cached.partial);
  await ctx.reply(
    `💾 Tersimpan sebagai baseline baru: ${new Date().toLocaleString('id-ID')}\nTotal: $${cached.totalUsd.toFixed(2)}`,
    keyboard()
  );
});

bot.action('pnl', async (ctx) => {
  await ctx.answerCbQuery('Menghitung...');
  if (countSnapshots() === 0) {
    return ctx.reply('Belum ada save sama sekali. Tekan Refresh lalu Save dulu.', keyboard());
  }
  try {
    const current = lastFetchByChat.get(ctx.chat.id) || (await fetchPortfolio(config.wallets));
    lastFetchByChat.set(ctx.chat.id, current);
    const lastSnapshot = getLatestSnapshot();
    const firstSnapshot = getFirstSnapshot();
    await ctx.reply(formatPnl({ current, lastSnapshot, firstSnapshot }), {
      parse_mode: 'Markdown',
      ...keyboard(),
    });
  } catch (err) {
    await ctx.reply(`❌ Gagal hitung PnL: ${err.message}`);
  }
});

bot.launch();
console.log('Bot jalan.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
