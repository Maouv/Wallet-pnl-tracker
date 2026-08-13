import { getEthNativeBalance, getEthTokenBalances } from './chains/eth.js';
import { getSolNativeBalance, getSolTokenBalances } from './chains/sol.js';
import { getNativePrices, getEthTokenPrices, getSolTokenPrices } from './pricing.js';
import { getManualEntries } from './storage.js';

export async function fetchPortfolio(wallets) {
  const nativePrices = await getNativePrices();
  let partial = false;
  const issuesGlobal = [];

  if (nativePrices.ethereum == null) {
    partial = true;
    issuesGlobal.push('Harga ETH tidak bisa diambil dari CoinGecko');
  }
  if (nativePrices.solana == null) {
    partial = true;
    issuesGlobal.push('Harga SOL tidak bisa diambil dari CoinGecko');
  }

  const ethResults = [];
  for (const w of wallets.eth || []) {
    const result = await fetchEthWallet(w, nativePrices.ethereum);
    if (result.issues.length) partial = true;
    ethResults.push(result);
  }

  const solResults = [];
  for (const w of wallets.sol || []) {
    const result = await fetchSolWallet(w, nativePrices.solana);
    if (result.issues.length) partial = true;
    solResults.push(result);
  }

  const lpTotalUsd =
    ethResults.reduce((s, w) => s + w.usd, 0) + solResults.reduce((s, w) => s + w.usd, 0);

  const manualEntries = getManualEntries();
  const idrRate = nativePrices.idrRate;
  let manualTotalIdr = 0;
  let manualTotalUsd = 0;
  for (const e of manualEntries) {
    manualTotalIdr += e.idr;
    if (idrRate) manualTotalUsd += e.idr / idrRate;
  }
  if (manualEntries.length > 0 && idrRate == null) {
    partial = true;
    issuesGlobal.push('Rate IDR tidak ditemukan — manual entry tidak bisa dikonversi ke USD');
  }

  const totalUsd = lpTotalUsd + manualTotalUsd;

  return {
    totalUsd,
    lpTotalUsd,
    manualTotalIdr,
    manualTotalUsd,
    idrRate,
    manualEntries,
    partial,
    issuesGlobal,
    chains: { eth: ethResults, sol: solResults },
  };
}

async function fetchEthWallet(wallet, ethPrice) {
  const issues = [];
  let usd = 0;

  const native = await getEthNativeBalance(wallet.address, process.env.ALCHEMY_API_KEY);
  if (native.error) {
    issues.push(`Gagal ambil balance ETH native: ${native.error}`);
  } else if (ethPrice == null) {
    issues.push('Balance ETH native didapat tapi harga ETH unknown — dikecualikan dari total');
  } else {
    usd += native.balanceEth * ethPrice;
  }

  const tokenResult = await getEthTokenBalances(wallet.address, process.env.ALCHEMY_API_KEY);
  if (tokenResult.error) {
    issues.push(`Gagal ambil daftar token ERC-20: ${tokenResult.error}`);
  } else if (tokenResult.tokens.length > 0) {
    const prices = await getEthTokenPrices(tokenResult.tokens.map((t) => t.contractAddress));
    for (const t of tokenResult.tokens) {
      const price = prices[t.contractAddress];
      if (price == null) {
        issues.push(`Harga ${t.symbol} (${t.contractAddress.slice(0, 8)}...) tidak ditemukan`);
        continue;
      }
      usd += t.balance * price;
    }
  }

  return { label: wallet.label, address: wallet.address, usd, issues };
}

async function fetchSolWallet(wallet, solPrice) {
  const issues = [];
  let usd = 0;

  const native = await getSolNativeBalance(wallet.address, process.env.SOLANA_RPC_URL);
  if (native.error) {
    issues.push(`Gagal ambil balance SOL native: ${native.error}`);
  } else if (solPrice == null) {
    issues.push('Balance SOL native didapat tapi harga SOL unknown — dikecualikan dari total');
  } else {
    usd += native.balanceSol * solPrice;
  }

  const tokenResult = await getSolTokenBalances(wallet.address, process.env.SOLANA_RPC_URL);
  if (tokenResult.error) {
    issues.push(`Gagal ambil daftar SPL token: ${tokenResult.error}`);
  } else if (tokenResult.tokens.length > 0) {
    const prices = await getSolTokenPrices(tokenResult.tokens.map((t) => t.mint));
    for (const t of tokenResult.tokens) {
      const price = prices[t.mint];
      if (price == null) {
        // Expected to be common here — Meteora-adjacent meme/new tokens
        // often aren't on CoinGecko. Tahap 2 will add pool-ratio fallback.
        issues.push(`Harga token mint ${t.mint.slice(0, 8)}... tidak ditemukan`);
        continue;
      }
      usd += t.balance * price;
    }
  }

  return { label: wallet.label, address: wallet.address, usd, issues };
}
