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

/**
 * Renders:
 * Full Porto $100.00 (⚠️ jika partial)
 * Eth
 * └ W1 $45.00
 * Sol
 * └ W2 $55.00
 */
export function formatPortfolio(portfolio) {
  const lines = [];
  const warn = portfolio.partial ? ' ⚠️' : '';

  lines.push(`*LP Total ${fmtUsd(portfolio.lpTotalUsd ?? portfolio.totalUsd)}*${warn}`);

  for (const [chainKey, chainLabel] of [['eth', 'Eth'], ['sol', 'Sol']]) {
    const walletsForChain = portfolio.chains[chainKey];
    if (!walletsForChain || walletsForChain.length === 0) continue;
    lines.push(chainLabel);
    for (const w of walletsForChain) {
      const flag = w.issues.length ? ' ⚠️' : '';
      lines.push(`└ ${w.label} ${fmtUsd(w.usd)}${flag}`);
    }
  }

  if (portfolio.manualEntries?.length) {
    lines.push('Manual');
    for (const e of portfolio.manualEntries) {
      lines.push(`└ ${e.label} ${fmtIdr(e.idr)}`);
    }
  }

  lines.push('');
  lines.push(`*Grand Total ${fmtUsd(portfolio.totalUsd)}*${warn}`);

  const allIssues = [
    ...(portfolio.issuesGlobal || []),
    ...portfolio.chains.eth.flatMap((w) => w.issues),
    ...portfolio.chains.sol.flatMap((w) => w.issues),
  ];
  if (allIssues.length) {
    lines.push('');
    lines.push('⚠️ _Belum lengkap, total di atas adalah batas bawah:_');
    for (const issue of allIssues) lines.push(`  • ${issue}`);
  }

  return lines.join('\n');
}

export function formatPnl({ current, lastSnapshot, firstSnapshot }) {
  if (!lastSnapshot) {
    return 'Belum ada baseline tersimpan. Tekan *Save* dulu setelah Refresh biar PnL bisa dihitung.';
  }

  const lines = [];

  const diffSinceLast = current.totalUsd - lastSnapshot.total_usd;
  const pctSinceLast = (diffSinceLast / lastSnapshot.total_usd) * 100;
  const sign1 = diffSinceLast >= 0 ? '+' : '';
  lines.push(`*Sejak save terakhir* (${fmtDate(lastSnapshot.ts)}):`);
  lines.push(
    `${fmtUsd(lastSnapshot.total_usd)} → ${fmtUsd(current.totalUsd)}  (${sign1}${fmtUsd(diffSinceLast)}, ${sign1}${pctSinceLast.toFixed(2)}%)`
  );

  if (firstSnapshot && firstSnapshot.id !== lastSnapshot.id) {
    lines.push('');
    const diffLifetime = current.totalUsd - firstSnapshot.total_usd;
    const pctLifetime = (diffLifetime / firstSnapshot.total_usd) * 100;
    const sign2 = diffLifetime >= 0 ? '+' : '';
    lines.push(`*Lifetime* (sejak ${fmtDate(firstSnapshot.ts)}):`);
    lines.push(
      `${fmtUsd(firstSnapshot.total_usd)} → ${fmtUsd(current.totalUsd)}  (${sign2}${fmtUsd(diffLifetime)}, ${sign2}${pctLifetime.toFixed(2)}%)`
    );
  }

  if (current.partial || lastSnapshot.partial) {
    lines.push('');
    lines.push('⚠️ _Salah satu titik data ini tidak lengkap (lihat detail di Refresh) — persentase di atas perkiraan._');
  }

  return lines.join('\n');
}
