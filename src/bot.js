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

function keyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Refresh', 'refresh'), Markup.button.callback('Save', 'save')],
    [Markup.button.callback('PnL', 'pnl'), Markup.button.callback('Full Porto', 'manual')],
  ]);
}

const lastFetchByChat = new Map();
const awaitingManualInput = new Set();

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

bot.action('manual', async (ctx) => {
  await ctx.answerCbQuery();
  const entries = getManualEntries();
  let msg = '*Manual Full Porto*\nKirim angka IDR buat nambah entry.\nContoh: `5000000`\n\n';
  if (entries.length) {
    msg += 'Entry sekarang:\n';
    for (const e of entries) {
      msg += `  [${e.id}] ${e.label}: Rp${e.idr.toLocaleString('id-ID')}\n`;
    }
    msg += '\nKirim \`del <id>\` buat hapus.';
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
      await ctx.reply(`Entry ${id} dihapus.`, keyboard());
    } else {
      await ctx.reply('Format: `del <id>`', { parse_mode: 'Markdown' });
    }
    awaitingManualInput.delete(ctx.chat.id);
    return;
  }

  const num = parseFloat(text.replace(/[^\d]/g, ''));
  if (!num || num <= 0) {
    await ctx.reply('Angka gak valid. Kirim angka IDR, contoh: `5000000`', { parse_mode: 'Markdown' });
    return;
  }

  saveManualEntry(num);
  awaitingManualInput.delete(ctx.chat.id);
  await ctx.reply(`✓ Tersimpan: Rp${num.toLocaleString('id-ID')}`, keyboard());
});

bot.launch();
console.log('Bot jalan.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
