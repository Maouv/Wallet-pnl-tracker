function fmtUsd(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtIdr(n) {
  return `Rp${n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmt(n, mode, idrRate) {
  if (mode === 'idr' && idrRate) return fmtIdr(n * idrRate);
  return fmtUsd(n);
}

export function formatPortfolio(portfolio, displayMode = 'usd') {
  const lines = [];
  const warn = portfolio.partial ? ' ⚠️' : '';
  const rate = portfolio.idrRate;

  lines.push(`*LP Total ${fmt(portfolio.lpTotalUsd ?? portfolio.totalUsd, displayMode, rate)}*${warn}`);

  for (const [chainKey, chainLabel] of [['eth', 'Eth'], ['sol', 'Sol']]) {
    const walletsForChain = portfolio.chains[chainKey];
    if (!walletsForChain || walletsForChain.length === 0) continue;
    lines.push(chainLabel);
    for (const w of walletsForChain) {
      const flag = w.issues.length ? ' ⚠️' : '';
      lines.push(`└ ${w.label} ${fmt(w.usd, displayMode, rate)}${flag}`);
    }
  }

  if (portfolio.manualEntries?.length) {
    lines.push('Manual');
    for (const e of portfolio.manualEntries) {
      lines.push(`└ ${e.label} ${fmt(e.usd, displayMode, rate)}`);
    }
  }

  lines.push('');
  lines.push(`*Grand Total ${fmt(portfolio.totalUsd, displayMode, rate)}*${warn}`);

  return lines.join('\n');
}

export function formatPnl({ current, lastSnapshot, firstSnapshot }, displayMode = 'usd') {
  if (!lastSnapshot) {
    return 'Belum ada baseline tersimpan. Tekan *Save* dulu setelah Refresh biar PnL bisa dihitung.';
  }

  const lines = [];
  const rate = current.idrRate;
  const f = (n) => fmt(n, displayMode, rate);

  const diffSinceLast = current.totalUsd - lastSnapshot.total_usd;
  const pctSinceLast = (diffSinceLast / lastSnapshot.total_usd) * 100;
  const sign1 = diffSinceLast >= 0 ? '+' : '';
  lines.push(`*Sejak save terakhir* (${fmtDate(lastSnapshot.ts)}):`);
  lines.push(
    `${f(lastSnapshot.total_usd)} → ${f(current.totalUsd)}  (${sign1}${f(diffSinceLast)}, ${sign1}${pctSinceLast.toFixed(2)}%)`
  );

  if (firstSnapshot && firstSnapshot.id !== lastSnapshot.id) {
    lines.push('');
    const diffLifetime = current.totalUsd - firstSnapshot.total_usd;
    const pctLifetime = (diffLifetime / firstSnapshot.total_usd) * 100;
    const sign2 = diffLifetime >= 0 ? '+' : '';
    lines.push(`*Lifetime* (sejak ${fmtDate(firstSnapshot.ts)}):`);
    lines.push(
      `${f(firstSnapshot.total_usd)} → ${f(current.totalUsd)}  (${sign2}${f(diffLifetime)}, ${sign2}${pctLifetime.toFixed(2)}%)`
    );
  }

  return lines.join('\n');
}
