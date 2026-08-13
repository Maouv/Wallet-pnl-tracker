const CG_BASE = 'https://api.coingecko.com/api/v3';
const DS_BASE = 'https://api.dexscreener.com';

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Native ETH + SOL price in USD + IDR rate. */
export async function getNativePrices() {
  const data = await safeFetchJson(
    `${CG_BASE}/simple/price?ids=ethereum,solana,usd-coin&vs_currencies=usd,idr`
  );
  return {
    ethereum: data?.ethereum?.usd ?? null,
    solana: data?.solana?.usd ?? null,
    idrRate: data?.['usd-coin']?.idr ?? null,
  };
}

/** DexScreener fallback: pick highest-liquidity pair's priceUsd. */
async function getDexScreenerPrice(chainId, tokenAddress) {
  const data = await safeFetchJson(`${DS_BASE}/latest/dex/tokens/${tokenAddress}`);
  if (!data?.pairs?.length) return null;
  const onChain = data.pairs.filter((p) => p.chainId === chainId);
  const pool = (onChain.length ? onChain : data.pairs).sort(
    (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
  )[0];
  return Number(pool?.priceUsd) || null;
}

/** contractAddresses: string[] (lowercase). Returns { [address]: priceUsd | null } */
export async function getEthTokenPrices(contractAddresses) {
  const result = {};
  for (const addr of contractAddresses) result[addr] = null;
  if (contractAddresses.length === 0) return result;

  const data = await safeFetchJson(
    `${CG_BASE}/simple/token_price/ethereum?contract_addresses=${contractAddresses.join(',')}&vs_currencies=usd`
  );
  const missing = [];
  for (const addr of contractAddresses) {
    const cgPrice = data?.[addr]?.usd ?? null;
    if (cgPrice != null) {
      result[addr] = cgPrice;
    } else {
      missing.push(addr);
    }
  }

  for (const addr of missing) {
    const dsPrice = await getDexScreenerPrice('ethereum', addr);
    if (dsPrice != null) result[addr] = dsPrice;
  }

  return result;
}

/** mintAddresses: string[]. Returns { [mint]: priceUsd | null } */
export async function getSolTokenPrices(mintAddresses) {
  const result = {};
  for (const mint of mintAddresses) result[mint] = null;
  if (mintAddresses.length === 0) return result;

  const data = await safeFetchJson(
    `${CG_BASE}/simple/token_price/solana?contract_addresses=${mintAddresses.join(',')}&vs_currencies=usd`
  );
  const missing = [];
  for (const mint of mintAddresses) {
    const cgPrice = data?.[mint]?.usd ?? null;
    if (cgPrice != null) {
      result[mint] = cgPrice;
    } else {
      missing.push(mint);
    }
  }

  for (const mint of missing) {
    const dsPrice = await getDexScreenerPrice('solana', mint);
    if (dsPrice != null) result[mint] = dsPrice;
  }

  return result;
}

/**
 * Fallback for tokens CoinGecko doesn't list (common for Meteora DLMM
 * meme/new-token pairs): derive price from an on-chain pool ratio against
 * a known-price base token (e.g. SOL/USDC). Stub for Tahap 2 — spot-only
 * MVP doesn't need this yet since it has no LP pools to price.
 */
export async function derivePriceFromPoolRatio(/* poolReserves, baseTokenPriceUsd */) {
  throw new Error('derivePriceFromPoolRatio belum diimplementasi — bagian Tahap 2 (LP).');
}
