import { Telegraf, Markup } from 'telegraf';
import { config } from './config.js';
import { fetchPortfolio } from './portfolio.js';
import { saveSnapshot, getLatestSnapshot, getFirstSnapshot, countSnapshots, saveManualEntry, getManualEntries, deleteManualEntry } from './storage.js';
import { formatPortfolio, formatPnl } from './format.js';

const bot = new Telegraf(config.telegramBotToken);

bot.use((ctx, next) => {
  if (config.allowedUserId && String(ctx.from?.id) !== String(config.allowedUserId)) {
    return;
  }
  return next();
});

const lastFetchByChat = new Map();
const awaitingManualInput = new Set();
const displayModeByChat = new Map();

function keyboard(chatId) {
  const mode = displayModeByChat.get(chatId) || 'usd';
  const toggleLabel = mode === 'usd' ? 'IDR' : 'USD';
  return Markup.inlineKeyboard([
    [Markup.button.callback('Refresh', 'refresh'), Markup.button.callback('Save', 'save')],
    [Markup.button.callback('PnL', 'pnl'), Markup.button.callback('Full Porto', 'manual')],
    [Markup.button.callback(toggleLabel, 'toggle_currency')],
  ]);
}

bot.start((ctx) => ctx.reply('Wallet PnL tracker siap. Tekan Refresh buat cek value sekarang.', keyboard(ctx.chat.id)));

bot.action('refresh', async (ctx) => {
  await ctx.answerCbQuery('Fetching...');
  const msg = await ctx.reply('⏳ Mengambil data terbaru...');
  try {
    const portfolio = await fetchPortfolio(config.wallets);
    lastFetchByChat.set(ctx.chat.id, portfolio);
    const mode = displayModeByChat.get(ctx.chat.id) || 'usd';
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      undefined,
      formatPortfolio(portfolio, mode),
      { parse_mode: 'Markdown', ...keyboard(ctx.chat.id) }
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

bot.action('toggle_currency', async (ctx) => {
  const current = displayModeByChat.get(ctx.chat.id) || 'usd';
  const next = current === 'usd' ? 'idr' : 'usd';
  displayModeByChat.set(ctx.chat.id, next);
  await ctx.answerCbQuery(`Mode: ${next.toUpperCase()}`);
  const portfolio = lastFetchByChat.get(ctx.chat.id);
  if (portfolio) {
    await ctx.reply(formatPortfolio(portfolio, next), {
      parse_mode: 'Markdown',
      ...keyboard(ctx.chat.id),
    });
  } else {
    await ctx.reply(`Mode tampilan: ${next.toUpperCase()}. Tekan Refresh.`, keyboard(ctx.chat.id));
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
    `💾 Tersimpan: ${new Date().toLocaleString('id-ID')}\nTotal: $${cached.totalUsd.toFixed(2)}`,
    keyboard(ctx.chat.id)
  );
});

bot.action('pnl', async (ctx) => {
  await ctx.answerCbQuery('Menghitung...');
  if (countSnapshots() === 0) {
    return ctx.reply('Belum ada save sama sekali. Tekan Refresh lalu Save dulu.', keyboard(ctx.chat.id));
  }
  try {
    const current = lastFetchByChat.get(ctx.chat.id) || (await fetchPortfolio(config.wallets));
    lastFetchByChat.set(ctx.chat.id, current);
    const lastSnapshot = getLatestSnapshot();
    const firstSnapshot = getFirstSnapshot();
    const mode = displayModeByChat.get(ctx.chat.id) || 'usd';
    await ctx.reply(formatPnl({ current, lastSnapshot, firstSnapshot }, mode), {
      parse_mode: 'Markdown',
      ...keyboard(ctx.chat.id),
    });
  } catch (err) {
    await ctx.reply(`❌ Gagal hitung PnL: ${err.message}`);
  }
});

bot.action('manual', async (ctx) => {
  await ctx.answerCbQuery();
  const entries = getManualEntries();
  let msg = '*Manual Full Porto*\nKirim angka USD buat nambah entry.\nContoh: `500`\n\n';
  if (entries.length) {
    msg += 'Entry sekarang:\n';
    for (const e of entries) {
      msg += `  [${e.id}] ${e.label}: $${e.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    }
    msg += '\nKirim `del <id>` buat hapus.';
  }
  awaitingManualInput.add(ctx.chat.id);
  await ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
  if (!awaitingManualInput.has(ctx.chat.id)) return;
  const text = ctx.message.text.trim();

  if (text.startsWith('del ')) {
    const id = parseInt(text.slice(4));
    if (id) {
      deleteManualEntry(id);
      await ctx.reply(`Entry ${id} dihapus.`, keyboard(ctx.chat.id));
    } else {
      await ctx.reply('Format: `del <id>`', { parse_mode: 'Markdown' });
    }
    awaitingManualInput.delete(ctx.chat.id);
    return;
  }

  const num = parseFloat(text.replace(/[^\d.]/g, ''));
  if (!num || num <= 0) {
    await ctx.reply('Angka gak valid. Kirim angka USD, contoh: `500`', { parse_mode: 'Markdown' });
    return;
  }

  saveManualEntry(num);
  awaitingManualInput.delete(ctx.chat.id);
  await ctx.reply(`✓ Tersimpan: $${num.toFixed(2)}`, keyboard(ctx.chat.id));
});

bot.launch();
console.log('Bot jalan.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
